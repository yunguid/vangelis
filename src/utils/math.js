/**
 * Shared math utilities for Vangelis
 * @module utils/math
 */

/**
 * Clamp a value between min and max bounds
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum bound
 * @param {number} max - Maximum bound
 * @returns {number} The clamped value
 * @example
 * clamp(150, 0, 100) // returns 100
 * clamp(-5, 0, 100)  // returns 0
 * clamp(50, 0, 100)  // returns 50
 */
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Linear interpolation between two values
 * @param {number} a - Start value
 * @param {number} b - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} The interpolated value
 * @example
 * lerp(0, 100, 0.5) // returns 50
 * lerp(0, 100, 0.25) // returns 25
 */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Note names in chromatic order (C = 0, C# = 1, ..., B = 11)
 * @constant {string[]}
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert MIDI note number to frequency in Hz
 * Uses equal temperament tuning with A4 = 440 Hz
 * @param {number} midi - MIDI note number (0-127)
 * @returns {number} Frequency in Hz
 * @example
 * midiNoteToFrequency(69)  // returns 440 (A4)
 * midiNoteToFrequency(60)  // returns ~261.63 (C4/Middle C)
 * midiNoteToFrequency(72)  // returns ~523.25 (C5)
 */
export const midiNoteToFrequency = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Convert MIDI note number to note name and octave
 * @param {number} midi - MIDI note number (0-127)
 * @returns {{noteName: string, octave: number, noteId: string}} Note info
 * @example
 * midiNoteToName(60)  // returns { noteName: 'C', octave: 4, noteId: 'C4' }
 * midiNoteToName(69)  // returns { noteName: 'A', octave: 4, noteId: 'A4' }
 * midiNoteToName(72)  // returns { noteName: 'C', octave: 5, noteId: 'C5' }
 */
export const midiNoteToName = (midi) => {
  const octave = Math.floor(midi / 12) - 1;
  const noteName = NOTE_NAMES[midi % 12];
  return {
    noteName,
    octave,
    noteId: `${noteName}${octave}`
  };
};

/**
 * Convert note name and octave to MIDI note number
 * @param {string} noteName - Note name (e.g., 'C', 'C#', 'D')
 * @param {number} octave - Octave number (-1 to 9)
 * @returns {number|null} MIDI note number, or null if invalid note name
 * @example
 * noteNameToMidi('C', 4)   // returns 60
 * noteNameToMidi('A', 4)   // returns 69
 * noteNameToMidi('C#', 5)  // returns 73
 */
export const noteNameToMidi = (noteName, octave) => {
  const noteIndex = NOTE_NAMES.indexOf(noteName);
  if (noteIndex === -1) return null;
  return (octave + 1) * 12 + noteIndex;
};
