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
const STAGGERED = process.argv.includes('--staggered');

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

const left = new Float32Array(BLOCK);
const right = new Float32Array(BLOCK);
const outputs = [[left, right]];

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
  if (STAGGERED) proc.process([], outputs);
}

// Warm up JIT
for (let i = 0; i < 500; i++) proc.process([], outputs);

const t0 = process.hrtime.bigint();
const cpu0 = process.cpuUsage();
for (let i = 0; i < BLOCKS; i++) proc.process([], outputs);
const cpu = process.cpuUsage(cpu0);
const t1 = process.hrtime.bigint();

const elapsedMs = Number(t1 - t0) / 1e6;
const cpuElapsedMs = (cpu.user + cpu.system) / 1000;
const audioMs = (BLOCKS * BLOCK / SAMPLE_RATE) * 1000;
const wallHeadroom = audioMs / elapsedMs;
const cpuHeadroom = audioMs / cpuElapsedMs;

let active = 0;
for (const v of proc.voices) if (v.active) active++;

console.log(`active voices:      ${active} (x4 unison, FM+filter+LFO on${STAGGERED ? ', staggered' : ''})`);
console.log(`rendered:           ${(audioMs / 1000).toFixed(1)}s of audio in ${(elapsedMs / 1000).toFixed(2)}s`);
console.log(`CPU render time:    ${(cpuElapsedMs / 1000).toFixed(2)}s`);
console.log(`CPU per block:      ${(cpuElapsedMs / BLOCKS * 1000).toFixed(1)}us`);
console.log(`CPU headroom:       ${cpuHeadroom.toFixed(1)}x`);
console.log(`wall headroom:      ${wallHeadroom.toFixed(1)}x (includes competing system load)`);
