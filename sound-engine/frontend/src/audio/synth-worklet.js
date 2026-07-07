const TWO_PI = Math.PI * 2;
const MAX_VOICES = 24;
const MIN_GAIN = 0.0001;
const MAX_MOD_ROUTES = 8;
const FILTER_MAX_CUTOFF_RATIO = 0.35;
const VOICE_SAMPLE_LIMIT = 8.0;

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

// Modulation matrix enums (mirrored in utils/audioParams.js)
const MOD_SRC = Object.freeze({
  LFO1: 0,
  LFO2: 1,
  AMP_ENV: 2,
  MOD_ENV: 3,
  VELOCITY: 4,
  KEY_TRACK: 5,
  MOD_WHEEL: 6
});

const MOD_DST = Object.freeze({
  PITCH: 0, // +/-12 semitones at depth 1
  CUTOFF: 1, // +/-4 octaves at depth 1
  AMP: 2, // +/-1 (gain offset) at depth 1
  FM_INDEX: 3, // +/-10 radians at depth 1
  DETUNE: 4 // +/-50 cents at depth 1
});

const LFO_SHAPES = Object.freeze({
  SINE: 0,
  TRIANGLE: 1,
  SQUARE: 2,
  SAW_UP: 3,
  SAW_DOWN: 4,
  SAMPLE_HOLD: 5
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
  unisonDetune: 0.0,
  // Modulation matrix
  lfo1Shape: 0,
  lfo2Shape: 0,
  lfo2Rate: 0.0,
  modAttack: 0.05,
  modDecay: 0.3,
  modSustain: 0.5,
  modRelease: 0.4,
  modRoutes: [],
  // Playability
  glideTime: 0.0,
  velocityCurve: 0.0
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

// 2-point polyBLAMP residual for a slope discontinuity at phase 0.
// Integral of the polyBlep step residual; rounds corners instead of steps.
function polyBlamp(t, dt) {
  if (t < dt) {
    const x = t / dt - 1.0;
    return -(x * x * x) / 3.0;
  }
  if (t > 1.0 - dt) {
    const x = (t - 1.0) / dt + 1.0;
    return (x * x * x) / 3.0;
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
    case WAVEFORMS.TRIANGLE: {
      let value = 2.0 * Math.abs(2.0 * phase - 1.0) - 1.0;
      // Slope changes by -8/cycle at the peak (phase 0) and +8/cycle at the
      // trough (phase 0.5); per-sample slope change is 8*dt.
      const blampScale = 8.0 * dt;
      value -= blampScale * polyBlamp(phase, dt);
      value += blampScale * polyBlamp((phase + 0.5) % 1.0, dt);
      return value;
    }
    default:
      return 0.0;
  }
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
    this.target = 0.0;
    this.sustain = 1.0;
    // Exponential coefficients (pre-calculated for performance)
    this.attackCoeff = 0.0;
    this.decayCoeff = 0.0;
    this.releaseCoeff = 0.0;
    // Time constant multiplier (higher = faster approach)
    this.timeConstant = 4.0;
  }

  setADSR(attack, decay, sustain, release) {
    this.sustain = clamp(sustain, 0, 1);

    // Calculate exponential coefficients
    // coeff = exp(-1 / (time * sampleRate * timeConstant))
    // Smaller coeff = faster approach to target
    const attackTime = Math.max(0.001, attack);
    const decayTime = Math.max(0.001, decay);
    const releaseTime = Math.max(0.001, release);

    this.attackCoeff = Math.exp(-1.0 / (attackTime * this.sampleRate / this.timeConstant));
    this.decayCoeff = Math.exp(-1.0 / (decayTime * this.sampleRate / this.timeConstant));
    this.releaseCoeff = Math.exp(-1.0 / (releaseTime * this.sampleRate / this.timeConstant));
  }

  noteOn() {
    this.stage = ENV_STAGE.ATTACK;
    this.target = 1.0;
    // Start from small positive value for smooth attack
    if (this.value < 0.001) {
      this.value = 0.001;
    }
  }

  setImmediate() {
    this.stage = ENV_STAGE.SUSTAIN;
    this.value = 1.0;
    this.target = 1.0;
  }

  noteOff() {
    if (this.stage === ENV_STAGE.IDLE || this.stage === ENV_STAGE.RELEASE) {
      return;
    }
    this.stage = ENV_STAGE.RELEASE;
    this.target = 0.0;
  }

  next(useAdsr) {
    if (!useAdsr && this.stage !== ENV_STAGE.RELEASE) {
      return 1.0;
    }

    switch (this.stage) {
      case ENV_STAGE.ATTACK:
        // Exponential approach to 1.0
        this.value = this.target + (this.value - this.target) * this.attackCoeff;
        if (this.value >= 0.999) {
          this.value = 1.0;
          this.stage = ENV_STAGE.DECAY;
          this.target = this.sustain;
        }
        break;
      case ENV_STAGE.DECAY:
        // Exponential approach to sustain level
        this.value = this.target + (this.value - this.target) * this.decayCoeff;
        if (Math.abs(this.value - this.sustain) < 0.001) {
          this.value = this.sustain;
          this.stage = ENV_STAGE.SUSTAIN;
        }
        break;
      case ENV_STAGE.SUSTAIN:
        this.value = this.sustain;
        break;
      case ENV_STAGE.RELEASE:
        // Exponential approach to 0
        this.value = this.value * this.releaseCoeff;
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

class LFO {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.shape = LFO_SHAPES.SINE;
    this.rate = 0.0;
    this.phase = 0.0;
    this.holdValue = 0.0;
  }

  reset() {
    this.phase = 0.0;
    this.holdValue = Math.random() * 2.0 - 1.0;
  }

  next() {
    if (this.rate <= 0.0) return 0.0;
    const prevPhase = this.phase;
    let phase = prevPhase + this.rate / this.sampleRate;
    if (phase >= 1.0) {
      phase -= 1.0;
      if (this.shape === LFO_SHAPES.SAMPLE_HOLD) {
        this.holdValue = Math.random() * 2.0 - 1.0;
      }
    }
    this.phase = phase;

    switch (this.shape) {
      case LFO_SHAPES.SINE:
        return Math.sin(TWO_PI * phase);
      case LFO_SHAPES.TRIANGLE:
        return 1.0 - 4.0 * Math.abs(phase - 0.5);
      case LFO_SHAPES.SQUARE:
        return phase < 0.5 ? 1.0 : -1.0;
      case LFO_SHAPES.SAW_UP:
        return 2.0 * phase - 1.0;
      case LFO_SHAPES.SAW_DOWN:
        return 1.0 - 2.0 * phase;
      case LFO_SHAPES.SAMPLE_HOLD:
        return this.holdValue;
      default:
        return 0.0;
    }
  }
}

// Topology-preserving-transform (Simper/Cytomic) state-variable filter.
// Unlike the Chamberlin SVF this discretization is unconditionally stable for
// any cutoff below Nyquist and any damping >= 0, so modulation can slam the
// cutoff against its ceiling without the state exploding into crackle.
class StateVariableFilter {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.cutoff = 18000;
    this.targetCutoff = 18000;
    this.resonance = 0.7;
    this.resonanceSmoothed = 0.7;
    this.ic1eq = 0.0;
    this.ic2eq = 0.0;
    this.mode = 0; // 0=lowpass
    // Smoothing coefficient (higher = slower smoothing)
    // ~10ms smoothing at 44100 Hz
    this.smoothCoeff = Math.exp(-1.0 / (0.01 * sampleRate));
  }

  getMaxCutoff() {
    return this.sampleRate * FILTER_MAX_CUTOFF_RATIO;
  }

  setParams({ cutoff, resonance, mode }) {
    if (typeof cutoff === 'number' && Number.isFinite(cutoff)) {
      this.targetCutoff = clamp(cutoff, 20, this.getMaxCutoff());
    }
    if (typeof resonance === 'number' && Number.isFinite(resonance)) {
      this.resonance = clamp(resonance, 0.1, 10.0);
    }
    if (typeof mode === 'number' && Number.isFinite(mode)) {
      this.mode = Math.floor(clamp(mode, 0, 3));
    }
  }

  reset() {
    this.ic1eq = 0.0;
    this.ic2eq = 0.0;
    this.cutoff = this.targetCutoff;
    this.resonanceSmoothed = this.resonance;
  }

  process(input, cutoffOverride) {
    // Apply one-pole smoothing to cutoff/resonance to prevent zipper noise
    const targetCutoff = typeof cutoffOverride === 'number' && Number.isFinite(cutoffOverride)
      ? clamp(cutoffOverride, 20, this.getMaxCutoff())
      : this.targetCutoff;

    this.cutoff = targetCutoff + (this.cutoff - targetCutoff) * this.smoothCoeff;
    this.resonanceSmoothed = this.resonance
      + (this.resonanceSmoothed - this.resonance) * this.smoothCoeff;

    const g = Math.tan(Math.PI * this.cutoff / this.sampleRate);
    const k = 1.0 / this.resonanceSmoothed;
    const a1 = 1.0 / (1.0 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;

    const v3 = input - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;
    this.ic1eq = 2.0 * v1 - this.ic1eq;
    this.ic2eq = 2.0 * v2 - this.ic2eq;

    let output;
    switch (this.mode) {
      case 1:
        output = input - k * v1 - v2; // high-pass
        break;
      case 2:
        output = v1; // band-pass
        break;
      case 3:
        output = input - k * v1; // notch
        break;
      default:
        output = v2; // low-pass
        break;
    }

    if (!Number.isFinite(output) || !Number.isFinite(this.ic1eq) || !Number.isFinite(this.ic2eq)) {
      this.reset();
      return 0.0;
    }

    return clamp(output, -VOICE_SAMPLE_LIMIT, VOICE_SAMPLE_LIMIT);
  }
}

// Sanitize a modRoutes array into flat typed arrays for the hot loop.
function compileModRoutes(routes, legacy) {
  const src = new Int8Array(MAX_MOD_ROUTES + 2);
  const dst = new Int8Array(MAX_MOD_ROUTES + 2);
  const depth = new Float32Array(MAX_MOD_ROUTES + 2);
  let count = 0;

  if (Array.isArray(routes)) {
    for (const route of routes) {
      if (count >= MAX_MOD_ROUTES) break;
      if (!route) continue;
      const s = Math.floor(route.src ?? -1);
      const d = Math.floor(route.dst ?? -1);
      const k = Number(route.depth);
      if (s < 0 || s > 6 || d < 0 || d > 4) continue;
      if (!Number.isFinite(k) || k === 0) continue;
      src[count] = s;
      dst[count] = d;
      depth[count] = clamp(k, -1, 1);
      count++;
    }
  }

  // Legacy single-LFO params map onto implicit LFO1 routes with the exact
  // scaling the old hardcoded targets used (pitch +/-2st, amp +/-1, cutoff
  // +/-4st), so existing presets/UI keep their sound.
  if (legacy && legacy.lfoDepth > 0 && legacy.lfoRate > 0) {
    if (legacy.lfoTarget === 1) {
      src[count] = MOD_SRC.LFO1;
      dst[count] = MOD_DST.PITCH;
      depth[count] = clamp(legacy.lfoDepth * 2 / 12, -1, 1);
      count++;
    } else if (legacy.lfoTarget === 2) {
      src[count] = MOD_SRC.LFO1;
      dst[count] = MOD_DST.AMP;
      depth[count] = clamp(legacy.lfoDepth, -1, 1);
      count++;
    } else if (legacy.lfoTarget === 3) {
      src[count] = MOD_SRC.LFO1;
      dst[count] = MOD_DST.CUTOFF;
      depth[count] = clamp(legacy.lfoDepth * (4 / 12) / 4, -1, 1);
      count++;
    }
  }

  // Which sources does the hot loop actually need to evaluate?
  let usesLfo1 = false;
  let usesLfo2 = false;
  let usesModEnv = false;
  for (let i = 0; i < count; i++) {
    if (src[i] === MOD_SRC.LFO1) usesLfo1 = true;
    else if (src[i] === MOD_SRC.LFO2) usesLfo2 = true;
    else if (src[i] === MOD_SRC.MOD_ENV) usesModEnv = true;
  }

  return {
    src,
    dst,
    depth,
    // Smoothed per-route depth (~20ms) to avoid zipper clicks while dragging
    // depth controls; seeded by the caller.
    depthSmoothed: new Float32Array(depth),
    count,
    usesLfo1,
    usesLfo2,
    usesModEnv
  };
}

class Voice {
  constructor(sampleRate) {
    this.sampleRate = sampleRate;
    this.active = false;
    this.noteId = null;
    this.frequency = 440; // glide-smoothed current frequency
    this.targetFrequency = 440;
    this.glideCoeff = 0.0; // 0 = no glide
    this.velocity = 1.0;
    this.keyTrack = 0.0;
    this.waveform = WAVEFORMS.SINE;
    this.phase = 0.0;
    this.modPhase = 0.0;
    this.prevFmOffset = 0.0;
    this.envelope = new Envelope(sampleRate);
    this.modEnvelope = new Envelope(sampleRate);
    this.filter = new StateVariableFilter(sampleRate);
    this.lfo1 = new LFO(sampleRate);
    this.lfo2 = new LFO(sampleRate);
    this.useFilter = false;
    this.useFM = false;
    this.fmRatio = 2.0;
    this.fmIndex = 0.0;
    this.useADSR = true;
    this.startFrame = 0;
    this.unisonVoices = 1;
    this.unisonDetune = 0.0;
    this.unisonPhases = new Float32Array(4);
    this.routes = compileModRoutes([], null);
    // ~20ms depth smoothing at 44100 Hz
    this.depthSmoothCoeff = Math.exp(-1.0 / (0.02 * sampleRate));
    // Voice stealing fade-out
    this.isBeingStolen = false;
    this.stealFadeGain = 1.0;
    // Fade-out rate: complete in ~5ms at 44100 Hz
    this.stealFadeRate = 1.0 / (0.005 * sampleRate);
    // Note waiting for the steal fade to finish before it starts (click-free
    // steal/retrigger: never hard-reset a phase that is still audible).
    this.pendingStart = null;
  }

  applyParams(params) {
    this.useADSR = params.useADSR !== false;
    this.envelope.setADSR(
      params.attack ?? 0.01,
      params.decay ?? 0.1,
      params.sustain ?? 0.8,
      params.release ?? 0.3
    );
    this.modEnvelope.setADSR(
      params.modAttack ?? 0.05,
      params.modDecay ?? 0.3,
      params.modSustain ?? 0.5,
      params.modRelease ?? 0.4
    );

    this.useFM = !!params.useFM;
    this.fmRatio = typeof params.fmRatio === 'number' ? params.fmRatio : this.fmRatio;
    const fmIndex = typeof params.fmIndex === 'number' ? params.fmIndex : this.fmIndex * TWO_PI;
    this.fmIndex = fmIndex / TWO_PI; // radians -> cycles

    this.useFilter = !!params.useFilter;
    this.filter.setParams({
      cutoff: params.filterCutoff,
      resonance: params.filterResonance,
      mode: params.filterMode
    });

    this.lfo1.shape = clamp(Math.floor(params.lfo1Shape ?? 0), 0, 5);
    this.lfo1.rate = clamp(params.lfoRate ?? 0, 0, 40);
    this.lfo2.shape = clamp(Math.floor(params.lfo2Shape ?? 0), 0, 5);
    this.lfo2.rate = clamp(params.lfo2Rate ?? 0, 0, 40);

    this.unisonVoices = clamp(params.unisonVoices ?? this.unisonVoices, 1, 4);
    this.unisonDetune = params.unisonDetune ?? this.unisonDetune;

    const prevRoutes = this.routes;
    const nextRoutes = compileModRoutes(params.modRoutes, {
      lfoRate: params.lfoRate ?? 0,
      lfoDepth: params.lfoDepth ?? 0,
      lfoTarget: params.lfoTarget ?? 0
    });
    if (this.active && prevRoutes) {
      // Carry over smoothed depths for matching routes; new routes ramp in
      // from zero so live edits never click.
      for (let i = 0; i < nextRoutes.count; i++) {
        nextRoutes.depthSmoothed[i] = 0;
        for (let j = 0; j < prevRoutes.count; j++) {
          if (prevRoutes.src[j] === nextRoutes.src[i] && prevRoutes.dst[j] === nextRoutes.dst[i]) {
            nextRoutes.depthSmoothed[i] = prevRoutes.depthSmoothed[j];
            break;
          }
        }
      }
    }
    this.routes = nextRoutes;

    const glideTime = params.glideTime ?? 0;
    this.glideCoeff = glideTime > 0.001
      ? Math.exp(-1.0 / (glideTime * this.sampleRate / 4.0))
      : 0.0;
  }

  // Click-free (re)start of an audibly-active voice: fade the current signal
  // out in ~5ms, then start the new note. Inactive voices start immediately.
  queueStart(startData) {
    if (!this.active) {
      this.start(startData);
      return;
    }
    this.pendingStart = startData;
    if (!this.isBeingStolen) {
      this.stealFadeGain = 1.0;
      this.isBeingStolen = true;
    }
  }

  start({ noteId, frequency, waveform, velocity, params, frame, glideFrom }) {
    this.noteId = noteId;
    this.targetFrequency = frequency;
    this.waveform = normalizeWaveform(waveform);
    this.active = true;
    this.startFrame = frame;
    // Reset steal fade state
    this.isBeingStolen = false;
    this.stealFadeGain = 1.0;
    this.pendingStart = null;

    const phaseOffset = (params.phaseOffsetDeg ?? 0) / 360.0;
    this.phase = phaseOffset % 1.0;
    this.modPhase = 0.0;
    this.prevFmOffset = 0.0;

    // Velocity curve: exponent 2^(2*curve); curve<0 = soft (compressed),
    // curve>0 = hard (expanded), 0 = linear.
    const rawVelocity = clamp(velocity ?? 1.0, 0.0, 1.0);
    const curve = clamp(params.velocityCurve ?? 0, -1, 1);
    this.velocity = curve === 0
      ? rawVelocity
      : Math.pow(rawVelocity, Math.pow(2, curve * 2));

    // Key tracking: -1..+1 across +/-2 octaves around middle C
    this.keyTrack = clamp(Math.log2(frequency / 261.63) / 2.0, -1, 1);

    this.applyParams(params);
    // Fresh note: no ramp-in needed, the amp envelope masks the onset.
    this.routes.depthSmoothed.set(this.routes.depth);

    // Glide starts from the previously played note, if any
    this.frequency = (this.glideCoeff > 0 && glideFrom && glideFrom > 0)
      ? glideFrom
      : frequency;

    this.envelope.noteOn();
    this.modEnvelope.noteOn();
    if (!this.useADSR) {
      this.envelope.setImmediate();
    }

    this.filter.reset();
    this.lfo1.reset();
    this.lfo2.reset();

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
    this.modEnvelope.noteOff();
  }

  updateParams(params) {
    if (!this.active) return;
    this.applyParams(params);
    if (!this.useADSR) {
      this.envelope.setImmediate();
    }
  }

  nextSample(bendMul, modWheel) {
    if (!this.active) return 0.0;

    // Glide toward the target frequency
    if (this.glideCoeff > 0 && this.frequency !== this.targetFrequency) {
      this.frequency = this.targetFrequency + (this.frequency - this.targetFrequency) * this.glideCoeff;
      if (Math.abs(this.frequency - this.targetFrequency) < 0.01) {
        this.frequency = this.targetFrequency;
      }
    } else if (this.glideCoeff === 0) {
      this.frequency = this.targetFrequency;
    }

    const envValue = this.envelope.next(this.useADSR);
    const routes = this.routes;

    // --- Evaluate modulation sources (only the ones routed) ---
    const lfo1Value = routes.usesLfo1 ? this.lfo1.next() : 0.0;
    const lfo2Value = routes.usesLfo2 ? this.lfo2.next() : 0.0;
    const modEnvValue = routes.usesModEnv ? this.modEnvelope.next(true) : 0.0;

    // --- Accumulate routed modulation per destination ---
    let pitchSemis = 0.0;
    let cutoffOct = 0.0;
    let ampOffset = 0.0;
    let fmIndexAdd = 0.0; // radians
    let detuneAdd = 0.0; // cents

    for (let i = 0; i < routes.count; i++) {
      let value;
      switch (routes.src[i]) {
        case MOD_SRC.LFO1: value = lfo1Value; break;
        case MOD_SRC.LFO2: value = lfo2Value; break;
        case MOD_SRC.AMP_ENV: value = envValue; break;
        case MOD_SRC.MOD_ENV: value = modEnvValue; break;
        case MOD_SRC.VELOCITY: value = this.velocity; break;
        case MOD_SRC.KEY_TRACK: value = this.keyTrack; break;
        case MOD_SRC.MOD_WHEEL: value = modWheel; break;
        default: value = 0.0; break;
      }
      const target = routes.depth[i];
      const smoothed = target + (routes.depthSmoothed[i] - target) * this.depthSmoothCoeff;
      routes.depthSmoothed[i] = smoothed;
      const amount = value * smoothed;
      switch (routes.dst[i]) {
        case MOD_DST.PITCH: pitchSemis += amount * 12.0; break;
        case MOD_DST.CUTOFF: cutoffOct += amount * 4.0; break;
        case MOD_DST.AMP: ampOffset += amount; break;
        case MOD_DST.FM_INDEX: fmIndexAdd += amount * 10.0; break;
        case MOD_DST.DETUNE: detuneAdd += amount * 50.0; break;
        default: break;
      }
    }

    // --- Oscillator section ---
    let pitchMultiplier = bendMul;
    if (pitchSemis !== 0.0) {
      pitchMultiplier *= Math.pow(2, pitchSemis / 12.0);
    }

    const baseFrequency = this.frequency * pitchMultiplier;
    const baseDt = baseFrequency / this.sampleRate;

    let fmOffset = 0.0;
    let effFmIndex = (this.useFM ? this.fmIndex : 0.0) + fmIndexAdd / TWO_PI;
    if (effFmIndex !== 0.0) {
      // Carson-rule anti-alias cap: the highest significant PM sideband sits
      // near fc + (I+1)*fm with I in radians. Keeping it below ~0.42*fs stops
      // bright FM patches from sparkling with aliased partials at high notes.
      const fmFreq = this.fmRatio * baseFrequency;
      if (fmFreq > 0) {
        const maxIndexCycles = Math.max(
          0.0,
          (0.42 * this.sampleRate - baseFrequency) / fmFreq - 1.0
        ) / TWO_PI;
        effFmIndex = clamp(effFmIndex, -maxIndexCycles, maxIndexCycles);
      }
      const modPhase = (this.modPhase + (this.fmRatio * baseDt)) % 1.0;
      this.modPhase = modPhase;
      fmOffset = Math.sin(TWO_PI * modPhase) * effFmIndex;
    }
    // Phase modulation raises the instantaneous frequency; widen the polyBLEP
    // transition band by the per-sample phase deviation so saw/square/triangle
    // carriers stay anti-aliased under FM.
    const fmRate = Math.abs(fmOffset - this.prevFmOffset);
    this.prevFmOffset = fmOffset;

    let oscSum = 0.0;
    const unison = this.unisonVoices;
    const effDetune = this.unisonDetune + detuneAdd;
    for (let i = 0; i < unison; i++) {
      const detune = (i - (unison - 1) / 2) * effDetune;
      const detuneRatio = detune === 0 ? 1.0 : Math.pow(2, detune / 1200.0);
      const phase = this.unisonPhases[i];
      const phaseWithMod = (phase + fmOffset) % 1.0;
      const dt = Math.min(0.45, baseDt * detuneRatio + fmRate);
      oscSum += waveformSample(this.waveform, phaseWithMod < 0 ? phaseWithMod + 1.0 : phaseWithMod, dt);
      this.unisonPhases[i] = (phase + baseDt * detuneRatio) % 1.0;
    }

    let sample = oscSum / unison;

    // --- Amplitude section ---
    sample *= envValue * this.velocity;
    if (ampOffset !== 0.0) {
      sample *= Math.max(0.0, 1.0 + ampOffset);
    }

    // --- Filter section ---
    if (this.useFilter) {
      if (cutoffOct !== 0.0) {
        const modCutoff = this.filter.targetCutoff * Math.pow(2, cutoffOct);
        sample = this.filter.process(sample, modCutoff);
      } else {
        sample = this.filter.process(sample);
      }
    }

    // Apply steal fade-out if being stolen
    if (this.isBeingStolen) {
      this.stealFadeGain -= this.stealFadeRate;
      if (this.stealFadeGain <= 0.0) {
        this.stealFadeGain = 0.0;
        this.active = false;
        this.noteId = null;
        this.isBeingStolen = false;
        const pending = this.pendingStart;
        this.pendingStart = null;
        if (pending) {
          this.start(pending);
        }
        return 0.0;
      }
      sample *= this.stealFadeGain;
    }

    if (this.envelope.isIdle() && envValue <= MIN_GAIN) {
      this.active = false;
      this.noteId = null;
    }

    if (!Number.isFinite(sample)) {
      this.filter.reset();
      this.active = false;
      this.noteId = null;
      return 0.0;
    }

    return clamp(sample, -VOICE_SAMPLE_LIMIT, VOICE_SAMPLE_LIMIT);
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
    this.lastFrequency = 0; // for glide
    // Performance state (not part of presets)
    this.pitchBendTarget = 0.0; // semitones
    this.pitchBendSmoothed = 0.0;
    this.modWheelTarget = 0.0; // 0..1
    this.modWheelSmoothed = 0.0;
    // ~5ms smoothing for performance controllers
    this.perfSmoothCoeff = Math.exp(-1.0 / (0.005 * sampleRate));
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
        case 'pitchBend':
          this.pitchBendTarget = clamp(Number(data.value) || 0, -24, 24);
          break;
        case 'modWheel':
          this.modWheelTarget = clamp(Number(data.value) || 0, 0, 1);
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
    // queueStart fades a still-audible voice before restarting it, so steals
    // and same-note retriggers never hard-reset a live phase (no clicks).
    targetVoice.queueStart({
      noteId,
      frequency,
      waveform,
      velocity,
      params: this.params,
      frame: this.frameCounter,
      glideFrom: this.lastFrequency
    });
    this.lastFrequency = frequency;
  }

  noteOff(noteId) {
    if (!noteId) return;
    for (const voice of this.voices) {
      // A note released while still queued behind a steal fade must never
      // start: cancelling here is its noteOff (otherwise it rings forever).
      if (voice.pendingStart && voice.pendingStart.noteId === noteId) {
        voice.pendingStart = null;
      }
      if (voice.active && voice.noteId === noteId) {
        voice.release();
      }
    }
  }

  allNotesOff() {
    for (const voice of this.voices) {
      voice.pendingStart = null;
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
    let candidateScore = Infinity;

    for (const voice of this.voices) {
      // Score voices: lower is better to steal
      // Prefer: releasing > oldest > loudest
      let score = 0;

      // A voice already fading toward a queued note is the worst candidate:
      // re-stealing it would silently drop that queued note.
      if (voice.pendingStart) {
        score += 200000;
      }

      // Voices in release phase are best candidates
      if (voice.envelope.stage === ENV_STAGE.RELEASE) {
        score -= 100000;
      }

      // Older voices are better candidates
      score -= (this.frameCounter - voice.startFrame);

      // Quieter voices are better candidates
      score -= (1.0 - voice.envelope.value) * 10000;

      if (score < candidateScore) {
        candidateScore = score;
        candidate = voice;
      }
    }

    // Caller queues the note via queueStart, which fades the stolen voice
    // out before restarting it.
    return candidate;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const left = output[0];
    const right = output[1] || output[0];
    const frameCount = left.length;
    const mixGain = 0.2;

    for (let i = 0; i < frameCount; i++) {
      // Smooth performance controllers
      this.pitchBendSmoothed = this.pitchBendTarget
        + (this.pitchBendSmoothed - this.pitchBendTarget) * this.perfSmoothCoeff;
      this.modWheelSmoothed = this.modWheelTarget
        + (this.modWheelSmoothed - this.modWheelTarget) * this.perfSmoothCoeff;

      const bendMul = (this.pitchBendSmoothed > 0.0005 || this.pitchBendSmoothed < -0.0005)
        ? Math.pow(2, this.pitchBendSmoothed / 12.0)
        : 1.0;

      let sample = 0.0;
      for (const voice of this.voices) {
        if (voice.active) {
          sample += voice.nextSample(bendMul, this.modWheelSmoothed);
        }
      }
      sample *= mixGain;
      sample = Number.isFinite(sample) ? Math.tanh(sample) : 0.0;
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
