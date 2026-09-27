/**
 * "Memories of Green" (Vangelis, 1980; the Blade Runner album, EastWest 1994), rebuilt from
 * a transcription of the record: the piano plays from Salamander Grand V3 recordings (a
 * Yamaha C5, CC-BY 3.0) voiced to sound like the record's piano
 * (public/samples/memories-of-green, built by scripts/piano-transcription/build_samples.py).
 * How it was made, and how close it is, is logged in docs/replicas/memories-of-green/JOURNEY.md.
 *
 * The MIDI file carries the performance on the record's own timeline: the piano on channel
 * 1, key-down to key-up as its notes; velocity is loudness (gain (velocity / 127) ** 2);
 * CC 70 before a note names the velocity layer it plays; CC 64 is the sustain pedal; RPN 1
 * is the record's pitch below A440 (the samples are built at that pitch).
 */
import { withBase } from '../utils/baseUrl.js';
import { midiNoteToFrequency } from '../utils/math.js';

// The piano's envelope and room. The recorded decay is the envelope; the release is the
// damper stopping the string. Of nine rooms rendered against the record, the hall brings the
// ring's brightness against the attack closest; at width 0.3 (with the recordings narrowed
// when built) the channels correlate per octave within 0.06 of the record's on average.
export const MOG_PIANO_PARAMS = {
  useADSR: true, attack: 0.002, sustain: 1, release: 0.3,
  useFilter: false, distortion: 0, delayEnabled: false,
  reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.9,
  reverbSize: 0.8, reverbDecay: 0.9, reverbTone: 1,
  reverbPreDelay: 20, reverbWidth: 0.3
};
// Plays at the record's own level (active -32.1 dBFS against its -32.3).
export const MOG_PIANO_GAIN = 10 ** (-4.6 / 20);

// Salamander is recorded every minor third, A0 to C8; a note plays the nearest recording.
const POSITIONS = Array.from({ length: 30 }, (_, k) => 21 + 3 * k);
const NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
export const nearestPosition = (midi) => POSITIONS.reduce((best, p) => (Math.abs(p - midi) < Math.abs(best - midi) ? p : best));
/** The recording a note plays, e.g. "Fs4v8". */
export const pianoSampleKey = (note) => {
  const position = nearestPosition(note.midi);
  return `${NAMES[position % 12]}${Math.floor(position / 12) - 1}v${note.layer}`;
};

const controllerValue = (event) => Math.round(event.value * 127);

/** RPN 1 (channel fine tuning) in cents, as written: CC 101/100 select, CC 6/38 carry it. */
function fineTuningCents(track) {
  const events = [101, 100, 6, 38]
    .flatMap((number) => (track.controlChanges[number] || []).map((event) => ({ number, event })))
    .sort((a, b) => a.event.ticks - b.event.ticks);
  let msb = null;
  let lsb = null;
  let coarse = null;
  let fine = 0;
  for (const { number, event } of events) {
    const value = controllerValue(event);
    if (number === 101) msb = value;
    else if (number === 100) lsb = value;
    else if (msb === 0 && lsb === 1) {
      if (number === 6) coarse = value;
      else fine = value;
    }
  }
  return coarse === null ? 0 : ((coarse * 128 + fine) - 8192) / 8192 * 100;
}

/** The latest value of a controller at or before `ticks` (events sorted), or `fallback`. */
function controllerAt(events, ticks, fallback) {
  let value = fallback;
  for (const event of events) {
    if (event.ticks > ticks) break;
    value = controllerValue(event);
  }
  return value;
}

/** Sustain-pedal spans ({ on, off } in seconds) from a track's CC 64. */
function pedalSpans(track) {
  const spans = [];
  let down = null;
  for (const event of track.controlChanges[64] || []) {
    if (event.value >= 0.5 && down === null) down = event.time;
    else if (event.value < 0.5 && down !== null) {
      spans.push({ on: down, off: event.time });
      down = null;
    }
  }
  return spans;
}

/**
 * How long each note sounds, the way a piano plays it (scripts/piano-transcription/
 * piano_score.py keeps the same rule): until its key comes up or, if the sustain pedal is
 * down then, until the pedal comes up; a key struck again cuts its earlier note.
 */
