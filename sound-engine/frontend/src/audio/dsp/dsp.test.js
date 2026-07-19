import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS, ENV_STAGE, LFO_SHAPES, MOD_SRC, MOD_DST, WAVEFORMS } from './constants.js';
import { WORKLET_PARAM_DEFAULTS } from '../../utils/audioParams.js';
import { polyBlep, polyBlep4, polyBlamp, polyBlamp4, waveformSample, normalizeWaveform } from './oscillator.js';
import { Envelope } from './envelope.js';
import { LFO } from './lfo.js';
import { StateVariableFilter } from './svf.js';
import { compileModRoutes } from './mod-routes.js';
import { Voice } from './voice.js';

const SR = 48000;

describe('parameter defaults', () => {
  it('UI-derived worklet defaults agree with the engine source of truth', () => {
    // B2 regression pin: DEFAULT_PARAMS (dsp/constants.js) is canonical;
    // AUDIO_PARAM_DEFAULTS derives from it, and the round trip through
    // toWorkletParams must reproduce it exactly.
    expect(WORKLET_PARAM_DEFAULTS).toEqual(DEFAULT_PARAMS);
  });
});

describe('oscillator', () => {
  it('normalizeWaveform maps names, numbers, and garbage', () => {
    expect(normalizeWaveform('Sawtooth')).toBe(WAVEFORMS.SAW);
    expect(normalizeWaveform(' saw ')).toBe(WAVEFORMS.SAW);
    expect(normalizeWaveform('SQUARE')).toBe(WAVEFORMS.SQUARE);
    expect(normalizeWaveform(3.7)).toBe(WAVEFORMS.TRIANGLE);
    expect(normalizeWaveform(-5)).toBe(WAVEFORMS.SINE);
    expect(normalizeWaveform(undefined)).toBe(WAVEFORMS.SINE);
    expect(normalizeWaveform('theremin')).toBe(WAVEFORMS.SINE);
  });

  it('polyBLEP residual is zero away from discontinuities and continuous at them', () => {
    const dt = 0.01;
    expect(polyBlep(0.5, dt)).toBe(0);
    expect(polyBlep(dt * 1.001, dt)).toBeCloseTo(0, 5);
    // Residual jumps by -2 across phase 0 to cancel the naive saw's +2 step
    expect(polyBlep(1e-9, dt) - polyBlep(1 - 1e-9, dt)).toBeCloseTo(-2, 3);
  });

  it('polyBlep4 residual is continuous, windowed to ±2dt, and step-matched', () => {
    const dt = 0.01;
    const eps = 1e-9;
    // Continuous across the x=1 branch boundary on both sides of the edge
    expect(polyBlep4(dt - eps, dt)).toBeCloseTo(polyBlep4(dt + eps, dt), 6);
    expect(polyBlep4(1 - dt - eps, dt)).toBeCloseTo(polyBlep4(1 - dt + eps, dt), 6);
    // Fades to zero at the ±2dt window edge, zero outside it
    expect(polyBlep4(2 * dt - eps, dt)).toBeCloseTo(0, 6);
    expect(polyBlep4(1 - 2 * dt + eps, dt)).toBeCloseTo(0, 6);
    expect(polyBlep4(0.5, dt)).toBe(0);
    // Residual jumps by -2 across the wrap: same convention as polyBlep,
    // cancelling the naive saw's +2 step
    expect(polyBlep4(eps, dt) - polyBlep4(1 - eps, dt)).toBeCloseTo(-2, 3);
  });

  it('polyBlamp4 residual is even, continuous, and windowed to ±2dt', () => {
    const dt = 0.01;
    const eps = 1e-9;
    expect(polyBlamp4(0, dt)).toBeCloseTo(7 / 30, 9); // corner value
    // Even in distance from the corner (phase 0 wraps: t and 1-t match)
    expect(polyBlamp4(0.005, dt)).toBeCloseTo(polyBlamp4(0.995, dt), 9);
    // Continuous across the d=1 branch boundary
    expect(polyBlamp4(dt - eps, dt)).toBeCloseTo(polyBlamp4(dt + eps, dt), 6);
    // Quintic tail reaches zero at the window edge, zero outside
    expect(polyBlamp4(2 * dt - eps, dt)).toBeCloseTo(0, 6);
    expect(polyBlamp4(0.5, dt)).toBe(0);
  });

  it('polyBLAMP residual is zero away from corners', () => {
    const dt = 0.01;
    expect(polyBlamp(0.5, dt)).toBe(0);
    expect(Math.abs(polyBlamp(dt / 2, dt))).toBeGreaterThan(0);
  });

  it('all waveforms stay bounded over a full cycle at high pitch', () => {
    const dt = 5000 / SR; // ~5kHz: wide BLEP transition bands
    for (const wf of [WAVEFORMS.SINE, WAVEFORMS.SAW, WAVEFORMS.SQUARE, WAVEFORMS.TRIANGLE]) {
      for (let p = 0; p < 1; p += 1 / 512) {
        const s = waveformSample(wf, p, dt);
        expect(Number.isFinite(s)).toBe(true);
        expect(Math.abs(s)).toBeLessThanOrEqual(1.35); // BLEP overshoot allowance
      }
    }
  });

  it('preserves modulo phase advancement on common and multi-wrap inputs', () => {
    const params = {
      ...DEFAULT_PARAMS,
      useADSR: false,
      useFM: false,
      useFilter: false,
      lfoRate: 0,
      lfoDepth: 0,
      modRoutes: [],
      unisonVoices: 4,
      unisonDetune: 12
    };

    for (const frequency of [1000, 96000]) {
      const routesBox = { compiled: compileModRoutes(params.modRoutes, params) };
      const voice = new Voice(SR, routesBox);
      voice.start({
        noteId: `phase-${frequency}`,
        frequency,
        waveform: 'saw',
        velocity: 1,
        params,
        frame: 0,
        glideFrom: 0
      });
      const initialPhases = Float32Array.from([0.999, 0.2, 0.7, 0.95]);
      voice.unisonPhases.set(initialPhases);
      const expected = Array.from(initialPhases, (phase, index) => (
        Math.fround((phase + (frequency / SR) * voice.unisonDetuneRatios[index]) % 1.0)
      ));

      voice.nextSample(1.0, 0.0);

      expect(Array.from(voice.unisonPhases)).toEqual(expected);
    }
  });
});

