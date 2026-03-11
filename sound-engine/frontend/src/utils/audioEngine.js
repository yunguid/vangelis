/**
 * Vangelis Audio Engine
 * AudioWorklet-based polyphonic synth + Web Audio FX + sample playback
 */

import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_TRANSPORT_TEMPO,
  getDelaySeconds,
  sanitizeAudioParams,
  toWorkletParams,
  WORKLET_PARAM_DEFAULTS
} from './audioParams.js';
import {
  DEFAULT_SAMPLE_RATE,
  DELAY_WORKLET_PROCESSOR,
  DELAY_WORKLET_URL,
  REVERB_WORKLET_PROCESSOR,
  REVERB_WORKLET_URL,
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

const DELAY_WORKLET_DEFAULTS = {
  enabled: false,
  inputLeft: 1,
  inputRight: 1,
  timeLeft: 0.12,
  timeRight: 0.17,
  feedback: 0.25,
  crossfeed: 0,
  lowCut: 90,
  highCut: 5400,
  drive: 0.02,
  modRate: 0.14,
  modDepth: 0.0001,
  flutterRate: 4,
  flutterDepth: 0.00002,
  width: 0.7,
  ducking: 0.12,
  duckRelease: 0.18
};

const REVERB_WORKLET_DEFAULTS = {
  enabled: false,
  variant: 'hall',
  preDelay: 0.018,
  size: 0.58,
  decay: 0.52,
  damping: 0.42,
  lowCut: 120,
  highCut: 9200,
  width: 0.82,
  diffusion: 0.72,
  modRate: 0.16,
  modDepth: 0.0004,
  earlyLevel: 0.34
};

class DelayWorklet {
  constructor(paramDefaults) {
    this.node = null;
    this.readyPromise = null;
    this.ready = false;
    this.paramDefaults = paramDefaults;
    this.lastParams = paramDefaults;
  }

  async ensure(ctx, source, destination) {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      if (!ctx.audioWorklet || !ctx.audioWorklet.addModule) {
        throw new Error('AudioWorklet not supported');
      }

      await ctx.audioWorklet.addModule(DELAY_WORKLET_URL);

      this.node = new AudioWorkletNode(ctx, DELAY_WORKLET_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        processorOptions: {
          paramDefaults: this.paramDefaults
        }
      });
      source.connect(this.node);
      this.node.connect(destination);
      this.ready = true;
      this.setParams(this.lastParams);
    })();

    return this.readyPromise;
  }

  setParams(params) {
    this.lastParams = { ...this.lastParams, ...params };
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'setParams',
      params: this.lastParams
    });
  }

  clear() {
    if (!this.node) return;
    this.node.port.postMessage({ type: 'clear' });
  }
}

class ReverbWorklet {
  constructor(paramDefaults) {
    this.node = null;
    this.readyPromise = null;
    this.ready = false;
    this.paramDefaults = paramDefaults;
    this.lastParams = paramDefaults;
  }

  async ensure(ctx, source, destination) {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = (async () => {
      if (!ctx.audioWorklet || !ctx.audioWorklet.addModule) {
        throw new Error('AudioWorklet not supported');
      }

      await ctx.audioWorklet.addModule(REVERB_WORKLET_URL);

      this.node = new AudioWorkletNode(ctx, REVERB_WORKLET_PROCESSOR, {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        processorOptions: {
          paramDefaults: this.paramDefaults
        }
      });
      source.connect(this.node);
      this.node.connect(destination);
      this.ready = true;
      this.setParams(this.lastParams);
    })();

    return this.readyPromise;
  }

  setParams(params) {
    this.lastParams = { ...this.lastParams, ...params };
    if (!this.node) return;
    this.node.port.postMessage({
      type: 'setParams',
      params: this.lastParams
    });
  }

