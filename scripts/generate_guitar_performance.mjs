#!/usr/bin/env node
/**
 * Generate "Saudade de Triana" — an original solo piece for nylon-string
 * guitar that moves between a bossa nova fingerstyle groove and a rumba
 * flamenca break over the Andalusian cadence. Every note is written as a
 * string and fret, the way a guitarist would finger it; nothing is
 * transcribed from an existing work.
 *
 * The MIDI carries the fingering: one track per string on channels 0-5
 * (string 1-6), GM program 24 (nylon guitar). A string sounds one note at a
 * time, so each note ends where the next note on its string begins.
 *
 * Output: public/midi/performances/saudade-de-triana.mid
 *
 * Usage:
 *   node scripts/generate_guitar_performance.mjs
 */

import tonejsMidi from '@tonejs/midi';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { Midi } = tonejsMidi;

const OUT_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..', 'public', 'midi', 'performances', 'saudade-de-triana.mid'
);

const BPM = 112;
const SECONDS_PER_BEAT = 60 / BPM;
const OPEN_STRINGS = { 6: 40, 5: 45, 4: 50, 3: 55, 2: 59, 1: 64 };
const NYLON_GUITAR_PROGRAM = 24;

// Deterministic jitter keeps regeneration reproducible.
let rngState = 20260919;
const random = () => {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
};
const jitter = (amount) => (random() - 0.5) * 2 * amount;

// Tempo breathes like a player's: a slow push and pull, a slight broadening
// into each new section, and a ritardando through the coda.
const SECTION_STARTS = [16, 80, 112, 144];
const RITARD_START = 144;
const STEPS_PER_BEAT = 16;
const LAST_BEAT = 172;
const elapsed = new Float64Array(LAST_BEAT * STEPS_PER_BEAT + 1);
for (let step = 1; step < elapsed.length; step++) {
  const beat = step / STEPS_PER_BEAT;
  let stretch = 1 + 0.012 * Math.sin(2 * Math.PI * beat / 32);
  for (const start of SECTION_STARTS) {
    if (beat > start - 2 && beat <= start) stretch += 0.05 * (1 - (start - beat) / 2);
  }
  if (beat > RITARD_START) stretch += 0.035 * (beat - RITARD_START);
  elapsed[step] = elapsed[step - 1] + stretch * SECONDS_PER_BEAT / STEPS_PER_BEAT;
}
const beatToSeconds = (beat) => {
  const position = Math.min(Math.max(beat, 0), LAST_BEAT) * STEPS_PER_BEAT;
  const step = Math.min(Math.floor(position), elapsed.length - 2);
  return elapsed[step] + (elapsed[step + 1] - elapsed[step]) * (position - step);
};

const notes = [];

/** One plucked note. `at` and `beats` are in beats; `offset` in seconds. */
function pluck(string, fret, at, beats, velocity, offset = 0) {
  notes.push({
    string,
    midi: OPEN_STRINGS[string] + fret,
    time: Math.max(0, beatToSeconds(at) + offset),
    end: beatToSeconds(at + beats) + offset,
    velocity: Math.min(1, Math.max(0.2, velocity + jitter(0.035)))
  });
}

/** Fingers plucking a chord together: a tiny low-to-high roll. */
function block(positions, at, beats, velocity) {
  const nudge = jitter(0.006);
  const roll = 0.004 + random() * 0.007;
  positions.forEach(([string, fret], index) => {
    pluck(string, fret, at, beats, velocity + index * 0.02 + jitter(0.04), nudge + index * roll);
  });
}

/**
 * A strum across a chord shape ({ string: fret }). Down-strokes travel from
 * the bass strings to the trebles, up-strokes the other way and usually
 * only catch the upper strings.
 */
