const TWO_PI = Math.PI * 2;
const MAX_VOICES = 24;
const MIN_GAIN = 0.0001;

const WAVEFORMS = Object.freeze({
  SINE: 0,
  SAW: 1,
  SQUARE: 2,
  TRIANGLE: 3
});

const ENV_STAGE = Object.freeze({
  IDLE: 0,
  ATTACK: 1,
  DECAY: 2,
  SUSTAIN: 3,
  RELEASE: 4
});

const DEFAULT_PARAMS = {
  attack: 0.01,
  decay: 0.1,
  sustain: 0.8,
  release: 0.3,
  useADSR: true,
  useFM: false,
  fmRatio: 2.0,
  fmIndex: 2.0,
  phaseOffsetDeg: 0,
  useFilter: false,
  filterCutoff: 18000,
  filterResonance: 0.7,
  filterMode: 0,
  lfoRate: 0.0,
  lfoDepth: 0.0,
  lfoTarget: 0,
  unisonVoices: 1,
  unisonDetune: 0.0
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function polyBlep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1.0;
  }
  if (t > 1.0 - dt) {
    const x = (t - 1.0) / dt;
    return x * x + x + x + 1.0;
  }
  return 0.0;
}

function waveformSample(waveform, phase, dt) {
  switch (waveform) {
    case WAVEFORMS.SINE:
      return Math.sin(TWO_PI * phase);
    case WAVEFORMS.SAW: {
      let value = 2.0 * phase - 1.0;
      value -= polyBlep(phase, dt);
      return value;
    }
    case WAVEFORMS.SQUARE: {
      let value = phase < 0.5 ? 1.0 : -1.0;
      value += polyBlep(phase, dt);
      value -= polyBlep((phase + 0.5) % 1.0, dt);
      return value;
    }
    case WAVEFORMS.TRIANGLE:
      return 2.0 * Math.abs(2.0 * phase - 1.0) - 1.0;
    default:
      return 0.0;
  }
}

function softClip(x) {
  return Math.tanh(x);
}

function normalizeWaveform(value) {
  if (typeof value === 'number') {
    return clamp(Math.floor(value), 0, 3);
  }
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase();
    if (key === 'sine') return WAVEFORMS.SINE;
    if (key === 'saw' || key === 'sawtooth') return WAVEFORMS.SAW;
    if (key === 'square') return WAVEFORMS.SQUARE;
    if (key === 'triangle') return WAVEFORMS.TRIANGLE;
  }
  return WAVEFORMS.SINE;
}

class Envelope {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.stage = ENV_STAGE.IDLE;
    this.value = 0.0;
    this.attackSamples = 1;
    this.decaySamples = 1;
    this.releaseSamples = 1;
    this.sustain = 1.0;
    this.attackInc = 1.0;
    this.decayInc = 0.0;
    this.releaseInc = 0.0;
  }

  setADSR(attack, decay, sustain, release) {
    const attackSamples = Math.max(1, Math.floor(attack * this.sampleRate));
    const decaySamples = Math.max(1, Math.floor(decay * this.sampleRate));
    const releaseSamples = Math.max(1, Math.floor(release * this.sampleRate));

    this.attackSamples = attackSamples;
    this.decaySamples = decaySamples;
    this.releaseSamples = releaseSamples;
    this.sustain = clamp(sustain, 0, 1);

    this.attackInc = 1.0 / attackSamples;
    this.decayInc = (this.sustain - 1.0) / decaySamples;
    this.releaseInc = 0.0;
  }

  noteOn() {
    this.stage = ENV_STAGE.ATTACK;
    this.value = 0.0;
  }

  setImmediate() {
    this.stage = ENV_STAGE.SUSTAIN;
    this.value = 1.0;
  }

  noteOff() {
    if (this.stage === ENV_STAGE.IDLE || this.stage === ENV_STAGE.RELEASE) {
      return;
    }
    this.stage = ENV_STAGE.RELEASE;
    this.releaseInc = -this.value / this.releaseSamples;
  }

  next(useAdsr) {
    if (!useAdsr && this.stage !== ENV_STAGE.RELEASE) {
      return 1.0;
    }

    switch (this.stage) {
      case ENV_STAGE.ATTACK:
        this.value += this.attackInc;
        if (this.value >= 1.0) {
          this.value = 1.0;
          this.stage = ENV_STAGE.DECAY;
        }
        break;
      case ENV_STAGE.DECAY:
        this.value += this.decayInc;
        if (this.value <= this.sustain) {
          this.value = this.sustain;
          this.stage = ENV_STAGE.SUSTAIN;
        }
        break;
      case ENV_STAGE.SUSTAIN:
        this.value = this.sustain;
        break;
      case ENV_STAGE.RELEASE:
        this.value += this.releaseInc;
        if (this.value <= MIN_GAIN) {
          this.value = 0.0;
          this.stage = ENV_STAGE.IDLE;
        }
        break;
      default:
        this.value = 0.0;
        break;
    }

    return this.value;
  }

  isIdle() {
    return this.stage === ENV_STAGE.IDLE;
  }
}

