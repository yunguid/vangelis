import { AUDIO_PARAM_DEFAULTS, sanitizeAudioParams } from '../utils/audioParams.js';
import { withBase } from '../utils/baseUrl.js';
import { midiNoteToFrequency } from '../utils/math.js';

export const OPENING_PARAMS = sanitizeAudioParams({
  ...AUDIO_PARAM_DEFAULTS,
  // The recorded decay is the envelope. Release is the damper settling on the
  // string; it also fades the piano out from under a takeover note.
  volume: 0.58, useADSR: true, attack: 0.005, sustain: 1,
  release: 0.45, useFilter: false, distortion: 0,
  // The grand is close-miked and dry, so the space is all reverb: a 3.3 s
  // tail about 13 dB under the piano. Its low cut keeps the bass out of it.
  reverbEnabled: true, reverbMode: 'ambient', reverbMix: 0.62,
  reverbSize: 0.85, reverbDecay: 0.8, reverbTone: 0.38,
  reverbPreDelay: 30, reverbWidth: 0.9, delayEnabled: false
});

// Salamander Grand is recorded in minor thirds, so every pitch in the score is
// at most one semitone from a recording. File names spell sharps with "s".
export const OPENING_SAMPLE_KEYS = [['Ds2',39], ['Fs2',42], ['A2',45], ['C3',48],
  ['Ds3',51], ['Fs3',54], ['A3',57], ['C4',60], ['Ds4',63], ['Fs4',66], ['A4',69],
  ['C5',72], ['Ds5',75], ['Fs5',78], ['A5',81]];

const BAR_SECONDS = 3.2; // four beats at 75 BPM
const BASS_CEILING = 52; // E3, the top of the left hand's bass register
const RESTRIKE_GAP = 0.08; // a repeated string starts fading just before the hammer lands
const RING_SECONDS = 8; // the recordings are 9 s with a faded tail
// The top line is the highest note struck at a moment, once it clears the
// accompaniment under it: the ostinato reaches G#4 for the first twenty bars,
// the later left-hand figure only G#3.
const OSTINATO_SECONDS = 20 * BAR_SECONDS;
const topLineFloor = (time) => (time < OSTINATO_SECONDS ? 69 : 59);

// Decoded once per audio context: the lullaby and the playable Grand Piano
// (data/sampledInstruments.js) share the same fifteen recordings.
const decodedSamples = new WeakMap();

export function loadOpeningSamples(context) {
  if (!decodedSamples.has(context)) {
    const loading = Promise.all(OPENING_SAMPLE_KEYS.map(async ([key, midi]) => {
      const response = await fetch(withBase(`samples/opening/${key}.mp3`));
      if (!response.ok) throw new Error(`Opening piano ${key}: HTTP ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      return { midi, buffer, baseFrequency: midiNoteToFrequency(midi) };
    }));
    decodedSamples.set(context, loading);
    loading.catch(() => decodedSamples.delete(context)); // a failed load may be retried
  }
  return decodedSamples.get(context);
}

/** The recording nearest a pitch; the lower one when two are equally near. */
export const nearestOpeningSample = (samples, midi) => samples.reduce((best, candidate) => (
  Math.abs(candidate.midi - midi) < Math.abs(best.midi - midi) ? candidate : best
));

export async function loadOpeningPerformance(context) {
  const { parseMidiFile } = await import('../utils/midiParser.js');
  const [score, samples] = await Promise.all([
    parseMidiFile(withBase('midi/subwoofer-lullaby.mid')),
    loadOpeningSamples(context)
  ]);
  return arrangeOpeningPerformance(score, samples);
}

export function arrangeOpeningPerformance(score, samples) {
  // The full-range music-box transcription is an octave above the piano and
  // has fixed pin-length notes. Restore the register, 75 BPM and the pedal.
  const scale = (score.bpm || 67) / 75;
  const isDownbeat = (time) => Math.abs(time / BAR_SECONDS - Math.round(time / BAR_SECONDS)) < 1e-3;
  // Legato pedalling: the dampers fall whenever a downbeat brings a new bass
  // note, so held harmonies ring for as long as the bass under them does.
  const pedalChanges = score.notes
    .filter((note) => note.midi - 12 <= BASS_CEILING && isDownbeat(note.time * scale))
    .map((note) => note.time * scale);
  const highestAt = new Map();
  for (const note of score.notes) {
    highestAt.set(note.time, Math.max(highestAt.get(note.time) ?? 0, note.midi - 12));
  }
  const nextStrikes = new Map();
  const notes = score.notes.slice().reverse().map((note) => {
    const midi = note.midi - 12;
    const time = note.time * scale;
    const nextPedal = pedalChanges.find((change) => change > time + 1e-3) ?? Infinity;
    const nextStrike = nextStrikes.get(midi) ?? Infinity;
    nextStrikes.set(midi, time);
    const duration = Math.min(nextPedal, nextStrike - RESTRIKE_GAP, time + RING_SECONDS) - time;
    const sample = nearestOpeningSample(samples, midi);
    // Gentle four-bar swells, no random timing drift. The top line sings about
    // 5 dB over the hands under it; the inner voices sit just under the bass.
    const phrase = Math.sin((time / 12.8) * Math.PI);
    const topLine = midi === highestAt.get(note.time) && midi >= topLineFloor(time);
    const velocity = (topLine ? 0.92 : midi >= 60 ? 0.52 : 0.57) + phrase * 0.045;
    return { ...note, midi, time, duration, velocity, sample };
  }).reverse();
  return { name: 'Subwoofer Lullaby', composer: 'C418', bpm: 75,
    notes, duration: Math.max(...notes.map((note) => note.time + note.duration)) + 2 };
}