  clear() {
    if (!this.node) return;
    this.node.port.postMessage({ type: 'clear' });
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

const DELAY_MODE_CONFIG = {
  digital: {
    inputLeft: 1,
    inputRight: 1,
    localFeedback: 1,
    crossFeedback: 0,
    spread: 0.14,
    modulationRate: 0.12,
    modulationDepth: 0.00008,
    drive: 0.015,
    ageDrive: 0.05,
    ageHighCutDrop: 0.18,
    ageLowCutLift: 60,
    flutterAmount: 0.18,
    flutterRate: 3.8,
    duckRelease: 0.14
  },
  tape: {
    inputLeft: 1,
    inputRight: 0.94,
    localFeedback: 0.84,
    crossFeedback: 0.12,
    spread: 0.18,
    modulationRate: 0.18,
    modulationDepth: 0.00034,
    drive: 0.08,
    ageDrive: 0.18,
    ageHighCutDrop: 0.52,
    ageLowCutLift: 180,
    flutterAmount: 0.92,
    flutterRate: 5.6,
    duckRelease: 0.24
  },
  'ping-pong': {
    inputLeft: 1,
    inputRight: 0.2,
    localFeedback: 0.12,
    crossFeedback: 0.84,
    spread: 0.24,
    modulationRate: 0.15,
    modulationDepth: 0.00018,
    drive: 0.04,
    ageDrive: 0.09,
    ageHighCutDrop: 0.28,
    ageLowCutLift: 100,
    flutterAmount: 0.42,
    flutterRate: 4.5,
    duckRelease: 0.18
  }
};

const REVERB_MODE_CONFIG = {
  room: {
    sendScale: 0.46,
    wetScale: 0.58,
    dampingOffset: 0.06,
    toneOffset: -0.06,
    diffusion: 0.62,
    modRate: 0.11,
    modDepth: 0.00018,
    earlyLevel: 0.46,
    widthBias: 0.08
  },
  plate: {
    sendScale: 0.5,
    wetScale: 0.62,
    dampingOffset: 0.02,
    toneOffset: 0.04,
    diffusion: 0.76,
    modRate: 0.14,
    modDepth: 0.00028,
    earlyLevel: 0.32,
    widthBias: 0.14
  },
  hall: {
    sendScale: 0.54,
    wetScale: 0.68,
    dampingOffset: 0,
    toneOffset: 0,
    diffusion: 0.82,
    modRate: 0.16,
    modDepth: 0.00042,
    earlyLevel: 0.28,
    widthBias: 0.18
  },
  ambient: {
    sendScale: 0.58,
    wetScale: 0.74,
    dampingOffset: -0.08,
    toneOffset: 0.08,
    diffusion: 0.9,
    modRate: 0.19,
    modDepth: 0.00058,
    earlyLevel: 0.22,
    widthBias: 0.24
  }
};

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
    this.transportTempoBpm = DEFAULT_TRANSPORT_TEMPO;

    this.worklet = new SynthWorklet(WORKLET_PARAM_DEFAULTS);
    this.workletReadyPromise = null;
    this.delayWorklet = new DelayWorklet(DELAY_WORKLET_DEFAULTS);
    this.delayWorkletReadyPromise = null;
    this.reverbWorklet = new ReverbWorklet(REVERB_WORKLET_DEFAULTS);
    this.reverbWorkletReadyPromise = null;

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
    this.activityListeners = new Set();
    this.activeVoiceIds = new Set();
    this.audioActivity = {
      isActive: false,
      activeVoices: 0,
      updatedAt: Date.now()
    };

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

  async ensureDelayWorklet(ctx) {
    if (this.delayWorkletReadyPromise) {
      return this.delayWorkletReadyPromise;
    }

    this.delayWorkletReadyPromise = Promise.resolve()
      .then(async () => {
        const nodes = this.setupGraph(ctx);
        await this.delayWorklet.ensure(ctx, nodes.delaySend, nodes.delayWet);
        if (this.currentParams) {
          this.lastParamSignature = '';
          this.applyGlobalParams(this.currentParams);
        }
      })
      .catch((err) => {
        this.status.error = {
          type: 'DELAY_WORKLET_FAILED',
          message: 'Failed to initialize delay effect',
          detail: err.message,
          timestamp: Date.now()
        };
        this.notify();
        throw err;
      });

    return this.delayWorkletReadyPromise;
  }

  async ensureReverbWorklet(ctx) {
    if (this.reverbWorkletReadyPromise) {
      return this.reverbWorkletReadyPromise;
    }

    this.reverbWorkletReadyPromise = Promise.resolve()
      .then(async () => {
        const nodes = this.setupGraph(ctx);
        await this.reverbWorklet.ensure(ctx, nodes.reverbSend, nodes.reverbWet);
        if (this.currentParams) {
          this.lastParamSignature = '';
          this.applyGlobalParams(this.currentParams);
        }
      })
      .catch((err) => {
        this.status.error = {
          type: 'REVERB_WORKLET_FAILED',
          message: 'Failed to initialize reverb effect',
          detail: err.message,
          timestamp: Date.now()
        };
        this.notify();
        throw err;
      });

    return this.reverbWorkletReadyPromise;
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
        this.ensureDelayWorklet(ctx).catch(() => {});
        this.ensureReverbWorklet(ctx).catch(() => {});
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
    nodes.masterGain.gain.setTargetAtTime(sanitized.volume * 0.94, now, 0.02);

    const delayMode = DELAY_MODE_CONFIG[sanitized.delayMode]
      ? sanitized.delayMode
      : AUDIO_PARAM_DEFAULTS.delayMode;
    const delayConfig = DELAY_MODE_CONFIG[delayMode];
    const delayActive = sanitized.delayEnabled && sanitized.delayMix > 0.001;
    const delayAge = sanitized.delayAge;
    const delayMotion = sanitized.delayMotion;
    const delaySeconds = getDelaySeconds(sanitized, this.transportTempoBpm);
    const stereoSpread = 0.015 + sanitized.delayStereo * delayConfig.spread;
    const leftDelayTime = clamp(delaySeconds * (1 - stereoSpread), 0.02, 4);
    const rightDelayTime = clamp(delaySeconds * (1 + stereoSpread), 0.02, 4);

    const feedbackBase = delayActive ? clamp(sanitized.delayFeedback, 0, 0.9) : 0;
    const feedback = feedbackBase * delayConfig.localFeedback;
    const crossfeed = feedbackBase * delayConfig.crossFeedback;
    const delayLevel = delayActive ? Math.pow(sanitized.delayMix, 0.88) : 0;
    const delaySend = delayLevel * 0.54;
    nodes.delaySend.gain.cancelScheduledValues(now);
    nodes.delaySend.gain.setTargetAtTime(delaySend, now, 0.05);

    const delayWetLevel = delayLevel * 0.68;
    nodes.delayWet.gain.cancelScheduledValues(now);
    nodes.delayWet.gain.setTargetAtTime(delayWetLevel, now, 0.05);

    const lowCut = clamp(
      sanitized.delayLowCut + delayAge * delayConfig.ageLowCutLift,
      20,
      2600
    );
    const highCut = clamp(
      Math.max(
        sanitized.delayHighCut * (1 - delayAge * delayConfig.ageHighCutDrop),
        lowCut + 400
      ),
      800,
      14000
    );

    const modulationDepth = delayActive
      ? delayConfig.modulationDepth
        * (0.35 + delayMotion * 1.9 + sanitized.delayStereo * 0.35 + sanitized.delayFeedback * 0.45)
      : 0;
    const modulationRate = delayConfig.modulationRate * (0.8 + delayMotion * 1.65);
    const flutterDepth = delayActive
      ? clamp(
        modulationDepth * delayConfig.flutterAmount * (0.18 + delayMotion * 0.9),
        0,
        0.0034
      )
      : 0;
    const flutterRate = delayConfig.flutterRate * (0.75 + delayMotion * 1.3);

    const delayDrive = delayActive
      ? clamp(delayConfig.drive + sanitized.delayFeedback * 0.1 + delayAge * delayConfig.ageDrive, 0, 0.38)
      : 0;
    const duckRelease = clamp(
      delayConfig.duckRelease + (1 - delayMotion) * 0.06 + delayAge * 0.05,
      0.08,
      0.48
    );
    this.delayWorklet.setParams({
      enabled: delayActive,
      inputLeft: delayActive ? delayConfig.inputLeft : 0,
      inputRight: delayActive ? delayConfig.inputRight : 0,
      timeLeft: leftDelayTime,
      timeRight: rightDelayTime,
      feedback,
      crossfeed,
      lowCut,
      highCut,
      drive: delayDrive,
      modRate: modulationRate,
      modDepth: modulationDepth,
      flutterRate,
      flutterDepth,
      width: sanitized.delayStereo,
      ducking: sanitized.delayDucking,
      duckRelease
    });

    const reverbMode = REVERB_MODE_CONFIG[sanitized.reverbMode]
      ? sanitized.reverbMode
      : AUDIO_PARAM_DEFAULTS.reverbMode;
    const reverbConfig = REVERB_MODE_CONFIG[reverbMode];
    const reverbActive = sanitized.reverbEnabled && sanitized.reverbMix > 0.001;
    const reverbLevel = reverbActive ? Math.pow(sanitized.reverbMix, 1.06) : 0;
    nodes.reverbSend.gain.cancelScheduledValues(now);
    nodes.reverbSend.gain.setTargetAtTime(reverbLevel * reverbConfig.sendScale, now, 0.08);
    nodes.reverbWet.gain.cancelScheduledValues(now);
    nodes.reverbWet.gain.setTargetAtTime(reverbLevel * reverbConfig.wetScale, now, 0.12);

    const reverbTone = clamp(sanitized.reverbTone + reverbConfig.toneOffset, 0, 1);
    const reverbDamping = clamp(
      0.18 + (1 - reverbTone) * 0.62 + reverbConfig.dampingOffset,
      0.12,
      0.9
    );
    const reverbLowCut = clamp(70 + (1 - reverbTone) * 180, 20, 1400);
    const reverbHighCut = clamp(
      Math.max(2600 + reverbTone * 9800, reverbLowCut + 900),
      1200,
      18000
    );

    this.reverbWorklet.setParams({
      enabled: reverbActive,
      variant: reverbMode,
      preDelay: sanitized.reverbPreDelay / 1000,
      size: sanitized.reverbSize,
      decay: sanitized.reverbDecay,
      damping: reverbDamping,
      lowCut: reverbLowCut,
      highCut: reverbHighCut,
      width: clamp(sanitized.reverbWidth + reverbConfig.widthBias, 0, 1),
      diffusion: clamp(reverbConfig.diffusion + sanitized.reverbSize * 0.12, 0.4, 0.98),
      modRate: reverbConfig.modRate * (0.8 + sanitized.reverbSize * 0.45),
      modDepth: reverbConfig.modDepth * (0.7 + sanitized.reverbDecay * 0.6),
      earlyLevel: clamp(
        reverbConfig.earlyLevel * (0.7 + (1 - sanitized.reverbSize) * 0.3),
        0.12,
        0.72
      )
    });

    nodes.warmthFilter.gain.cancelScheduledValues(now);
    nodes.warmthFilter.gain.setTargetAtTime(1.2 + sanitized.distortion * 1.6, now, 0.12);
    nodes.presenceFilter.gain.cancelScheduledValues(now);
    nodes.presenceFilter.gain.setTargetAtTime(1.5 - sanitized.reverbMix * 0.7, now, 0.12);
    nodes.airFilter.gain.cancelScheduledValues(now);
    nodes.airFilter.gain.setTargetAtTime(1.8 - sanitized.distortion * 0.8, now, 0.12);

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
