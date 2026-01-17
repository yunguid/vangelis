import { audioEngine } from '../../../utils/audioEngine.js';
import { BASE_OCTAVE, MIN_OFFSET, MAX_OFFSET, clamp } from '../constants';

export const getNoteMeta = (noteName, relativeOctave, octaveOffset) => {
  const octave = clamp(
    BASE_OCTAVE + octaveOffset + relativeOctave,
    MIN_OFFSET + BASE_OCTAVE,
    MAX_OFFSET + BASE_OCTAVE + 1
  );
  const noteId = `${noteName}${octave}`;
  const frequency = audioEngine.getFrequency(noteName, octave);
  return {
    noteName,
    octave,
    noteId,
    frequency
  };
};
