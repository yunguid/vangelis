import { beforeAll, describe, expect, it } from 'vitest';
import { FACTORY_PRESETS } from '../utils/factoryPresets.js';
import { sanitizeAudioParams, toWorkletParams } from '../utils/audioParams.js';

/**
 * Offline render regression suite: instantiates the real AudioWorklet
 * processor (globals stubbed, same trick as scripts/bench_synth_worklet.mjs)
 * and renders every factory preset end to end. Guards against the artifact
 * classes that used to "sparkle": filter blowup/reset dropouts, voice-steal
 * clicks, FM aliasing blowups and stuck self-oscillation.
 */

const SAMPLE_RATE = 48000;
const BLOCK = 128;

let ProcessorClass = null;

beforeAll(async () => {
  globalThis.sampleRate = SAMPLE_RATE;
  globalThis.AudioWorkletProcessor = class {
    constructor() {
      this.port = { onmessage: null, postMessage() {} };
    }
  };
  globalThis.registerProcessor = (_name, cls) => {
    ProcessorClass = cls;
  };
  await import('./synth-worklet.js');
});

const midiToFreq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

const makeProcessor = (audioParams) => new ProcessorClass({
  processorOptions: {
    paramDefaults: toWorkletParams(sanitizeAudioParams(audioParams))
  }
});

const renderSeconds = (proc, seconds, sink) => {
  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  const outputs = [[left, right]];
  const blocks = Math.ceil((seconds * SAMPLE_RATE) / BLOCK);
  for (let b = 0; b < blocks; b++) {
    proc.process([], outputs);
    if (sink) sink(left);
  }
};

class RenderStats {
  constructor() {
    this.nonFinite = 0;
    this.maxAbs = 0;
    this.exactZeroRuns = 0;
    this.zeroRun = 0;
    this.prev = 0;
    this.maxJump = 0;
    this.sumSquares = 0;
    this.count = 0;
  }

  get sink() {
    return (block) => {
      for (let i = 0; i < block.length; i++) {
        const s = block[i];
        if (!Number.isFinite(s)) this.nonFinite++;
        const abs = Math.abs(s);
        if (abs > this.maxAbs) this.maxAbs = abs;
        const jump = Math.abs(s - this.prev);
        if (jump > this.maxJump) this.maxJump = jump;
        this.prev = s;
        // The old Chamberlin filter blew up and hard-reset to a run of exact
        // zeros mid-note; count runs of >= 8 consecutive exact zeros.
        if (s === 0) {
          this.zeroRun++;
          if (this.zeroRun === 8) this.exactZeroRuns++;
        } else {
          this.zeroRun = 0;
        }
        this.sumSquares += s * s;
        this.count++;
      }
    };
  }

  get rms() {
    return this.count ? Math.sqrt(this.sumSquares / this.count) : 0;
  }
}

const noteOn = (proc, noteId, midi, waveform, velocity = 0.9) => {
  proc.port.onmessage({
    data: {
      type: 'noteOn',
      noteId,
      frequency: midiToFreq(midi),
      waveform,
      velocity
    }
  });
};

const noteOff = (proc, noteId) => {
  proc.port.onmessage({ data: { type: 'noteOff', noteId } });
};

