import initWasm, {
  wasm_generate_waveform_with_phase,
  wasm_fm_waveform,
  wasm_apply_adsr,
  WasmWaveform
} from '../../public/pkg/sound_engine.js';

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_DURATION = 1.0;
const SILENT_BUFFER_LENGTH = 128;
const POOL_SIZE = 32;
const MAX_BUFFER_POOL = 96;
const COMMON_PRELOAD_NOTES = ['C3', 'C4', 'C5', 'C6'];
const WAVEFORMS = ['Sine', 'Square', 'Sawtooth', 'Triangle'];
const LISTENER_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MIN_OCTAVE = -1;
const MAX_OCTAVE = 7;

const NOTE_OFFSET_FROM_A = {
  'C': -9,
  'C#': -8,
  'D': -7,
  'D#': -6,
  'E': -5,
  'F': -4,
  'F#': -3,
  'G': -2,
  'G#': -1,
  'A': 0,
  'A#': 1,
  'B': 2
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getWaveformEnum(type) {
  switch (type) {
    case 'Square':
      return WasmWaveform.Square;
    case 'Sawtooth':
      return WasmWaveform.Sawtooth;
    case 'Triangle':
      return WasmWaveform.Triangle;
    case 'Sine':
    default:
      return WasmWaveform.Sine;
  }
}

class Float32Pool {
  constructor(blockSize = DEFAULT_SAMPLE_RATE, maxBlocks = MAX_BUFFER_POOL) {
    this.blockSize = blockSize;
    this.maxBlocks = maxBlocks;
    this.pool = [];
  }

  acquire(minLength) {
    const required = Math.max(minLength, this.blockSize);
    for (let i = 0; i < this.pool.length; i += 1) {
      const candidate = this.pool[i];
      if (candidate.length >= required) {
        this.pool.splice(i, 1);
        return candidate;
      }
    }
    return new Float32Array(required);
  }

  release(buffer) {
    if (!buffer || this.pool.length >= this.maxBlocks) return;
    this.pool.push(buffer);
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
      for (let i = 0; i < this.resolution; i += 1) {
        curve[i] = (i * 2) / this.resolution - 1;
      }
      this.cache.set(key, curve);
      return curve;
    }

    const k = key * 150;
    const deg = Math.PI / 180;
    for (let i = 0; i < this.resolution; i += 1) {
      const x = (i * 2) / this.resolution - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }

    this.cache.set(key, curve);
    return curve;
  }
}

class NoteVoice {
  constructor(engine, ctx, target) {
    this.engine = engine;
    this.ctx = ctx;
    this.target = target;

    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(target);

    this.bufferSource = null;
    this.playingSource = null;
    this.stopSource = null;

    this.noteId = null;
    this.active = false;
    this.startTime = 0;

    this.prepareNextSource();
  }

  prepareNextSource() {
    this.bufferSource = this.ctx.createBufferSource();
    this.bufferSource.connect(this.gain);
  }

  trigger({ buffer, noteId, volume, attackTime, startTime }) {
    const source = this.bufferSource;
    source.buffer = buffer;
    source.loop = false;

    this.stopSource = source.stop.bind(source);
    source.stop = (when) => {
      this.stop(when);
    };

    source.onended = () => {
      if (this.playingSource === source) {
        this.cleanup();
      }
    };

    this.playingSource = source;
    this.noteId = noteId;
    this.active = true;
    this.startTime = startTime;

    const attack = Math.max(attackTime, 0.0005);
    this.gain.gain.cancelScheduledValues(startTime);
    this.gain.gain.setValueAtTime(0.0001, startTime);
    this.gain.gain.linearRampToValueAtTime(volume, startTime + attack);

    try {
      source.start(startTime);
    } catch (_) {
      this.cleanup();
    }

    this.prepareNextSource();
    return source;
  }

