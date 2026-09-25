import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { sanitizeAudioParams, toWorkletParams } from '../utils/audioParams.js';

/**
 * Timed messages: a noteOn/noteOff carrying `when` (AudioContext seconds) acts
 * on the exact sample it falls on, read against the AudioWorkletGlobalScope's
 * currentFrame, which the render below advances block by block. A score's
 * parts are handed over ahead of time this way, so their notes must neither
 * start early nor ring on after a stop that reached them before they started.
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

afterEach(() => {
  delete globalThis.currentFrame;
});

// A sine a quarter-cycle in, so a note's very first sample is audible.
const makeProcessor = (audioParams = {}) => new ProcessorClass({
  processorOptions: {
    paramDefaults: toWorkletParams(sanitizeAudioParams({ phaseOffset: 90, ...audioParams }))
  }
});

const at = (frame) => frame / SR;
const send = (proc, data) => proc.port.onmessage({ data });
const noteOn = (noteId, when) => ({ type: 'noteOn', noteId, frequency: 220, waveform: 'Sine', velocity: 1, when });

function renderClocked(proc, frames, startFrame = 0) {
  const out = new Float32Array(frames);
  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  for (let frame = 0; frame < frames; frame += BLOCK) {
    globalThis.currentFrame = startFrame + frame;
    proc.process([], [[left, right]]);
    out.set(left.subarray(0, Math.min(BLOCK, frames - frame)), frame);
  }
  return out;
}

const firstSound = (out) => out.findIndex((value) => value !== 0);
const peak = (out) => out.reduce((max, value) => Math.max(max, Math.abs(value)), 0);

describe('timed note messages', () => {
  it('start a note on the exact sample they fall on; an overdue one plays at once', () => {
    for (const frame of [300, 1000, 12000]) {
      const proc = makeProcessor();
      globalThis.currentFrame = 0;
      send(proc, noteOn('n', at(frame)));
      expect(firstSound(renderClocked(proc, frame + 256))).toBe(frame);
    }

    const late = makeProcessor();
    globalThis.currentFrame = 4096;
    send(late, noteOn('n', at(1000)));
    expect(firstSound(renderClocked(late, 256, 4096))).toBe(0);
  });

  it('release a note on the exact sample of a timed noteOff', () => {
    const releasedAt = (offFrame) => {
      const proc = makeProcessor({ attack: 0.005, release: 0.2 });
      globalThis.currentFrame = 0;
      send(proc, noteOn('n', at(1000)));
      send(proc, { type: 'noteOff', noteId: 'n', when: at(offFrame) });
      return renderClocked(proc, 6000);
    };
    const early = releasedAt(3000);
    const late = releasedAt(3001);
    expect(Array.from(early.subarray(0, 3000))).toEqual(Array.from(late.subarray(0, 3000)));
    expect(early[3000]).not.toBe(late[3000]);
  });

  it('never start a queued note released before its start, however it was released', () => {
    const releases = [
      { type: 'noteOff', noteId: 'q' },
      { type: 'noteOff', noteId: 'q', when: at(1000) },
      { type: 'allNotesOff' }
    ];
    for (const release of releases) {
      const proc = makeProcessor();
      globalThis.currentFrame = 0;
      send(proc, noteOn('q', at(2000)));
      send(proc, release);
      expect(firstSound(renderClocked(proc, 6000))).toBe(-1);
    }
  });

  it('keep a note sent after a timed noteOff for the same id (a replayed note)', () => {
    const proc = makeProcessor({ attack: 0.005, release: 0.005 });
    globalThis.currentFrame = 0;
    send(proc, noteOn('x', at(500)));
    send(proc, { type: 'noteOff', noteId: 'x', when: at(1000) });
    send(proc, noteOn('x', at(3000)));
    const out = renderClocked(proc, 4000);
    expect(peak(out.subarray(2500, 3000))).toBeLessThan(1e-3);
    expect(peak(out.subarray(3000, 3100))).toBeGreaterThan(0.05);
  });

  it('dispose lets a retired node go: process() stops returning true', () => {
    const proc = makeProcessor();
    const outputs = [[new Float32Array(BLOCK), new Float32Array(BLOCK)]];
    expect(proc.process([], outputs)).toBe(true);
    send(proc, { type: 'dispose' });
    expect(proc.process([], outputs)).toBe(false);
  });
});
