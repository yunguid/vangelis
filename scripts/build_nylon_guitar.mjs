#!/usr/bin/env node
/**
 * Build the nylon-guitar samples that "Saudade de Triana" plays, from the
 * University of Iowa Musical Instrument Samples guitar recordings (Raimundo
 * 118 classical guitar, anechoic chamber; every fret of every string at
 * several dynamics, several notes per file).
 *
 * Only the string/fret/dynamic combinations the score uses are built, each
 * just long enough for its longest note. Per sample: split the take out of
 * its file, remove the chamber's sub-70 Hz rumble, retune it to equal
 * temperament (the guitar was recorded 10-45 cents flat), align the pluck to
 * a fixed pre-roll, trim the player's uneven levels onto one line across the
 * neck, fade the tail and encode mono MP3 (the two microphones are 0.97
 * correlated). See public/samples/nylon-guitar/README.md.
 *
 * Usage (needs ffmpeg with libmp3lame):
 *   node scripts/build_nylon_guitar.mjs --source <dir with Guitar.*.aif>
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tonejsMidi from '@tonejs/midi';
import { GUITAR_OPEN_STRINGS, assignGuitarTakes } from '../src/data/nylonGuitar.js';

const SAMPLE_RATE = 44100;
const HOP = 441; // 10 ms envelope frames
const PRE_ROLL_SECONDS = 0.003;
const RING_MARGIN_SECONDS = 0.3;
const MIN_SECONDS = 0.8;
const MAX_SECONDS = 6.5;
const TAIL_FADE_FRACTION = 0.35;
const LEVEL_WINDOW_SECONDS = 0.25;
const LEVEL_SLOPE_DB_PER_SEMITONE = -0.1; // trebles a little under the basses, as on the instrument
const PEAK_TARGET_DBFS = -2;
const MP3_QUALITY = 4;
const STRING_NAMES = ['sul_E', 'sulB', 'sulG', 'sulD', 'sulA', 'sulE'];
const SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const sourceFlag = process.argv.indexOf('--source');
if (sourceFlag < 0 || !process.argv[sourceFlag + 1]) {
  console.error('usage: node scripts/build_nylon_guitar.mjs --source <dir with Guitar.*.aif>');
  process.exit(1);
}
const sourceDir = path.resolve(process.argv[sourceFlag + 1]);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'samples', 'nylon-guitar');
const workDir = mkdtempSync(path.join(os.tmpdir(), 'nylon-guitar-'));

const toDb = (amplitude) => 20 * Math.log10(Math.max(amplitude, 1e-12));
const fromDb = (db) => 10 ** (db / 20);
const noteNumber = (name) => {
  const [, letter, flat, octave] = /^([A-G])(b?)(\d)$/.exec(name);
  return (Number(octave) + 1) * 12 + SEMITONES[letter] - (flat ? 1 : 0);
};

// ── What the score needs ────────────────────────────────────────────────

const midi = new tonejsMidi.Midi(readFileSync(path.join(root, 'public/midi/performances/saudade-de-triana.mid')));
const played = midi.tracks
  .flatMap((track) => track.notes.map((note) => ({ channel: track.channel, midi: note.midi, time: note.time, velocity: note.velocity, duration: note.duration })))
  .sort((a, b) => a.time - b.time);
const needed = new Map();
assignGuitarTakes(played).forEach((key, index) => {
  const note = played[index];
  const entry = needed.get(key) || { key, channel: note.channel, midi: note.midi, dynamic: key.slice(-2), seconds: 0 };
  entry.seconds = Math.max(entry.seconds, note.duration);
  needed.set(key, entry);
});

// ── Source takes ────────────────────────────────────────────────────────

const decoded = new Map();
function takesIn(file, floor) {
  if (decoded.has(file)) return decoded.get(file);
  const raw = execFileSync('ffmpeg', [
    '-v', 'error', '-i', path.join(sourceDir, file), '-af', 'highpass=f=70,highpass=f=70',
    '-f', 'f32le', '-ac', '1', '-ar', String(SAMPLE_RATE), '-'
  ], { maxBuffer: 2 ** 31 - 1 });
  const audio = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  const envelope = new Float32Array(Math.floor(audio.length / HOP));
  for (let frame = 0; frame < envelope.length; frame++) {
    let energy = 0;
    for (let i = frame * HOP; i < (frame + 1) * HOP; i++) energy += audio[i] * audio[i];
    envelope[frame] = Math.sqrt(energy / HOP);
  }
  // A pluck is a 12 dB jump within 60 ms; takes are at least a second apart.
  const plucks = [];
  for (let frame = 0; frame < envelope.length - 4; frame++) {
    if (plucks.length && frame - plucks.at(-1) < 100) continue;
    const after = Math.max(envelope[frame], envelope[frame + 1], envelope[frame + 2], envelope[frame + 3]);
    const before = frame >= 6 ? envelope[frame - 6] : 0;
    const justBefore = frame >= 2 ? envelope[frame - 2] : 0;
    if (!(after > floor && after > before * 4 && envelope[frame] > justBefore * 2)) continue;
    // A finger landing on the string can trip the detector up to a second
    // before the pluck itself, so take the loudest moment that follows and
    // walk back down its attack.
    let pluck = frame;
    for (let ahead = frame; ahead < Math.min(envelope.length, frame + 100); ahead++) {
      if (envelope[ahead] > envelope[pluck]) pluck = ahead;
    }
    const loudest = envelope[pluck];
    while (pluck > 0 && envelope[pluck - 1] > loudest * 0.1) pluck -= 1;
    plucks.push(pluck);
  }
  const result = { audio, plucks };
  decoded.set(file, result);
  return result;
}

function findTake({ channel, midi: pitch, dynamic }) {
  const prefix = `Guitar.${dynamic}.${STRING_NAMES[channel]}.`;
  for (const file of readdirSync(sourceDir).filter((name) => name.startsWith(prefix) && !name.includes('mono'))) {
    const [, low, high] = /\.([A-G]b?\d)([A-G]b?\d)?\.(?:stereo\.)?aif$/.exec(file);
    const first = noteNumber(low);
    const last = high ? noteNumber(high) : first;
    if (pitch < first || pitch > last) continue;
    // Each file plays its range once, in rising semitones.
    // The soft takes sit lower over the noise, so they get a lower pluck threshold.
    const { audio, plucks } = takesIn(file, dynamic === 'pp' ? 0.002 : 0.004);
    if (plucks.length !== last - first + 1) throw new Error(`${file}: found ${plucks.length} plucks, expected ${last - first + 1}`);
    const index = pitch - first;
    const next = plucks[index + 1];
    return { audio, from: plucks[index] * HOP, to: next === undefined ? audio.length : (next - 5) * HOP };
  }
  throw new Error(`no recording for string ${channel + 1} pitch ${pitch}`);
}

/** Pitch of a take in cents from equal temperament, from its first four partials. */
function centsOff(audio, from, pitch) {
  const size = 1 << 16;
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  const start = from + Math.round(SAMPLE_RATE * 0.08);
  for (let i = 0; i < size; i++) real[i] = (audio[start + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / size));
  fft(real, imaginary);
  const magnitude = (bin) => Math.hypot(real[bin], imaginary[bin]);
  const nominal = 440 * 2 ** ((pitch - 69) / 12);
  let weighted = 0;
  let weight = 0;
  for (let partial = 1; partial <= 4; partial++) {
    let peakBin = Math.round(nominal * partial * 0.955 * size / SAMPLE_RATE);
    for (let bin = peakBin + 1; bin <= nominal * partial * 1.045 * size / SAMPLE_RATE; bin++) {
      if (magnitude(bin) > magnitude(peakBin)) peakBin = bin;
    }
    const [a, b, c] = [-1, 0, 1].map((offset) => Math.log(magnitude(peakBin + offset)));
    const frequency = (peakBin + 0.5 * (a - c) / (a - 2 * b + c)) * SAMPLE_RATE / size;
    weighted += magnitude(peakBin) * frequency / partial;
    weight += magnitude(peakBin);
  }
  return 1200 * Math.log2(weighted / weight / nominal);
}

