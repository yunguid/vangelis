/**
 * Vangelis Audio Engine
 * AudioWorklet-based polyphonic synth + Web Audio FX + sample playback
 */

import {
  AUDIO_PARAM_DEFAULTS,
  sanitizeAudioParams,
  toWorkletParams,
  WORKLET_PARAM_DEFAULTS
} from './audioParams.js';
import {
  DEFAULT_SAMPLE_RATE,
  SAMPLE_VOICE_POOL,
  WORKLET_PROCESSOR,
  WORKLET_URL,
  NOTE_NAMES,
  MIN_OCTAVE,
  MAX_OCTAVE,
  NOTE_OFFSET_FROM_A
} from './audioEngine/constants.js';
import { createAudioGraph } from './audioEngine/graph.js';
import { createSampleVoicePool } from './audioEngine/samplePool.js';
import { RecorderController } from './audioEngine/recorder.js';
import { clamp } from './math.js';

class SynthWorklet {
  constructor(paramDefaults) {
    this.node = null;
    this.readyPromise = null;
    this.ready = false;
    this.paramDefaults = paramDefaults;
  }

  async ensure(ctx, destination) {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      if (!ctx.audioWorklet || !ctx.audioWorklet.addModule) {
        throw new Error('AudioWorklet not supported');
      }

      await ctx.audioWorklet.addModule(WORKLET_URL);

      this.node = new AudioWorkletNode(ctx, WORKLET_PROCESSOR, {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        processorOptions: {
          paramDefaults: this.paramDefaults
        }
      });
      this.node.connect(destination);
      this.ready = true;
    })();

    return this.readyPromise;
  }

  setParams(params) {
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'setParams',
      params
    });
  }

  noteOn({ noteId, frequency, waveform, velocity }) {
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'noteOn',
      noteId,
      frequency,
      waveform,
      velocity
    });
  }

  noteOff(noteId) {
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'noteOff',
      noteId
    });
  }

  allNotesOff() {
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'allNotesOff'
    });
  }
}

class DistortionCurveCache {
  constructor(resolution = 44100) {
    this.resolution = resolution;
    this.cache = new Map();
  }

  get(amount) {
    const normalized = clamp(amount ?? 0, 0, 1);
    const key = Math.round(normalized * 1000) / 1000;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const curve = new Float32Array(this.resolution);
    if (key === 0) {
      for (let i = 0; i < this.resolution; i++) {
        curve[i] = (i * 2) / this.resolution - 1;
      }
    } else {
      const k = key * 150;
      const deg = Math.PI / 180;
      for (let i = 0; i < this.resolution; i++) {
        const x = (i * 2) / this.resolution - 1;
        curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
      }
    }

    this.cache.set(key, curve);
    return curve;
  }
}

class AudioEngine {
  constructor() {
    this.context = null;
    this.contextPromise = null;
    this.graphReady = false;

    this.statusListeners = new Set();
    this.status = {
      wasmReady: false,
      contextReady: false,
      graphWarmed: false,
      error: null
    };

    this.globalNodes = null;
    this.currentParams = sanitizeAudioParams(AUDIO_PARAM_DEFAULTS);
    this.lastParamSignature = '';

    this.worklet = new SynthWorklet(WORKLET_PARAM_DEFAULTS);
    this.workletReadyPromise = null;

    this.recorder = new RecorderController({
      onStop: () => this.exportRecording()
    });

    this.samplePool = null;
    this.voiceSerial = 0;

    this.customSample = null;
    this.customSampleBaseFrequency = 261.63; // C4
    this.customSampleLoop = false;

    this.isRecording = false;
    this.recordingListeners = new Set();

    this.distortionCache = new DistortionCurveCache();
    this.frequencyTable = this.buildFrequencyTable();
  }

  // ============ Status Management ============

  subscribe(listener) {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  notify() {
    const snapshot = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(snapshot);
    }
  }

  getStatus() {
    return {
      ...this.status,
      isRecording: this.isRecording,
      hasCustomSample: !!this.customSample
    };
  }

  subscribeRecording(listener) {
    this.recordingListeners.add(listener);
    return () => this.recordingListeners.delete(listener);
  }

  notifyRecording() {
    for (const listener of this.recordingListeners) {
      listener(this.isRecording);
    }
  }

  // ============ Audio Context Setup ============

  async ensureWasm() {
    return this.ensureWorklet();
  }

  async ensureWorklet() {
    if (this.workletReadyPromise) {
      return this.workletReadyPromise;
    }

    this.workletReadyPromise = this.ensureAudioContext()
      .then(async (ctx) => {
        const nodes = this.setupGraph(ctx);
        await this.worklet.ensure(ctx, nodes.inputBus);
        this.status.wasmReady = true;
        this.notify();
        if (this.currentParams) {
          this.worklet.setParams(toWorkletParams(this.currentParams));
        }
      })
      .catch((err) => {
        this.status.error = {
          type: 'AUDIO_WORKLET_FAILED',
          message: 'Failed to initialize audio worklet',
          detail: err.message,
          timestamp: Date.now()
        };
        this.notify();
        throw err;
      });

    return this.workletReadyPromise;
  }

