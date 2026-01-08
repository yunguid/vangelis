/**
 * Vangelis Audio Engine
 * Real-time synthesis with oscillators, custom samples, and recording
 */

const DEFAULT_SAMPLE_RATE = 44100;
const POOL_SIZE = 32;
const MICRO_FADE_TIME = 0.005;
const MINIMUM_GAIN = 0.0001;

const VOICE_STATE = Object.freeze({
  IDLE: 'idle',
  ATTACK: 'attack',
  DECAY: 'decay',
  SUSTAIN: 'sustain',
  RELEASE: 'release'
});

const WAVEFORM_TYPES = ['sine', 'square', 'sawtooth', 'triangle'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_OCTAVE = -1;
const MAX_OCTAVE = 7;

const NOTE_OFFSET_FROM_A = {
  'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4,
  'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Attempt an exponential ramp safely, falling back to linear if needed
 */
function safeExponentialRamp(param, value, time) {
  const safeValue = Math.max(value, MINIMUM_GAIN);
  try {
    param.exponentialRampToValueAtTime(safeValue, time);
  } catch (e) {
    param.linearRampToValueAtTime(safeValue, time);
  }
}

/**
 * Individual voice for polyphonic playback using OscillatorNode
 */
class SynthVoice {
  constructor(engine, ctx, target) {
    this.engine = engine;
    this.ctx = ctx;
    this.target = target;

    // Per-voice gain for envelope
    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(target);

    this.oscillator = null;
    this.bufferSource = null; // For custom samples
    this.noteId = null;
    this.frequency = 0;
    this.state = VOICE_STATE.IDLE;
    this.startTime = 0;
    this.velocity = 1;
    this.isCustomSample = false;
  }

  /**
   * Start a note with real-time oscillator
   */
  startOscillator({ noteId, frequency, waveformType, velocity, params }) {
    this.cleanup();

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Create oscillator
    this.oscillator = ctx.createOscillator();
    this.oscillator.type = waveformType.toLowerCase();
    this.oscillator.frequency.setValueAtTime(frequency, now);
    this.oscillator.connect(this.gainNode);

    this.noteId = noteId;
    this.frequency = frequency;
    this.velocity = clamp(velocity, 0, 1);
    this.isCustomSample = false;
    this.startTime = now;

    // Apply ADSR envelope - Attack phase
    const attack = clamp(params.attack ?? 0.05, MICRO_FADE_TIME, 5);
    const decay = clamp(params.decay ?? 0.1, 0, 5);
    const sustain = clamp(params.sustain ?? 0.7, 0, 1);
    const targetGain = clamp(params.volume ?? 0.7, 0, 1) * this.velocity;

    const gainParam = this.gainNode.gain;
    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(MINIMUM_GAIN, now);

    // Attack: ramp to full level
    safeExponentialRamp(gainParam, targetGain, now + attack);

    // Decay: ramp down to sustain level
    if (decay > 0 && sustain < 1) {
      const sustainGain = Math.max(targetGain * sustain, MINIMUM_GAIN);
      safeExponentialRamp(gainParam, sustainGain, now + attack + decay);
    }

    this.state = VOICE_STATE.ATTACK;
    this.oscillator.start(now);

    // Transition to sustain state after attack+decay
    setTimeout(() => {
      if (this.state === VOICE_STATE.ATTACK || this.state === VOICE_STATE.DECAY) {
        this.state = VOICE_STATE.SUSTAIN;
      }
    }, (attack + decay) * 1000);
  }

  /**
   * Start a custom sample
   */
  startSample({ noteId, buffer, frequency, baseFrequency, velocity, params, loop }) {
    this.cleanup();

    const ctx = this.ctx;
    const now = ctx.currentTime;

    this.bufferSource = ctx.createBufferSource();
    this.bufferSource.buffer = buffer;
    this.bufferSource.loop = loop || false;

    // Pitch shift based on frequency ratio
    if (baseFrequency && frequency) {
      this.bufferSource.playbackRate.value = frequency / baseFrequency;
    }

    this.bufferSource.connect(this.gainNode);

    this.noteId = noteId;
    this.frequency = frequency;
    this.velocity = clamp(velocity, 0, 1);
    this.isCustomSample = true;
    this.startTime = now;

    // Apply envelope
    const attack = clamp(params.attack ?? 0.01, MICRO_FADE_TIME, 5);
    const targetGain = clamp(params.volume ?? 0.7, 0, 1) * this.velocity;

    const gainParam = this.gainNode.gain;
    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(MINIMUM_GAIN, now);
    safeExponentialRamp(gainParam, targetGain, now + attack);

    this.state = VOICE_STATE.ATTACK;
    this.bufferSource.start(now);

    // Handle sample end
    this.bufferSource.onended = () => {
      if (!loop) {
        this.cleanup();
        this.engine.recycleVoice(this);
      }
    };

    setTimeout(() => {
      if (this.state === VOICE_STATE.ATTACK) {
        this.state = VOICE_STATE.SUSTAIN;
      }
    }, attack * 1000);
  }

  /**
   * Release the note - trigger release phase of envelope
   */
  release(releaseTime = 0.3) {
    if (this.state === VOICE_STATE.IDLE || this.state === VOICE_STATE.RELEASE) {
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const release = clamp(releaseTime, MICRO_FADE_TIME, 5);

    const gainParam = this.gainNode.gain;
    const currentGain = gainParam.value;

    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(Math.max(currentGain, MINIMUM_GAIN), now);
    safeExponentialRamp(gainParam, MINIMUM_GAIN, now + release);

    this.state = VOICE_STATE.RELEASE;

    // Schedule cleanup after release
    const stopTime = now + release + 0.05;

    if (this.oscillator) {
      try {
        this.oscillator.stop(stopTime);
      } catch (e) {
        // Already stopped
      }
    }

    if (this.bufferSource) {
      try {
        this.bufferSource.stop(stopTime);
      } catch (e) {
        // Already stopped
      }
    }

    setTimeout(() => {
      this.cleanup();
      this.engine.recycleVoice(this);
    }, (release + 0.1) * 1000);
  }

  /**
   * Immediately stop the voice
   */
  stop() {
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Quick fade to avoid clicks
    const gainParam = this.gainNode.gain;
    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(Math.max(gainParam.value, MINIMUM_GAIN), now);
    safeExponentialRamp(gainParam, MINIMUM_GAIN, now + MICRO_FADE_TIME);

    setTimeout(() => {
      this.cleanup();
      this.engine.recycleVoice(this);
    }, MICRO_FADE_TIME * 1000 + 50);
  }

  cleanup() {
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (e) {
        // Ignore
      }
      this.oscillator = null;
    }

    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
        this.bufferSource.disconnect();
      } catch (e) {
        // Ignore
      }
      this.bufferSource = null;
    }

    this.noteId = null;
    this.state = VOICE_STATE.IDLE;
  }
}