  stop(when = this.ctx.currentTime) {
    if (!this.active || !this.playingSource) return;

    const ctx = this.ctx;
    const stopAt = Math.max(when, ctx.currentTime);
    this.gain.gain.cancelScheduledValues(stopAt);
    this.gain.gain.setTargetAtTime(0.0001, stopAt, 0.05);

    if (this.stopSource) {
      try {
        this.stopSource(stopAt + 0.05);
      } catch (_) {
        /* already stopped */
      }
    }
  }

  cleanup() {
    if (!this.active) return;

    this.active = false;
    this.noteId = null;
    this.playingSource = null;
    this.stopSource = null;

    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(0, now);

    this.engine.recycleVoice(this);
  }
}

class AudioEngine {
  constructor() {
    this.wasmReady = false;
    this.wasmInitPromise = null;

    this.context = null;
    this.contextPromise = null;

    this.graphReady = false;
    this.graphWarmPromise = null;

    this.unlockHandlerInstalled = false;

    this.statusListeners = new Set();
    this.status = {
      wasmReady: false,
      contextReady: false,
      graphWarmed: false
    };

    this.silentBuffer = null;
    this.cachedImpulse = null;

    this.globalNodes = null;
    this.currentParams = null;
    this.lastParamSignature = '';

    this.voices = [];
    this.freeVoices = [];
    this.activeVoices = new Map();
    this.voiceSerial = 0;

    this.floatPool = new Float32Pool();
    this.distortionCache = new DistortionCurveCache();
    this.waveformCache = new Map();
    this.frequencyTable = this.buildFrequencyTable();
    this.commonWaveformsPrecomputed = false;
  }

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
    return { ...this.status };
  }

  async ensureWasm() {
    if (!this.wasmInitPromise) {
      this.wasmInitPromise = initWasm().then((module) => {
        this.wasmReady = true;
        this.status.wasmReady = true;
        this.notify();
        this.precomputeCommonWaveforms();
        return module;
      });
    }
    return this.wasmInitPromise;
  }

  async ensureAudioContext() {
    if (this.contextPromise) {
      return this.contextPromise;
    }

    this.contextPromise = Promise.resolve().then(() => {
      let ctx;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)({
          latencyHint: 'playback',
          sampleRate: DEFAULT_SAMPLE_RATE
        });
      } catch (_) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      this.context = ctx;
      this.status.contextReady = true;
      this.notify();

      this.installUnlockHandlers();
      this.setupGraph(ctx);
      this.ensureVoicePool(ctx);
      return ctx;
    });

    return this.contextPromise;
  }

  installUnlockHandlers() {
    if (this.unlockHandlerInstalled || typeof window === 'undefined') return;

    const resume = async () => {
      if (!this.context) return;
      if (this.context.state === 'suspended') {
        try {
          await this.context.resume();
        } catch (_) {
          /* browsers may keep the context suspended until a trusted gesture */
        }
      }
    };

    LISTENER_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resume, { passive: true });
    });
    this.unlockHandlerInstalled = true;
  }

  async warmGraph() {
    if (this.graphWarmPromise) {
      return this.graphWarmPromise;
    }

    this.graphWarmPromise = (async () => {
      await this.ensureWasm();
      const ctx = await this.ensureAudioContext();
      const nodes = this.setupGraph(ctx);
      this.ensureSilentBuffer(ctx);

      try {
        const tempSource = ctx.createBufferSource();
        tempSource.buffer = this.silentBuffer;
        tempSource.connect(nodes.inputBus);
        tempSource.start();
        tempSource.stop(ctx.currentTime + 0.05);
      } catch (_) {
        /* ignore warm-up issues */
      }

      this.graphReady = true;
      this.status.graphWarmed = true;
      this.notify();
    })().catch(() => {
      this.graphWarmPromise = null;
    });

    return this.graphWarmPromise;
  }

  ensureSilentBuffer(ctx) {
    if (this.silentBuffer) return;
    this.silentBuffer = ctx.createBuffer(1, SILENT_BUFFER_LENGTH, ctx.sampleRate);
    const channel = this.silentBuffer.getChannelData(0);
    channel.fill(0);
  }

  setupGraph(ctx) {
    if (this.globalNodes) {
      return this.globalNodes;
    }

    const inputBus = ctx.createGain();
    inputBus.gain.value = 1;

    const dryGain = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack = 0.003;
    compressor.release = 0.1;

    const distortion = ctx.createWaveShaper();
    distortion.curve = this.distortionCache.get(0);
    distortion.oversample = '4x';

    const delayNode = ctx.createDelay(5);
    delayNode.delayTime.value = 0;

    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;

    const reverbNode = ctx.createConvolver();
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = 0;

    const stereoPanner = ctx.createStereoPanner();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.8;

    this.ensureImpulse(ctx, reverbNode);

    inputBus.connect(dryGain);
    dryGain.connect(compressor);
    compressor.connect(distortion);
    distortion.connect(delayNode);
    distortion.connect(masterGain);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(masterGain);

    inputBus.connect(reverbNode);
    reverbNode.connect(reverbGain);
    reverbGain.connect(masterGain);

    masterGain.connect(stereoPanner);
    stereoPanner.connect(analyser);
    analyser.connect(ctx.destination);

    this.globalNodes = {
      inputBus,
      dryGain,
      compressor,
      distortion,
      delayNode,
      delayFeedback,
      reverbNode,
      reverbGain,
      masterGain,
      stereoPanner,
      analyser
    };

    return this.globalNodes;
  }

  ensureImpulse(ctx, reverbNode) {
    if (this.cachedImpulse) {
      reverbNode.buffer = this.cachedImpulse;
      return;
    }

    const seconds = 1.4;
    const channels = 2;
    const length = ctx.sampleRate * seconds;
    const impulse = ctx.createBuffer(channels, length, ctx.sampleRate);

    for (let channel = 0; channel < channels; channel += 1) {
      const impulseData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        impulseData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }

    this.cachedImpulse = impulse;
    reverbNode.buffer = impulse;
  }

  ensureVoicePool(ctx) {
    if (this.voices.length) return;

    const nodes = this.setupGraph(ctx);
    for (let i = 0; i < POOL_SIZE; i += 1) {
      const voice = new NoteVoice(this, ctx, nodes.inputBus);
      this.voices.push(voice);
      this.freeVoices.push(voice);
    }
  }

  acquireVoice(noteId) {
    if (!this.freeVoices.length) {
      const stolen = this.stealVoice();
      if (!stolen) return null;
      this.activeVoices.set(noteId, stolen);
      stolen.noteId = noteId;
      return stolen;
    }

    const voice = this.freeVoices.pop();
    this.activeVoices.set(noteId, voice);
    voice.noteId = noteId;
    return voice;
  }

  recycleVoice(voice) {
    if (voice.noteId && this.activeVoices.get(voice.noteId) === voice) {
      this.activeVoices.delete(voice.noteId);
    }

    if (!this.freeVoices.includes(voice)) {
      this.freeVoices.push(voice);
    }
  }

  stealVoice() {
    if (!this.voices.length || !this.context) return null;
    let candidate = null;

    for (const voice of this.voices) {
      if (!voice.active) {
        candidate = voice;
        break;
      }
      if (!candidate || voice.startTime < candidate.startTime) {
        candidate = voice;
      }
    }

    if (candidate) {
      candidate.stop(this.context.currentTime);
      if (candidate.noteId) {
        this.activeVoices.delete(candidate.noteId);
      }
    }

    return candidate;
  }

  buildFrequencyTable() {
    const table = new Map();
    for (let octave = MIN_OCTAVE; octave <= MAX_OCTAVE; octave += 1) {
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

  buildWaveformKey({ waveformType, frequency, duration, phaseOffset, useFM, fmRatio, fmIndex, sampleRate }) {
    return [
      waveformType,
      sampleRate,
      duration.toFixed(3),
      frequency.toFixed(3),
      phaseOffset.toFixed(3),
      useFM ? 1 : 0,
      fmRatio.toFixed(3),
      fmIndex.toFixed(3)
    ].join(':');
  }

  fetchWaveformSamples(options) {
    const key = this.buildWaveformKey(options);
    if (this.waveformCache.has(key)) {
      return this.waveformCache.get(key);
    }

    const {
      waveformType,
      frequency,
      duration,
      phaseOffset,
      useFM,
      fmRatio,
      fmIndex,
      sampleRate
    } = options;

    let samples;
    if (useFM) {
      const carrierFreq = Math.max(frequency, 0);
      const ratio = clamp(fmRatio ?? 2.5, 0.1, 10);
      const modFreq = carrierFreq * ratio;
      const modIndex = clamp(fmIndex ?? 5, 0, 100);
      samples = wasm_fm_waveform(carrierFreq, modFreq, modIndex, duration, sampleRate);
    } else {
      const wasmWaveform = getWaveformEnum(waveformType);
      const phase = clamp(phaseOffset ?? 0, 0, Math.PI * 2);
      samples = wasm_generate_waveform_with_phase(wasmWaveform, frequency, phase, duration, sampleRate);
    }

    this.waveformCache.set(key, samples);
    return samples;
  }

  applyEnvelopeIfNeeded(samples, params, sampleRate) {
    if (!params.useADSR) {
      return { data: samples, releaseAfterUse: false };
    }

    const attack = clamp(params.attack ?? 0.05, 0, 5);
    const decay = clamp(params.decay ?? 0.1, 0, 5);
    const sustain = clamp(params.sustain ?? 0.7, 0, 1);
    const release = clamp(params.release ?? 0.3, 0, 5);

    const working = this.floatPool.acquire(samples.length);
    working.set(samples);
    wasm_apply_adsr(working, attack, decay, sustain, release, sampleRate);

    return { data: working, releaseAfterUse: true };
  }

  sanitizeParams(params) {
    return {
      volume: clamp(params.volume ?? 0.7, 0, 1),
      delay: clamp(params.delay ?? 0, 0, 500),
      reverb: clamp(params.reverb ?? 0, 0, 1),
      distortion: clamp(params.distortion ?? 0, 0, 1),
      pan: clamp(params.pan ?? 0.5, 0, 1),
      phaseOffset: clamp(params.phaseOffset ?? 0, 0, Math.PI * 2),
      useADSR: !!params.useADSR,
      attack: params.attack ?? 0.05,
      decay: params.decay ?? 0.1,
      sustain: params.sustain ?? 0.7,
      release: params.release ?? 0.3,
      useFM: !!params.useFM,
      fmRatio: params.fmRatio ?? 2.5,
      fmIndex: params.fmIndex ?? 5
    };
  }

  paramsSignature(params) {
    return [
      params.volume.toFixed(4),
      params.delay.toFixed(2),
      params.reverb.toFixed(3),
      params.distortion.toFixed(3),
      params.pan.toFixed(3),
      params.phaseOffset.toFixed(3),
      params.useADSR ? 1 : 0,
      params.attack.toFixed(3),
      params.decay.toFixed(3),
      params.sustain.toFixed(3),
      params.release.toFixed(3),
      params.useFM ? 1 : 0,
      params.fmRatio.toFixed(3),
      params.fmIndex.toFixed(3)
    ].join('|');
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

    nodes.masterGain.gain.cancelScheduledValues(now);
    nodes.masterGain.gain.setTargetAtTime(sanitized.volume, now, 0.01);

    nodes.delayNode.delayTime.cancelScheduledValues(now);
    nodes.delayNode.delayTime.setTargetAtTime(sanitized.delay / 1000, now, 0.05);

    const feedback = clamp(sanitized.delay / 400, 0, 0.85);
    nodes.delayFeedback.gain.cancelScheduledValues(now);
    nodes.delayFeedback.gain.setTargetAtTime(feedback, now, 0.1);

    nodes.reverbGain.gain.cancelScheduledValues(now);
    nodes.reverbGain.gain.setTargetAtTime(sanitized.reverb, now, 0.1);

    nodes.distortion.curve = this.distortionCache.get(sanitized.distortion);

    const panValue = (sanitized.pan - 0.5) * 2;
    nodes.stereoPanner.pan.cancelScheduledValues(now);
    nodes.stereoPanner.pan.setTargetAtTime(panValue, now, 0.05);

    this.currentParams = sanitized;
    this.lastParamSignature = signature;
  }

  async playFrequency({ noteId, frequency, waveformType, duration = DEFAULT_DURATION, params = {}, velocity = 1 }) {
    await this.ensureWasm();
    const ctx = await this.ensureAudioContext();
    const nodes = this.setupGraph(ctx);
    this.ensureVoicePool(ctx);

    const sanitized = this.sanitizeParams(params);
    this.updateGlobalParams(sanitized);

    const sampleRate = ctx.sampleRate;
    const waveformSamples = this.fetchWaveformSamples({
      waveformType,
      frequency,
      duration,
      phaseOffset: sanitized.phaseOffset,
      useFM: sanitized.useFM,
      fmRatio: sanitized.fmRatio,
      fmIndex: sanitized.fmIndex,
      sampleRate
    });

    const { data: playbackSamples, releaseAfterUse } = this.applyEnvelopeIfNeeded(
      waveformSamples,
      sanitized,
      sampleRate
    );

    const buffer = ctx.createBuffer(1, playbackSamples.length, sampleRate);
    buffer.copyToChannel(playbackSamples, 0);

    if (releaseAfterUse) {
      this.floatPool.release(playbackSamples);
    }

    const voiceId = noteId || `voice-${this.voiceSerial += 1}`;
    const voice = this.acquireVoice(voiceId);
    if (!voice) {
      return null;
    }

    const gain = clamp(sanitized.volume * velocity, 0, 1);
    const source = voice.trigger({
      buffer,
      noteId: voiceId,
      volume: gain,
      attackTime: sanitized.useADSR ? sanitized.attack : 0.002,
      startTime: ctx.currentTime
    });

    return {
      source,
      analyser: nodes.analyser,
      voiceId
    };
  }

  async preloadNote({ frequency, waveformType, duration = DEFAULT_DURATION, params = {} }) {
    await this.ensureWasm();
    const ctx = await this.ensureAudioContext();
    const sanitized = this.sanitizeParams(params);
    this.fetchWaveformSamples({
      waveformType,
      frequency,
      duration,
      phaseOffset: sanitized.phaseOffset,
      useFM: sanitized.useFM,
      fmRatio: sanitized.fmRatio,
      fmIndex: sanitized.fmIndex,
      sampleRate: ctx.sampleRate
    });
  }

  stopNote(noteId) {
    const voice = this.activeVoices.get(noteId);
    if (voice) {
      voice.stop();
    }
  }

  setGlobalParams(params) {
    this.updateGlobalParams(params);
  }

  getAnalyser() {
    return this.globalNodes?.analyser || null;
  }

  async precomputeCommonWaveforms() {
    if (this.commonWaveformsPrecomputed) return;
    await this.ensureWasm();

    const sampleRate = this.context?.sampleRate || DEFAULT_SAMPLE_RATE;
    for (const waveformType of WAVEFORMS) {
      for (const noteId of COMMON_PRELOAD_NOTES) {
        const frequency = this.frequencyTable.get(noteId);
        if (!frequency) continue;
        const key = this.buildWaveformKey({
          waveformType,
          frequency,
          duration: DEFAULT_DURATION,
          phaseOffset: 0,
          useFM: false,
          fmRatio: 0,
          fmIndex: 0,
          sampleRate
        });
        if (!this.waveformCache.has(key)) {
          const samples = wasm_generate_waveform_with_phase(
            getWaveformEnum(waveformType),
            frequency,
            0,
            DEFAULT_DURATION,
            sampleRate
          );
          this.waveformCache.set(key, samples);
        }
      }
    }

    this.commonWaveformsPrecomputed = true;
  }
}

export const audioEngine = new AudioEngine();
