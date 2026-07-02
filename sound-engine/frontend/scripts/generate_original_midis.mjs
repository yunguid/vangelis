#!/usr/bin/env node
/**
 * Generate the "Originals" MIDI corpus — short pieces composed from scratch
 * in the spirit of the Blade Runner / Vangelis palette (slow synth blues,
 * drones, arpeggio chase cues). Everything here is an original composition,
 * written note-by-note in this script; nothing is transcribed.
 *
 * Output: public/midi/originals/<id>.mid
 *
 * Usage:
 *   node scripts/generate_original_midis.mjs
 */

import tonejsMidi from '@tonejs/midi';

const { Midi } = tonejsMidi;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'midi',
  'originals'
);

// ── Note helpers ───────────────────────────────────────────────────────

const NOTE_OFFSETS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'C#4' -> MIDI number (C4 = 60). */
const n = (name) => {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(name);
  if (!match) throw new Error(`Bad note name: ${name}`);
  const [, letter, accidental, octave] = match;
  const semitone = NOTE_OFFSETS[letter]
    + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
  return (Number(octave) + 1) * 12 + semitone;
};

/** Deterministic pseudo-random in [0, 1) — keeps regeneration reproducible. */
const makeRng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

/**
 * Tiny sequencing surface: times in beats, converted to seconds on write.
 * humanize jitters onsets/velocities a touch so pads don't machine-gun.
 */
class Part {
  constructor({ bpm, humanize = 0, seed = 1 }) {
    this.bpm = bpm;
    this.humanize = humanize;
    this.rng = makeRng(seed);
    this.notes = [];
  }

  secondsPerBeat() {
    return 60 / this.bpm;
  }

  add(noteName, beat, beats, velocity = 0.7) {
    const spb = this.secondsPerBeat();
    const jitter = this.humanize > 0
      ? (this.rng() - 0.5) * 2 * this.humanize
      : 0;
    const velJitter = this.humanize > 0 ? (this.rng() - 0.5) * 0.08 : 0;
    this.notes.push({
      midi: typeof noteName === 'number' ? noteName : n(noteName),
      time: Math.max(0, beat * spb + jitter),
      duration: Math.max(0.05, beats * spb - 0.01),
      velocity: Math.min(1, Math.max(0.05, velocity + velJitter))
    });
  }

  chord(noteNames, beat, beats, velocity = 0.6) {
    noteNames.forEach((name, index) => {
      // Soft strum: upper voices land a hair later, slightly quieter.
      this.add(name, beat + index * 0.015, beats, velocity - index * 0.02);
    });
  }
}

const writeMidi = ({ id, name, bpm, parts }) => {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
  midi.header.name = name;

  parts.forEach((part, index) => {
    const track = midi.addTrack();
    track.name = `Part ${index + 1}`;
    part.notes
      .sort((a, b) => a.time - b.time)
      .forEach((note) => track.addNote(note));
  });

  const file = path.join(OUT_DIR, `${id}.mid`);
  fs.writeFileSync(file, Buffer.from(midi.toArray()));
  const totalNotes = parts.reduce((sum, part) => sum + part.notes.length, 0);
  console.log(`wrote ${file} (${totalNotes} notes)`);
};

// ── Pieces ─────────────────────────────────────────────────────────────

/**
 * Neon Rain — a slow synth blues in C# minor. Sparse pentatonic lead over
 * m9 pads, the kind of cue that drifts past a rain-soaked window.
 */
const neonRain = () => {
  const bpm = 52;
  const pads = new Part({ bpm, humanize: 0.01, seed: 11 });
  const bass = new Part({ bpm, seed: 12 });
  const lead = new Part({ bpm, humanize: 0.02, seed: 13 });

  // 8-bar progression, played twice (64 beats total).
  const PROG = [
    { chord: ['C#3', 'E3', 'G#3', 'D#4'], bass: 'C#2' }, // C#m9
    { chord: ['C#3', 'E3', 'B3', 'D#4'], bass: 'C#2' },
    { chord: ['F#3', 'A3', 'C#4', 'G#4'], bass: 'F#2' }, // F#m9
    { chord: ['C#3', 'E3', 'G#3', 'B3'], bass: 'C#2' },
    { chord: ['A2', 'E3', 'G#3', 'C#4'], bass: 'A1' },   // Amaj7
    { chord: ['G#2', 'F#3', 'B#3', 'D#4'], bass: 'G#1' }, // G#7
    { chord: ['C#3', 'E3', 'G#3', 'D#4'], bass: 'C#2' },
    { chord: ['C#3', 'G#3', 'B3', 'E4'], bass: 'C#2' }
  ];

  for (let pass = 0; pass < 2; pass++) {
    PROG.forEach((bar, i) => {
      const at = pass * 32 + i * 4;
      pads.chord(bar.chord, at, 4, 0.5);
      bass.add(bar.bass, at, 4, 0.62);
    });
  }

  // Lead phrases on the C# minor pentatonic, entering in bar 3.
  // [note, startBeat, beats, velocity]
  const PHRASES = [
    ['G#4', 8.5, 1.5, 0.66], ['B4', 10, 1, 0.6], ['C#5', 11, 4.5, 0.7],
    ['B4', 16, 1, 0.58], ['G#4', 17, 2.5, 0.62],
    ['E4', 20.5, 1, 0.55], ['F#4', 21.5, 5, 0.66],
    ['G#4', 28, 1.5, 0.6], ['E4', 29.5, 2, 0.55], ['C#4', 31.5, 4, 0.6],
    // Second pass: answer phrases an octave up, more ornament.
    ['C#5', 40.5, 1, 0.68], ['D#5', 41.5, 0.5, 0.62], ['E5', 42, 4, 0.74],
    ['D#5', 46, 1, 0.62], ['C#5', 47, 1, 0.6], ['B4', 48, 3, 0.66],
    ['G#4', 52, 1.5, 0.6], ['B4', 53.5, 0.5, 0.58], ['C#5', 54, 5.5, 0.7],
    ['B4', 60, 1, 0.55], ['G#4', 61, 1, 0.52], ['C#4', 62, 5, 0.6]
  ];
  PHRASES.forEach(([note, at, beats, vel]) => lead.add(note, at, beats, vel));

  writeMidi({
    id: 'original-neon-rain',
    name: 'Neon Rain (Synth Blues)',
    bpm,
    parts: [pads, bass, lead]
  });
};

/**
 * Sea of Dunes — a Dorian drone piece. Open fifths hold the floor while a
 * long-tone melody wanders above; written for the drone/pad presets.
 */
const seaOfDunes = () => {
  const bpm = 46;
  const drone = new Part({ bpm, seed: 21 });
  const melody = new Part({ bpm, humanize: 0.03, seed: 22 });

  // 16 bars of low D fifths, refreshed every 4 bars.
  for (let bar = 0; bar < 16; bar += 4) {
    drone.add('D2', bar * 4, 16, 0.55);
    drone.add('A2', bar * 4, 16, 0.48);
    if (bar >= 8) drone.add('D3', bar * 4, 16, 0.4);
  }

  // D Dorian long tones: D E F G A B C.
  const MELODY = [
    ['D4', 4, 6, 0.5], ['F4', 10, 4, 0.52], ['E4', 14, 6, 0.5],
    ['G4', 22, 5, 0.55], ['A4', 27, 7, 0.6],
    ['B4', 36, 4, 0.58], ['A4', 40, 4, 0.54], ['F4', 44, 6, 0.5],
    ['E4', 52, 5, 0.5], ['D4', 57, 7, 0.52]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-sea-of-dunes',
    name: 'Sea of Dunes (Drone)',
    bpm,
    parts: [drone, melody]
  });
};

/**
 * Escape Velocity — a chase cue. Sixteenth-note A minor ostinato under a
 * brass-style melody; written for the lead/brass presets.
 */