/**
 * Distortion curve cache for wave shaper
 */
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

/**
 * Main Audio Engine
 */
class AudioEngine {
  constructor() {
    this.context = null;
    this.contextPromise = null;
    this.graphReady = false;

    this.statusListeners = new Set();
    this.status = {
      wasmReady: true, // Not using WASM for oscillators anymore
      contextReady: false,
      graphWarmed: false,
      error: null
    };

    // Audio nodes
    this.globalNodes = null;
    this.currentParams = null;
    this.lastParamSignature = '';

    // Voice management
    this.voices = [];
    this.freeVoices = [];
    this.activeVoices = new Map();
    this.voiceSerial = 0;

    // Custom samples
    this.customSample = null;
    this.customSampleBaseFrequency = 261.63; // C4
    this.customSampleLoop = false;

    // Recording
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.recordingListeners = new Set();

    // Utilities
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
    // No WASM needed for oscillator-based synthesis
    this.status.wasmReady = true;
    return Promise.resolve();
  }

  async ensureAudioContext() {
    if (this.contextPromise) {
      return this.contextPromise;
    }

    this.contextPromise = Promise.resolve().then(() => {
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
      this.ensureVoicePool(ctx);

      if (ctx.state === 'running') {
        this.markGraphReady();
      }

      return ctx;
    }).catch((err) => {
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

    // Input bus for all voices
    const inputBus = ctx.createGain();
    inputBus.gain.value = 1;

    // Compressor for dynamics control (gentle settings to avoid killing quiet sounds)
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 30;
    compressor.ratio.value = 2;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    // Distortion
    const distortion = ctx.createWaveShaper();
    distortion.curve = this.distortionCache.get(0);
    distortion.oversample = '4x';

    // Delay
    const delayNode = ctx.createDelay(5);
    delayNode.delayTime.value = 0;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0;

    // Reverb (simple convolver)
    const reverbNode = ctx.createConvolver();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0;
    this.ensureImpulse(ctx, reverbNode);

    // Master gain
    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;

    // Stereo panner
    const stereoPanner = ctx.createStereoPanner();

    // Analyser for visualization
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;

    // Recording destination
    const recordingDest = ctx.createMediaStreamDestination();

    // Connect the graph
    // Main path: input -> compressor -> distortion -> master
    inputBus.connect(compressor);
    compressor.connect(distortion);
    distortion.connect(masterGain);

    // Delay path: distortion -> delay -> delayFeedback -> delay (loop)
    //                               -> delayWet -> master
    distortion.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayWet);
    delayWet.connect(masterGain);

    // Reverb path: input -> reverb -> reverbGain -> master
    inputBus.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);

    // Output path: master -> panner -> analyser -> destination
    masterGain.connect(stereoPanner);
    stereoPanner.connect(analyser);
    analyser.connect(ctx.destination);

    // Also connect to recording destination
    analyser.connect(recordingDest);

    this.globalNodes = {
      inputBus,
      compressor,
      distortion,
      delayNode,
      delayFeedback,
      delayWet,
      reverbNode,
      reverbGain,
      masterGain,
      stereoPanner,
      analyser,
      recordingDest
    };

    return this.globalNodes;
  }