describe('envelope', () => {
  it('walks ATTACK -> DECAY -> SUSTAIN and releases to IDLE', () => {
    const env = new Envelope(SR);
    env.setADSR(0.005, 0.01, 0.5, 0.01);
    env.noteOn();
    expect(env.stage).toBe(ENV_STAGE.ATTACK);
    let last = 0;
    for (let i = 0; i < SR * 0.1 && env.stage !== ENV_STAGE.SUSTAIN; i++) last = env.next(true);
    expect(env.stage).toBe(ENV_STAGE.SUSTAIN);
    expect(env.next(true)).toBeCloseTo(0.5, 6);
    env.noteOff();
    expect(env.stage).toBe(ENV_STAGE.RELEASE);
    for (let i = 0; i < SR * 0.2 && !env.isIdle(); i++) env.next(true);
    expect(env.isIdle()).toBe(true);
    expect(env.next(true)).toBe(0);
  });

  it('bypasses shaping when useADSR=false but still releases', () => {
    const env = new Envelope(SR);
    env.setADSR(1, 1, 0.2, 0.005);
    env.noteOn();
    expect(env.next(false)).toBe(1.0);
    env.noteOff();
    for (let i = 0; i < SR * 0.1 && !env.isIdle(); i++) env.next(false);
    expect(env.isIdle()).toBe(true);
  });

  it('setImmediate jumps straight to full sustain', () => {
    const env = new Envelope(SR);
    env.setADSR(2, 2, 0.3, 0.3);
    env.noteOn();
    env.setImmediate();
    expect(env.value).toBe(1.0);
    expect(env.stage).toBe(ENV_STAGE.SUSTAIN);
  });
});

