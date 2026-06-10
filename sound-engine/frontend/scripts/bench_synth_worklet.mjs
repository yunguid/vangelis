#!/usr/bin/env node
/**
 * Benchmark the real synth worklet (src/audio/synth-worklet.js) under a
 * worst-case polyphonic load, outside the browser.
 *
 * Stubs the AudioWorklet globals, instantiates the processor, saturates the
 * voice pool, and measures how fast process() renders 128-frame blocks.
 *
 * Output: realtime headroom multiplier (how many copies of the engine one
 * core could run at the given sample rate).
 */

const SAMPLE_RATE = 48000;
const BLOCK = 128;
const BLOCKS = 8000; // ~21s of audio

globalThis.sampleRate = SAMPLE_RATE;
globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { onmessage: null, postMessage() {} };
  }
};
let ProcessorClass = null;
globalThis.registerProcessor = (_name, cls) => {
  ProcessorClass = cls;
};

await import('../src/audio/synth-worklet.js');

const proc = new ProcessorClass({
  processorOptions: {
    paramDefaults: {
      // Worst case: everything on.
      useADSR: true,
      attack: 0.005,
      decay: 0.2,
      sustain: 0.7,
      release: 0.5,
      useFM: true,
      fmRatio: 2.5,
      fmIndex: 3.0,
      useFilter: true,
      filterCutoff: 4000,
      filterResonance: 2.0,
      filterMode: 0,
      lfoRate: 5,
      lfoDepth: 0.5,
      lfoTarget: 3,
      unisonVoices: 4,
      unisonDetune: 12
    }
  }
});

// Saturate the pool: 24 voices, saw (PolyBLEP path), full velocity.
for (let i = 0; i < 24; i++) {
  proc.port.onmessage({
    data: {
      type: 'noteOn',
      noteId: `bench-${i}`,
      frequency: 110 * Math.pow(2, i / 12),
      waveform: 'saw',
      velocity: 1
    }
  });
}

const left = new Float32Array(BLOCK);
const right = new Float32Array(BLOCK);
const outputs = [[left, right]];

// Warm up JIT
for (let i = 0; i < 500; i++) proc.process([], outputs);

const t0 = process.hrtime.bigint();
for (let i = 0; i < BLOCKS; i++) proc.process([], outputs);
const t1 = process.hrtime.bigint();

const elapsedMs = Number(t1 - t0) / 1e6;
const audioMs = (BLOCKS * BLOCK / SAMPLE_RATE) * 1000;
const headroom = audioMs / elapsedMs;

let active = 0;
for (const v of proc.voices) if (v.active) active++;

console.log(`active voices:      ${active} (x4 unison, FM+filter+LFO on)`);
console.log(`rendered:           ${(audioMs / 1000).toFixed(1)}s of audio in ${(elapsedMs / 1000).toFixed(2)}s`);
console.log(`per 128-frame block: ${(elapsedMs / BLOCKS * 1000).toFixed(1)}us (budget: ${(BLOCK / SAMPLE_RATE * 1e6).toFixed(0)}us)`);
console.log(`realtime headroom:  ${headroom.toFixed(1)}x`);