function strum(shape, at, { direction = 'down', beats = 1, velocity = 0.8, spread = 0.011, strings } = {}) {
  const order = (strings || Object.keys(shape).map(Number))
    .filter((string) => shape[string] !== undefined)
    .sort((a, b) => (direction === 'down' ? b - a : a - b));
  const nudge = jitter(0.005);
  order.forEach((string, index) => {
    const lead = direction === 'down' ? index / order.length : 0;
    pluck(string, shape[string], at, beats, velocity - 0.06 + lead * 0.08,
      nudge + index * spread * (1 + jitter(0.2)));
  });
}

/** Left-hand-damped slap: the strum is choked almost at once. */
function slap(shape, at, velocity = 0.5) {
  strum(shape, at, { beats: 0.07, velocity, spread: 0.006 });
}

/** Rasgueado: successive fingers flick down across the strings into `landing`. */
function rasgueado(shape, landing, beats = 1) {
  [[-0.5, 0.56], [-0.375, 0.64], [-0.25, 0.74], [-0.125, 0.84]].forEach(([before, velocity]) => {
    strum(shape, landing + before, { beats: 0.125, velocity, spread: 0.007 });
  });
  strum(shape, landing, { beats, velocity: 0.96, spread: 0.009 });
}

/** Picado: alternating rest strokes, one note per step. */
function picado(line, at, step, velocity) {
  line.forEach(([string, fret], index) => {
    pluck(string, fret, at + index * step, step, velocity + (index % 2 ? -0.05 : 0.03), jitter(0.004));
  });
}

// ── Chord shapes ───────────────────────────────────────────────────────

const E_MAJOR = { 6: 0, 5: 2, 4: 2, 3: 1, 2: 0, 1: 0 };
const E_FLAT_NINE = { 6: 0, 5: 2, 4: 2, 3: 1, 2: 0, 1: 1 };
const F_OPEN = { 6: 1, 5: 3, 4: 3, 3: 2, 2: 0, 1: 0 }; // Fmaj7#11, the flamenco F
const F_MAJOR_SEVEN = { 6: 1, 5: 3, 4: 3, 3: 2, 2: 1, 1: 0 };
const G_MAJOR = { 6: 3, 5: 2, 4: 0, 3: 0, 2: 0, 1: 3 };
const A_MINOR = { 5: 0, 4: 2, 3: 2, 2: 1, 1: 0 };

// Bossa voicings: thumb on the root then the fifth, fingers on strings 4-3-2.
const BOSSA = [
  { root: [5, 0], fifth: [6, 0], fingers: [[4, 5], [3, 5], [2, 5]] }, // Am7
  { root: [5, 5], fifth: [5, 0], fingers: [[4, 3], [3, 5], [2, 5]] }, // Dm9
  { root: [6, 3], fifth: [5, 5], fingers: [[4, 3], [3, 4], [2, 5]] }, // G13
  { root: [5, 3], fifth: [6, 3], fingers: [[4, 2], [3, 4], [2, 3]] }, // Cmaj9
  { root: [6, 1], fifth: [5, 3], fingers: [[4, 2], [3, 2], [2, 1]] }, // Fmaj7
  { root: [5, 2], fifth: [6, 1], fingers: [[4, 3], [3, 2], [2, 3]] }, // Bm7b5
  { root: [6, 0], fifth: [5, 2], fingers: [[4, 0], [3, 1], [2, 0]] }, // E7
  { root: [5, 0], fifth: [6, 0], fingers: [[4, 4], [3, 5], [2, 5]] }  // Am6
];

/** One bar of bossa comping; the finger rhythm alternates over two bars. */
function bossaBar(chord, bar, second, level = 1) {
  const at = bar * 4;
  pluck(...chord.root, at, 2, 0.66 * level);
  pluck(...chord.fifth, at + 2, 2, 0.6 * level);
  (second ? [1, 2.5] : [0, 1.5, 3]).forEach((beat, index) => {
    block(chord.fingers, at + beat, 0.45, (index === 0 ? 0.56 : 0.5) * level);
  });
}

