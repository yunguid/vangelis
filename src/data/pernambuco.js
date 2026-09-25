/**
 * "Pernambuco" as Luiz Bonfá played it in Rio in 1959 (Smithsonian Folkways
 * SFW40483), transcribed from the recording by scripts/guitar-transcription:
 * every note is a string, fret and stroke measured from the record, played
 * from the Iowa guitar recordings of that exact string and fret, re-voiced to
 * sound like Bonfá's guitar on that tape (public/samples/nylon-guitar/pernambuco).
 *
 * The MIDI file carries the performance: one track per string (channel =
 * string - 1); velocity is the loudness of the stroke; before a note, CC 70
 * names its take (the stroke's hardness), CC 74 its brightness and CC 75 how
 * fast a muted stroke dies away; RPN 1 carries the record's pitch, 42 cents
 * above A440.
 */
import { midiNoteToFrequency } from '../utils/math.js';
import { GUITAR_OPEN_STRINGS, loadGuitarTakes } from './nylonGuitar.js';

export const PERNAMBUCO_FOLDER = 'pernambuco';

// CC 70 (sound variation): which recorded stroke plays, soft to hard.
export const strokeTake = (value) => (value < 43 ? 'pp' : value < 86 ? 'mf' : 'ff');
// CC 74 (brightness): a high shelf on the stroke, 64 = the take as recorded.
export const BRIGHTNESS_DB_PER_STEP = 0.25;
// CC 75 (decay time): 127 lets the string ring; below it, a muted stroke dies
// away with a time constant of 10 ms doubling every 16 steps.
export const muteSeconds = (value) => (value >= 127 ? null : 0.01 * 2 ** (value / 16));

// Envelope and room only: volume and pan stay with the player's own settings.
export const PERNAMBUCO_PARAMS = {
  useADSR: true, attack: 0.005, sustain: 1,
  release: 0.1, useFilter: false, distortion: 0, delayEnabled: false,
  reverbEnabled: true, reverbMode: 'room', reverbMix: 0.35,
  reverbSize: 0.4, reverbDecay: 0.35, reverbTone: 0.45,
  reverbPreDelay: 8, reverbWidth: 0.5
};

// The piece's level beside the other performances: its takes sit on the same
// level line as theirs, but Bonfá plays most notes far under his accents.
export const PERNAMBUCO_GAIN = 10 ** (2.6 / 20);

const controllerValue = (event) => Math.round(event.value * 127);

/** The latest value of each controller at or before `ticks`, per sorted event list. */
function controllerAt(events, ticks) {
  let value = null;
  for (const event of events) {
    if (event.ticks > ticks) break;
    value = controllerValue(event);
  }
  return value;
}

/** RPN 1 (channel fine tuning) in cents, as written: CC 101/100 select, CC 6/38 carry it. */
function fineTuningCents(track) {
  const events = [101, 100, 6, 38]
    .flatMap((number) => (track.controlChanges[number] || []).map((event) => ({ number, event })))
    .sort((a, b) => a.event.ticks - b.event.ticks);
  let msb = null;
  let lsb = null;
  let data = null;
  for (const { number, event } of events) {
    const value = controllerValue(event);
    if (number === 101) msb = value;
    else if (number === 100) lsb = value;
    else if (msb === 0 && lsb === 1) {
      data = data ?? { coarse: 64, fine: 0 };
      if (number === 6) data.coarse = value;
      else data.fine = value;
    }
  }
  return data ? ((data.coarse * 128 + data.fine) - 8192) / 8192 * 100 : 0;
}

/**
 * Notes of a string-per-channel performance file (a @tonejs/midi Midi) with
 * each stroke's take, brightness (dB) and mute (seconds or null).
 */
export function readGuitarPerformance(midi) {
  let tuningCents = 0;
  const notes = midi.tracks.flatMap((track) => {
    if (!track.notes.length) return [];
    tuningCents = fineTuningCents(track) || tuningCents;
    const take = track.controlChanges[70] || [];
    const brightness = track.controlChanges[74] || [];
    const decay = track.controlChanges[75] || [];
    return track.notes.map((note) => ({
      midi: note.midi,
      time: note.time,
      duration: note.duration,
      velocity: note.velocity,
      channel: track.channel,
      take: strokeTake(controllerAt(take, note.ticks) ?? 64),
      brightness: ((controllerAt(brightness, note.ticks) ?? 64) - 64) * BRIGHTNESS_DB_PER_STEP,
      mute: muteSeconds(controllerAt(decay, note.ticks) ?? 127)
    }));
  }).sort((a, b) => a.time - b.time);
  return { name: midi.name, duration: midi.duration, tuningCents, notes };
}

/** The recording a note plays, e.g. "pernambuco/s3f2mf". */
export const pernambucoTake = (note) => (
  `${PERNAMBUCO_FOLDER}/s${note.channel + 1}f${note.midi - GUITAR_OPEN_STRINGS[note.channel]}${note.take}`
);

/** Hand each note its recording, stroke and the record's pitch. */
export function arrangePernambuco(score, buffers) {
  const tuning = 2 ** (score.tuningCents / 1200);
  const nextOnString = new Map();
  const notes = [...score.notes].reverse().map((note) => {
    // One string, one note: whatever rings is cut by the next pluck on it.
    const nextPluck = nextOnString.get(note.channel) ?? Infinity;
    nextOnString.set(note.channel, note.time);
    return {
      ...note,
      duration: Math.min(note.duration, nextPluck - note.time),
      velocity: note.velocity ** 1.25,
      audioParamOverrides: PERNAMBUCO_PARAMS,
      sample: {
        buffer: buffers.get(pernambucoTake(note)),
        // The takes are in tune with A440; the record sits above it.
        baseFrequency: midiNoteToFrequency(note.midi) / tuning,
        brightness: note.brightness,
        mute: note.mute,
        gain: PERNAMBUCO_GAIN
      }
    };
  }).reverse();
  return { ...score, notes };
}

export async function loadPernambuco(context, path) {
  const [{ Midi }, response] = await Promise.all([import('@tonejs/midi'), fetch(path)]);
  if (!response.ok) throw new Error(`Pernambuco: HTTP ${response.status}`);
  const score = readGuitarPerformance(new Midi(await response.arrayBuffer()));
  const keys = [...new Set(score.notes.map(pernambucoTake))];
  return arrangePernambuco(score, await loadGuitarTakes(context, keys));
}
