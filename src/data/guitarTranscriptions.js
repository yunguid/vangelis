/**
 * Luiz Bonfá's guitar, transcribed from his records by scripts/guitar-transcription:
 * every note is a string, fret and stroke measured from the record, played from
 * the Iowa guitar recordings of that exact string and fret, re-voiced to sound
 * like his guitar on that record (public/samples/nylon-guitar/<folder>).
 *
 * - "Pernambuco" as he played it in Rio in 1959 (Smithsonian Folkways SFW40483),
 *   alone, on a mono tape recorder;
 * - "The Shade of the Mango Tree" (Bonfa Burrows Brazil, 1978): his guitar
 *   lifted out of the band (Don Burrows's flute, bass and drums are not played).
 *
 * The MIDI file carries the performance: one track per string (channel =
 * string - 1); velocity is the loudness of the stroke; before a note, CC 70
 * names its take (the stroke's hardness), CC 74 its brightness and CC 75 how
 * fast a muted stroke dies away; RPN 1 carries the record's pitch above A440.
 */
import { midiNoteToFrequency } from '../utils/math.js';
import { GUITAR_OPEN_STRINGS, loadGuitarTakes } from './nylonGuitar.js';

// CC 70 (sound variation): which recorded stroke plays, soft to hard.
export const strokeTake = (value) => (value < 43 ? 'pp' : value < 86 ? 'mf' : 'ff');
// CC 74 (brightness): a high shelf on the stroke, 64 = the take as recorded.
export const BRIGHTNESS_DB_PER_STEP = 0.25;
// CC 75 (decay time): 127 lets the string ring; below it, a muted stroke dies
// away with a time constant of 10 ms doubling every 16 steps.
export const muteSeconds = (value) => (value >= 127 ? null : 0.01 * 2 ** (value / 16));

/**
 * Each transcription's voice: the folder of its takes; its envelope and room
 * (`params`: volume and pan stay with the player's own settings); `gain`, its
 * level beside the other performances (the takes sit on one level line, but
 * the player keeps most notes far under his accents); `hissGain`, the record's
 * tape hiss laid under the piece, or null.
 */
export const GUITAR_TRANSCRIPTIONS = Object.freeze({
  pernambuco: {
    folder: 'pernambuco',
    // The release and the room were fitted against the record (the room renders closest
    // to it among 47 settings tried); the record is mono, so the room is too.
    params: {
      useADSR: true, attack: 0.005, sustain: 1,
      release: 0.1, useFilter: false, distortion: 0, delayEnabled: false,
      reverbEnabled: true, reverbMode: 'room', reverbMix: 0.9,
      reverbSize: 0.6, reverbDecay: 0.8, reverbTone: 0.45,
      reverbPreDelay: 8, reverbWidth: 0
    },
    gain: 10 ** (2.6 / 20),
    // White noise (flat from 3 to 14 kHz on the record), set so its top octaves sit as
    // far under the music as the record's do.
    hissGain: 0.0009
  },
  'shade-of-the-mango-tree': {
    folder: 'shade-of-the-mango-tree',
    // Chosen against the record's first 20 seconds, where the guitar plays alone: of about
    // 200 settings rendered, this one fills the pauses between phrases at the record's depth
    // (2 dB off on average), and at width 0 the channels correlate as the record's guitar
    // does (0.94-0.95 against 0.95-0.98 below 5 kHz).
    params: {
      useADSR: true, attack: 0.005, sustain: 1,
      release: 0.1, useFilter: false, distortion: 0, delayEnabled: false,
      reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.9,
      reverbSize: 0.4, reverbDecay: 0.8, reverbTone: 0.3,
      reverbPreDelay: 20, reverbWidth: 0
    },
    // As loud as Pernambuco (-30.1 dBFS active); the hiss sits 48.7 dB under the solo guitar,
    // as the record's does.
    gain: 10 ** (2.1 / 20),
    hissGain: 0.00038
  }
});

const HISS_SECONDS = 8;

/** Eight seconds of white noise, looped under a piece as its tape hiss. */
export function makeTapeHiss(context, random = Math.random) {
  const buffer = context.createBuffer(1, Math.round(HISS_SECONDS * context.sampleRate), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
  return buffer;
}

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
export const transcriptionTake = (voice, note) => (
  `${voice.folder}/s${note.channel + 1}f${note.midi - GUITAR_OPEN_STRINGS[note.channel]}${note.take}`
);

/**
 * Hand each note its recording, stroke and the record's pitch, in `voice` (an entry of
 * GUITAR_TRANSCRIPTIONS); `hiss` runs under them all.
 */
export function arrangeGuitarTranscription(score, buffers, voice, hiss = null) {
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
      audioParamOverrides: voice.params,
      sample: {
        buffer: buffers.get(transcriptionTake(voice, note)),
        // The takes are in tune with A440; the record sits above it.
        baseFrequency: midiNoteToFrequency(note.midi) / tuning,
        brightness: note.brightness,
        mute: note.mute,
        gain: voice.gain
      }
    };
  }).reverse();
  const ambience = hiss && { buffer: hiss, gain: voice.hissGain, audioParamOverrides: voice.params };
  return { ...score, notes, ...(ambience ? { ambience } : {}) };
}

/** A transcription (a key of GUITAR_TRANSCRIPTIONS) from its MIDI file, ready to play. */
export async function loadGuitarTranscription(context, id, path) {
  const voice = GUITAR_TRANSCRIPTIONS[id];
  const [{ Midi }, response] = await Promise.all([import('@tonejs/midi'), fetch(path)]);
  if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
  const score = readGuitarPerformance(new Midi(await response.arrayBuffer()));
  const keys = [...new Set(score.notes.map((note) => transcriptionTake(voice, note)))];
  const buffers = await loadGuitarTakes(context, keys);
  return arrangeGuitarTranscription(score, buffers, voice, voice.hissGain ? makeTapeHiss(context) : null);
}
