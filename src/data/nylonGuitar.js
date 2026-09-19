import { withBase } from '../utils/baseUrl.js';
import { midiNoteToFrequency } from '../utils/math.js';

// Strings 1-6, high E to low E. The score carries the fingering: a note's
// MIDI channel is its string, so its fret is the distance from the open string.
export const GUITAR_OPEN_STRINGS = [64, 59, 55, 50, 45, 40];
// The guitar was recorded at three dynamics; hard strokes use the forte takes.
export const GUITAR_FORTE_VELOCITY = 0.78;
const REPEAT_SECONDS = 1.5;

// Envelope and room only: volume and pan stay with the player's own settings.
// The recordings are anechoic, so the room reverb is the space the guitar sits in.
export const GUITAR_PARAMS = {
  useADSR: true, attack: 0.005, sustain: 1,
  // A string is stopped by the next finger or the damping hand, never left to fade.
  release: 0.07, useFilter: false, distortion: 0, delayEnabled: false,
  reverbEnabled: true, reverbMode: 'room', reverbMix: 0.78,
  reverbSize: 0.52, reverbDecay: 0.46, reverbTone: 0.56,
  reverbPreDelay: 10, reverbWidth: 0.85
};

/**
 * The recording each note plays, e.g. "s3f2mf": string 3, fret 2, mezzo-forte
 * take. A position plucked again within moments gets the next softer take, so
 * the same recording never sounds twice in a row. Notes must be in time order.
 */
export function assignGuitarTakes(notes) {
  const lastPluck = new Map();
  return notes.map((note) => {
    const position = `s${note.channel + 1}f${note.midi - GUITAR_OPEN_STRINGS[note.channel]}`;
    const [preferred, alternate] = note.velocity >= GUITAR_FORTE_VELOCITY ? ['ff', 'mf'] : ['mf', 'pp'];
    const last = lastPluck.get(position);
    const repeated = last && note.time - last.time < REPEAT_SECONDS && last.take === preferred;
    const take = repeated ? alternate : preferred;
    lastPluck.set(position, { time: note.time, take });
    return position + take;
  });
}

export async function loadGuitarPerformance(context, score) {
  const keys = [...new Set(assignGuitarTakes(score.notes))];
  const buffers = new Map(await Promise.all(keys.map(async (key) => {
    const response = await fetch(withBase(`samples/nylon-guitar/${key}.mp3`));
    if (!response.ok) throw new Error(`Nylon guitar ${key}: HTTP ${response.status}`);
    return [key, await context.decodeAudioData(await response.arrayBuffer())];
  })));
  return arrangeGuitarPerformance(score, buffers);
}

export function arrangeGuitarPerformance(score, buffers) {
  const takes = assignGuitarTakes(score.notes);
  const nextOnString = new Map();
  const notes = score.notes.map((note, index) => ({ note, index })).reverse().map(({ note, index }) => {
    // One string, one note: whatever rings is cut by the next pluck on it.
    const nextPluck = nextOnString.get(note.channel) ?? Infinity;
    nextOnString.set(note.channel, note.time);
    // No two plucks land alike: a few cents of drift between them.
    const cents = ((index * 7919) % 7) - 3;
    return {
      ...note,
      duration: Math.min(note.duration, nextPluck - note.time),
      velocity: note.velocity ** 1.25,
      audioParamOverrides: GUITAR_PARAMS,
      sample: {
        buffer: buffers.get(takes[index]),
        baseFrequency: midiNoteToFrequency(note.midi) * 2 ** (cents / 1200)
      }
    };
  }).reverse();
  return { ...score, notes };
}