  ensureImpulse(ctx, reverbNode) {
    const seconds = 1.4;
    const channels = 2;
    const length = ctx.sampleRate * seconds;
    const impulse = ctx.createBuffer(channels, length, ctx.sampleRate);

    for (let channel = 0; channel < channels; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponential decay with random noise
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    reverbNode.buffer = impulse;
  }

  // ============ Voice Pool ============

  ensureVoicePool(ctx) {
    if (this.voices.length) return;

    const nodes = this.setupGraph(ctx);
    for (let i = 0; i < POOL_SIZE; i++) {
      const voice = new SynthVoice(this, ctx, nodes.inputBus);
      this.voices.push(voice);
      this.freeVoices.push(voice);
    }
  }

  acquireVoice(noteId) {
    // Check if we already have a voice for this note
    if (this.activeVoices.has(noteId)) {
      return null; // Don't double-trigger
    }

    if (!this.freeVoices.length) {
      const stolen = this.stealVoice();
      if (!stolen) return null;
      this.activeVoices.set(noteId, stolen);
      return stolen;
    }

    const voice = this.freeVoices.pop();
    this.activeVoices.set(noteId, voice);
    return voice;
  }

  recycleVoice(voice) {
    // Clean up any stale references (voice might already be removed from activeVoices)
    if (voice.noteId && this.activeVoices.get(voice.noteId) === voice) {
      this.activeVoices.delete(voice.noteId);
    }
    voice.noteId = null;

    if (!this.freeVoices.includes(voice)) {
      this.freeVoices.push(voice);
    }
  }

  stealVoice() {
    if (!this.voices.length) return null;

    // Find oldest voice or idle voice
    let candidate = null;
    for (const voice of this.voices) {
      if (voice.state === VOICE_STATE.IDLE) {
        candidate = voice;
        break;
      }
      if (!candidate || voice.startTime < candidate.startTime) {
        candidate = voice;
      }
    }

    if (candidate) {
      candidate.stop();
      if (candidate.noteId) {
        this.activeVoices.delete(candidate.noteId);
      }
    }

    return candidate;
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

  sanitizeParams(params) {
    return {
      volume: clamp(params.volume ?? 0.7, 0, 1),
      delay: clamp(params.delay ?? 0, 0, 500),
      reverb: clamp(params.reverb ?? 0, 0, 1),
      distortion: clamp(params.distortion ?? 0, 0, 1),
      pan: clamp(params.pan ?? 0.5, 0, 1),
      attack: clamp(params.attack ?? 0.05, MICRO_FADE_TIME, 5),
      decay: clamp(params.decay ?? 0.1, 0, 5),
      sustain: clamp(params.sustain ?? 0.7, 0, 1),
      release: clamp(params.release ?? 0.3, MICRO_FADE_TIME, 5),
      useADSR: params.useADSR !== false
    };
  }

  paramsSignature(params) {
    return Object.values(params).map(v =>
      typeof v === 'number' ? v.toFixed(4) : String(v)
    ).join('|');
  }

  updateGlobalParams(params) {
    const ctx = this.context;
    if (!ctx || !this.globalNodes) return;

    const sanitized = this.sanitizeParams(params);
    const signature = this.paramsSignature(sanitized);
    if (signature === this.lastParamSignature) {
      this.currentParams = sanitized;
      return;
    }

    const nodes = this.globalNodes;
    const now = ctx.currentTime;

    // Master volume
    nodes.masterGain.gain.cancelScheduledValues(now);
    nodes.masterGain.gain.setTargetAtTime(sanitized.volume, now, 0.01);

    // Delay
    const delayTime = sanitized.delay / 1000;
    nodes.delayNode.delayTime.cancelScheduledValues(now);
    nodes.delayNode.delayTime.setTargetAtTime(delayTime, now, 0.05);

    const feedback = clamp(sanitized.delay / 400, 0, 0.7);
    nodes.delayFeedback.gain.cancelScheduledValues(now);
    nodes.delayFeedback.gain.setTargetAtTime(feedback, now, 0.1);

    const delayWetLevel = delayTime > 0.01 ? 0.5 : 0;
    nodes.delayWet.gain.cancelScheduledValues(now);
    nodes.delayWet.gain.setTargetAtTime(delayWetLevel, now, 0.05);

    // Reverb
    nodes.reverbGain.gain.cancelScheduledValues(now);
    nodes.reverbGain.gain.setTargetAtTime(sanitized.reverb, now, 0.1);

    // Distortion
    nodes.distortion.curve = this.distortionCache.get(sanitized.distortion);

    // Pan
    const panValue = (sanitized.pan - 0.5) * 2;
    nodes.stereoPanner.pan.cancelScheduledValues(now);
    nodes.stereoPanner.pan.setTargetAtTime(panValue, now, 0.05);

    this.currentParams = sanitized;
    this.lastParamSignature = signature;
  }

  setGlobalParams(params) {
    this.updateGlobalParams(params);
  }

  // ============ Note Playback ============

  async playFrequency({ noteId, frequency, waveformType, params = {}, velocity = 1 }) {
    await this.ensureAudioContext();
    this.ensureVoicePool(this.context);

    const sanitized = this.sanitizeParams(params);
    this.updateGlobalParams(sanitized);

    const voiceId = noteId || `voice-${++this.voiceSerial}`;
    const voice = this.acquireVoice(voiceId);
    if (!voice) return null;

    // Use custom sample if loaded, otherwise use oscillator
    if (this.customSample) {
      voice.startSample({
        noteId: voiceId,
        buffer: this.customSample,
        frequency,
        baseFrequency: this.customSampleBaseFrequency,
        velocity,
        params: sanitized,
        loop: this.customSampleLoop
      });
    } else {
      voice.startOscillator({
        noteId: voiceId,
        frequency,
        waveformType: waveformType || 'sine',
        velocity,
        params: sanitized
      });
    }

    return {
      voiceId,
      analyser: this.globalNodes?.analyser
    };
  }

  stopNote(noteId) {
    const voice = this.activeVoices.get(noteId);
    if (voice) {
      // Remove from activeVoices immediately so the note can be replayed
      this.activeVoices.delete(noteId);
      const releaseTime = this.currentParams?.release ?? 0.3;
      voice.release(releaseTime);
    }
  }

  getAnalyser() {
    return this.globalNodes?.analyser || null;
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
    this.customSample = null;
    this.status.hasCustomSample = false;
    this.notify();
  }

  // ============ Recording ============

  async startRecording() {
    if (this.isRecording) return;

    await this.ensureAudioContext();
    const nodes = this.globalNodes;
    if (!nodes) return;

    this.recordedChunks = [];

    const stream = nodes.recordingDest.stream;
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.exportRecording();
    };

    this.mediaRecorder.start(100); // Collect data every 100ms
    this.isRecording = true;
    this.notifyRecording();
    this.notify();
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;

    this.mediaRecorder.stop();
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
    if (this.recordedChunks.length === 0) return;

    const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);

    // Create download link and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `vangelis-recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Cleanup
    URL.revokeObjectURL(url);
    this.recordedChunks = [];
  }
}

export const audioEngine = new AudioEngine();
