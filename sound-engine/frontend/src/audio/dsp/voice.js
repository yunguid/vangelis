// One polyphonic voice: oscillator stack (unison + FM), dual envelopes, dual
// LFOs, per-voice SVF, mod-matrix evaluation, glide, and click-free stealing.

import { TWO_PI, WAVEFORMS, MOD_SRC, MOD_DST, MAX_MOD_ROUTES, MIN_GAIN, VOICE_SAMPLE_LIMIT, DEFAULT_PARAMS, clamp } from './constants.js';
import { waveformSample, normalizeWaveform } from './oscillator.js';
import { Envelope } from './envelope.js';
import { LFO } from './lfo.js';
import { StateVariableFilter } from './svf.js';

export class Voice {
  // routesBox is the processor-owned holder of the shared compiled route
  // template ({ compiled }); the processor swaps box.compiled on setParams so
  // voices never compile (or allocate) routes themselves.
  constructor(sampleRate, routesBox) {
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
    // Stereo filter pair: the R filter is only exercised when unison spreads
    // the sub-voices (mono voices process L and copy, keeping cost flat).
    this.filterL = new StateVariableFilter(sampleRate);
    this.filterR = new StateVariableFilter(sampleRate);
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
    // Equal-power pan gains per unison sub-voice (unity at center so a
    // single-voice note renders identically on both channels).
    this.unisonGainL = new Float32Array(4);
    this.unisonGainR = new Float32Array(4);
    this.outL = 0.0;
    this.outR = 0.0;
    this.routesBox = routesBox;
    this.routes = routesBox.compiled;
    // Per-voice smoothed route depths (~20ms) + a scratch buffer so route
    // swaps can carry matching depths over without allocating.
    this.depthSmoothed = new Float32Array(MAX_MOD_ROUTES + 2);
    this.depthScratch = new Float32Array(MAX_MOD_ROUTES + 2);
    this.depthSmoothCoeff = Math.exp(-1.0 / (0.02 * sampleRate));
    // Voice stealing fade-out
    this.isBeingStolen = false;
    this.stealFadeGain = 1.0;
    // Fade-out rate: complete in ~5ms at the context sample rate
    this.stealFadeRate = 1.0 / (0.005 * sampleRate);
    // Note waiting for the steal fade to finish before it starts (click-free
    // steal/retrigger: never hard-reset a phase that is still audible).
    this.pendingStart = null;
  }