function fft(real, imaginary) {
  const size = real.length;
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = -2 * Math.PI / length;
    for (let i = 0; i < size; i += length) {
      for (let k = 0; k < length / 2; k++) {
        const cos = Math.cos(angle * k);
        const sin = Math.sin(angle * k);
        const a = i + k;
        const b = a + length / 2;
        const re = real[b] * cos - imaginary[b] * sin;
        const im = real[b] * sin + imaginary[b] * cos;
        real[b] = real[a] - re; imaginary[b] = imaginary[a] - im;
        real[a] += re; imaginary[a] += im;
      }
    }
  }
}

function writeWav(file, samples, sampleRate) {
  const header = Buffer.alloc(44);
  const bytes = samples.length * 4;
  header.write('RIFF', 0); header.writeUInt32LE(36 + bytes, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(3, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(sampleRate * 4, 28);
  header.writeUInt16LE(4, 32); header.writeUInt16LE(32, 34);
  header.write('data', 36); header.writeUInt32LE(bytes, 40);
  writeFileSync(file, Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, bytes)]));
}

// ── Cut, measure ────────────────────────────────────────────────────────

const samples = [...needed.values()].map((entry) => {
  const { audio, from, to } = findTake(entry);
  let peak = 0;
  for (let i = from; i < from + SAMPLE_RATE * 0.05; i++) peak = Math.max(peak, Math.abs(audio[i]));
  let onset = Math.max(0, from - HOP * 3);
  while (Math.abs(audio[onset]) < peak * 0.05) onset += 1;

  const cents = centsOff(audio, onset, entry.midi);
  if (Math.abs(cents) > 70) throw new Error(`${entry.key}: measured ${cents.toFixed(0)} cents from pitch ${entry.midi}`);
  // Retuning happens at encode time: the take is written at a sample rate
  // that is off by its tuning error and ffmpeg resamples it back.
  const tunedRate = Math.round(SAMPLE_RATE * 2 ** (-cents / 1200));

  const seconds = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, entry.seconds + RING_MARGIN_SECONDS));
  const start = Math.max(0, onset - Math.round(PRE_ROLL_SECONDS * tunedRate));
  const frames = Math.min(Math.round(seconds * tunedRate), to - start);
  const take = audio.slice(start, start + frames);
  const fadeFrames = Math.round(frames * TAIL_FADE_FRACTION);
  for (let i = 0; i < fadeFrames; i++) take[frames - fadeFrames + i] *= 0.5 + 0.5 * Math.cos(Math.PI * (i + 1) / fadeFrames);

  let energy = 0;
  const window = Math.round(LEVEL_WINDOW_SECONDS * tunedRate);
  for (let i = onset - start; i < onset - start + window; i++) energy += take[i] * take[i];
  return { ...entry, take, tunedRate, cents, levelDb: toDb(Math.sqrt(energy / window)) };
});

