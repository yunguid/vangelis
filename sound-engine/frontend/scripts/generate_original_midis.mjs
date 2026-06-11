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
console.log('done');
