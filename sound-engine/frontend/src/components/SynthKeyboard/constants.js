export const BASE_OCTAVE = 4;
export const MIN_OFFSET = -5;
export const MAX_OFFSET = 2;

export const WHITE_KEY_HEIGHT = 'clamp(72px, 18vh, 120px)';
export const BLACK_KEY_WIDTH = 'clamp(24px, 4.2vw, 48px)';
export const BLACK_KEY_HEIGHT = 'clamp(52px, 17vh, 100px)';
export const BLACK_KEY_OFFSET_RATIO = 2 / 3;

export const WHITE_KEYS = [
  { name: 'C', rel: 0 },
  { name: 'D', rel: 0 },
  { name: 'E', rel: 0 },
  { name: 'F', rel: 0 },
  { name: 'G', rel: 0 },
  { name: 'A', rel: 0 },
  { name: 'B', rel: 0 },
  { name: 'C', rel: 1 },
  { name: 'D', rel: 1 },
  { name: 'E', rel: 1 },
  { name: 'F', rel: 1 }
];

export const BLACK_KEYS = [
  { name: 'C#', rel: 0 },
  { name: 'D#', rel: 0 },
  { name: 'F#', rel: 0 },
  { name: 'G#', rel: 0 },
  { name: 'A#', rel: 0 },
  { name: 'C#', rel: 1 },
  { name: 'D#', rel: 1 }
];

export const BLACK_PLACEMENT = {
  'C#': 0,
  'D#': 1,
  'F#': 3,
  'G#': 4,
  'A#': 5
};

export const KEYBOARD_MAP = {
  a: { name: 'C', delta: 0 },
  s: { name: 'D', delta: 0 },
  d: { name: 'E', delta: 0 },
  f: { name: 'F', delta: 0 },
  g: { name: 'G', delta: 0 },
  h: { name: 'A', delta: 0 },
  j: { name: 'B', delta: 0 },
  k: { name: 'C', delta: 1 },
  l: { name: 'D', delta: 1 },
  ';': { name: 'E', delta: 1 },
  "'": { name: 'F', delta: 1 },
  w: { name: 'C#', delta: 0 },
  e: { name: 'D#', delta: 0 },
  t: { name: 'F#', delta: 0 },
  y: { name: 'G#', delta: 0 },
  u: { name: 'A#', delta: 0 },
  o: { name: 'C#', delta: 1 },
  p: { name: 'D#', delta: 1 }
};

export const KEY_LABELS = {
  C4: 'A',
  D4: 'S',
  E4: 'D',
  F4: 'F',
  G4: 'G',
  A4: 'H',
  B4: 'J',
  C5: 'K',
  D5: 'L',
  E5: ';',
  F5: "'",
  'C#4': 'W',
  'D#4': 'E',
  'F#4': 'T',
  'G#4': 'Y',
  'A#4': 'U',
  'C#5': 'O',
  'D#5': 'P'
};

export { clamp } from '../../utils/math.js';
