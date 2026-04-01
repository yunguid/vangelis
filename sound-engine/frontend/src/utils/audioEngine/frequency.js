import {
  MAX_OCTAVE,
  MIN_OCTAVE,
  NOTE_NAMES,
  NOTE_OFFSET_FROM_A
} from './constants.js';

export function buildFrequencyTable() {
  const table = new Map();
  for (let octave = MIN_OCTAVE; octave <= MAX_OCTAVE; octave++) {
    for (const name of NOTE_NAMES) {
      const semitoneOffset = (octave - 4) * 12 + NOTE_OFFSET_FROM_A[name];
      const frequency = 440 * Math.pow(2, semitoneOffset / 12);
      table.set(`${name}${octave}`, frequency);
    }
  }
  return table;
}

export function getFrequencyFromTable(table, noteName, octave) {
  return table.get(`${noteName}${octave}`) || null;
}
