import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import {
  arrangeGuitarTranscription, makeTapeHiss, readGuitarPerformance, transcriptionTake, GUITAR_TRANSCRIPTIONS
} from './guitarTranscriptions.js';
import { LANDING_PIECES } from './landingQueue.js';
import { GUITAR_OPEN_STRINGS } from './nylonGuitar.js';

// Each record's pitch above A440, as measured (scripts/guitar-transcription/tuning.py).
const RECORD_CENTS = { pernambuco: 41.7, 'shade-of-the-mango-tree': 7.5 };
const transcribed = LANDING_PIECES.filter((piece) => piece.instrument === 'nylon-guitar' && piece.transcription);
const readPiece = (piece) => readGuitarPerformance(new Midi(readFileSync(`public/midi/${piece.relativePath}`)));

it('reads each stroke the way the transcription wrote it', () => {
  const midi = new Midi();
  const track = midi.addTrack();
  track.channel = 2;
  [[101, 0], [100, 1], [6, 90], [38, 88], [101, 127], [100, 127]]
    .forEach(([number, value], ticks) => track.addCC({ number, value: value / 127, ticks }));
  track.addCC({ number: 70, value: 106 / 127, ticks: 480 });
  track.addCC({ number: 74, value: 48 / 127, ticks: 480 });
  track.addCC({ number: 75, value: 32 / 127, ticks: 480 });
  track.addNote({ midi: 57, ticks: 480, durationTicks: 240, velocity: 0.5 });
  track.addCC({ number: 75, value: 1, ticks: 960 });
  track.addNote({ midi: 59, ticks: 960, durationTicks: 240, velocity: 0.5 });
  const { tuningCents, notes } = readGuitarPerformance(new Midi(midi.toArray()));
  expect(tuningCents).toBeCloseTo(41.7, 1);
  expect(notes[0]).toMatchObject({ channel: 2, take: 'ff', brightness: -4 });
  expect(notes[0].mute).toBeCloseTo(0.04, 6); // 10 ms doubling every 16 steps
  expect(notes[1]).toMatchObject({ take: 'ff', brightness: -4, mute: null }); // 127 rings
});

it('knows the voice and the pitch of every transcribed piece', () => {
  expect(transcribed.map((piece) => piece.transcription).sort()).toEqual(Object.keys(GUITAR_TRANSCRIPTIONS).sort());
  expect(Object.keys(RECORD_CENTS).sort()).toEqual(Object.keys(GUITAR_TRANSCRIPTIONS).sort());
});

describe.each(transcribed)('$name', (piece) => {
  const voice = GUITAR_TRANSCRIPTIONS[piece.transcription];
  const score = readPiece(piece);

  it('has a recording for every string, fret and stroke it plays', () => {
    expect(score.notes.length).toBeGreaterThan(1000);
    for (const note of score.notes) {
      const fret = note.midi - GUITAR_OPEN_STRINGS[note.channel];
      expect(fret).toBeGreaterThanOrEqual(0);
      expect(fret).toBeLessThanOrEqual(19);
    }
    for (const key of new Set(score.notes.map((note) => transcriptionTake(voice, note)))) {
      expect(existsSync(`public/samples/nylon-guitar/${key}.mp3`), key).toBe(true);
    }
  });

  it('plays at the record\u2019s pitch, one note per string, with each stroke\u2019s shape', () => {
    expect(score.tuningCents).toBeCloseTo(RECORD_CENTS[piece.transcription], 0);
    const buffers = new Map(score.notes.map((note) => [transcriptionTake(voice, note), {}]));
    const { notes } = arrangeGuitarTranscription(score, buffers, voice);
    const ringsUntil = new Map();
    for (const note of notes) {
      expect(note.time).toBeGreaterThanOrEqual((ringsUntil.get(note.channel) ?? 0) - 1e-9);
      expect(note.duration).toBeGreaterThan(0);
      ringsUntil.set(note.channel, note.time + note.duration);
      expect(note.sample.buffer).toBeDefined();
      const nominal = 440 * 2 ** ((note.midi - 69) / 12);
      expect(nominal / note.sample.baseFrequency).toBeCloseTo(2 ** (RECORD_CENTS[piece.transcription] / 1200), 3);
      expect(note.audioParamOverrides).toBe(voice.params);
    }
    // The thumb mutes some strokes while others ring.
    expect(notes.filter((note) => note.sample.mute).length).toBeGreaterThan(100);
    expect(notes.filter((note) => !note.sample.mute).length).toBeGreaterThan(100);
  });
});

it('lays the record\u2019s tape hiss under the piece as looping white noise', () => {
  const context = {
    sampleRate: 48000,
    createBuffer: (channels, length, sampleRate) => {
      const data = new Float32Array(length);
      return { sampleRate, length, getChannelData: () => data };
    }
  };
  const hiss = makeTapeHiss(context);
  const samples = hiss.getChannelData(0);
  expect(samples.length).toBe(8 * 48000);
  const rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
  expect(rms).toBeCloseTo(1 / Math.sqrt(3), 2); // uniform white noise
  const pernambuco = GUITAR_TRANSCRIPTIONS.pernambuco;
  const score = readPiece(transcribed.find((piece) => piece.transcription === 'pernambuco'));
  const buffers = new Map(score.notes.map((note) => [transcriptionTake(pernambuco, note), {}]));
  const { ambience } = arrangeGuitarTranscription(score, buffers, pernambuco, hiss);
  expect(ambience).toEqual({ buffer: hiss, gain: pernambuco.hissGain, audioParamOverrides: pernambuco.params });
});
