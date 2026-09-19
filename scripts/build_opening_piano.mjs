#!/usr/bin/env node
/**
 * Build the opening-performance piano from Salamander Grand Piano V3 sources.
 *
 * Per note: align the hammer onset to a fixed pre-roll, repair the spaced
 * microphone pair for mono playback (polarity, then left/right balance),
 * even out the hand-played layer's note-to-note level against a linear
 * trend, keep the natural decay up to LENGTH_SECONDS with a faded tail, and
 * encode MP3. One shared gain is applied so the instrument's bass-to-treble
 * balance survives. See public/samples/opening/README.md for source and license.
 *
 * Usage (needs ffmpeg with libmp3lame):
 *   node scripts/build_opening_piano.mjs --source <dir with Salamander .flac files>
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENING_SAMPLE_KEYS } from '../src/data/openingPerformance.js';

const SAMPLE_RATE = 48000;
const VELOCITY_LAYER = 6;
const PRE_ROLL_SECONDS = 0.005;
const LENGTH_SECONDS = 9;
const TAIL_FADE_SECONDS = 2.5;
const MAX_BALANCE_DB = 3;
const LEVEL_WINDOW_SECONDS = 0.4;
const MAX_TRIM_DB = 3;
const PEAK_TARGET_DBFS = -4;
const MP3_QUALITY = 4;

const sourceFlag = process.argv.indexOf('--source');
if (sourceFlag < 0 || !process.argv[sourceFlag + 1]) {
  console.error('usage: node scripts/build_opening_piano.mjs --source <salamander flac dir>');
  process.exit(1);
}
const sourceDir = path.resolve(process.argv[sourceFlag + 1]);
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'samples', 'opening');
const workDir = mkdtempSync(path.join(os.tmpdir(), 'opening-piano-'));

const toDb = (amplitude) => 20 * Math.log10(Math.max(amplitude, 1e-12));
const fromDb = (db) => 10 ** (db / 20);

function decode(file) {
  const raw = execFileSync('ffmpeg', [
    '-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SAMPLE_RATE), '-'
  ], { maxBuffer: 1 << 30 });
  return new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
}

function writeWav(file, interleaved) {
  const header = Buffer.alloc(44);
  const bytes = interleaved.length * 4;
  header.write('RIFF', 0); header.writeUInt32LE(36 + bytes, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(2, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 8, 28);
  header.writeUInt16LE(8, 32); header.writeUInt16LE(32, 34);
  header.write('data', 36); header.writeUInt32LE(bytes, 40);
  writeFileSync(file, Buffer.concat([header, Buffer.from(interleaved.buffer)]));
}

function stereoStats(audio) {
  let left = 0;
  let right = 0;
  let cross = 0;
  for (let i = 0; i < audio.length; i += 2) {
    left += audio[i] * audio[i];
    right += audio[i + 1] * audio[i + 1];
    cross += audio[i] * audio[i + 1];
  }
  return { correlation: cross / Math.sqrt(left * right), balanceDb: toDb(Math.sqrt(left / right)) };
}

const notes = OPENING_SAMPLE_KEYS.map(([key, midi]) => {
  const source = decode(path.join(sourceDir, `${key.replace('s', '#')}v${VELOCITY_LAYER}.flac`));
  let peak = 0;
  for (let i = 0; i < source.length; i++) peak = Math.max(peak, Math.abs(source[i]));
  let onset = 0;
  while (Math.abs(source[onset * 2]) < peak * 0.01 && Math.abs(source[onset * 2 + 1]) < peak * 0.01) onset += 1;

  // Every note gets the same pre-roll (zero-padded when the source starts
  // later than that) so chords land together.
  const preRoll = Math.round(PRE_ROLL_SECONDS * SAMPLE_RATE);
  const frames = Math.round(LENGTH_SECONDS * SAMPLE_RATE);
  const start = Math.max(0, onset - preRoll);
  const padding = preRoll - (onset - start);
  if (source.length / 2 - start < frames) throw new Error(`${key}: source shorter than ${LENGTH_SECONDS}s`);
  const audio = new Float32Array(frames * 2);
  audio.set(source.subarray(start * 2, (start + frames - padding) * 2), padding * 2);

  // The spaced pair captures some notes with the channels out of phase, which
  // cancels them on mono speakers, and pans neighbouring notes far apart.
  // Inverting one channel is inaudible per ear; the balance cap splits its
  // correction across both channels.
  const recorded = stereoStats(audio);
  const polarity = recorded.correlation < 0 ? -1 : 1;
  const excessDb = recorded.balanceDb - Math.max(-MAX_BALANCE_DB, Math.min(MAX_BALANCE_DB, recorded.balanceDb));
  const leftGain = fromDb(-excessDb / 2);
  const rightGain = fromDb(excessDb / 2) * polarity;
  for (let i = 0; i < audio.length; i += 2) {
    audio[i] *= leftGain;
    audio[i + 1] *= rightGain;
  }

  const fadeFrames = Math.round(TAIL_FADE_SECONDS * SAMPLE_RATE);
  for (let i = 0; i < fadeFrames; i++) {
    const gain = 0.5 + 0.5 * Math.cos(Math.PI * (i + 1) / fadeFrames);
    const frame = frames - fadeFrames + i;
    audio[frame * 2] *= gain;
    audio[frame * 2 + 1] *= gain;
  }

  const levelStart = preRoll * 2;
  const levelEnd = levelStart + Math.round(LEVEL_WINDOW_SECONDS * SAMPLE_RATE) * 2;
  let energy = 0;
  for (let i = levelStart; i < levelEnd; i++) energy += audio[i] * audio[i];
  return { key, midi, audio, recorded, levelDb: toDb(Math.sqrt(energy / (levelEnd - levelStart))) };
});

// Least-squares level trend across the keyboard; each note is trimmed onto it.
const meanMidi = notes.reduce((sum, note) => sum + note.midi, 0) / notes.length;
const meanLevel = notes.reduce((sum, note) => sum + note.levelDb, 0) / notes.length;
const slope = notes.reduce((sum, note) => sum + (note.midi - meanMidi) * (note.levelDb - meanLevel), 0)
  / notes.reduce((sum, note) => sum + (note.midi - meanMidi) ** 2, 0);
for (const note of notes) {
  const trend = meanLevel + slope * (note.midi - meanMidi);
  note.trimDb = Math.max(-MAX_TRIM_DB, Math.min(MAX_TRIM_DB, trend - note.levelDb));
}

let trimmedPeak = 0;
for (const note of notes) {
  const trim = fromDb(note.trimDb);
  for (let i = 0; i < note.audio.length; i++) trimmedPeak = Math.max(trimmedPeak, Math.abs(note.audio[i]) * trim);
}
const sharedGainDb = PEAK_TARGET_DBFS - toDb(trimmedPeak);

console.log(`Salamander v${VELOCITY_LAYER}: level trend ${slope.toFixed(3)} dB/semitone, shared gain ${sharedGainDb.toFixed(2)} dB`);
console.log('note   L/R corr (recorded > built)   L/R balance dB (recorded > built)   level dB   trim dB     bytes');
let totalBytes = 0;
for (const note of notes) {
  const gain = fromDb(note.trimDb + sharedGainDb);
  for (let i = 0; i < note.audio.length; i++) note.audio[i] *= gain;
  const wav = path.join(workDir, `${note.key}.wav`);
  const mp3 = path.join(outDir, `${note.key}.mp3`);
  writeWav(wav, note.audio);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-codec:a', 'libmp3lame', '-q:a', String(MP3_QUALITY), mp3]);
  const bytes = statSync(mp3).size;
  totalBytes += bytes;
  const built = stereoStats(note.audio);
  console.log([
    note.key.padEnd(6),
    `${note.recorded.correlation.toFixed(2).padStart(12)} > ${built.correlation.toFixed(2).padEnd(14)}`,
    `${note.recorded.balanceDb.toFixed(1).padStart(14)} > ${built.balanceDb.toFixed(1).padEnd(18)}`,
    note.levelDb.toFixed(1).padStart(8),
    note.trimDb.toFixed(1).padStart(9),
    String(bytes).padStart(9)
  ].join(' '));
}
console.log(`total ${totalBytes} bytes (${(totalBytes / 1048576).toFixed(2)} MiB)`);
rmSync(workDir, { recursive: true, force: true });