const escapeVelocity = () => {
  const bpm = 104;
  const arp = new Part({ bpm, seed: 31 });
  const bass = new Part({ bpm, seed: 32 });
  const melody = new Part({ bpm, humanize: 0.012, seed: 33 });

  // Two-bar arp cells over a i–VI–III–VII progression (Am F C G), x4.
  const CELLS = [
    { root: 'A1', arp: ['A2', 'E3', 'A3', 'C4', 'E4', 'C4', 'A3', 'E3'] },
    { root: 'F1', arp: ['F2', 'C3', 'F3', 'A3', 'C4', 'A3', 'F3', 'C3'] },
    { root: 'C2', arp: ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'] },
    { root: 'G1', arp: ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3'] }
  ];

  for (let round = 0; round < 4; round++) {
    CELLS.forEach((cell, cellIndex) => {
      const barStart = (round * 8 + cellIndex * 2) * 4; // 2 bars per cell
      bass.add(cell.root, barStart, 8, 0.7);
      for (let i = 0; i < 16; i++) {
        const accent = i % 4 === 0 ? 0.68 : 0.5;
        arp.add(cell.arp[i % 8], barStart + i * 0.5, 0.48, accent);
      }
    });
  }

  // Melody enters on round 2 (beat 32), heroic and even.
  const MELODY = [
    ['E4', 32, 3, 0.72], ['G4', 35, 1, 0.66], ['A4', 36, 4, 0.78],
    ['C5', 40, 2, 0.74], ['B4', 42, 2, 0.7], ['G4', 44, 4, 0.72],
    ['A4', 48, 3, 0.74], ['E4', 51, 1, 0.62], ['F4', 52, 4, 0.7],
    ['G4', 56, 2, 0.7], ['E4', 58, 2, 0.64], ['D4', 60, 4, 0.66],
    // Round 3-4: lifted an octave for the climax.
    ['E5', 64, 3, 0.8], ['G5', 67, 1, 0.72], ['A5', 68, 4, 0.84],
    ['C6', 72, 2, 0.8], ['B5', 74, 2, 0.74], ['G5', 76, 4, 0.76],
    ['A5', 80, 3, 0.8], ['E5', 83, 1, 0.68], ['F5', 84, 4, 0.74],
    ['G5', 88, 2, 0.74], ['B4', 90, 2, 0.66], ['A4', 92, 8, 0.78]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-escape-velocity',
    name: 'Escape Velocity (Chase)',
    bpm,
    parts: [arp, bass, melody]
  });
};

/**
 * Green Memories — a gentle ballad in E major built on broken add9 chords;
 * written for the FM e-piano preset.
 */
const greenMemories = () => {
  const bpm = 68;
  const arps = new Part({ bpm, humanize: 0.02, seed: 41 });
  const melody = new Part({ bpm, humanize: 0.025, seed: 42 });

  // Each bar: a slow broken chord, low to high, eighths.
  const BARS = [
    ['E2', 'B2', 'G#3', 'B3', 'F#4', 'B3', 'G#3', 'B2'],  // Emaj9
    ['C#2', 'G#2', 'E3', 'B3', 'D#4', 'B3', 'E3', 'G#2'], // C#m9
    ['A1', 'E2', 'C#3', 'G#3', 'B3', 'G#3', 'C#3', 'E2'], // Amaj9
    ['B1', 'F#2', 'D#3', 'A3', 'C#4', 'A3', 'D#3', 'F#2'] // B13
  ];

  for (let round = 0; round < 4; round++) {
    BARS.forEach((bar, barIndex) => {
      const start = (round * 4 + barIndex) * 4;
      bar.forEach((note, i) => {
        arps.add(note, start + i * 0.5, 0.9, 0.5 + (i === 0 ? 0.1 : 0));
      });
    });
  }

  const MELODY = [
    ['G#4', 16, 2, 0.6], ['F#4', 18, 1, 0.55], ['E4', 19, 5, 0.6],
    ['D#4', 24, 2, 0.55], ['E4', 26, 1, 0.52], ['F#4', 27, 5, 0.6],
    ['B4', 32, 3, 0.64], ['G#4', 35, 1, 0.56], ['A4', 36, 4, 0.62],
    ['F#4', 40, 2, 0.56], ['D#4', 42, 2, 0.52], ['E4', 44, 8, 0.6],
    ['E5', 52, 2.5, 0.64], ['D#5', 54.5, 1.5, 0.58], ['B4', 56, 4, 0.62],
    ['A4', 60, 1.5, 0.55], ['G#4', 61.5, 2.5, 0.55]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-green-memories',
    name: 'Green Memories (Ballad)',
    bpm,
    parts: [arps, melody]
  });
};

/**
 * Elegy for Replicants — six very slow chords with a moving top voice.
 * Written for the big ambient pads; each chord is a small weather system.
 */
const elegyForReplicants = () => {
  const bpm = 40;
  const pads = new Part({ bpm, humanize: 0.02, seed: 51 });
  const top = new Part({ bpm, humanize: 0.03, seed: 52 });

  // Each entry holds 8 beats (12 s at 40 BPM).
  const CHORDS = [
    { notes: ['F#2', 'C#3', 'F#3', 'A3', 'E4'], top: 'C#5' },  // F#m11
    { notes: ['D2', 'A2', 'D3', 'F#3', 'C#4'], top: 'A4' },    // Dmaj7
    { notes: ['B1', 'F#2', 'B2', 'D3', 'A3'], top: 'F#4' },    // Bm7
    { notes: ['G2', 'D3', 'G3', 'B3', 'F#4'], top: 'B4' },     // Gmaj7
    { notes: ['E2', 'B2', 'E3', 'G3', 'D4'], top: 'G4' },      // Em7
    { notes: ['F#2', 'C#3', 'A3', 'C#4', 'G#4'], top: 'C#5' }  // F#m9
  ];

  CHORDS.forEach((entry, i) => {
    const at = i * 8;
    pads.chord(entry.notes, at, 8.5, 0.48);
    // Top voice swells in mid-chord, ties into the next change.
    top.add(entry.top, at + 3, 5.5, 0.5);
  });

  writeMidi({
    id: 'original-elegy-for-replicants',
    name: 'Elegy for Replicants (Ambient)',
    bpm,
    parts: [pads, top]
  });
};

/**
 * Rain on Chrome — a syncopated E minor sequence study for the pluck and
 * acid presets. One repeating cell that mutates every eight bars.
 */
const rainOnChrome = () => {
  const bpm = 96;
  const seq = new Part({ bpm, seed: 61 });
  const bass = new Part({ bpm, seed: 62 });
  const accents = new Part({ bpm, humanize: 0.015, seed: 63 });

  // 16th-note cell over Em: [step, note, velocity] — rests are skipped steps.
  const CELL_A = [
    [0, 'E3', 0.72], [3, 'B3', 0.5], [6, 'E4', 0.62], [8, 'D4', 0.5],
    [10, 'B3', 0.55], [12, 'G3', 0.6], [14, 'F#3', 0.45]
  ];
  const CELL_B = [
    [0, 'E3', 0.72], [3, 'B3', 0.5], [6, 'G4', 0.66], [8, 'F#4', 0.52],
    [10, 'E4', 0.56], [12, 'B3', 0.6], [15, 'D4', 0.46]
  ];
  const CELL_C = [
    [0, 'C3', 0.7], [3, 'G3', 0.5], [6, 'C4', 0.62], [8, 'B3', 0.5],
    [10, 'G3', 0.55], [12, 'E3', 0.58], [14, 'D3', 0.45]
  ];
  const CELL_D = [
    [0, 'D3', 0.7], [3, 'A3', 0.5], [6, 'D4', 0.62], [8, 'C4', 0.5],
    [10, 'A3', 0.55], [12, 'F#3', 0.58], [15, 'A3', 0.46]
  ];

  // Bar plan: 8x A/B alternating on Em, then C (C maj) and D (D maj) turns.
  const PLAN = [
    { cell: CELL_A, root: 'E2' }, { cell: CELL_B, root: 'E2' },
    { cell: CELL_A, root: 'E2' }, { cell: CELL_B, root: 'E2' },
    { cell: CELL_C, root: 'C2' }, { cell: CELL_C, root: 'C2' },
    { cell: CELL_D, root: 'D2' }, { cell: CELL_B, root: 'E2' }
  ];

  for (let round = 0; round < 3; round++) {
    PLAN.forEach((bar, barIndex) => {
      const start = (round * 8 + barIndex) * 4;
      bass.add(bar.root, start, 4, 0.6);
      bar.cell.forEach(([step, note, vel]) => {
        seq.add(note, start + step * 0.25, 0.22, vel);
      });
    });
  }

  // Long accent tones drift in for the last two rounds.
  const ACCENTS = [
    ['B4', 32, 6, 0.5], ['G4', 40, 6, 0.48], ['A4', 48, 6, 0.5],
    ['E5', 56, 6, 0.55], ['D5', 64, 6, 0.5], ['B4', 72, 8, 0.52],
    ['G4', 84, 8, 0.48]
  ];
  ACCENTS.forEach(([note, at, beats, vel]) => accents.add(note, at, beats, vel));

  writeMidi({
    id: 'original-rain-on-chrome',
    name: 'Rain on Chrome (Sequence)',
    bpm,
    parts: [seq, bass, accents]
  });
};

/**
 * Offworld Anthem — a broad, slow fanfare in F major for the brass presets.
 * Block chords with a stately melody, ending on a long suspended resolve.
 */
const offworldAnthem = () => {
  const bpm = 84;
  const pads = new Part({ bpm, humanize: 0.012, seed: 71 });
  const bass = new Part({ bpm, seed: 72 });
  const melody = new Part({ bpm, humanize: 0.015, seed: 73 });

  // [chordNotes, bass, beats]
  const SEQUENCE = [
    [['F3', 'A3', 'C4'], 'F2', 4], [['C3', 'E3', 'G3'], 'C2', 4],
    [['D3', 'F3', 'A3'], 'D2', 4], [['Bb2', 'D3', 'F3'], 'Bb1', 4],
    [['F3', 'A3', 'C4'], 'F2', 4], [['G3', 'Bb3', 'D4'], 'G2', 4],
    [['A3', 'C4', 'E4'], 'A2', 4], [['Bb2', 'F3', 'C4'], 'Bb1', 4], // Bbsus2
    [['F3', 'A3', 'C4'], 'F2', 4], [['C3', 'E3', 'G3'], 'C2', 4],
    [['D3', 'F3', 'A3'], 'D2', 4], [['Bb2', 'D3', 'G3'], 'G1', 4],  // Gm/Bb
    [['C3', 'F3', 'A3'], 'C2', 4], [['C3', 'E3', 'Bb3'], 'C2', 4],  // F/C, C7
    [['F3', 'A3', 'C4'], 'F2', 8]
  ];

  let beat = 0;
  SEQUENCE.forEach(([chord, root, beats]) => {
    pads.chord(chord, beat, beats, 0.58);
    bass.add(root, beat, beats, 0.66);
    beat += beats;
  });

  const MELODY = [
    ['C5', 0, 3, 0.7], ['A4', 3, 1, 0.6], ['G4', 4, 4, 0.68],
    ['A4', 8, 3, 0.68], ['F4', 11, 1, 0.58], ['D4', 12, 4, 0.62],
    ['C5', 16, 3, 0.72], ['D5', 19, 1, 0.64], ['E5', 20, 4, 0.74],
    ['F5', 24, 3, 0.78], ['C5', 27, 1, 0.66], ['D5', 28, 4, 0.7],
    ['C5', 32, 4, 0.7], ['G4', 36, 4, 0.64],
    ['A4', 40, 3, 0.66], ['Bb4', 43, 1, 0.6], ['D5', 44, 4, 0.7],
    ['C5', 48, 4, 0.72], ['Bb4', 52, 2, 0.64], ['G4', 54, 2, 0.6],
    ['F4', 56, 8, 0.68]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-offworld-anthem',
    name: 'Offworld Anthem (Fanfare)',
    bpm,
    parts: [pads, bass, melody]
  });
};

/**
 * Vapor Lights — a second synth blues, slower and jazzier than Neon Rain.
 * G minor with 9th voicings; the lead leans on space and repeated notes.
 */