class StateVariableFilter {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.cutoff = 18000;
    this.resonance = 0.7;
    this.lp = 0.0;
    this.bp = 0.0;
    this.mode = 0; // 0=lowpass
  }

  setParams({ cutoff, resonance, mode }) {
    if (typeof cutoff === 'number') {
      this.cutoff = clamp(cutoff, 20, this.sampleRate * 0.45);
    }
    if (typeof resonance === 'number') {
      this.resonance = clamp(resonance, 0.1, 10.0);
    }
    if (typeof mode === 'number') {
      this.mode = mode;
    }
  }

  reset() {
    this.lp = 0.0;
    this.bp = 0.0;
  }

  process(input, cutoffOverride) {
    const cutoff = typeof cutoffOverride === 'number'
      ? clamp(cutoffOverride, 20, this.sampleRate * 0.45)
      : this.cutoff;
    const f = 2.0 * Math.sin(Math.PI * cutoff / this.sampleRate);
    const q = 1.0 / this.resonance;

    this.lp = this.lp + f * this.bp;
    const hp = input - this.lp - q * this.bp;
    this.bp = this.bp + f * hp;

    switch (this.mode) {
      case 1:
        return hp; // high-pass
      case 2:
        return this.bp; // band-pass
      case 3:
        return input - q * this.bp; // notch
      default:
        return this.lp; // low-pass
    }
  }
}

