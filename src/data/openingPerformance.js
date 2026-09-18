import { AUDIO_PARAM_DEFAULTS, sanitizeAudioParams } from '../utils/audioParams.js';
import { withBase } from '../utils/baseUrl.js';
import { midiNoteToFrequency } from '../utils/math.js';

export const OPENING_PARAMS = sanitizeAudioParams({
  ...AUDIO_PARAM_DEFAULTS,
  volume: 0.58, useADSR: true, attack: 0.008, decay: 2.8, sustain: 0.45,
  // The score supplies pedal-length holds; short releases allow instant takeover.
  release: 0.025, useFilter: false, distortion: 0,
  reverbEnabled: true, reverbMode: 'hall', reverbMix: 0.3,
  reverbSize: 0.78, reverbDecay: 0.62, reverbTone: 0.38,
  reverbPreDelay: 24, reverbWidth: 0.9, delayEnabled: false
});

const SAMPLE_KEYS = [['C2',36], ['G2',43], ['C3',48], ['G3',55], ['C4',60],
  ['G4',67], ['C5',72], ['G5',79], ['C6',84]];

export async function loadOpeningPerformance(context) {
  const { parseMidiFile } = await import('../utils/midiParser.js');
  const [score, samples] = await Promise.all([
    parseMidiFile(withBase('midi/subwoofer-lullaby.mid')),
    Promise.all(SAMPLE_KEYS.map(async ([key, midi]) => {
      const response = await fetch(withBase(`samples/opening/${key}.mp3`));
      if (!response.ok) throw new Error(`Opening piano ${key}: HTTP ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      return { midi, buffer, baseFrequency: midiNoteToFrequency(midi) };
    }))
  ]);
  return arrangeOpeningPerformance(score, samples);
}

export function arrangeOpeningPerformance(score, samples) {
  // The full-range music-box transcription is an octave above the piano and
  // has fixed pin-length notes. Restore the register, 75 BPM and pedal phrasing.
  const scale = (score.bpm || 67) / 75;
  const nextTimes = new Map();
  const notes = score.notes.slice().reverse().map((note) => {
    const midi = note.midi - 12;
    const next = nextTimes.get(note.midi);
    const duration = Math.min(2.7, next !== undefined ? (next - note.time) * scale * 0.94 : 2.7);
    nextTimes.set(note.midi, note.time);
    const sample = samples.reduce((best, candidate) => (
      Math.abs(candidate.midi - midi) < Math.abs(best.midi - midi) ? candidate : best
    ));
    // Gentle four-bar swells, melody above accompaniment, no random timing drift.
    const phrase = Math.sin((note.time * scale / 12.8) * Math.PI);
    const velocity = (midi >= 60 ? 0.72 : 0.57) + phrase * 0.045;
    return { ...note, midi, time: note.time * scale, duration, velocity, sample };
  }).reverse();
  return { name: 'Subwoofer Lullaby', composer: 'C418', bpm: 75,
    notes, duration: Math.max(...notes.map((note) => note.time + note.duration)) + 2 };
}