const vaporLights = () => {
  const bpm = 58;
  const pads = new Part({ bpm, humanize: 0.012, seed: 81 });
  const bass = new Part({ bpm, seed: 82 });
  const lead = new Part({ bpm, humanize: 0.025, seed: 83 });

  // 12-bar minor blues in G: i i i i / iv iv i i / VI V i i
  const BARS = [
    { chord: ['G2', 'Bb2', 'D3', 'A3'], bass: 'G1' },   // Gm9
    { chord: ['G2', 'Bb2', 'F3', 'A3'], bass: 'G1' },
    { chord: ['G2', 'D3', 'F3', 'Bb3'], bass: 'G1' },
    { chord: ['G2', 'Bb2', 'D3', 'A3'], bass: 'G1' },
    { chord: ['C3', 'Eb3', 'G3', 'D4'], bass: 'C2' },   // Cm9
    { chord: ['C3', 'Eb3', 'Bb3', 'D4'], bass: 'C2' },
    { chord: ['G2', 'Bb2', 'D3', 'A3'], bass: 'G1' },
    { chord: ['G2', 'D3', 'F3', 'Bb3'], bass: 'G1' },
    { chord: ['Eb3', 'G3', 'Bb3', 'D4'], bass: 'Eb2' }, // Ebmaj7
    { chord: ['D3', 'F#3', 'A3', 'C4'], bass: 'D2' },   // D7
    { chord: ['G2', 'Bb2', 'D3', 'A3'], bass: 'G1' },
    { chord: ['G2', 'Bb2', 'F3', 'A3'], bass: 'G1' }
  ];

  for (let pass = 0; pass < 2; pass++) {
    BARS.forEach((bar, i) => {
      const at = pass * 48 + i * 4;
      pads.chord(bar.chord, at, 4, 0.48);
      bass.add(bar.bass, at, 4, 0.6);
    });
  }

  // Sparse lead built on the G blues scale (G Bb C Db D F).
  const PHRASES = [
    ['D4', 4.5, 1, 0.6], ['F4', 5.5, 0.5, 0.55], ['G4', 6, 5, 0.66],
    ['F4', 12, 1, 0.56], ['D4', 13, 2.5, 0.6],
    ['Bb4', 16.5, 1.5, 0.64], ['C5', 18, 4, 0.68],
    ['Bb4', 24, 0.75, 0.58], ['G4', 24.75, 0.75, 0.55], ['F4', 25.5, 4, 0.6],
    ['D4', 32, 1, 0.55], ['Db4', 33, 0.5, 0.5], ['C4', 33.5, 2.5, 0.55],
    ['G4', 36.5, 1, 0.6], ['Bb4', 37.5, 6, 0.66],
    // Pass two: higher, more talkative.
    ['G4', 52.5, 0.75, 0.62], ['Bb4', 53.25, 0.75, 0.6], ['C5', 54, 4.5, 0.7],
    ['D5', 60, 1.5, 0.7], ['C5', 61.5, 1, 0.62], ['Bb4', 62.5, 3.5, 0.66],
    ['G5', 64.5, 1, 0.72], ['F5', 65.5, 1, 0.66], ['D5', 66.5, 4, 0.7],
    ['C5', 72, 0.75, 0.62], ['Bb4', 72.75, 0.75, 0.58], ['G4', 73.5, 4, 0.62],
    ['F4', 80, 1, 0.55], ['G4', 81, 1.5, 0.58], ['D4', 82.5, 4, 0.56],
    ['G4', 88, 7, 0.6]
  ];
  PHRASES.forEach(([note, at, beats, vel]) => lead.add(note, at, beats, vel));

  writeMidi({
    id: 'original-vapor-lights',
    name: 'Vapor Lights (Blues II)',
    bpm,
    parts: [pads, bass, lead]
  });
};

// ── Cycle-3 pieces: cues matched to the 25 new factory presets ─────────

/**
 * Scream at the Sky — expressive minor lead cue for "Jexus Scream".
 * Long crying phrases over Am–F–Dm–E, wide intervals, lots of air.
 */
const screamAtTheSky = () => {
  const bpm = 63;
  const pads = new Part({ bpm, humanize: 0.015, seed: 101 });
  const bass = new Part({ bpm, seed: 102 });
  const lead = new Part({ bpm, humanize: 0.02, seed: 103 });

  const PROG = [
    { chord: ['A2', 'E3', 'A3', 'C4'], bass: 'A1' },   // Am
    { chord: ['F2', 'C3', 'A3', 'E4'], bass: 'F1' },   // Fmaj7
    { chord: ['D3', 'A3', 'D4', 'F4'], bass: 'D2' },   // Dm
    { chord: ['E3', 'G#3', 'B3', 'D4'], bass: 'E2' }   // E7
  ];
  for (let pass = 0; pass < 4; pass++) {
    PROG.forEach((bar, i) => {
      const at = pass * 16 + i * 4;
      pads.chord(bar.chord, at, 4, 0.46);
      bass.add(bar.bass, at, 4, 0.6);
    });
  }

  const PHRASES = [
    ['E4', 2, 2, 0.6], ['A4', 4.5, 3.5, 0.7], ['G4', 8.5, 1, 0.6],
    ['E4', 9.5, 2.5, 0.62], ['F4', 12.5, 2, 0.6], ['E4', 14.5, 1.5, 0.55],
    ['C5', 18, 4, 0.74], ['B4', 22.5, 1.5, 0.64], ['A4', 24, 3, 0.66],
    ['E5', 28, 3.5, 0.78], ['D5', 31.5, 0.5, 0.66],
    ['C5', 34, 2, 0.68], ['A4', 36.5, 2.5, 0.62], ['B4', 40, 3.5, 0.68],
    ['G#4', 44, 3, 0.6],
    ['A4', 48, 1, 0.62], ['C5', 49, 1, 0.66], ['E5', 50, 5, 0.8],
    ['D5', 56, 2, 0.68], ['C5', 58, 2, 0.64], ['B4', 60, 1.5, 0.6],
    ['A4', 61.5, 2.5, 0.62]
  ];
  PHRASES.forEach(([note, at, beats, vel]) => lead.add(note, at, beats, vel));

  writeMidi({
    id: 'original-scream-at-the-sky',
    name: 'Scream at the Sky (Lead Ballad)',
    bpm,
    parts: [pads, bass, lead]
  });
};

/**
 * Chrome Canyon Run — driving synth-rock riff cue for "Prophet Sync Sting".
 * Pumping eighth bass in E minor with offbeat stabs and a hard riff.
 */
const chromeCanyonRun = () => {
  const bpm = 118;
  const bass = new Part({ bpm, seed: 111 });
  const stabs = new Part({ bpm, humanize: 0.01, seed: 112 });
  const riff = new Part({ bpm, humanize: 0.012, seed: 113 });

  // Bar plan: Em Em C D x4 — bass pumps root eighths.
  const ROOTS = ['E2', 'E2', 'C2', 'D2'];
  const STAB_CHORDS = {
    E2: ['E3', 'G3', 'B3'],
    C2: ['C3', 'E3', 'G3'],
    D2: ['D3', 'F#3', 'A3']
  };
  for (let round = 0; round < 4; round++) {
    ROOTS.forEach((root, barIndex) => {
      const start = (round * 4 + barIndex) * 4;
      for (let i = 0; i < 8; i++) {
        bass.add(root, start + i * 0.5, 0.45, i % 2 === 0 ? 0.72 : 0.6);
      }
      // Offbeat stabs on the and-of-2 and and-of-4.
      stabs.chord(STAB_CHORDS[root], start + 1.5, 0.4, 0.6);
      stabs.chord(STAB_CHORDS[root], start + 3.5, 0.4, 0.58);
    });
  }

  const RIFF = [
    ['E4', 16, 0.5, 0.74], ['G4', 16.5, 0.5, 0.68], ['A4', 17, 1, 0.72],
    ['B4', 18.5, 1.5, 0.76], ['A4', 20, 0.5, 0.66], ['G4', 20.5, 0.5, 0.62],
    ['E4', 21, 2, 0.7],
    ['E4', 24, 0.5, 0.74], ['G4', 24.5, 0.5, 0.68], ['B4', 25, 1, 0.76],
    ['D5', 26.5, 1.5, 0.8], ['C5', 28, 1, 0.7], ['B4', 29, 1, 0.68],
    ['A4', 30, 2, 0.7],
    ['E5', 32, 1.5, 0.82], ['D5', 33.5, 0.5, 0.7], ['B4', 34, 1, 0.72],
    ['G4', 35, 1, 0.66], ['A4', 36, 2.5, 0.74], ['B4', 38.5, 1.5, 0.72],
    ['C5', 40, 1, 0.72], ['B4', 41, 1, 0.68], ['A4', 42, 1, 0.66],
    ['G4', 43, 1, 0.62], ['F#4', 44, 2, 0.64], ['E4', 46, 2, 0.66],
    ['E4', 48, 0.5, 0.74], ['G4', 48.5, 0.5, 0.68], ['A4', 49, 1, 0.72],
    ['B4', 50.5, 1.5, 0.76], ['D5', 52, 2, 0.8], ['E5', 54, 2, 0.84],
    ['B4', 56, 1, 0.7], ['D5', 57, 1, 0.72], ['E5', 58, 4, 0.82]
  ];
  RIFF.forEach(([note, at, beats, vel]) => riff.add(note, at, beats, vel));

  writeMidi({
    id: 'original-chrome-canyon-run',
    name: 'Chrome Canyon Run (Synth Rock)',
    bpm,
    parts: [bass, stabs, riff]
  });
};

/**
 * Sugar Crash Angel — hyperpop anthem for "Hyperpop Supersaw".
 * I–V–vi–IV in C at 160, syncopated supersaw stabs, octave-leaping hook.
 */
