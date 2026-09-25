import { describe, expect, it } from 'vitest';
import { Midi } from '@tonejs/midi';
import { midiFileName, patternToMidiBytes } from './midiExport.js';

const pattern = {
  name: 'Slab 1',
  bpm: 96,
  bars: 4,
  tracks: Array.from({ length: 11 }, (_, index) => ({ id: `track-${index + 1}`, name: `T${index + 1}` })),
  notes: [
    { id: 'note-1', midi: 60, start: 0, duration: 1, velocity: 0.5, trackId: 'track-1' },
    { id: 'note-2', midi: 64, start: 1.5, duration: 0.25, velocity: 1, trackId: 'track-1' },
    { id: 'note-3', midi: 67, start: 2, duration: 1, velocity: 0.8, trackId: 'track-1', muted: true },
    { id: 'note-4', midi: 36, start: 3, duration: 0.5, velocity: 0.7, trackId: 'track-10' }
  ]
};

describe('patternToMidiBytes', () => {
  it('writes a file that reads back with the same tempo, layers and notes', () => {
    const read = new Midi(patternToMidiBytes(pattern));
    const ppq = read.header.ppq;
    expect(read.name).toBe('Slab 1');
    expect(read.header.tempos[0].bpm).toBeCloseTo(96, 3);
    expect(read.tracks.map((track) => track.name)).toEqual(pattern.tracks.map((track) => track.name));

    const lead = read.tracks[0].notes;
    expect(lead.map((note) => note.midi)).toEqual([60, 64]); // the deactivated note stays out
    expect(lead[1].ticks).toBe(1.5 * ppq);
    expect(lead[1].durationTicks).toBe(0.25 * ppq);
    expect(lead[0].velocity).toBeCloseTo(0.5, 1);
  });

  it('keeps the tenth layer off the General MIDI drum channel', () => {
    const read = new Midi(patternToMidiBytes(pattern));
    expect(read.tracks.map((track) => track.channel)).not.toContain(9);
    expect(read.tracks[9].notes[0].midi).toBe(36);
  });
});

describe('midiFileName', () => {
  it('keeps the name readable and file-system safe', () => {
    expect(midiFileName('bass / take: 2')).toBe('bass - take- 2.mid');
    expect(midiFileName('   ')).toBe('untitled.mid');
  });
});