/** One bar of rumba: accented down-strokes, light up-strokes, slaps on 2 and 4. */
function rumbaBar(shape, bar, { from = 0, until = 4, upper = shape } = {}) {
  const at = bar * 4;
  const top = [4, 3, 2, 1];
  [
    [0, () => strum(shape, at, { beats: 0.75, velocity: 0.94 })],
    [0.75, () => strum(upper, at + 0.75, { direction: 'up', beats: 0.25, velocity: 0.62, strings: top })],
    [1, () => slap(shape, at + 1, 0.5)],
    [1.5, () => strum(upper, at + 1.5, { direction: 'up', beats: 0.5, velocity: 0.6, strings: top })],
    [2, () => strum(shape, at + 2, { beats: 0.5, velocity: 0.84 })],
    [2.5, () => strum(upper, at + 2.5, { direction: 'up', beats: 0.25, velocity: 0.58, strings: top })],
    [2.75, () => strum(shape, at + 2.75, { beats: 0.25, velocity: 0.68, strings: top })],
    [3, () => slap(shape, at + 3, 0.52)],
    [3.5, () => strum(upper, at + 3.5, { direction: 'up', beats: 0.5, velocity: 0.62, strings: top })]
  ].filter(([beat]) => beat >= from && beat < until).forEach(([, play]) => play());
}

/** Slow thumb roll that is left to ring. */
const roll = (shape, at, beats, velocity = 0.66) => strum(shape, at, { beats, velocity, spread: 0.05 });

// ── Intro: E, F, G, F into E (bars 0-3) ─────────────────────────────────

roll(E_MAJOR, 0, 4);
[[1, 1, 2], [1, 0, 2.5], [2, 3, 3], [2, 1, 3.5]].forEach(([s, f, at]) => pluck(s, f, at, 0.5, 0.64));
roll(F_OPEN, 4, 4);
[[1, 3, 6], [1, 1, 6.5], [1, 0, 7], [2, 3, 7.5]].forEach(([s, f, at]) => pluck(s, f, at, 0.5, 0.66));
roll(G_MAJOR, 8, 4, 0.7);
[[1, 5, 10], [1, 3, 10.5], [1, 1, 11], [1, 0, 11.5]].forEach(([s, f, at]) => pluck(s, f, at, 0.5, 0.7));
roll(F_OPEN, 12, 2, 0.72);
rasgueado(E_MAJOR, 14, 2);

// ── Bossa (bars 4-19): an eight-bar descending sequence, played twice ───

for (let bar = 4; bar < 20; bar++) bossaBar(BOSSA[(bar - 4) % 8], bar, (bar - 4) % 2 === 1);

// Melody on the first string. [fret, beat in the two-bar unit, beats]
const UNIT = [[0, 0.5, 1], [1, 1.5, 0.5], [2, 2, 1.5], [3, 3.5, 2.5], [4, 6.5, 0.5], [5, 7, 1]];
const UNIT_VARIED = [[0, 0.5, 0.5], [1, 1, 0.5], [0, 1.5, 0.5], [2, 2, 0.75], [1, 2.75, 0.25],
  [2, 3, 0.5], [3, 3.5, 2.5], [4, 6.5, 0.5], [5, 7, 1]];
const LINES = [
  [12, 10, 8, 5, 8, 7], // E D C | A . C B   over Am7  Dm9
  [10, 8, 7, 3, 7, 5],  // D C B | G . B A   over G13  Cmaj9
  [8, 7, 5, 1, 5, 4],   // C B A | F . A G#  over Fmaj7 Bm7b5
  [4, 1, 0, 5, 8, 10]   // G# F E | A . C D  over E7   Am6
];
// Each phrase leans into its long note and eases off through the pickups.
const PHRASING = [0.7, 0.66, 0.73, 0.8, 0.64, 0.68];
LINES.forEach((frets, unit) => {
  UNIT.forEach(([degree, beat, beats]) => pluck(1, frets[degree], 16 + unit * 8 + beat, beats, PHRASING[degree]));
});
LINES.forEach((frets, unit) => {
  const last = unit === LINES.length - 1;
  UNIT_VARIED.filter(([degree]) => !(last && degree >= 4)).forEach(([degree, beat, beats]) => {
    pluck(1, frets[degree], 48 + unit * 8 + beat, last && degree === 3 ? 2 : beats, PHRASING[degree] + 0.03);
  });
});
// A rising Phrygian run lifts the last bar into the rumba.
picado([[1, 0], [1, 1], [1, 4], [1, 5], [1, 7], [1, 8], [1, 10], [1, 12]], 78, 0.25, 0.8);