// ── Level: every take sits on one line across the neck ─────────────────
// The player's levels wander by 20 dB from note to note, and the soft takes
// are there for their gentler attack, not to be quieter: velocity sets loudness.

const meanPitch = samples.reduce((sum, sample) => sum + sample.midi, 0) / samples.length;
const meanLevel = samples.reduce((sum, sample) => sum + sample.levelDb, 0) / samples.length;
const slope = LEVEL_SLOPE_DB_PER_SEMITONE;
let loudest = 0;
for (const sample of samples) {
  sample.trimDb = meanLevel + slope * (sample.midi - meanPitch) - sample.levelDb;
  const trim = fromDb(sample.trimDb);
  for (let i = 0; i < sample.take.length; i++) loudest = Math.max(loudest, Math.abs(sample.take[i]) * trim);
}
const sharedGainDb = PEAK_TARGET_DBFS - toDb(loudest);

// ── Encode ──────────────────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true });
for (const stale of readdirSync(outDir).filter((name) => name.endsWith('.mp3'))) rmSync(path.join(outDir, stale));
console.log(`shared gain ${sharedGainDb.toFixed(2)} dB`);
console.log('sample     string fret  cents  level dB  trim dB  seconds   bytes');
let totalBytes = 0;
for (const sample of samples.sort((a, b) => a.channel - b.channel || a.midi - b.midi || a.key.localeCompare(b.key))) {
  const gain = fromDb(sample.trimDb + sharedGainDb);
  for (let i = 0; i < sample.take.length; i++) sample.take[i] *= gain;
  const wav = path.join(workDir, `${sample.key}.wav`);
  const mp3 = path.join(outDir, `${sample.key}.mp3`);
  writeWav(wav, sample.take, sample.tunedRate);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-ar', String(SAMPLE_RATE), '-codec:a', 'libmp3lame', '-q:a', String(MP3_QUALITY), mp3]);
  const bytes = statSync(mp3).size;
  totalBytes += bytes;
  console.log([
    sample.key.padEnd(10), String(sample.channel + 1).padStart(6), String(sample.midi - GUITAR_OPEN_STRINGS[sample.channel]).padStart(4),
    sample.cents.toFixed(1).padStart(6), sample.levelDb.toFixed(1).padStart(9), sample.trimDb.toFixed(1).padStart(8),
    (sample.take.length / sample.tunedRate).toFixed(2).padStart(8), String(bytes).padStart(7)
  ].join(' '));
}
console.log(`${samples.length} samples, ${totalBytes} bytes (${(totalBytes / 1048576).toFixed(2)} MiB)`);
rmSync(workDir, { recursive: true, force: true });
