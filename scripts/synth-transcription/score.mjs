// Score module for scripts/render_performance.mjs --score: a draft MIDI (BRB_MIDI) through the
// page's reader, optionally only some parts (BRB_PARTS=cs80,pad) or without the noise bed
// (BRB_NOISE=off). The noise is seeded, so renders compare exactly.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const seeded = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export async function loadScore(root) {
  const require = createRequire(path.join(root, 'package.json'));
  const { Midi } = require('@tonejs/midi');
  const { readBladeRunnerBlues, arrangeBladeRunnerBlues, makeRecordNoise } = await import(pathToFileURL(path.join(root, 'src/data/bladeRunnerBlues.js')).href);
  const file = process.env.BRB_MIDI;
  const score = readBladeRunnerBlues(new Midi(readFileSync(file)));
  if (process.env.BRB_PARTS) {
    const only = process.env.BRB_PARTS.split(',');
    score.notes = score.notes.filter((note) => only.includes(note.part));
  }
  const maker = {
    sampleRate: 48000,
    createBuffer: (channels, length, sampleRate) => {
      const data = new Float32Array(length);
      return { sampleRate, length, duration: length / sampleRate, numberOfChannels: 1, getChannelData: () => data };
    }
  };
  return process.env.BRB_NOISE === 'off' ? score : arrangeBladeRunnerBlues(score, makeRecordNoise(maker, seeded(1982)));
}