describe('factory presets render cleanly through the worklet', () => {
  it.each(FACTORY_PRESETS.map((preset) => [preset.name, preset]))(
    '%s: bounded, dropout-free, decaying to silence',
    (_name, preset) => {
      const proc = makeProcessor(preset.audioParams);
      const params = sanitizeAudioParams(preset.audioParams);
      const wave = preset.waveformType;

      // Wide register spread incl. extremes where aliasing/instability bites.
      const notes = [36, 55, 67, 79, 96];
      notes.forEach((midi, idx) => noteOn(proc, `n${idx}`, midi, wave));

      const attackSettle = Math.min(params.attack + 0.4, 3.0);
      const settle = new RenderStats();
      renderSeconds(proc, attackSettle, settle.sink);

      const sustain = new RenderStats();
      renderSeconds(proc, 0.6, sustain.sink);

      notes.forEach((_, idx) => noteOff(proc, `n${idx}`));
      const earlyRelease = new RenderStats();
      renderSeconds(proc, Math.min(params.release * 0.5 + 0.1, 1.5), earlyRelease.sink);

      const tail = new RenderStats();
      renderSeconds(proc, Math.min(params.release * 1.4 + 0.3, 5.5), tail.sink);
      const tailEnd = new RenderStats();
      renderSeconds(proc, 0.15, tailEnd.sink);

      for (const stats of [settle, sustain, earlyRelease, tail, tailEnd]) {
        expect(stats.nonFinite).toBe(0);
        expect(stats.maxAbs).toBeLessThanOrEqual(1.0);
      }

      // The preset must actually make sound (plucks with sustain=0 have
      // already decayed by the sustain window; the settle window covers them).
      expect(Math.max(settle.rms, sustain.rms)).toBeGreaterThan(0.005);
      // ...without the filter-reset dropouts the old SVF produced (plucks
      // with sustain~0 reach true silence here, which is not a dropout)...
      if (params.sustain > 0.05) {
        expect(sustain.exactZeroRuns).toBe(0);
      }
      // ...and must decay toward silence instead of self-oscillating forever.
      expect(tailEnd.rms).toBeLessThan(Math.max(0.02, earlyRelease.rms * 0.35));
    }
  );
});