const sugarCrashAngel = () => {
  const bpm = 160;
  const stabs = new Part({ bpm, humanize: 0.008, seed: 121 });
  const bass = new Part({ bpm, seed: 122 });
  const hook = new Part({ bpm, humanize: 0.01, seed: 123 });

  const PROG = [
    { chord: ['C4', 'E4', 'G4'], bass: 'C2' },
    { chord: ['B3', 'D4', 'G4'], bass: 'G2' },
    { chord: ['C4', 'E4', 'A4'], bass: 'A2' },
    { chord: ['C4', 'F4', 'A4'], bass: 'F2' }
  ];
  // Syncopated stab pattern per bar (beats): 0, 1.5, 2.5, 3.
  const HITS = [[0, 0.7], [1.5, 0.6], [2.5, 0.62], [3, 0.55]];
  for (let round = 0; round < 4; round++) {
    PROG.forEach((bar, barIndex) => {
      const start = (round * 4 + barIndex) * 4;
      HITS.forEach(([beat, vel]) => stabs.chord(bar.chord, start + beat, 0.6, vel));
      bass.add(bar.bass, start, 1.5, 0.72);
      bass.add(bar.bass, start + 2, 1, 0.62);
      bass.add(bar.bass, start + 3.5, 0.5, 0.66);
    });
  }

  const HOOK = [
    ['E5', 16, 1, 0.78], ['G5', 17, 0.5, 0.72], ['E5', 17.5, 0.5, 0.68],
    ['D5', 18, 1.5, 0.74], ['C5', 19.5, 0.5, 0.66], ['D5', 20, 2, 0.72],
    ['E5', 22, 2, 0.74],
    ['A5', 24, 1.5, 0.84], ['G5', 25.5, 0.5, 0.72], ['E5', 26, 1, 0.72],
    ['G5', 27, 1, 0.74], ['A5', 28, 2, 0.8], ['G5', 30, 2, 0.74],
    ['F5', 32, 1, 0.74], ['A5', 33, 0.5, 0.76], ['F5', 33.5, 0.5, 0.68],
    ['E5', 34, 1.5, 0.72], ['D5', 35.5, 0.5, 0.64], ['E5', 36, 2, 0.72],
    ['C5', 38, 2, 0.68],
    ['E5', 40, 0.5, 0.74], ['E5', 41, 0.5, 0.7], ['E5', 42, 0.5, 0.72],
    ['G5', 42.5, 0.5, 0.74], ['C6', 43, 3, 0.86],
    // Second pass: hook lifted with octave pops.
    ['E5', 48, 1, 0.78], ['E6', 49, 0.5, 0.84], ['E5', 49.5, 0.5, 0.68],
    ['D5', 50, 1.5, 0.74], ['C5', 51.5, 0.5, 0.66], ['D5', 52, 2, 0.72],
    ['E5', 54, 2, 0.74],
    ['A5', 56, 1.5, 0.84], ['A4', 57.5, 0.5, 0.66], ['E5', 58, 1, 0.72],
    ['G5', 59, 1, 0.74], ['A5', 60, 4, 0.82]
  ];
  HOOK.forEach(([note, at, beats, vel]) => hook.add(note, at, beats, vel));

  writeMidi({
    id: 'original-sugar-crash-angel',
    name: 'Sugar Crash Angel (Hyperpop)',
    bpm,
    parts: [stabs, bass, hook]
  });
};

/**
 * Red Mist — rage cue for "Rage Siren" / "Rage Growl". F minor riff leaning
 * on the b2 (Gb) and b5 (B), half-time 808 floor under triplet-feel jabs.
 */
const redMist = () => {
  const bpm = 150;
  const riff = new Part({ bpm, humanize: 0.008, seed: 131 });
  const sub = new Part({ bpm, seed: 132 });
  const stabs = new Part({ bpm, humanize: 0.01, seed: 133 });

  // One-bar riff cell (16ths): F F Ab F Gb F B(b5) Gb — with rests.
  const CELL = [
    [0, 'F3', 0.78], [2, 'F3', 0.6], [4, 'Ab3', 0.7], [6, 'F3', 0.6],
    [8, 'Gb3', 0.74], [11, 'F3', 0.58], [12, 'B3', 0.76], [14, 'Gb3', 0.62]
  ];
  const CELL_VAR = [
    [0, 'F3', 0.78], [2, 'F3', 0.6], [4, 'Ab3', 0.7], [6, 'Bb3', 0.66],
    [8, 'B3', 0.78], [10, 'Bb3', 0.62], [12, 'Ab3', 0.7], [14, 'Gb3', 0.62]
  ];
  for (let bar = 0; bar < 16; bar++) {
    const start = bar * 4;
    const cell = bar % 4 === 3 ? CELL_VAR : CELL;
    cell.forEach(([step, note, vel]) => riff.add(note, start + step * 0.25, 0.22, vel));
    // Half-time 808: beat 1 held long, ghost on the and-of-3.
    sub.add(bar % 8 < 6 ? 'F1' : 'Db2', start, 2.6, 0.8);
    if (bar % 2 === 1) sub.add(bar % 8 < 6 ? 'F1' : 'B1', start + 3, 0.9, 0.66);
  }

  // High siren stabs answering every four bars.
  const STABS = [
    ['F5', 12, 1.5, 0.7], ['Gb5', 14, 1.5, 0.72],
    ['F5', 28, 1, 0.7], ['B4', 29.5, 2, 0.68],
    ['Ab5', 44, 1.5, 0.74], ['Gb5', 46, 1.5, 0.7],
    ['F5', 60, 3, 0.76]
  ];
  STABS.forEach(([note, at, beats, vel]) => stabs.add(note, at, beats, vel));

  writeMidi({
    id: 'original-red-mist',
    name: 'Red Mist (Rage)',
    bpm,
    parts: [riff, sub, stabs]
  });
};

/**
 * Analog Sunrise — major-key anthem for "Memorymoog Fifths".
 * D major, rising melody over I–IV–vi–V, warm and simple.
 */
const analogSunrise = () => {
  const bpm = 96;
  const pads = new Part({ bpm, humanize: 0.012, seed: 141 });
  const bass = new Part({ bpm, seed: 142 });
  const melody = new Part({ bpm, humanize: 0.015, seed: 143 });

  const PROG = [
    { chord: ['D3', 'F#3', 'A3', 'E4'], bass: 'D2' },  // Dadd9
    { chord: ['G3', 'B3', 'D4', 'A4'], bass: 'G2' },   // Gadd9
    { chord: ['B2', 'F#3', 'B3', 'D4'], bass: 'B1' },  // Bm
    { chord: ['A2', 'E3', 'A3', 'C#4'], bass: 'A1' }   // A
  ];
  for (let round = 0; round < 4; round++) {
    PROG.forEach((bar, i) => {
      const at = round * 16 + i * 4;
      pads.chord(bar.chord, at, 4, 0.5);
      bass.add(bar.bass, at, 2, 0.64);
      bass.add(bar.bass, at + 2.5, 1.5, 0.56);
    });
  }

  const MELODY = [
    ['A4', 16, 2, 0.66], ['B4', 18, 1, 0.62], ['D5', 19, 5, 0.72],
    ['B4', 24, 2, 0.64], ['A4', 26, 1, 0.6], ['F#4', 27, 5, 0.64],
    ['E4', 32, 2, 0.6], ['F#4', 34, 1, 0.6], ['A4', 35, 3, 0.68],
    ['E5', 38, 2, 0.74], ['C#5', 40, 2.5, 0.68], ['B4', 42.5, 1.5, 0.62],
    ['A4', 44, 4, 0.66],
    ['D5', 48, 2, 0.72], ['E5', 50, 1, 0.7], ['F#5', 51, 4, 0.78],
    ['E5', 55, 1, 0.68], ['D5', 56, 2, 0.7], ['B4', 58, 2, 0.64],
    ['A4', 60, 1.5, 0.62], ['B4', 61.5, 1, 0.6], ['D5', 62.5, 1.5, 0.68]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-analog-sunrise',
    name: 'Analog Sunrise (Anthem)',
    bpm,
    parts: [pads, bass, melody]
  });
};

/**
 * Velvet Horizon — slow chorale for "CS-80 Velvet". Bb major, six-chord
 * cycle with suspensions resolving late, a top voice like a held breath.
 */
const velvetHorizon = () => {
  const bpm = 48;
  const pads = new Part({ bpm, humanize: 0.02, seed: 151 });
  const top = new Part({ bpm, humanize: 0.025, seed: 152 });

  const CHORDS = [
    { notes: ['Bb2', 'F3', 'Bb3', 'D4'], top: 'F4' },   // Bb
    { notes: ['G2', 'D3', 'Bb3', 'F4'], top: 'A4' },    // Gm9 color
    { notes: ['Eb2', 'Bb2', 'G3', 'D4'], top: 'Bb4' },  // Ebmaj7
    { notes: ['F2', 'C3', 'F3', 'Bb3'], top: 'A4' },    // Fsus -> resolves in top
    { notes: ['D3', 'A3', 'C4', 'F4'], top: 'A4' },     // Dm7
    { notes: ['Eb2', 'Bb2', 'G3', 'D4'], top: 'C5' }    // Ebmaj9 lift
  ];
  CHORDS.forEach((entry, i) => {
    const at = i * 8;
    pads.chord(entry.notes, at, 8.4, 0.48);
    top.add(entry.top, at + 2.5, 6, 0.5);
  });
  // Final resolution: Bb with the third on top, held long.
  pads.chord(['Bb2', 'F3', 'Bb3', 'F4'], 48, 10, 0.5);
  top.add('D5', 50, 8, 0.52);

  writeMidi({
    id: 'original-velvet-horizon',
    name: 'Velvet Horizon (Chorale)',
    bpm,
    parts: [pads, top]
  });
};

/**
 * Strings of Io — string elegy for "Jupiter Strings". F# minor,
 * i–VI–III–VII with a singing viola-register melody.
 */
