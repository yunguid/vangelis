export const DEFAULT_SAMPLE_RATE = 44100;
export const SAMPLE_VOICE_POOL = 64;
export const MINIMUM_GAIN = 0.0001;

export const WORKLET_PROCESSOR = 'vangelis-synth';
export const WORKLET_URL = new URL('../../audio/synth-worklet.js', import.meta.url);
export const RECORDER_PROCESSOR = 'vangelis-recorder';
export const RECORDER_URL = new URL('../../audio/recorder-worklet.js', import.meta.url);

export const VOICE_STATE = Object.freeze({
  IDLE: 'idle',
  ATTACK: 'attack',
  SUSTAIN: 'sustain',
  RELEASE: 'release'
});

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const MIN_OCTAVE = -1;
export const MAX_OCTAVE = 7;

export const NOTE_OFFSET_FROM_A = {
  C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4,
  'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2
};
