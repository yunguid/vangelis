import { expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { BRB_EXPRESSION_RATE, BRB_FX, BRB_PARTS, makeRecordNoise, readBladeRunnerBlues } from './bladeRunnerBlues.js';

const rpnBendRange = (track, semitones) => {
  [[101, 0], [100, 0], [6, semitones], [38, 0]]
    .forEach(([number, value], ticks) => track.addCC({ number, value: value / 127, ticks }));
};

// Through the file format and back, as the page reads it. @tonejs/midi writes a bend's value
// as the raw 14-bit offset but reads it back as -1..1 of the full bend.
const roundTrip = (midi) => readBladeRunnerBlues(new Midi(midi.toArray()));
const BEND = 8192;

it('plays each CS-80 note with its own pitch and loudness curves, as written', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  track.channel = 3;
  rpnBendRange(track, 12);
  // A scoop: a quarter of the full bend (300 cents) up to +12 cents over 0.2 s.
  track.addPitchBend({ time: 1, value: -0.25 * BEND });
  track.addPitchBend({ time: 1.2, value: Math.round((12 / 1200) * BEND) });
  // Loudness: CC 11 107 is 10 dB down, rising to full.
  track.addCC({ number: 11, value: 107 / 127, time: 1 });
  track.addCC({ number: 11, value: 1, time: 1.5 });
  track.addNote({ midi: 73, time: 1, duration: 2, velocity: 0.8 });

  const { notes, parts } = roundTrip(midi);
  expect(parts).toBe(BRB_PARTS);
  expect(notes).toHaveLength(1);
  const [note] = notes;
  expect(note).toMatchObject({ midi: 73, part: 'cs80', audioParamOverrides: BRB_FX });
  const { rate, pitch, gain } = note.expression;
  expect(rate).toBe(BRB_EXPRESSION_RATE);
  expect(pitch[0]).toBeCloseTo(-300, 0);
  expect(pitch[Math.round(0.1 * rate)]).toBeCloseTo(-144, 0); // halfway along the scoop
  expect(pitch[Math.round(0.5 * rate)]).toBeCloseTo(12, 0);
  expect(gain[0]).toBeCloseTo(10 ** (-10 / 20), 3);
  expect(gain[Math.round(0.5 * rate)]).toBeCloseTo(1, 3);
});

it('gives each channel range its part, and long notes coarser curves', () => {
  const midi = new Midi();
  const add = (channel, midiNote, time, duration) => {
    const track = midi.addTrack();
    track.channel = channel;
    rpnBendRange(track, 12);
    track.addPitchBend({ time, value: Math.round((11.6 / 1200) * BEND) });
    track.addNote({ midi: midiNote, time, duration, velocity: 0.5 });
  };
  add(0, 69, 0, 1);
  add(12, 54, 0, 10);
  add(14, 31, 12, 516);
  const byPart = Object.fromEntries(roundTrip(midi).notes.map((note) => [note.part, note]));
  expect(Object.keys(byPart).sort()).toEqual(['cs80', 'pad', 'rumble']);
  expect(byPart.pad.expression.pitch[0]).toBeCloseTo(11.6, 0);
  // A bed held for minutes still hands the synth a curve of bounded size.
  expect(byPart.rumble.expression.pitch.length).toBeLessThanOrEqual(12002);
  expect(byPart.rumble.expression.rate).toBeLessThan(BRB_EXPRESSION_RATE);
});

it('lays the record\'s floor noise under the piece as a loop without a seam', () => {
  const context = {
    sampleRate: 48000,
    createBuffer: (channels, length, sampleRate) => {
      const data = new Float32Array(length);
      return { sampleRate, length, getChannelData: () => data };
    }
  };
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const data = makeRecordNoise(context, random).getChannelData(0);
  const steps = data.slice(1).map((value, i) => Math.abs(value - data[i]));
  const typical = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)];
  // Looping from the last sample back to the first is no bigger a step than any other.
  expect(Math.abs(data[0] - data[data.length - 1])).toBeLessThan(typical * 8);
  expect(Math.max(...data.map(Math.abs))).toBeCloseTo(1, 6);
});