const stringsOfIo = () => {
  const bpm = 56;
  const strings = new Part({ bpm, humanize: 0.02, seed: 161 });
  const bass = new Part({ bpm, seed: 162 });
  const melody = new Part({ bpm, humanize: 0.02, seed: 163 });

  const PROG = [
    { chord: ['F#3', 'A3', 'C#4', 'E4'], bass: 'F#2' },  // F#m7
    { chord: ['D3', 'A3', 'D4', 'F#4'], bass: 'D2' },    // D
    { chord: ['A3', 'C#4', 'E4', 'G#4'], bass: 'A2' },   // Amaj7
    { chord: ['E3', 'G#3', 'B3', 'E4'], bass: 'E2' }     // E
  ];
  for (let pass = 0; pass < 3; pass++) {
    PROG.forEach((bar, i) => {
      const at = pass * 16 + i * 4;
      strings.chord(bar.chord, at, 4.2, 0.5);
      bass.add(bar.bass, at, 4, 0.58);
    });
  }

  const MELODY = [
    ['C#4', 2, 2, 0.56], ['E4', 4, 3, 0.62], ['F#4', 7, 1, 0.58],
    ['A4', 8, 4, 0.66], ['G#4', 12, 2, 0.6], ['E4', 14, 2, 0.58],
    ['F#4', 16, 3, 0.62], ['C#4', 19, 1, 0.54], ['D4', 20, 4, 0.6],
    ['C#5', 24, 3, 0.7], ['B4', 27, 1, 0.62], ['A4', 28, 4, 0.64],
    ['G#4', 32, 2, 0.6], ['A4', 34, 1, 0.6], ['B4', 35, 3, 0.66],
    ['A4', 38, 2, 0.62], ['F#4', 40, 4, 0.6],
    ['E4', 44, 2, 0.56], ['F#4', 46, 6, 0.6]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-strings-of-io',
    name: 'Strings of Io (Elegy)',
    bpm,
    parts: [strings, bass, melody]
  });
};

/**
 * West Coast Wall — 80s brass-pad cue for "Oberheim Wall".
 * C minor block chords with a confident stepwise melody.
 */
const westCoastWall = () => {
  const bpm = 84;
  const pads = new Part({ bpm, humanize: 0.012, seed: 171 });
  const bass = new Part({ bpm, seed: 172 });
  const melody = new Part({ bpm, humanize: 0.015, seed: 173 });

  const PROG = [
    { chord: ['C3', 'Eb3', 'G3', 'Bb3'], bass: 'C2' },   // Cm7
    { chord: ['Ab2', 'Eb3', 'Ab3', 'C4'], bass: 'Ab1' }, // Ab
    { chord: ['Eb3', 'G3', 'Bb3', 'D4'], bass: 'Eb2' },  // Ebmaj7
    { chord: ['Bb2', 'F3', 'Bb3', 'D4'], bass: 'Bb1' }   // Bb
  ];
  for (let round = 0; round < 4; round++) {
    PROG.forEach((bar, i) => {
      const at = round * 16 + i * 4;
      pads.chord(bar.chord, at, 3.6, 0.56);
      pads.chord(bar.chord, at + 3.5, 0.5, 0.48); // pickup push
      bass.add(bar.bass, at, 3.5, 0.64);
      bass.add(bar.bass, at + 3.5, 0.5, 0.56);
    });
  }

  const MELODY = [
    ['G4', 16, 3, 0.66], ['Bb4', 19, 1, 0.62], ['C5', 20, 4, 0.7],
    ['Bb4', 24, 2, 0.64], ['G4', 26, 2, 0.6], ['F4', 28, 4, 0.62],
    ['Eb4', 32, 2, 0.58], ['F4', 34, 1, 0.58], ['G4', 35, 3, 0.64],
    ['D5', 38, 2, 0.7], ['C5', 40, 2, 0.66], ['Bb4', 42, 2, 0.62],
    ['C5', 44, 4, 0.68],
    ['Eb5', 48, 3, 0.72], ['D5', 51, 1, 0.66], ['C5', 52, 2, 0.68],
    ['Bb4', 54, 2, 0.62], ['G4', 56, 3, 0.62], ['Bb4', 59, 1, 0.6],
    ['C5', 60, 4, 0.68]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-west-coast-wall',
    name: 'West Coast Wall (80s)',
    bpm,
    parts: [pads, bass, melody]
  });
};

/**
 * Ghost Frequency — Phrygian spectral piece for "PPG Ghost Choir".
 * E drone, chords borrowing the b2, a top line that never settles.
 */
const ghostFrequency = () => {
  const bpm = 44;
  const drone = new Part({ bpm, seed: 181 });
  const pads = new Part({ bpm, humanize: 0.02, seed: 182 });
  const voice = new Part({ bpm, humanize: 0.03, seed: 183 });

  for (let bar = 0; bar < 12; bar += 4) {
    drone.add('E2', bar * 4, 16, 0.5);
    drone.add('B2', bar * 4, 16, 0.42);
  }

  const CHORDS = [
    ['E3', 'G3', 'B3', 'D4'],    // Em7
    ['F3', 'A3', 'C4', 'E4'],    // Fmaj7 (b2)
    ['G3', 'B3', 'D4', 'F#4'],   // G
    ['D3', 'F3', 'A3', 'D4']     // Dm over the drone
  ];
  CHORDS.forEach((chord, i) => {
    pads.chord(chord, i * 12, 12.5, 0.44);
  });

  const VOICE = [
    ['B3', 3, 5, 0.48], ['C4', 9, 4, 0.5], ['B3', 13.5, 4, 0.46],
    ['E4', 19, 5, 0.52], ['F4', 25, 4, 0.54], ['E4', 29.5, 4, 0.5],
    ['G4', 36, 5, 0.54], ['F#4', 41.5, 4, 0.5]
  ];
  VOICE.forEach(([note, at, beats, vel]) => voice.add(note, at, beats, vel));

  writeMidi({
    id: 'original-ghost-frequency',
    name: 'Ghost Frequency (Spectral)',
    bpm,
    parts: [drone, pads, voice]
  });
};

/**
 * Airborne Cathedral — Lydian float for "Fairlight Air".
 * C Lydian pads with a weightless top voice; nothing lands hard.
 */
const airborneCathedral = () => {
  const bpm = 50;
  const pads = new Part({ bpm, humanize: 0.02, seed: 191 });
  const air = new Part({ bpm, humanize: 0.03, seed: 192 });

  const CHORDS = [
    ['C3', 'G3', 'E4', 'B4'],    // Cmaj7
    ['D3', 'A3', 'F#4', 'C5'],   // D/C-flavor (Lydian #4)
    ['B2', 'F#3', 'D4', 'A4'],   // Bm7
    ['C3', 'G3', 'D4', 'B4']     // Cmaj9
  ];
  for (let pass = 0; pass < 2; pass++) {
    CHORDS.forEach((chord, i) => {
      pads.chord(chord, pass * 32 + i * 8, 8.4, 0.46);
    });
  }

  const AIR = [
    ['E5', 3, 4, 0.5], ['F#5', 8.5, 4.5, 0.52], ['E5', 14, 3, 0.48],
    ['D5', 18.5, 4, 0.5], ['A4', 24, 3.5, 0.46], ['B4', 28, 6, 0.5],
    ['G5', 35, 4, 0.54], ['F#5', 40, 3.5, 0.5], ['E5', 44.5, 3, 0.48],
    ['B4', 49, 4, 0.46], ['D5', 54, 3, 0.48], ['E5', 57.5, 6, 0.52]
  ];
  AIR.forEach(([note, at, beats, vel]) => air.add(note, at, beats, vel));

  writeMidi({
    id: 'original-airborne-cathedral',
    name: 'Airborne Cathedral (Air)',
    bpm,
    parts: [pads, air]
  });
};

/**
 * Night Drive Basement — synthwave groove for "Juno Punch".
 * Pumping A-minor eighth-note bass, sparse neon lead.
 */
const nightDriveBasement = () => {
  const bpm = 108;
  const bass = new Part({ bpm, seed: 201 });
  const lead = new Part({ bpm, humanize: 0.012, seed: 202 });

  // Am F C G, two bars each — bass alternates root and octave eighths.
  const ROOTS = [['A1', 'A2'], ['F1', 'F2'], ['C2', 'C3'], ['G1', 'G2']];
  for (let round = 0; round < 3; round++) {
    ROOTS.forEach(([low, high], chordIndex) => {
      const start = (round * 8 + chordIndex * 2) * 4;
      for (let i = 0; i < 16; i++) {
        const note = i % 2 === 0 ? low : high;
        bass.add(note, start + i * 0.5, 0.42, i % 4 === 0 ? 0.72 : 0.58);
      }
    });
  }

  const LEAD = [
    ['E4', 32, 1.5, 0.62], ['C4', 33.5, 0.5, 0.55], ['D4', 34, 2, 0.6],
    ['A4', 37, 3, 0.68],
    ['G4', 41, 1, 0.6], ['E4', 42, 2, 0.62], ['C4', 44.5, 3, 0.58],
    ['D4', 48, 1.5, 0.6], ['E4', 49.5, 0.5, 0.58], ['G4', 50, 2, 0.64],
    ['B4', 53, 3, 0.68],
    ['A4', 57, 1, 0.64], ['G4', 58, 1.5, 0.6], ['E4', 59.5, 4, 0.62],
    ['C5', 65, 2.5, 0.7], ['B4', 67.5, 0.5, 0.62], ['A4', 68, 2, 0.66],
    ['E5', 71, 3, 0.72],
    ['D5', 75, 1, 0.64], ['C5', 76, 1.5, 0.62], ['B4', 77.5, 1, 0.6],
    ['A4', 78.5, 1.5, 0.6], ['G4', 80, 2, 0.6], ['A4', 82, 6, 0.66]
  ];
  LEAD.forEach(([note, at, beats, vel]) => lead.add(note, at, beats, vel));

  writeMidi({
    id: 'original-night-drive-basement',
    name: 'Night Drive Basement (Synthwave)',
    bpm,
    parts: [bass, lead]
  });
};

/**
 * Trap Door — trap cue for "Trap Door 808". Half-time C# minor: sliding
 * 808 line (legato overlaps trigger the preset's glide) under a sparse
 * dark bell melody with the b5 hanging in the air.
 */