  applyParams(params) {
    this.useADSR = params.useADSR !== false;
    this.envelope.setADSR(
      params.attack ?? DEFAULT_PARAMS.attack,
      params.decay ?? DEFAULT_PARAMS.decay,
      params.sustain ?? DEFAULT_PARAMS.sustain,
      params.release ?? DEFAULT_PARAMS.release
    );
    this.modEnvelope.setADSR(
      params.modAttack ?? DEFAULT_PARAMS.modAttack,
      params.modDecay ?? DEFAULT_PARAMS.modDecay,
      params.modSustain ?? DEFAULT_PARAMS.modSustain,
      params.modRelease ?? DEFAULT_PARAMS.modRelease
    );

    this.useFM = !!params.useFM;
    this.fmRatio = typeof params.fmRatio === 'number' ? params.fmRatio : this.fmRatio;
    const fmIndex = typeof params.fmIndex === 'number' ? params.fmIndex : this.fmIndex * TWO_PI;
    this.fmIndex = fmIndex / TWO_PI; // radians -> cycles

    this.useFilter = !!params.useFilter;
    const filterParams = {
      cutoff: params.filterCutoff,
      resonance: params.filterResonance,
      mode: params.filterMode
    };
    this.filterL.setParams(filterParams);
    this.filterR.setParams(filterParams);

    this.lfo1.shape = clamp(Math.floor(params.lfo1Shape ?? 0), 0, 5);
    this.lfo1.rate = clamp(params.lfoRate ?? 0, 0, 40);
    this.lfo2.shape = clamp(Math.floor(params.lfo2Shape ?? 0), 0, 5);
    this.lfo2.rate = clamp(params.lfo2Rate ?? 0, 0, 40);

    this.unisonVoices = clamp(params.unisonVoices ?? this.unisonVoices, 1, 4);
    this.unisonDetune = params.unisonDetune ?? this.unisonDetune;

    // Equal-power pan per sub-voice across a fixed spread; sqrt(2)-normalized
    // so a centered sub-voice has unity gain on both channels (n=1 keeps the
    // engine's historical mono behavior exactly).
    const n = this.unisonVoices;
    const UNISON_SPREAD = 0.8;
    const SQRT2 = Math.SQRT2;
    for (let i = 0; i < 4; i++) {
      const pan = n > 1 && i < n ? ((i / (n - 1)) * 2 - 1) * UNISON_SPREAD : 0;
      const theta = ((pan + 1) * Math.PI) / 4;
      this.unisonGainL[i] = SQRT2 * Math.cos(theta);
      this.unisonGainR[i] = SQRT2 * Math.sin(theta);
    }

    const prevRoutes = this.routes;
    const nextRoutes = this.routesBox.compiled;
    if (this.active && prevRoutes !== nextRoutes) {
      // Carry over smoothed depths for matching routes; new routes ramp in
      // from zero so live edits never click. Scratch buffer first — the new
      // route order may permute indices we still need to read.
      const scratch = this.depthScratch;
      for (let i = 0; i < nextRoutes.count; i++) {
        scratch[i] = 0;
        for (let j = 0; j < prevRoutes.count; j++) {
          if (prevRoutes.src[j] === nextRoutes.src[i] && prevRoutes.dst[j] === nextRoutes.dst[i]) {
            scratch[i] = this.depthSmoothed[j];
            break;
          }
        }
      }
      this.depthSmoothed.set(scratch);
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
    this.depthSmoothed.set(this.routes.depth);

    // Glide starts from the previously played note, if any
    this.frequency = (this.glideCoeff > 0 && glideFrom && glideFrom > 0)
      ? glideFrom
      : frequency;

    this.envelope.noteOn();
    this.modEnvelope.noteOn();
    if (!this.useADSR) {
      this.envelope.setImmediate();
    }

    this.filterL.reset();
    this.filterR.reset();
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

  // Renders one stereo sample into this.outL/this.outR (fields, not returns,
  // so the hot loop never allocates).
  nextSample(bendMul, modWheel) {
    if (!this.active) {
      this.outL = 0.0;
      this.outR = 0.0;
      return;
    }

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
      const smoothed = target + (this.depthSmoothed[i] - target) * this.depthSmoothCoeff;
      this.depthSmoothed[i] = smoothed;
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

    const unison = this.unisonVoices;
    const stereo = unison > 1;
    let oscL = 0.0;
    let oscR = 0.0;
    const effDetune = this.unisonDetune + detuneAdd;
    for (let i = 0; i < unison; i++) {
      const detune = (i - (unison - 1) / 2) * effDetune;
      const detuneRatio = detune === 0 ? 1.0 : Math.pow(2, detune / 1200.0);
      const phase = this.unisonPhases[i];
      const phaseWithMod = (phase + fmOffset) % 1.0;
      const dt = Math.min(0.45, baseDt * detuneRatio + fmRate);
      const s = waveformSample(this.waveform, phaseWithMod < 0 ? phaseWithMod + 1.0 : phaseWithMod, dt);
      if (stereo) {
        oscL += s * this.unisonGainL[i];
        oscR += s * this.unisonGainR[i];
      } else {
        oscL += s;
      }
      this.unisonPhases[i] = (phase + baseDt * detuneRatio) % 1.0;
    }

    let sampleL = oscL / unison;
    let sampleR = stereo ? oscR / unison : sampleL;

    // --- Amplitude section ---
    let amp = envValue * this.velocity;
    if (ampOffset !== 0.0) {
      amp *= Math.max(0.0, 1.0 + ampOffset);
    }
    sampleL *= amp;
    sampleR = stereo ? sampleR * amp : sampleL;

    // --- Filter section (R filter only pays when the voice is spread) ---
    if (this.useFilter) {
      const modCutoff = cutoffOct !== 0.0
        ? this.filterL.targetCutoff * Math.pow(2, cutoffOct)
        : undefined;
      sampleL = this.filterL.process(sampleL, modCutoff);
      sampleR = stereo ? this.filterR.process(sampleR, modCutoff) : sampleL;
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
        this.outL = 0.0;
        this.outR = 0.0;
        return;
      }
      sampleL *= this.stealFadeGain;
      sampleR *= this.stealFadeGain;
    }

    if (this.envelope.isIdle() && envValue <= MIN_GAIN) {
      this.active = false;
      this.noteId = null;
    }

    if (!Number.isFinite(sampleL) || !Number.isFinite(sampleR)) {
      this.filterL.reset();
      this.filterR.reset();
      this.active = false;
      this.noteId = null;
      this.outL = 0.0;
      this.outR = 0.0;
      return;
    }

    this.outL = clamp(sampleL, -VOICE_SAMPLE_LIMIT, VOICE_SAMPLE_LIMIT);
    this.outR = clamp(sampleR, -VOICE_SAMPLE_LIMIT, VOICE_SAMPLE_LIMIT);
  }
}