describe('lfo', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is silent at rate 0 and advances phase at the requested rate', () => {
    const lfo = new LFO(SR);
    expect(lfo.next()).toBe(0);
    lfo.shape = LFO_SHAPES.SAW_UP;
    lfo.rate = 2; // 2 Hz
    for (let i = 0; i < SR / 4; i++) lfo.next(); // quarter period
    expect(lfo.phase).toBeCloseTo(0.5, 2);
  });

  it('produces each shape within [-1, 1]', () => {
    for (const shape of Object.values(LFO_SHAPES)) {
      const lfo = new LFO(SR);
      lfo.shape = shape;
      lfo.rate = 5;
      lfo.reset();
      for (let i = 0; i < 20000; i++) {
        const v = lfo.next();
        expect(Math.abs(v)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('sample & hold redraws once per cycle from Math.random', () => {
    const lfo = new LFO(SR);
    lfo.shape = LFO_SHAPES.SAMPLE_HOLD;
    lfo.rate = 100; // 480 samples per cycle
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.75);
    lfo.reset();
    expect(lfo.next()).toBeCloseTo(0.5, 9); // 0.75*2-1
    spy.mockReturnValue(0.25);
    let v = 0;
    for (let i = 0; i < 481; i++) v = lfo.next();
    expect(v).toBeCloseTo(-0.5, 9); // redrawn at the wrap
  });
});

describe('dc blocker', () => {
  it('removes a DC step within ~100ms', async () => {
    const { DCBlocker } = await import('./dc-blocker.js');
    const dc = new DCBlocker(SR);
    let y = 0;
    for (let i = 0; i < SR * 0.1; i++) y = dc.process(0.5);
    expect(Math.abs(y)).toBeLessThan(0.05 * 0.5);
    for (let i = 0; i < SR * 0.4; i++) y = dc.process(0.5);
    expect(Math.abs(y)).toBeLessThan(1e-3);
  });

  it('passes audio-rate content at ~unity gain', async () => {
    const { DCBlocker } = await import('./dc-blocker.js');
    const dc = new DCBlocker(SR);
    const f = 100; // worst realistic case: low bass fundamental
    let peak = 0;
    for (let i = 0; i < SR; i++) {
      const y = dc.process(Math.sin((TWO_PI_TEST * f * i) / SR));
      if (i > SR / 2) peak = Math.max(peak, Math.abs(y));
    }
    expect(peak).toBeGreaterThan(0.995);
    expect(peak).toBeLessThanOrEqual(1.005);
  });
});

const TWO_PI_TEST = Math.PI * 2;

describe('state-variable filter', () => {
  it('lowpass passes DC and attenuates near-Nyquist input', () => {
    const f = new StateVariableFilter(SR);
    f.setParams({ cutoff: 1000, resonance: 0.7, mode: 0 });
    f.reset();
    let out = 0;
    for (let i = 0; i < SR * 0.05; i++) out = f.process(1.0);
    expect(out).toBeCloseTo(1.0, 2);

    f.reset();
    let peak = 0;
    for (let i = 0; i < 4096; i++) {
      const hf = Math.sin(Math.PI * 0.9 * i); // ~0.45*fs
      peak = Math.max(peak, Math.abs(f.process(hf)));
    }
    expect(peak).toBeLessThan(0.05);
  });

  it('survives cutoff slammed to the ceiling at max resonance', () => {
    const f = new StateVariableFilter(SR);
    f.setParams({ cutoff: 20, resonance: 10, mode: 0 });
    f.reset();
    for (let i = 0; i < 20000; i++) {
      const drive = Math.sin(0.3 * i) * 2;
      const override = i % 2 === 0 ? f.getMaxCutoff() : 20;
      const out = f.process(drive, override);
      expect(Number.isFinite(out)).toBe(true);
      expect(Math.abs(out)).toBeLessThanOrEqual(8.0);
    }
  });

  it('clamps setParams garbage instead of absorbing it', () => {
    const f = new StateVariableFilter(SR);
    f.setParams({ cutoff: 1e9, resonance: -5, mode: 42 });
    expect(f.targetCutoff).toBe(f.getMaxCutoff());
    expect(f.resonance).toBe(0.1);
    expect(f.mode).toBe(3);
    f.setParams({ cutoff: NaN, resonance: Infinity });
    expect(f.targetCutoff).toBe(f.getMaxCutoff());
    expect(f.resonance).toBe(0.1);
  });

  it('reuses settled coefficients until cutoff or resonance changes', () => {
    const f = new StateVariableFilter(SR);
    f.setParams({ cutoff: 4000, resonance: 2, mode: 0 });
    f.reset();
    const tanSpy = vi.spyOn(Math, 'tan');
    for (let i = 0; i < 256; i++) f.process(Math.sin(i * 0.1));
    expect(tanSpy).not.toHaveBeenCalled();
    tanSpy.mockRestore();
  });

  it('shares stereo coefficients without changing right-channel samples', () => {
    const left = new StateVariableFilter(SR);
    const independentRight = new StateVariableFilter(SR);
    const sharedRight = new StateVariableFilter(SR);
    for (const filter of [left, independentRight, sharedRight]) {
      filter.setParams({ cutoff: 4000, resonance: 2, mode: 0 });
      filter.reset();
    }

    for (let i = 0; i < 512; i++) {
      const input = Math.sin(i * 0.17) * 0.7;
      const modulatedCutoff = 4000 * Math.pow(2, Math.sin(i * 0.013) * 0.2);
      left.process(input * 0.8, modulatedCutoff);
      const expected = independentRight.process(input, modulatedCutoff);
      const actual = sharedRight.processStereoPartner(input, left);
      expect(actual).toBe(expected);
    }
  });

  it('reuses exact modulated coefficients across synchronized voices', () => {
    const first = new StateVariableFilter(SR);
    const second = new StateVariableFilter(SR);
    for (const filter of [first, second]) {
      filter.setParams({ cutoff: 4000, resonance: 2, mode: 0 });
      filter.reset();
    }
    const coefficientCache = {
      cutoff: NaN,
      resonance: NaN,
      k: 0,
      a1: 0,
      a2: 0,
      a3: 0
    };
    const tanSpy = vi.spyOn(Math, 'tan');

    for (let i = 0; i < 256; i++) {
      const input = Math.sin(i * 0.071) * 0.25;
      const cutoff = 3000 + Math.sin(i * 0.1) * 500;
      const firstOutput = first.process(input, cutoff, coefficientCache);
      const secondOutput = second.process(input, cutoff, coefficientCache);
      expect(secondOutput).toBe(firstOutput);
    }

    expect(tanSpy).toHaveBeenCalledTimes(256);
  });
});

describe('mod-route compiler', () => {
  it('drops invalid routes and clamps depth', () => {
    const r = compileModRoutes([
      { src: MOD_SRC.LFO1, dst: MOD_DST.PITCH, depth: 3 },
      { src: 99, dst: 0, depth: 1 },
      { src: 0, dst: -1, depth: 1 },
      { src: 0, dst: 1, depth: 0 },
      null,
      { src: MOD_SRC.VELOCITY, dst: MOD_DST.AMP, depth: -0.5 }
    ], null);
    expect(r.count).toBe(2);
    expect(r.depth[0]).toBe(1);
    expect(r.depth[1]).toBe(-0.5);
    expect(r.usesLfo1).toBe(true);
    expect(r.usesLfo2).toBe(false);
  });

  it('caps at MAX_MOD_ROUTES', () => {
    const many = Array.from({ length: 20 }, () => ({ src: 0, dst: 0, depth: 0.5 }));
    expect(compileModRoutes(many, null).count).toBe(8);
  });

  it('maps legacy LFO params onto implicit LFO1 routes with legacy scaling', () => {
    const pitch = compileModRoutes([], { lfoRate: 5, lfoDepth: 1, lfoTarget: 1 });
    expect(pitch.count).toBe(1);
    expect(pitch.dst[0]).toBe(MOD_DST.PITCH);
    expect(pitch.depth[0]).toBeCloseTo(2 / 12, 6);

    const amp = compileModRoutes([], { lfoRate: 5, lfoDepth: 0.7, lfoTarget: 2 });
    expect(amp.dst[0]).toBe(MOD_DST.AMP);
    expect(amp.depth[0]).toBeCloseTo(0.7, 6);

    const cutoff = compileModRoutes([], { lfoRate: 5, lfoDepth: 1, lfoTarget: 3 });
    expect(cutoff.dst[0]).toBe(MOD_DST.CUTOFF);
    expect(cutoff.depth[0]).toBeCloseTo((4 / 12) / 4, 6);

    expect(compileModRoutes([], { lfoRate: 0, lfoDepth: 1, lfoTarget: 1 }).count).toBe(0);
  });

  it('flags which sources the hot loop must evaluate', () => {
    const r = compileModRoutes([
      { src: MOD_SRC.LFO2, dst: MOD_DST.CUTOFF, depth: 0.3 },
      { src: MOD_SRC.MOD_ENV, dst: MOD_DST.FM_INDEX, depth: 0.9 }
    ], null);
    expect(r.usesLfo1).toBe(false);
    expect(r.usesLfo2).toBe(true);
    expect(r.usesModEnv).toBe(true);
  });
});