const trapDoor = () => {
  const bpm = 140;
  const eight08 = new Part({ bpm, seed: 211 });
  const bells = new Part({ bpm, humanize: 0.012, seed: 212 });

  // 8-bar 808 pattern x3 — long notes that overlap into the next for glide.
  const PATTERN = [
    ['C#1', 0, 3.2, 0.85], ['C#1', 3.5, 0.5, 0.6],
    ['E1', 4, 2.2, 0.8], ['G#1', 6, 2.2, 0.75],
    ['C#1', 8, 3.2, 0.85], ['B0', 11.5, 0.5, 0.6],
    ['A0', 12, 4.2, 0.8],
    ['G#1', 16, 2.2, 0.78], ['G1', 18, 2.2, 0.74],  // b5 slide
    ['F#1', 20, 4.2, 0.8],
    ['C#1', 24, 3.2, 0.85], ['E1', 27.5, 0.6, 0.62],
    ['F#1', 28, 2.2, 0.76], ['G#1', 30, 2.2, 0.78]
  ];
  for (let round = 0; round < 3; round++) {
    PATTERN.forEach(([note, at, beats, vel]) => {
      eight08.add(note, round * 32 + at, beats, vel);
    });
  }

  const BELLS = [
    ['G#4', 2, 1, 0.6], ['E4', 3.5, 1.5, 0.55], ['C#4', 6, 2, 0.58],
    ['G4', 10, 1.5, 0.62],                       // b5 color
    ['G#4', 13, 1, 0.58], ['B4', 14.5, 1.5, 0.6],
    ['C#5', 18, 2, 0.66], ['B4', 21, 1, 0.58], ['G#4', 22.5, 1.5, 0.56],
    ['E4', 26, 2, 0.56], ['F#4', 29.5, 2, 0.58],
    ['G#4', 34, 1, 0.6], ['E4', 35.5, 1.5, 0.55], ['C#4', 38, 2, 0.58],
    ['G4', 42, 1.5, 0.62],
    ['C#5', 45, 1, 0.64], ['D#5', 46.5, 1.5, 0.66],
    ['E5', 50, 2, 0.7], ['D#5', 53, 1, 0.6], ['C#5', 54.5, 1.5, 0.62],
    ['B4', 58, 2, 0.58], ['G#4', 61.5, 2, 0.56],
    ['G#4', 66, 1, 0.6], ['B4', 67.5, 1.5, 0.6], ['C#5', 70, 4, 0.66],
    ['G4', 76, 2, 0.6], ['F#4', 80, 2, 0.56], ['E4', 84, 3, 0.56],
    ['C#4', 90, 4, 0.54]
  ];
  BELLS.forEach(([note, at, beats, vel]) => bells.add(note, at, beats, vel));

  writeMidi({
    id: 'original-trap-door',
    name: 'Trap Door (Trap)',
    bpm,
    parts: [eight08, bells]
  });
};

/**
 * Concrete Teeth — rage bass workout for "Rage Growl". G minor 16th
 * bursts with rests for the growl to bark, answered by high jabs.
 */
const concreteTeeth = () => {
  const bpm = 155;
  const bass = new Part({ bpm, humanize: 0.006, seed: 221 });
  const jabs = new Part({ bpm, humanize: 0.01, seed: 222 });

  // Bar cell (16ths): burst-rest-burst phrasing.
  const CELL_A = [
    [0, 'G2', 0.8], [1, 'G2', 0.62], [2, 'G2', 0.7],
    [6, 'Bb2', 0.74], [7, 'A2', 0.6],
    [8, 'G2', 0.78], [10, 'F2', 0.68], [12, 'Db3', 0.76], [14, 'C3', 0.64]
  ];
  const CELL_B = [
    [0, 'G2', 0.8], [1, 'G2', 0.62], [2, 'G2', 0.7],
    [6, 'Db3', 0.78], [8, 'C3', 0.72], [10, 'Bb2', 0.66],
    [12, 'G2', 0.74], [15, 'F2', 0.58]
  ];
  for (let bar = 0; bar < 16; bar++) {
    const start = bar * 4;
    const cell = bar % 2 === 0 ? CELL_A : CELL_B;
    cell.forEach(([step, note, vel]) => bass.add(note, start + step * 0.25, 0.21, vel));
  }

  const JABS = [
    ['G4', 14, 1, 0.68], ['Bb4', 15.25, 0.75, 0.66],
    ['G4', 30, 0.75, 0.68], ['Db5', 31, 1, 0.72],
    ['C5', 46, 0.75, 0.7], ['Bb4', 47, 1, 0.66],
    ['G4', 61, 1.5, 0.7], ['F4', 62.75, 1.25, 0.64]
  ];
  JABS.forEach(([note, at, beats, vel]) => jabs.add(note, at, beats, vel));

  writeMidi({
    id: 'original-concrete-teeth',
    name: 'Concrete Teeth (Rage Bass)',
    bpm,
    parts: [bass, jabs]
  });
};

/**
 * Acid Perimeter — 303-style line for "2600 Acid Wire". A minor 16ths,
 * accent pattern rotates every four bars, b5 passing tones.
 */
const acidPerimeter = () => {
  const bpm = 128;
  const acid = new Part({ bpm, seed: 231 });
  const kickBass = new Part({ bpm, seed: 232 });

  // 16-step cells: [step, note, velocity] — velocity is the accent pattern.
  const CELL_A = [
    [0, 'A1', 0.82], [2, 'A2', 0.5], [3, 'A1', 0.6], [5, 'C2', 0.52],
    [6, 'A1', 0.72], [8, 'E2', 0.58], [10, 'A1', 0.66], [11, 'G2', 0.52],
    [12, 'A2', 0.76], [14, 'Eb2', 0.6], [15, 'D2', 0.5]
  ];
  const CELL_B = [
    [0, 'A1', 0.82], [2, 'C2', 0.54], [4, 'D2', 0.68], [6, 'Eb2', 0.6],
    [7, 'E2', 0.74], [9, 'A1', 0.52], [10, 'E2', 0.64], [12, 'G2', 0.72],
    [13, 'A2', 0.56], [14, 'G2', 0.6], [15, 'E2', 0.52]
  ];
  for (let bar = 0; bar < 16; bar++) {
    const start = bar * 4;
    const cell = (bar >> 2) % 2 === 0 ? CELL_A : CELL_B;
    cell.forEach(([step, note, vel]) => acid.add(note, start + step * 0.25, 0.2, vel));
    // Four-on-the-floor low anchor.
    for (let beat = 0; beat < 4; beat++) {
      kickBass.add('A0', start + beat, 0.3, beat === 0 ? 0.7 : 0.55);
    }
  }

  writeMidi({
    id: 'original-acid-perimeter',
    name: 'Acid Perimeter (Acid)',
    bpm,
    parts: [acid, kickBass]
  });
};

/**
 * Low Tide Fog — deep drone study for "Taurus Fog". Slow C pedal with
 * fifths breathing above, one patient melody far overhead.
 */
const lowTideFog = () => {
  const bpm = 40;
  const drone = new Part({ bpm, seed: 241 });
  const melody = new Part({ bpm, humanize: 0.03, seed: 242 });

  for (let bar = 0; bar < 12; bar += 4) {
    drone.add('C1', bar * 4, 16.4, 0.6);
    drone.add('G1', bar * 4 + 1, 15.4, 0.5);
    if (bar >= 4) drone.add('C2', bar * 4 + 2, 14.4, 0.42);
  }

  const MELODY = [
    ['G3', 6, 5, 0.46], ['Bb3', 12, 5, 0.48], ['A3', 18, 5, 0.46],
    ['F3', 24, 6, 0.44], ['G3', 31, 6, 0.46], ['C4', 38, 8, 0.5]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-low-tide-fog',
    name: 'Low Tide Fog (Deep Drone)',
    bpm,
    parts: [drone, melody]
  });
};

/**
 * Glass Elevator — descending maj9 comping study for "Prophet Glass".
 * Syncopated hits with a light conversational melody.
 */
const glassElevator = () => {
  const bpm = 92;
  const comp = new Part({ bpm, humanize: 0.015, seed: 251 });
  const bass = new Part({ bpm, seed: 252 });
  const melody = new Part({ bpm, humanize: 0.02, seed: 253 });

  const PROG = [
    { chord: ['F3', 'A3', 'C4', 'G4'], bass: 'F2' },   // Fmaj9
    { chord: ['E3', 'G3', 'B3', 'F#4'], bass: 'E2' },  // Em9
    { chord: ['D3', 'F3', 'A3', 'E4'], bass: 'D2' },   // Dm9
    { chord: ['C3', 'E3', 'G3', 'D4'], bass: 'C2' }    // Cmaj9
  ];
  // Comp rhythm per bar: hit on 1, and-of-2, 4.
  const HITS = [[0, 3.5, 0.58], [1.5, 1, 0.5], [3, 1, 0.52]];
  for (let round = 0; round < 4; round++) {
    PROG.forEach((bar, i) => {
      const start = round * 16 + i * 4;
      HITS.forEach(([beat, beats, vel]) => comp.chord(bar.chord, start + beat, beats, vel));
      bass.add(bar.bass, start, 2.5, 0.6);
      bass.add(bar.bass, start + 3, 1, 0.52);
    });
  }

  const MELODY = [
    ['A4', 16.5, 1, 0.6], ['G4', 17.5, 0.5, 0.55], ['E4', 18, 2, 0.58],
    ['F#4', 21, 2.5, 0.6],
    ['E4', 24.5, 1, 0.58], ['D4', 25.5, 0.5, 0.52], ['C4', 26, 2, 0.55],
    ['D4', 29, 2.5, 0.58],
    ['G4', 33, 1.5, 0.6], ['A4', 34.5, 1.5, 0.62], ['C5', 36.5, 2.5, 0.66],
    ['B4', 40, 1, 0.6], ['G4', 41.5, 1.5, 0.56], ['D4', 43.5, 3.5, 0.55],
    ['C5', 48.5, 1, 0.64], ['B4', 49.5, 0.5, 0.58], ['G4', 50, 2, 0.6],
    ['A4', 53, 2.5, 0.62],
    ['B4', 56.5, 1, 0.6], ['A4', 57.5, 0.5, 0.56], ['G4', 58, 1.5, 0.58],
    ['E4', 59.5, 1, 0.54], ['D4', 60.5, 3, 0.55]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-glass-elevator',
    name: 'Glass Elevator (Comping)',
    bpm,
    parts: [comp, bass, melody]
  });
};