describe('engine artifact regressions', () => {
  it('survives max resonance with cutoff slammed by a square LFO (old SVF blowup)', () => {
    const proc = makeProcessor({
      useFilter: true,
      filterCutoff: 8000,
      filterResonance: 10,
      filterMode: 0,
      lfo1Shape: 2,
      lfoRate: 8,
      modRoutes: [
        { src: 0, dst: 1, depth: 1 },
        { src: 3, dst: 1, depth: 1 }
      ],
      attack: 0.005,
      decay: 0.2,
      sustain: 0.9,
      release: 0.3
    });
    noteOn(proc, 'stress', 88, 'Square', 1);
    noteOn(proc, 'stress2', 100, 'Sawtooth', 1);
    const stats = new RenderStats();
    renderSeconds(proc, 2.0, stats.sink);
    expect(stats.nonFinite).toBe(0);
    expect(stats.maxAbs).toBeLessThanOrEqual(1.0);
    expect(stats.exactZeroRuns).toBe(0);
    expect(stats.rms).toBeGreaterThan(0.001);
  });

  it('extreme FM stacking stays bounded at the top of the keyboard', () => {
    const proc = makeProcessor({
      useFM: true,
      fmRatio: 8,
      fmIndex: 30,
      modRoutes: [
        { src: 4, dst: 3, depth: 1 },
        { src: 3, dst: 3, depth: 1 }
      ],
      attack: 0.005,
      decay: 0.3,
      sustain: 0.8,
      release: 0.2
    });
    noteOn(proc, 'fmHigh', 108, 'Sine', 1);
    noteOn(proc, 'fmSaw', 103, 'Sawtooth', 1);
    const stats = new RenderStats();
    renderSeconds(proc, 1.0, stats.sink);
    expect(stats.nonFinite).toBe(0);
    expect(stats.maxAbs).toBeLessThanOrEqual(1.0);
  });

  it('voice-steal flood does not click (no hard phase resets)', () => {
    const proc = makeProcessor({
      attack: 0.01,
      decay: 0.1,
      sustain: 0.9,
      release: 0.4,
      useFilter: false,
      useFM: false
    });
    const stats = new RenderStats();
    // 40 sine notes into a 24-voice pool forces steals mid-render. Sines at
    // these frequencies move < ~0.1 per sample, so any hard reset of a live
    // phase shows up as an outsized sample-to-sample jump.
    for (let i = 0; i < 40; i++) {
      noteOn(proc, `flood-${i}`, 45 + (i % 24), 'Sine', 1);
      renderSeconds(proc, 0.02, stats.sink);
    }
    renderSeconds(proc, 0.3, stats.sink);
    expect(stats.nonFinite).toBe(0);
    expect(stats.maxJump).toBeLessThan(0.25);
  });

  it('noteOff during a steal fade cancels the queued note (no stuck loop)', () => {
    const proc = makeProcessor({
      attack: 0.01,
      decay: 0.1,
      sustain: 0.9,
      release: 0.15
    });
    // Saturate the pool, then steal with a note that is released immediately
    // (inside the ~5ms fade window, before the queued voice ever starts).
    for (let i = 0; i < 24; i++) noteOn(proc, `held-${i}`, 40 + i, 'Sine', 1);
    renderSeconds(proc, 0.2);
    noteOn(proc, 'stolen', 84, 'Sine', 1);
    noteOff(proc, 'stolen'); // arrives before the steal fade completes
    for (let i = 0; i < 24; i++) noteOff(proc, `held-${i}`);
    renderSeconds(proc, 1.0);
    const tail = new RenderStats();
    renderSeconds(proc, 0.2, tail.sink);
    // Without pending-note cancellation the stolen voice starts after the
    // fade and sustains forever; with the fix everything decays to silence.
    expect(tail.rms).toBeLessThan(0.001);
    expect(proc.voices.every((v) => !v.pendingStart)).toBe(true);
  });

  it('allNotesOff clears queued steal notes too', () => {
    const proc = makeProcessor({ attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 });
    for (let i = 0; i < 24; i++) noteOn(proc, `held-${i}`, 40 + i, 'Sine', 1);
    renderSeconds(proc, 0.1);
    noteOn(proc, 'queued-a', 90, 'Sine', 1);
    noteOn(proc, 'queued-b', 91, 'Sine', 1);
    proc.port.onmessage({ data: { type: 'allNotesOff' } });
    renderSeconds(proc, 1.0);
    const tail = new RenderStats();
    renderSeconds(proc, 0.2, tail.sink);
    expect(tail.rms).toBeLessThan(0.001);
  });

  it('master stage is linear below the clip knee (no tanh coloration)', () => {
    // Three identical sines sum to exactly 3x one sine while under the knee;
    // the old always-on tanh compressed the triple to ~2.8x.
    const params = { useADSR: false, useFilter: false, useFM: false };
    const single = makeProcessor(params);
    noteOn(single, 'a', 60, 'Sine', 0.8);
    const s1 = new RenderStats();
    renderSeconds(single, 0.5, s1.sink);

    const triple = makeProcessor(params);
    noteOn(triple, 'a', 60, 'Sine', 0.8);
    noteOn(triple, 'b', 60, 'Sine', 0.8);
    noteOn(triple, 'c', 60, 'Sine', 0.8);
    const s3 = new RenderStats();
    renderSeconds(triple, 0.5, s3.sink);

    expect(s3.maxAbs / s1.maxAbs).toBeGreaterThan(2.95);
    expect(s3.maxAbs / s1.maxAbs).toBeLessThan(3.05);
  });

  it('master clip knee bounds a saturated flood below unity', () => {
    const proc = makeProcessor({ useADSR: false, useFilter: false, useFM: false });
    for (let i = 0; i < 24; i++) noteOn(proc, `f${i}`, 36 + i, 'Sawtooth', 1);
    const stats = new RenderStats();
    renderSeconds(proc, 0.5, stats.sink);
    expect(stats.nonFinite).toBe(0);
    expect(stats.maxAbs).toBeLessThanOrEqual(1.0);
    expect(stats.maxAbs).toBeGreaterThan(0.5); // knee engaged, not silenced
  });

  it('legato-only glide: staccato retriggers start on pitch, overlaps slide', () => {
    const countZC = (proc, blocks) => {
      const left = new Float32Array(BLOCK);
      const outputs = [[left, left]];
      let zc = 0;
      let prev = 0;
      for (let b = 0; b < blocks; b++) {
        proc.process([], outputs);
        for (let i = 0; i < BLOCK; i++) {
          if (prev < 0 && left[i] >= 0) zc++;
          prev = left[i];
        }
      }
      return zc;
    };
    const params = { glideTime: 0.5, glideMode: 1, useFilter: false, useFM: false };

    // Staccato: release the low note fully, then play the high note — it must
    // start at its own pitch (no glide), so early zero-crossings run fast.
    const stac = makeProcessor(params);
    noteOn(stac, 'a', 45, 'Sine', 1); // 110 Hz
    renderSeconds(stac, 0.3);
    noteOff(stac, 'a');
    renderSeconds(stac, 2.0); // release fully idle
    noteOn(stac, 'b', 69, 'Sine', 1); // 440 Hz
    const zcStac = countZC(stac, 8); // ~21ms window: 440Hz ≈ 9 crossings
    expect(zcStac).toBeGreaterThanOrEqual(7);

    // Legato: hold the low note and overlap the high one — glide engages,
    // early pitch stays near 110 Hz (≈ 2 crossings in the same window).
    const lega = makeProcessor(params);
    noteOn(lega, 'a', 45, 'Sine', 1);
    renderSeconds(lega, 0.3);
    noteOn(lega, 'b', 69, 'Sine', 1); // 'a' still held
    const zcLega = countZC(lega, 8);
    expect(zcLega).toBeLessThan(5);
  });

  it('unison spread decorrelates channels; single voices stay exactly centered', () => {
    const renderStereo = (params, waveform) => {
      const proc = makeProcessor(params);
      noteOn(proc, 'st', 48, waveform, 0.9);
      const left = new Float32Array(BLOCK);
      const right = new Float32Array(BLOCK);
      const outputs = [[left, right]];
      const L = [];
      const R = [];
      for (let b = 0; b < 400; b++) {
        proc.process([], outputs);
        if (b > 100) {
          for (let i = 0; i < BLOCK; i++) {
            L.push(left[i]);
            R.push(right[i]);
          }
        }
      }
      let ab = 0;
      let aa = 0;
      let bb = 0;
      let identical = true;
      for (let i = 0; i < L.length; i++) {
        ab += L[i] * R[i];
        aa += L[i] * L[i];
        bb += R[i] * R[i];
        if (L[i] !== R[i]) identical = false;
      }
      return { identical, corr: ab / Math.sqrt(aa * bb), rmsL: Math.sqrt(aa / L.length), rmsR: Math.sqrt(bb / R.length) };
    };

    const mono = renderStereo({ unisonVoices: 1, useFilter: false }, 'Sawtooth');
    expect(mono.identical).toBe(true); // single voice: bit-identical channels

    const wide = renderStereo({ unisonVoices: 4, unisonDetune: 18, useFilter: false }, 'Sawtooth');
    expect(wide.identical).toBe(false);
    expect(wide.corr).toBeLessThan(0.995); // audibly decorrelated
    expect(wide.rmsL).toBeGreaterThan(0.01); // both channels carry signal
    expect(wide.rmsR).toBeGreaterThan(0.01);
    expect(wide.rmsL / wide.rmsR).toBeGreaterThan(0.7); // roughly balanced
    expect(wide.rmsL / wide.rmsR).toBeLessThan(1.4);
  });

  it('same-note retrigger does not click', () => {
    const proc = makeProcessor({
      attack: 0.01,
      decay: 0.2,
      sustain: 0.8,
      release: 0.5
    });
    const stats = new RenderStats();
    for (let i = 0; i < 12; i++) {
      noteOn(proc, 'same-note', 57, 'Sine', 1);
      renderSeconds(proc, 0.05, stats.sink);
    }
    expect(stats.nonFinite).toBe(0);
    expect(stats.maxJump).toBeLessThan(0.2);
  });
});