export function pedalledNotes(notes, pedal) {
  const pedalUpAfter = (time) => pedal.find((span) => span.on <= time && time < span.off)?.off ?? time;
  const sorted = [...notes].sort((a, b) => a.time - b.time || a.midi - b.midi);
  const sounding = sorted.map((note) => ({ ...note, duration: Math.max(note.time + note.duration, pedalUpAfter(note.time + note.duration)) - note.time }));
  const last = new Map();
  for (const note of sounding) {
    const previous = last.get(note.midi);
    if (previous && previous.time + previous.duration > note.time) previous.duration = note.time - previous.time;
    last.set(note.midi, note);
  }
  return sounding;
}

/** The piano in a Memories of Green MIDI file (a @tonejs/midi Midi): notes with their layer, the pedal, the pitch. */
export function readMemoriesOfGreen(midi) {
  const track = midi.tracks.find((candidate) => candidate.channel === 0 && candidate.notes.length);
  const layers = track.controlChanges[70] || [];
  const notes = track.notes.map((note) => ({
    midi: note.midi,
    time: note.time,
    duration: note.duration,
    velocity: note.velocity,
    layer: controllerAt(layers, note.ticks, 8)
  }));
  return { name: midi.name, duration: midi.duration, tuningCents: fineTuningCents(track), notes: pedalledNotes(notes, pedalSpans(track)) };
}

// The record's floor: its quietest moments above 7 kHz sit 53.2 dB under the music
// (scripts/guitar-transcription/hiss_level.py) and fall no faster than pink noise from 9 to
// 14 kHz, so pink noise, independent in each channel, loops under the piece.
export const MOG_HISS_GAIN = 0.00132;
const HISS_SECONDS = 8;

/** Eight seconds of stereo pink noise (Paul Kellet's economy filter), seamless when looped. */
export function makeStereoHiss(context, random = Math.random) {
  const rate = context.sampleRate;
  const length = Math.round(HISS_SECONDS * rate);
  const fade = Math.round(0.25 * rate);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const raw = new Float32Array(length + fade);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < raw.length; i++) {
      const white = random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      raw[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    }
    // The tail crossfades into the head, so the loop has no seam.
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = i < fade ? raw[i] * (i / fade) + raw[length + i] * (1 - i / fade) : raw[i];
  }
  return buffer;
}

/**
 * Hand each piano note its recording (`buffers`: sample key -> AudioBuffer) at the record's
 * pitch; `hiss` runs under them all.
 */
export function arrangeMemoriesOfGreen(score, buffers, hiss = null) {
  const notes = score.notes.map((note) => ({
    ...note,
    velocity: note.velocity ** 2,
    audioParamOverrides: MOG_PIANO_PARAMS,
    sample: {
      buffer: buffers.get(pianoSampleKey(note)),
      // The recordings were moved to the record's pitch (RPN 1) when they were built, so a
      // note is only ever the interval from its recording's key.
      baseFrequency: midiNoteToFrequency(nearestPosition(note.midi)),
      gain: MOG_PIANO_GAIN
    }
  }));
  const ambience = hiss && { buffer: hiss, gain: MOG_HISS_GAIN, audioParamOverrides: MOG_PIANO_PARAMS };
  return { ...score, notes, ...(ambience ? { ambience } : {}) };
}

/** The piano samples a score plays, decoded. */
export async function loadPianoSamples(context, keys) {
  const entries = await Promise.all(keys.map(async (key) => {
    const response = await fetch(withBase(`samples/memories-of-green/${key}.mp3`));
    if (!response.ok) throw new Error(`Memories of Green ${key}: HTTP ${response.status}`);
    return [key, await context.decodeAudioData(await response.arrayBuffer())];
  }));
  return new Map(entries);
}

export async function loadMemoriesOfGreen(context, path) {
  const [{ Midi }, response] = await Promise.all([import('@tonejs/midi'), fetch(path)]);
  if (!response.ok) throw new Error(`Memories of Green: HTTP ${response.status}`);
  const score = readMemoriesOfGreen(new Midi(await response.arrayBuffer()));
  const buffers = await loadPianoSamples(context, [...new Set(score.notes.map(pianoSampleKey))]);
  return arrangeMemoriesOfGreen(score, buffers, makeStereoHiss(context));
}