class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.active = false;
    this.noteId = null;
    this.frequency = 440;
    this.velocity = 1.0;
    this.waveform = WAVEFORMS.SINE;
    this.phase = 0.0;
    this.modPhase = 0.0;
    this.envelope = new Envelope(sampleRate);
    this.filter = new StateVariableFilter(sampleRate);
    this.useFilter = false;
    this.useFM = false;
    this.fmRatio = 2.0;
    this.fmIndex = 0.0;
    this.useADSR = true;
    this.startFrame = 0;
    this.lfoRate = 0.0;
    this.lfoDepth = 0.0;
    this.lfoPhase = 0.0;
    this.lfoTarget = 0; // 0 none, 1 pitch, 2 amp, 3 filter
    this.unisonVoices = 1;
    this.unisonDetune = 0.0;
    this.unisonPhases = new Float32Array(4);
  }

  start({ noteId, frequency, waveform, velocity, params, frame }) {
    this.noteId = noteId;
    this.frequency = frequency;
    this.velocity = clamp(velocity ?? 1.0, 0.0, 1.0);
    this.waveform = normalizeWaveform(waveform);
    this.phase = 0.0;
    this.modPhase = 0.0;
    this.active = true;
    this.startFrame = frame;

    const phaseOffset = (params.phaseOffsetDeg ?? 0) / 360.0;
    this.phase = phaseOffset % 1.0;

    this.useFM = !!params.useFM;
    this.fmRatio = typeof params.fmRatio === 'number' ? params.fmRatio : 2.0;
    const fmIndex = typeof params.fmIndex === 'number' ? params.fmIndex : 0.0;
    this.fmIndex = fmIndex / TWO_PI; // convert radians to cycles

    this.useADSR = params.useADSR !== false;
    this.envelope.setADSR(
      params.attack ?? 0.01,
      params.decay ?? 0.1,
      params.sustain ?? 0.8,
      params.release ?? 0.3
    );
    this.envelope.noteOn();
    if (!this.useADSR) {
      this.envelope.setImmediate();
    }

    this.useFilter = !!params.useFilter;
    this.filter.setParams({
      cutoff: params.filterCutoff ?? 18000,
      resonance: params.filterResonance ?? 0.7,
      mode: params.filterMode ?? 0
    });
    this.filter.reset();

    this.lfoRate = params.lfoRate ?? 0.0;
    this.lfoDepth = params.lfoDepth ?? 0.0;
    this.lfoTarget = params.lfoTarget ?? 0;
    this.lfoPhase = 0.0;

    this.unisonVoices = clamp(params.unisonVoices ?? 1, 1, 4);
    this.unisonDetune = params.unisonDetune ?? 0.0;
    const basePhase = this.phase;
    const useSpread = this.unisonVoices > 1;
    for (let i = 0; i < this.unisonPhases.length; i++) {
      const spread = useSpread ? (i / this.unisonVoices) * 0.08 : 0;
      const jitter = useSpread ? Math.random() * 0.01 : 0;
      this.unisonPhases[i] = (basePhase + spread + jitter) % 1.0;
    }
  }

  release() {
    if (!this.active) return;
    this.envelope.noteOff();
  }

  updateParams(params) {
    if (!this.active) return;
    this.useADSR = params.useADSR !== false;
    this.envelope.setADSR(
      params.attack ?? 0.01,
      params.decay ?? 0.1,
      params.sustain ?? 0.8,
      params.release ?? 0.3
    );
    if (!this.useADSR) {
      this.envelope.setImmediate();
    }
    this.useFM = !!params.useFM;
    this.fmRatio = typeof params.fmRatio === 'number' ? params.fmRatio : this.fmRatio;
    const fmIndex = typeof params.fmIndex === 'number' ? params.fmIndex : this.fmIndex * TWO_PI;
    this.fmIndex = fmIndex / TWO_PI;
    this.useFilter = !!params.useFilter;
    this.filter.setParams({
      cutoff: params.filterCutoff,
      resonance: params.filterResonance,
      mode: params.filterMode
    });
    this.lfoRate = params.lfoRate ?? this.lfoRate;
    this.lfoDepth = params.lfoDepth ?? this.lfoDepth;
    this.lfoTarget = params.lfoTarget ?? this.lfoTarget;
    this.unisonVoices = clamp(params.unisonVoices ?? this.unisonVoices, 1, 4);
    this.unisonDetune = params.unisonDetune ?? this.unisonDetune;
  }

  nextSample() {
    if (!this.active) return 0.0;

    let lfoValue = 0.0;
    if (this.lfoDepth > 0.0 && this.lfoRate > 0.0) {
      const lfoPhase = (this.lfoPhase + this.lfoRate / this.sampleRate) % 1.0;
      this.lfoPhase = lfoPhase;
      lfoValue = Math.sin(TWO_PI * lfoPhase) * this.lfoDepth;
    }

    let pitchMultiplier = 1.0;
    if (this.lfoTarget === 1 && this.lfoDepth > 0.0) {
      const semitones = lfoValue * 2.0;
      pitchMultiplier = Math.pow(2, semitones / 12.0);
    }

    const baseFrequency = this.frequency * pitchMultiplier;
    const baseDt = baseFrequency / this.sampleRate;
    let fmOffset = 0.0;
    if (this.useFM) {
      const modPhase = (this.modPhase + (this.fmRatio * baseDt)) % 1.0;
      this.modPhase = modPhase;
      fmOffset = Math.sin(TWO_PI * modPhase) * this.fmIndex;
    }

    let oscSum = 0.0;
    const unison = this.unisonVoices;
    for (let i = 0; i < unison; i++) {
      const detune = (i - (unison - 1) / 2) * this.unisonDetune;
      const detuneRatio = detune === 0 ? 1.0 : Math.pow(2, detune / 1200.0);
      const phase = this.unisonPhases[i];
      const phaseWithMod = (phase + fmOffset) % 1.0;
      oscSum += waveformSample(this.waveform, phaseWithMod, baseDt * detuneRatio);
      this.unisonPhases[i] = (phase + baseDt * detuneRatio) % 1.0;
    }

    let sample = oscSum / unison;

    const envValue = this.envelope.next(this.useADSR);
    sample *= envValue * this.velocity;

    if (this.lfoTarget === 2 && this.lfoDepth > 0.0) {
      sample *= Math.max(0.0, 1.0 + lfoValue);
    }

    if (this.useFilter) {
      if (this.lfoTarget === 3 && this.lfoDepth > 0.0) {
        const modCutoff = this.filter.cutoff * Math.pow(2, lfoValue * 4.0 / 12.0);
        sample = this.filter.process(sample, modCutoff);
      } else {
        sample = this.filter.process(sample);
      }
    }

    if (this.envelope.isIdle() && envValue <= MIN_GAIN) {
      this.active = false;
      this.noteId = null;
    }

    return sample;
  }
}

class SynthProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = sampleRate;
    this.voices = Array.from({ length: MAX_VOICES }, () => new Voice(sampleRate));
    const paramDefaults = options?.processorOptions?.paramDefaults;
    this.params = {
      ...DEFAULT_PARAMS,
      ...(paramDefaults || {})
    };
    this.frameCounter = 0;
    this.port.onmessage = (event) => {
      const data = event.data;
      if (!data || !data.type) return;
      switch (data.type) {
        case 'noteOn':
          this.noteOn(data);
          break;
        case 'noteOff':
          this.noteOff(data.noteId);
          break;
        case 'allNotesOff':
          this.allNotesOff();
          break;
        case 'setParams':
          this.setParams(data.params || {});
          break;
        default:
          break;
      }
    };
  }

  noteOn({ noteId, frequency, waveform, velocity }) {
    if (!frequency) return;
    let targetVoice = null;
    for (const voice of this.voices) {
      if (voice.active && voice.noteId === noteId) {
        targetVoice = voice;
        break;
      }
      if (!voice.active && !targetVoice) {
        targetVoice = voice;
      }
    }
    if (!targetVoice) {
      targetVoice = this.stealVoice();
    }
    if (!targetVoice) return;
    targetVoice.start({
      noteId,
      frequency,
      waveform,
      velocity,
      params: this.params,
      frame: this.frameCounter
    });
  }

  noteOff(noteId) {
    if (!noteId) return;
    for (const voice of this.voices) {
      if (voice.active && voice.noteId === noteId) {
        voice.release();
        break;
      }
    }
  }

  allNotesOff() {
    for (const voice of this.voices) {
      if (voice.active) {
        voice.release();
      }
    }
  }

  setParams(params) {
    this.params = {
      ...this.params,
      ...params
    };
    for (const voice of this.voices) {
      voice.updateParams(this.params);
    }
  }

  stealVoice() {
    let candidate = null;
    for (const voice of this.voices) {
      if (!candidate || voice.startFrame < candidate.startFrame) {
        candidate = voice;
      }
    }
    return candidate;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const frameCount = left.length;
    const mixGain = 0.2;

    for (let i = 0; i < frameCount; i++) {
      let sample = 0.0;
      for (const voice of this.voices) {
        if (voice.active) {
          sample += voice.nextSample();
        }
      }
      sample = softClip(sample * mixGain);
      left[i] = sample;
      if (right) {
        right[i] = sample;
      }
    }

    this.frameCounter += frameCount;
    return true;
  }
}

registerProcessor('vangelis-synth', SynthProcessor);