// ── Rumba over the Andalusian cadence (bars 20-27) ──────────────────────

const CADENCE = [A_MINOR, G_MAJOR, F_MAJOR_SEVEN, E_MAJOR];
for (let bar = 20; bar < 28; bar++) {
  const shape = CADENCE[(bar - 20) % 4];
  const intoF = (bar - 20) % 4 === 1;
  const fill = (bar - 20) % 4 === 3;
  rumbaBar(shape, bar, {
    from: shape === F_MAJOR_SEVEN ? 0.5 : 0, // the rasgueado already landed on this downbeat
    until: bar === 27 ? 0.5 : fill ? 2 : intoF ? 3.5 : 4,
    upper: shape === E_MAJOR ? E_FLAT_NINE : shape
  });
  if (intoF) rasgueado(F_MAJOR_SEVEN, (bar + 1) * 4, 0.75);
}
picado([[1, 7], [1, 5], [1, 4], [1, 1], [1, 0], [2, 3], [2, 1], [2, 0]], 94, 0.25, 0.84);
picado([[1, 12], [1, 10], [1, 8], [1, 7], [1, 5], [1, 4], [1, 1], [1, 0],
  [2, 3], [2, 1], [2, 0], [3, 2], [3, 1], [4, 3]], 108.5, 0.25, 0.86);

// ── Bossa reprise, softer (bars 28-35) ──────────────────────────────────

for (let bar = 28; bar < 36; bar++) bossaBar(BOSSA[(bar - 28) % 8], bar, (bar - 28) % 2 === 1, 0.92);
LINES.forEach((frets, unit) => {
  UNIT.filter(([degree]) => !(unit === 3 && degree >= 4)).forEach(([degree, beat, beats]) => {
    pluck(1, frets[degree], 112 + unit * 8 + beat, unit === 3 && degree === 3 ? 4.5 : beats, PHRASING[degree] - 0.05);
  });
});

// ── Coda: the flamenco F falls to E and rings out (bars 36-39) ──────────

roll(F_OPEN, 144, 4, 0.62);
[[1, 1, 146], [1, 0, 147]].forEach(([s, f, at]) => pluck(s, f, at, 1, 0.6));
roll(E_MAJOR, 148, 4, 0.6);
[[3, 12, 152], [2, 12, 153], [1, 12, 154]].forEach(([s, f, at]) => pluck(s, f, at, 6, 0.52));
roll(E_MAJOR, 156, 8, 0.58);

// ── Write one track per string ──────────────────────────────────────────

const midi = new Midi();
midi.header.setTempo(BPM);
midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
midi.header.name = 'Saudade de Triana';

for (let string = 1; string <= 6; string++) {
  const track = midi.addTrack();
  track.name = `String ${string}`;
  track.channel = string - 1;
  track.instrument.number = NYLON_GUITAR_PROGRAM;
  const onString = notes.filter((note) => note.string === string).sort((a, b) => a.time - b.time);
  onString.forEach((note, index) => {
    const next = onString[index + 1];
    const end = next ? Math.min(note.end, next.time) : note.end;
    track.addNote({ midi: note.midi, time: note.time, duration: Math.max(0.03, end - note.time), velocity: note.velocity });
  });
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, Buffer.from(midi.toArray()));
console.log(`wrote ${OUT_FILE} (${notes.length} notes, ${beatToSeconds(164).toFixed(1)} s)`);