  async ensureRecorder(ctx) {
    const nodes = this.setupGraph(ctx);
    return this.recorder.ensure(ctx, nodes);
  }

  async ensureAudioContext() {
    if (this.contextPromise) {
      return this.contextPromise;
    }

    this.contextPromise = Promise.resolve()
      .then(() => {
        let ctx;
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)({
            latencyHint: 'interactive',
            sampleRate: DEFAULT_SAMPLE_RATE
          });
        } catch (err) {
          try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
          } catch (fallbackErr) {
            throw new Error('Web Audio API not supported');
          }
        }

        this.context = ctx;
        this.status.contextReady = true;
        this.notify();

        this.installUnlockHandlers();
        this.setupGraph(ctx);
        this.ensureSamplePool(ctx);

        if (ctx.state === 'running') {
          this.markGraphReady();
        }

        return ctx;
      })
      .catch((err) => {
        this.status.error = {
          type: 'AUDIO_CONTEXT_FAILED',
          message: 'Failed to initialize audio',
          detail: err.message,
          timestamp: Date.now()
        };
        this.notify();
        throw err;
      });

    return this.contextPromise;
  }

  installUnlockHandlers() {
    if (typeof window === 'undefined') return;

    const resume = async () => {
      if (this.context?.state === 'suspended') {
        try {
          await this.context.resume();
        } catch (e) {
          // Ignore
        }
      }
      if (this.context?.state === 'running') {
        this.markGraphReady();
      }
    };

    ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach((event) => {
      window.addEventListener(event, resume, { passive: true, once: true });
    });
  }

  markGraphReady() {
    if (this.graphReady) return;
    this.graphReady = true;
    this.status.graphWarmed = true;
    this.notify();
  }

  async warmGraph() {
    await this.ensureAudioContext();
    this.markGraphReady();
  }

  // ============ Audio Graph ============

  setupGraph(ctx) {
    if (this.globalNodes) {
      return this.globalNodes;
    }

    this.globalNodes = createAudioGraph(ctx, this.distortionCache);
    return this.globalNodes;
  }

  // ============ Sample Voice Pool ============

  ensureSamplePool(ctx) {
    if (this.samplePool) return;

    const nodes = this.setupGraph(ctx);
    this.samplePool = createSampleVoicePool({
      ctx,
      inputBus: nodes.inputBus,
      poolSize: SAMPLE_VOICE_POOL
    });
  }

  // ============ Frequency Table ============

  buildFrequencyTable() {
    const table = new Map();
    for (let octave = MIN_OCTAVE; octave <= MAX_OCTAVE; octave++) {
      for (const name of NOTE_NAMES) {
        const semitoneOffset = (octave - 4) * 12 + NOTE_OFFSET_FROM_A[name];
        const frequency = 440 * Math.pow(2, semitoneOffset / 12);
        table.set(`${name}${octave}`, frequency);
      }
    }
    return table;
  }

  getFrequency(noteName, octave) {
    return this.frequencyTable.get(`${noteName}${octave}`) || null;
  }

  // ============ Parameter Management ============

  paramsSignature(params) {
    return Object.values(params).map((value) =>
      typeof value === 'number' ? value.toFixed(4) : String(value)
    ).join('|');
  }

  applyGlobalParams(sanitized) {
    const ctx = this.context;
    if (!ctx || !this.globalNodes) return;

    const signature = this.paramsSignature(sanitized);
    if (signature === this.lastParamSignature) {
      this.currentParams = sanitized;
      return;
    }

    const nodes = this.globalNodes;
    const now = ctx.currentTime;

    nodes.masterGain.gain.cancelScheduledValues(now);
    nodes.masterGain.gain.setTargetAtTime(sanitized.volume, now, 0.01);

    const delayTime = sanitized.delay / 1000;
    nodes.delayNode.delayTime.cancelScheduledValues(now);
    nodes.delayNode.delayTime.setTargetAtTime(delayTime, now, 0.05);

    const feedback = clamp(sanitized.delay / 400, 0, 0.7);
    nodes.delayFeedback.gain.cancelScheduledValues(now);
    nodes.delayFeedback.gain.setTargetAtTime(feedback, now, 0.1);

    const delayWetLevel = delayTime > 0.01 ? 0.5 : 0;
    nodes.delayWet.gain.cancelScheduledValues(now);
    nodes.delayWet.gain.setTargetAtTime(delayWetLevel, now, 0.05);

    nodes.reverbGain.gain.cancelScheduledValues(now);
    nodes.reverbGain.gain.setTargetAtTime(sanitized.reverb, now, 0.1);

    nodes.distortion.curve = this.distortionCache.get(sanitized.distortion);

    const panValue = (sanitized.pan - 0.5) * 2;
    nodes.stereoPanner.pan.cancelScheduledValues(now);
    nodes.stereoPanner.pan.setTargetAtTime(panValue, now, 0.05);

    if (this.worklet.ready) {
      this.worklet.setParams(toWorkletParams(sanitized));
    }

    this.currentParams = sanitized;
    this.lastParamSignature = signature;
  }

  setGlobalParams(params) {
    this.applyGlobalParams(sanitizeAudioParams(params));
  }

  // ============ Note Playback ============

  playBufferedSample({ noteId, buffer, frequency, baseFrequency, params = {}, velocity = 1, loop = false }) {
    if (!buffer) return null;
    if (!this.context) {
      this.ensureAudioContext().catch(() => {});
      return null;
    }

    this.ensureSamplePool(this.context);

    const sanitized = sanitizeAudioParams(params);
    this.applyGlobalParams(sanitized);

    const voiceId = noteId || `sample-${++this.voiceSerial}`;
    const voice = this.samplePool?.acquire(voiceId);
    if (!voice) return null;

    voice.startSample({
      noteId: voiceId,
      buffer,
      frequency,
      baseFrequency,
      velocity,
      params: sanitized,
      loop
    });

    return {
      voiceId,
      analyser: this.globalNodes?.analyser
    };
  }

  playFrequency({ noteId, frequency, waveformType, params = {}, velocity = 1 }) {
    if (!this.context) {
      this.ensureAudioContext().catch(() => {});
      return null;
    }

    this.ensureSamplePool(this.context);

    if (!this.customSample && !this.worklet.ready) {
      this.ensureWorklet().catch(() => {});
      return null;
    }

    if (this.customSample) {
      return this.playBufferedSample({
        noteId,
        buffer: this.customSample,
        frequency,
        baseFrequency: this.customSampleBaseFrequency,
        velocity,
        params,
        loop: this.customSampleLoop
      });
    }

    const sanitized = sanitizeAudioParams(params);
    this.applyGlobalParams(sanitized);

    const voiceId = noteId || `voice-${++this.voiceSerial}`;

    this.worklet.noteOn({
      noteId: voiceId,
      frequency,
      waveform: waveformType || 'sine',
      velocity
    });

    return {
      voiceId,
      analyser: this.globalNodes?.analyser
    };
  }

  stopNote(noteId) {
    if (!noteId) return;

    if (this.samplePool) {
      const releaseTime = this.currentParams?.release ?? AUDIO_PARAM_DEFAULTS.release;
      this.samplePool.release(noteId, releaseTime);
    }

    this.worklet.noteOff(noteId);
  }

  stopAllNotes() {
    this.worklet.allNotesOff();
    if (this.samplePool) {
      const releaseTime = this.currentParams?.release ?? AUDIO_PARAM_DEFAULTS.release;
      this.samplePool.releaseAll(releaseTime);
    }
  }

  getAnalyser() {
    return this.globalNodes?.analyser || null;
  }

  getAnalysisNodes() {
    if (!this.globalNodes) return null;
    return {
      analyser: this.globalNodes.analyser,
      leftAnalyser: this.globalNodes.leftAnalyser,
      rightAnalyser: this.globalNodes.rightAnalyser
    };
  }

  // ============ Custom Sample Support ============

  async loadCustomSample(file) {
    const ctx = await this.ensureAudioContext();

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

          this.customSample = audioBuffer;
          this.status.hasCustomSample = true;
          this.notify();

          resolve({
            duration: audioBuffer.duration,
            sampleRate: audioBuffer.sampleRate,
            channels: audioBuffer.numberOfChannels
          });
        } catch (err) {
          reject(new Error('Failed to decode audio file: ' + err.message));
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  setCustomSampleBaseNote(noteName, octave) {
    const freq = this.getFrequency(noteName, octave);
    if (freq) {
      this.customSampleBaseFrequency = freq;
    }
  }

  setCustomSampleLoop(loop) {
    this.customSampleLoop = !!loop;
  }

  clearCustomSample() {
    if (this.samplePool) {
      this.samplePool.stopAll();
    }
    this.customSample = null;
    this.status.hasCustomSample = false;
    this.notify();
  }

  // ============ Recording ============

  async startRecording() {
    if (this.isRecording) return;

    await this.ensureAudioContext();
    if (!this.context) return;
    await this.ensureRecorder(this.context);

    this.recorder.start();
    this.isRecording = true;
    this.notifyRecording();
    this.notify();
  }

  stopRecording() {
    if (!this.isRecording) return;

    this.recorder.stop();
    this.isRecording = false;
    this.notifyRecording();
    this.notify();
  }

  toggleRecording() {
    if (this.isRecording) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  exportRecording() {
    if (!this.context) return;
    const wavBuffer = this.recorder.exportWav(this.context.sampleRate);
    if (!wavBuffer) return;

    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `vangelis-recording-${Date.now()}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }
}

export const audioEngine = new AudioEngine();
