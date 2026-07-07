import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Message-protocol hardening (descent(19)): the audio thread must survive a
 * hostile or buggy client. Every attack here once passed individually, but a
 * garbage setParams poisoned the merged params and PERMANENTLY silenced the
 * synth (NaN envelope coefficients kill each voice at birth) — the worst
 * failure mode: total silence, no error anywhere. The boundary guard in
 * synth-worklet.js (sanitizeIncomingParams + noteOn finiteness check) plus
 * this recovery assertion pin the contract.
 */

const SR = 48000;
const BLOCK = 128;

let ProcessorClass = null;

beforeAll(async () => {
  globalThis.sampleRate = SR;
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

const ATTACKS = [
  ['negative frequency', { type: 'noteOn', noteId: 'x1', frequency: -440, waveform: 'saw', velocity: 1 }],
  ['Infinity frequency', { type: 'noteOn', noteId: 'x2', frequency: Infinity, waveform: 'saw', velocity: 1 }],
  ['NaN frequency', { type: 'noteOn', noteId: 'x3', frequency: NaN, waveform: 'saw', velocity: 1 }],
  ['NaN velocity', { type: 'noteOn', noteId: 'x4', frequency: 440, waveform: 'saw', velocity: NaN }],
  ['object waveform', { type: 'noteOn', noteId: 'x5', frequency: 440, waveform: {}, velocity: 1 }],
  ['NaN pitch bend', { type: 'pitchBend', value: NaN }],
  ['Infinity mod wheel', { type: 'modWheel', value: Infinity }],
  ['garbage setParams', {
    type: 'setParams',
    params: {
      attack: 'abc', filterCutoff: null, modRoutes: 'nope',
      unisonVoices: -3, fmIndex: Infinity, sustain: undefined,
      useFM: 'yes', __proto__isNot: 'aKey'
    }
  }],
  ['null message', null],
  ['unknown type', { type: 'selfDestruct' }],
  ['noteOff for unknown id', { type: 'noteOff', noteId: 'ghost' }]
];

function render(proc, blocks) {
  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  const outputs = [[left, right]];
  let peak = 0;
  let nonFinite = 0;
  for (let b = 0; b < blocks; b++) {
    proc.process([], outputs);
    for (let i = 0; i < BLOCK; i++) {
      if (!Number.isFinite(left[i]) || !Number.isFinite(right[i])) nonFinite++;
      peak = Math.max(peak, Math.abs(left[i]));
    }
  }
  return { peak, nonFinite };
}

describe('message-protocol hardening', () => {
  it('survives the full attack battery and still plays a normal note after', () => {
    const proc = new ProcessorClass({ processorOptions: {} });
    const msg = (d) => proc.port.onmessage({ data: d });

    for (const [, attack] of ATTACKS) {
      msg(attack);
      const r = render(proc, 40);
      expect(r.nonFinite).toBe(0);
    }

    // Recovery is the contract: after everything above, a sane note sounds.
    msg({ type: 'allNotesOff' });
    render(proc, 400);
    msg({ type: 'noteOn', noteId: 'sane', frequency: 440, waveform: 'sine', velocity: 1 });
    const r = render(proc, 60);
    expect(r.nonFinite).toBe(0);
    expect(r.peak).toBeGreaterThan(0.01);
  });

  it('garbage constructor paramDefaults cannot poison the engine', () => {
    const proc = new ProcessorClass({
      processorOptions: { paramDefaults: { attack: 'abc', release: NaN, modRoutes: 42, notAKey: 1 } }
    });
    proc.port.onmessage({
      data: { type: 'noteOn', noteId: 'n', frequency: 440, waveform: 'sine', velocity: 1 }
    });
    const r = render(proc, 60);
    expect(r.nonFinite).toBe(0);
    expect(r.peak).toBeGreaterThan(0.01);
  });
});