/**
 * Bells for Rachael — bell ballad for "Fairlight Bell Choir".
 * D major melody in parallel sixths over sparse low roots.
 */
const bellsForRachael = () => {
  const bpm = 60;
  const bells = new Part({ bpm, humanize: 0.02, seed: 261 });
  const roots = new Part({ bpm, seed: 262 });

  const ROOTS = [
    ['D2', 0, 8], ['B1', 8, 8], ['G1', 16, 8], ['A1', 24, 8],
    ['D2', 32, 8], ['F#1', 40, 8], ['G1', 48, 8], ['A1', 56, 6], ['D2', 62, 8]
  ];
  ROOTS.forEach(([note, at, beats]) => roots.add(note, at, beats, 0.5));

  // Melody with a lower companion voice a sixth below, offset slightly.
  const PAIRS = [
    ['F#4', 'A3', 0, 3], ['A4', 'C#4', 3, 2], ['B4', 'D4', 5, 3],
    ['D5', 'F#4', 8, 4], ['C#5', 'E4', 12, 3],
    ['B4', 'D4', 16, 3], ['A4', 'C#4', 19, 2], ['G4', 'B3', 21, 3],
    ['A4', 'C#4', 24, 4], ['E4', 'G3', 28, 4],
    ['F#4', 'A3', 32, 3], ['A4', 'C#4', 35, 2], ['D5', 'F#4', 37, 3],
    ['C#5', 'E4', 40, 4], ['B4', 'D4', 44, 4],
    ['G4', 'B3', 48, 3], ['B4', 'D4', 51, 2], ['A4', 'C#4', 53, 3],
    ['E4', 'G3', 56, 3], ['F#4', 'A3', 59, 3],
    ['D4', 'F#3', 62, 6]
  ];
  PAIRS.forEach(([high, low, at, beats]) => {
    bells.add(high, at, beats, 0.62);
    bells.add(low, at + 0.03, beats, 0.5);
  });

  writeMidi({
    id: 'original-bells-for-rachael',
    name: 'Bells for Rachael (Bell Ballad)',
    bpm,
    parts: [bells, roots]
  });
};

/**
 * Pixel Heartbreak — hyperpop pluck cue for "Hyperpop Pluck".
 * Fast 16th arps in E, hook popping octaves, sudden rest bar for drama.
 */
const pixelHeartbreak = () => {
  const bpm = 165;
  const arps = new Part({ bpm, seed: 271 });
  const hook = new Part({ bpm, humanize: 0.01, seed: 272 });
  const bass = new Part({ bpm, seed: 273 });

  // E – B – C#m – A, one bar each, 16th arps.
  const CELLS = [
    { root: 'E2', arp: ['E3', 'G#3', 'B3', 'E4', 'G#4', 'E4', 'B3', 'G#3'] },
    { root: 'B1', arp: ['B2', 'D#3', 'F#3', 'B3', 'D#4', 'B3', 'F#3', 'D#3'] },
    { root: 'C#2', arp: ['C#3', 'E3', 'G#3', 'C#4', 'E4', 'C#4', 'G#3', 'E3'] },
    { root: 'A1', arp: ['A2', 'C#3', 'E3', 'A3', 'C#4', 'A3', 'E3', 'C#3'] }
  ];
  for (let round = 0; round < 4; round++) {
    CELLS.forEach((cell, barIndex) => {
      const start = (round * 4 + barIndex) * 4;
      // Rest bar for drama at the top of round 4.
      if (round === 3 && barIndex === 0) return;
      for (let i = 0; i < 16; i++) {
        arps.add(cell.arp[i % 8], start + i * 0.25, 0.22, i % 4 === 0 ? 0.66 : 0.5);
      }
      bass.add(cell.root, start, 3.6, 0.66);
    });
  }

  const HOOK = [
    ['G#4', 16, 1, 0.7], ['B4', 17, 1, 0.72], ['E5', 18, 2, 0.78],
    ['D#5', 20.5, 1.5, 0.7], ['B4', 22, 2, 0.68],
    ['C#5', 24, 1, 0.7], ['C#4', 25, 0.5, 0.56], ['C#5', 25.5, 0.5, 0.68],
    ['B4', 26, 1.5, 0.66], ['A4', 27.5, 0.5, 0.6], ['B4', 28, 4, 0.7],
    ['G#4', 32, 1, 0.7], ['B4', 33, 1, 0.72], ['E5', 34, 1.5, 0.78],
    ['E4', 35.5, 0.5, 0.58], ['F#5', 36, 2, 0.8], ['E5', 38, 2, 0.74],
    ['G#5', 40, 1, 0.8], ['F#5', 41, 0.5, 0.72], ['E5', 41.5, 0.5, 0.7],
    ['D#5', 42, 1, 0.68], ['B4', 43, 1, 0.64], ['C#5', 44, 4, 0.72],
    // After the rest bar: hook returns up the octave, breathless.
    ['E5', 52, 1, 0.78], ['B4', 53, 0.5, 0.64], ['E5', 53.5, 0.5, 0.74],
    ['G#5', 54, 2, 0.82], ['F#5', 56.5, 1.5, 0.74], ['E5', 58, 2, 0.72],
    ['B5', 60, 3, 0.86], ['G#5', 63, 1, 0.74]
  ];
  HOOK.forEach(([note, at, beats, vel]) => hook.add(note, at, beats, vel));

  writeMidi({
    id: 'original-pixel-heartbreak',
    name: 'Pixel Heartbreak (Hyperpop)',
    bpm,
    parts: [arps, hook, bass]
  });
};

/**
 * 2AM Lullaby — soft EP ballad for "Lullaby EP". F major broken chords,
 * a melody that keeps almost falling asleep.
 */
const twoAmLullaby = () => {
  const bpm = 66;
  const arps = new Part({ bpm, humanize: 0.02, seed: 281 });
  const melody = new Part({ bpm, humanize: 0.025, seed: 282 });

  const BARS = [
    ['F2', 'C3', 'A3', 'E4', 'A3', 'C3'],   // Fmaj7
    ['D2', 'A2', 'F3', 'C4', 'F3', 'A2'],   // Dm7
    ['Bb1', 'F2', 'D3', 'A3', 'D3', 'F2'],  // Bbmaj7
    ['C2', 'G2', 'E3', 'Bb3', 'E3', 'G2']   // C7
  ];
  for (let round = 0; round < 4; round++) {
    BARS.forEach((bar, barIndex) => {
      const start = (round * 4 + barIndex) * 4;
      bar.forEach((note, i) => {
        arps.add(note, start + i * 0.66, 1.2, 0.46 + (i === 0 ? 0.08 : 0));
      });
    });
  }

  const MELODY = [
    ['A4', 16, 2.5, 0.56], ['G4', 18.5, 1.5, 0.52], ['F4', 20, 3, 0.54],
    ['E4', 24, 2, 0.52], ['F4', 26, 1, 0.5], ['A4', 27, 4, 0.56],
    ['C5', 32, 2.5, 0.6], ['A4', 34.5, 1.5, 0.54], ['G4', 36, 3, 0.56],
    ['F4', 40, 2, 0.52], ['E4', 42, 2, 0.5], ['D4', 44, 3.5, 0.5],
    ['E4', 48, 1.5, 0.52], ['F4', 49.5, 1.5, 0.54], ['G4', 51, 2, 0.56],
    ['A4', 53, 3, 0.58], ['G4', 57, 2, 0.52], ['F4', 59, 4.5, 0.54]
  ];
  MELODY.forEach(([note, at, beats, vel]) => melody.add(note, at, beats, vel));

  writeMidi({
    id: 'original-2am-lullaby',
    name: '2AM Lullaby (EP Ballad)',
    bpm,
    parts: [arps, melody]
  });
};

/**
 * Chime Orbit — rotating arpeggio piece for "Jupiter Chime".
 * B minor cells that shift one note per pass, chime accents on top.
 */
const chimeOrbit = () => {
  const bpm = 76;
  const arps = new Part({ bpm, humanize: 0.015, seed: 291 });
  const chimes = new Part({ bpm, humanize: 0.02, seed: 292 });
  const roots = new Part({ bpm, seed: 293 });

  const CELLS = [
    { root: 'B1', arp: ['B2', 'F#3', 'B3', 'D4', 'F#4', 'D4'] },
    { root: 'G1', arp: ['G2', 'D3', 'G3', 'B3', 'D4', 'B3'] },
    { root: 'D2', arp: ['D3', 'A3', 'D4', 'F#4', 'A4', 'F#4'] },
    { root: 'A1', arp: ['A2', 'E3', 'A3', 'C#4', 'E4', 'C#4'] }
  ];
  for (let round = 0; round < 4; round++) {
    CELLS.forEach((cell, barIndex) => {
      const start = (round * 4 + barIndex) * 4;
      roots.add(cell.root, start, 4, 0.52);
      // Sextuplet-feel: six notes across the bar.
      cell.arp.forEach((note, i) => {
        arps.add(note, start + i * (4 / 6), 0.6, 0.5 + (i === 0 ? 0.1 : 0));
      });
    });
  }

  const CHIMES = [
    ['F#5', 6, 2, 0.6], ['D5', 13, 2, 0.56], ['A5', 22, 2, 0.62],
    ['E5', 29, 2, 0.56], ['B5', 38, 2.5, 0.64], ['F#5', 45, 2, 0.58],
    ['D5', 53, 2, 0.56], ['C#5', 60, 3, 0.58]
  ];
  CHIMES.forEach(([note, at, beats, vel]) => chimes.add(note, at, beats, vel));

  writeMidi({
    id: 'original-chime-orbit',
    name: 'Chime Orbit (Arpeggio)',
    bpm,
    parts: [arps, chimes, roots]
  });
};

