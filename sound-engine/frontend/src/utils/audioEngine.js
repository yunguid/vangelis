/**
 * Vangelis Audio Engine
 * AudioWorklet-based polyphonic synth + Web Audio FX + sample playback
 */

import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_TRANSPORT_TEMPO,
  applyEffectToggleState,
  sanitizeAudioParams,
  WORKLET_PARAM_DEFAULTS
} from './audioParams.js';
import {
  DEFAULT_SAMPLE_RATE,
  SAMPLE_VOICE_POOL
} from './audioEngine/constants.js';
import { createAudioGraph } from './audioEngine/graph.js';
import { createSampleVoicePool } from './audioEngine/samplePool.js';
import { RecorderController } from './audioEngine/recorder.js';
import { applyGlobalParams, DistortionCurveCache, paramsSignature } from './audioEngine/effects.js';
import { buildFrequencyTable, getFrequencyFromTable } from './audioEngine/frequency.js';
import {
  DelayWorklet,
  DELAY_WORKLET_DEFAULTS,
  ReverbWorklet,
  REVERB_WORKLET_DEFAULTS,
  SynthWorklet
} from './audioEngine/worklets.js';
import { clamp } from './math.js';

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
      error: null,
      hasVoicePhrase: false
    };

    this.globalNodes = null;
    this.currentParams = applyEffectToggleState(sanitizeAudioParams(AUDIO_PARAM_DEFAULTS));
    this.lastParamSignature = '';
    this.transportTempoBpm = DEFAULT_TRANSPORT_TEMPO;

    this.worklet = new SynthWorklet(WORKLET_PARAM_DEFAULTS);
    this.delayWorklet = new DelayWorklet(DELAY_WORKLET_DEFAULTS);
    this.reverbWorklet = new ReverbWorklet(REVERB_WORKLET_DEFAULTS);

    this.recorder = new RecorderController({
      onStop: () => this.exportRecording()
    });

    this.samplePool = null;
    this.voiceSerial = 0;

    this.customSample = null;
    this.customSampleBaseFrequency = 261.63; // C4
    this.customSampleLoop = false;
    this.voicePhrase = {
      enabled: false,
      chunks: [],
      nextIndex: 0,
      baseFrequency: 261.63,
      lastChunk: null,
      sourceText: ''
    };

    this.isRecording = false;
    this.recordingListeners = new Set();
    this.voicePhraseListeners = new Set();
    this.activityListeners = new Set();
    this.activeVoiceIds = new Set();
    this.audioActivity = {
      isActive: false,
      activeVoices: 0,
      updatedAt: Date.now()
    };

    this.distortionCache = new DistortionCurveCache();
    this.frequencyTable = buildFrequencyTable();
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
      hasCustomSample: !!this.customSample,
      hasVoicePhrase: this.voicePhrase.enabled && this.voicePhrase.chunks.length > 0
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

  subscribeVoicePhrase(listener) {
    this.voicePhraseListeners.add(listener);
    listener(this.getVoicePhraseStatus());
    return () => this.voicePhraseListeners.delete(listener);
  }

  notifyVoicePhrase() {
    const snapshot = this.getVoicePhraseStatus();
    for (const listener of this.voicePhraseListeners) {
      listener(snapshot);
    }
    this.notify();
  }

  getVoicePhraseStatus() {
    return {
      enabled: this.voicePhrase.enabled,
      chunkCount: this.voicePhrase.chunks.length,
      nextIndex: this.voicePhrase.nextIndex,
      lastChunk: this.voicePhrase.lastChunk,
      sourceText: this.voicePhrase.sourceText
    };
  }

  subscribeActivity(listener) {
    this.activityListeners.add(listener);
    listener(this.getActivity());
    return () => this.activityListeners.delete(listener);
  }

  notifyActivity() {
    const snapshot = this.getActivity();
    for (const listener of this.activityListeners) {
      listener(snapshot);
    }
  }

  getActivity() {
    return { ...this.audioActivity };
  }

  syncActivity() {
    const activeVoices = this.activeVoiceIds.size;
    const isActive = activeVoices > 0;
    if (
      this.audioActivity.activeVoices === activeVoices &&
      this.audioActivity.isActive === isActive
    ) {
      return;
    }

    this.audioActivity = {
      isActive,
      activeVoices,
      updatedAt: Date.now()
    };
    this.notifyActivity();
  }

  markVoiceStarted(voiceId) {
    if (!voiceId) return;
    this.activeVoiceIds.add(voiceId);
    this.syncActivity();
  }

  markVoiceStopped(voiceId) {
    if (!voiceId) return;
    this.activeVoiceIds.delete(voiceId);
    this.syncActivity();
  }

  clearActiveVoices() {
    if (this.activeVoiceIds.size === 0) return;
    this.activeVoiceIds.clear();
    this.syncActivity();
  }

  // ============ Audio Context Setup ============

  async ensureWasm() {
    return this.ensureWorklet();
  }

  async ensureWorklet() {
    try {
      const ctx = await this.ensureAudioContext();
      const nodes = this.setupGraph(ctx);
      await this.worklet.ensure(ctx, nodes.inputBus);

      if (!this.status.wasmReady) {
        this.status.wasmReady = true;
        this.notify();
      }

      return this.worklet;
    } catch (err) {
      this.reportStatusError('AUDIO_WORKLET_FAILED', 'Failed to initialize audio worklet', err);
      throw err;
    }
  }

  async ensureEffectWorklet({
    ctx,
    worklet,
    sourceNode,
    destinationNode,
    errorType,
    errorMessage
  }) {
    try {
      const nodes = this.setupGraph(ctx);
      await worklet.ensure(ctx, nodes[sourceNode], nodes[destinationNode]);
      return worklet;
    } catch (err) {
      this.reportStatusError(errorType, errorMessage, err);
      throw err;
    }
  }

  ensureDelayWorklet(ctx = this.context) {
    if (!ctx) return Promise.resolve(null);
    return this.ensureEffectWorklet({
      ctx,
      worklet: this.delayWorklet,
      sourceNode: 'delaySend',
      destinationNode: 'delayWet',
      errorType: 'DELAY_WORKLET_FAILED',
      errorMessage: 'Failed to initialize delay effect'
    });
  }

  ensureReverbWorklet(ctx = this.context) {
    if (!ctx) return Promise.resolve(null);
    return this.ensureEffectWorklet({
      ctx,
      worklet: this.reverbWorklet,
      sourceNode: 'reverbSend',
      destinationNode: 'reverbWet',
      errorType: 'REVERB_WORKLET_FAILED',
      errorMessage: 'Failed to initialize reverb effect'
    });
  }

  scheduleEnabledEffectWorklets(params, ctx = this.context) {
    if (!ctx || !params) return;
    if (params.delayEnabled && params.delayMix > 0.001) {
      this.ensureDelayWorklet(ctx).catch(() => {});
    }
    if (params.reverbEnabled && params.reverbMix > 0.001) {
      this.ensureReverbWorklet(ctx).catch(() => {});
    }
  }

  reportStatusError(type, message, err) {
    this.status.error = {
      type,
      message,
      detail: err.message,
      timestamp: Date.now()
    };
    this.notify();
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
        this.scheduleEnabledEffectWorklets(this.currentParams, ctx);
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
    if (this.currentParams) {
      this.lastParamSignature = '';
      this.applyGlobalParams(this.currentParams);
    }
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

  getFrequency(noteName, octave) {
    return getFrequencyFromTable(this.frequencyTable, noteName, octave);
  }

  // ============ Parameter Management ============

  applyGlobalParams(sanitized) {
    const effective = applyEffectToggleState(sanitized);
    this.currentParams = effective;

    const ctx = this.context;
    const nodes = this.globalNodes;
    if (!ctx || !nodes) {
      this.lastParamSignature = '';
      return;
    }

    this.scheduleEnabledEffectWorklets(effective, ctx);

    const signature = paramsSignature(effective);
    if (signature === this.lastParamSignature) {
      return;
    }

    applyGlobalParams({
      params: effective,
      transportTempoBpm: this.transportTempoBpm,
      ctx,
      nodes,
      distortionCache: this.distortionCache,
      delayWorklet: this.delayWorklet,
      reverbWorklet: this.reverbWorklet,
      synthWorklet: this.worklet
    });
    this.lastParamSignature = signature;
  }

  setGlobalParams(params) {
    this.applyGlobalParams(sanitizeAudioParams(params));
  }

  setTransportTempo(bpm) {
    const nextTempo = clamp(
      Number.isFinite(bpm) ? bpm : DEFAULT_TRANSPORT_TEMPO,
      40,
      280
    );
    if (Math.abs(nextTempo - this.transportTempoBpm) < 0.01) return;
    this.transportTempoBpm = nextTempo;
    if (this.currentParams) {
      this.lastParamSignature = '';
      this.applyGlobalParams(this.currentParams);
    }
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
    this.markVoiceStarted(voiceId);

    return {
      voiceId,
      analyser: this.globalNodes?.analyser
    };
  }

  playFrequency({ noteId, frequency, waveformType, params = {}, velocity = 1, allowVoicePhrase = true }) {
    if (!this.context) {
      this.ensureAudioContext().catch(() => {});
      return null;
    }

    this.ensureSamplePool(this.context);

    if (allowVoicePhrase && this.voicePhrase.enabled && this.voicePhrase.chunks.length > 0) {
      const chunk = this.voicePhrase.chunks[this.voicePhrase.nextIndex] || this.voicePhrase.chunks[0];
      this.voicePhrase.nextIndex = (this.voicePhrase.nextIndex + 1) % this.voicePhrase.chunks.length;
      this.voicePhrase.lastChunk = {
        id: chunk.id,
        label: chunk.label,
        phonemes: chunk.phonemes
      };
      this.notifyVoicePhrase();

      return this.playBufferedSample({
        noteId,
        buffer: chunk.buffer,
        frequency,
        baseFrequency: this.voicePhrase.baseFrequency,
        velocity,
        params,
        loop: false
      });
    }

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
    this.markVoiceStarted(voiceId);

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
    this.markVoiceStopped(noteId);
  }

  setPitchBend(semitones) {
    this.worklet.setPitchBend(semitones);
  }

  setModWheel(value) {
    this.worklet.setModWheel(value);
  }

  stopAllNotes() {
    this.worklet.allNotesOff();
    if (this.samplePool) {
      const releaseTime = this.currentParams?.release ?? AUDIO_PARAM_DEFAULTS.release;
      this.samplePool.releaseAll(releaseTime);
    }
    this.clearActiveVoices();
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

  setVoicePhrase({ chunks, sourceText = '', enabled = true, baseFrequency = 261.63 } = {}) {
    const nextChunks = Array.isArray(chunks)
      ? chunks.filter((chunk) => chunk?.buffer)
      : [];

    this.voicePhrase = {
      enabled: enabled && nextChunks.length > 0,
      chunks: nextChunks,
      nextIndex: 0,
      baseFrequency,
      lastChunk: null,
      sourceText
    };
    this.status.hasVoicePhrase = this.voicePhrase.enabled;
    this.notifyVoicePhrase();
  }

  setVoicePhraseEnabled(enabled) {
    if (this.voicePhrase.chunks.length === 0) {
      this.voicePhrase.enabled = false;
    } else {
      this.voicePhrase.enabled = !!enabled;
    }
    this.status.hasVoicePhrase = this.voicePhrase.enabled;
    this.notifyVoicePhrase();
  }

  clearVoicePhrase() {
    this.voicePhrase = {
      enabled: false,
      chunks: [],
      nextIndex: 0,
      baseFrequency: 261.63,
      lastChunk: null,
      sourceText: ''
    };
    this.status.hasVoicePhrase = false;
    this.notifyVoicePhrase();
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