/**
 * Alarm District — trap stab cue for "Trap Alarm". F minor: oscillating
 * minor-second alarm figure, syncopated stabs, sparse half-time subs.
 */
const alarmDistrict = () => {
  const bpm = 142;
  const alarm = new Part({ bpm, humanize: 0.008, seed: 301 });
  const stabs = new Part({ bpm, humanize: 0.01, seed: 302 });
  const sub = new Part({ bpm, seed: 303 });

  for (let bar = 0; bar < 16; bar++) {
    const start = bar * 4;
    // The alarm: C-Db oscillation on 8ths, only bars 0-1 of each 4-bar cell.
    if (bar % 4 < 2) {
      for (let i = 0; i < 8; i++) {
        alarm.add(i % 2 === 0 ? 'C5' : 'Db5', start + i * 0.5, 0.4, i % 4 === 0 ? 0.64 : 0.52);
      }
    }
    // Syncopated stab hits.
    stabs.add('F4', start + 2, 0.4, 0.66);
    stabs.add('Ab4', start + 2.75, 0.4, 0.6);
    if (bar % 2 === 1) stabs.add('Eb4', start + 3.5, 0.4, 0.58);
    // Half-time subs.
    sub.add(bar % 8 < 6 ? 'F1' : 'Eb1', start, 2.4, 0.78);
    if (bar % 4 === 3) sub.add('Ab1', start + 3, 0.9, 0.62);
  }

  writeMidi({
    id: 'original-alarm-district',
    name: 'Alarm District (Trap)',
    bpm,
    parts: [alarm, stabs, sub]
  });
};

/**
 * Shimmer Bloom — texture piece for "Hyperpop Shimmer". A major
 * sustained chords with pulsing top notes that bloom in and out.
 */
const shimmerBloom = () => {
  const bpm = 120;
  const pads = new Part({ bpm, humanize: 0.015, seed: 311 });
  const pulses = new Part({ bpm, humanize: 0.01, seed: 312 });

  const PROG = [
    { chord: ['A2', 'E3', 'A3', 'C#4'], pulse: 'E5' },
    { chord: ['F#2', 'C#3', 'F#3', 'A3'], pulse: 'C#5' },
    { chord: ['D3', 'A3', 'D4', 'F#4'], pulse: 'A5' },
    { chord: ['E3', 'B3', 'E4', 'G#4'], pulse: 'B5' }
  ];
  for (let round = 0; round < 3; round++) {
    PROG.forEach((bar, i) => {
      const start = (round * 4 + i) * 8; // 2 bars per chord
      pads.chord(bar.chord, start, 8.2, 0.5);
      // Pulses: dotted-eighth rhythm (3 16ths) across the two bars.
      for (let p = 0; p < 10; p++) {
        pulses.add(bar.pulse, start + p * 0.75, 0.4, 0.46 + (p % 3 === 0 ? 0.12 : 0));
      }
    });
  }

  writeMidi({
    id: 'original-shimmer-bloom',
    name: 'Shimmer Bloom (Texture)',
    bpm,
    parts: [pads, pulses]
  });
};

/**
 * Ribbon in the Rain — glide-gesture piece for "Ribbon Fall". D minor:
 * overlapping legato swoops (the preset's long portamento does the work).
 */
const ribbonInTheRain = () => {
  const bpm = 50;
  const pads = new Part({ bpm, humanize: 0.02, seed: 321 });
  const ribbon = new Part({ bpm, seed: 322 });

  const CHORDS = [
    ['D3', 'A3', 'D4', 'F4'],   // Dm
    ['Bb2', 'F3', 'Bb3', 'D4'], // Bb
    ['F3', 'C4', 'F4', 'A4'],   // F
    ['A2', 'E3', 'A3', 'C#4']   // A
  ];
  for (let pass = 0; pass < 2; pass++) {
    CHORDS.forEach((chord, i) => {
      pads.chord(chord, pass * 32 + i * 8, 8.4, 0.44);
    });
  }

  // Ribbon gestures: each note starts just before the previous ends, so the
  // 0.6 s glide carries the pitch between them like a finger on a ribbon.
  const GESTURES = [
    ['D4', 2, 4, 0.58], ['A4', 5.8, 3, 0.62], ['F4', 8.6, 4, 0.58],
    ['D4', 12.4, 3, 0.54],
    ['F4', 18, 3.5, 0.58], ['Bb4', 21.3, 3, 0.62], ['D5', 24.1, 5, 0.66],
    ['A4', 29, 3, 0.58],
    ['E4', 34, 3.5, 0.56], ['A4', 37.3, 3, 0.6], ['C#5', 40.1, 4, 0.64],
    ['D5', 44, 3, 0.64], ['A4', 46.8, 3, 0.58], ['F4', 49.6, 4, 0.56],
    ['E4', 53.4, 3, 0.54], ['D4', 56.2, 6, 0.56]
  ];
  GESTURES.forEach(([note, at, beats, vel]) => ribbon.add(note, at, beats, vel));

  writeMidi({
    id: 'original-ribbon-in-the-rain',
    name: 'Ribbon in the Rain (Gesture)',
    bpm,
    parts: [pads, ribbon]
  });
};

/**
 * Gulls Over Voltage Bay — ambient scene for "Voltage Gulls". E minor
 * drone, short high cries, one slow tune drifting underneath.
 */
const gullsOverVoltageBay = () => {
  const bpm = 42;
  const drone = new Part({ bpm, seed: 331 });
  const cries = new Part({ bpm, humanize: 0.04, seed: 332 });
  const tune = new Part({ bpm, humanize: 0.03, seed: 333 });

  for (let bar = 0; bar < 12; bar += 4) {
    drone.add('E2', bar * 4, 16.4, 0.5);
    drone.add('B2', bar * 4 + 0.5, 15.6, 0.44);
  }

  // Cries: short, high, in loose pairs.
  const CRIES = [
    ['E6', 5, 0.6, 0.5], ['D6', 5.9, 0.8, 0.44],
    ['G6', 14, 0.5, 0.48], ['E6', 14.8, 0.9, 0.42],
    ['B5', 22.5, 0.7, 0.46], ['A5', 23.5, 1, 0.4],
    ['E6', 31, 0.6, 0.48], ['G6', 32, 0.5, 0.46], ['D6', 32.8, 1, 0.42],
    ['A5', 41, 0.8, 0.44], ['B5', 42.2, 1.2, 0.42]
  ];
  CRIES.forEach(([note, at, beats, vel]) => cries.add(note, at, beats, vel));

  const TUNE = [
    ['G3', 8, 5, 0.46], ['A3', 14, 4, 0.46], ['B3', 19, 6, 0.48],
    ['D4', 27, 5, 0.5], ['C4', 33, 5, 0.46], ['B3', 39, 8, 0.46]
  ];
  TUNE.forEach(([note, at, beats, vel]) => tune.add(note, at, beats, vel));

  writeMidi({
    id: 'original-gulls-over-voltage-bay',
    name: 'Gulls Over Voltage Bay (Ambient)',
    bpm,
    parts: [drone, cries, tune]
  });
};

/**
 * Cathedral of Wires — drone mass for the preset of the same name.
 * A minor: enormous slow chords, each held for a small eternity.
 */
const cathedralOfWires = () => {
  const bpm = 38;
  const mass = new Part({ bpm, humanize: 0.03, seed: 341 });
  const cantus = new Part({ bpm, humanize: 0.03, seed: 342 });

  const CHORDS = [
    ['A1', 'E2', 'A2', 'C3', 'E3'],   // Am
    ['F1', 'C2', 'F2', 'A2', 'C3'],   // F
    ['C2', 'G2', 'C3', 'E3', 'G3'],   // C
    ['E2', 'B2', 'E3', 'G3', 'B3']    // Em
  ];
  CHORDS.forEach((chord, i) => {
    mass.chord(chord, i * 10, 10.6, 0.5);
  });
  // Second pass: same mass, one octave brighter on top.
  CHORDS.forEach((chord, i) => {
    mass.chord(chord, 40 + i * 10, 10.6, 0.48);
    mass.add(chord[chord.length - 1].replace(/\d/, (d) => Number(d) + 1), 40 + i * 10 + 3, 7, 0.4);
  });

  const CANTUS = [
    ['E4', 4, 6, 0.46], ['D4', 12, 6, 0.44], ['C4', 22, 6, 0.46],
    ['B3', 32, 7, 0.44], ['A3', 44, 6, 0.44], ['C4', 52, 6, 0.46],
    ['E4', 62, 7, 0.48], ['A4', 71, 8, 0.5]
  ];
  CANTUS.forEach(([note, at, beats, vel]) => cantus.add(note, at, beats, vel));

  writeMidi({
    id: 'original-cathedral-of-wires',
    name: 'Cathedral of Wires (Drone Mass)',
    bpm,
    parts: [mass, cantus]
  });
};

// ── Main ───────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });
neonRain();
seaOfDunes();
escapeVelocity();
greenMemories();
elegyForReplicants();
rainOnChrome();
offworldAnthem();
vaporLights();
// Cycle-3 corpus, matched to the 25 new factory presets.
screamAtTheSky();
chromeCanyonRun();
sugarCrashAngel();
redMist();
analogSunrise();
velvetHorizon();
stringsOfIo();
westCoastWall();
ghostFrequency();
airborneCathedral();
nightDriveBasement();
trapDoor();
concreteTeeth();
acidPerimeter();
lowTideFog();
glassElevator();
bellsForRachael();
pixelHeartbreak();
twoAmLullaby();
chimeOrbit();
alarmDistrict();
shimmerBloom();
ribbonInTheRain();
gullsOverVoltageBay();
cathedralOfWires();
console.log('done');
