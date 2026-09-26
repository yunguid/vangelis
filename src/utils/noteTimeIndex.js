/**
 * A score's notes sorted by start time, and binary searches over those start
 * times: the study page finds what sounds at a moment, the notes view what is
 * in sight (components/notes/noteFrame.js).
 */
const EMPTY_RENDER_WINDOW = Object.freeze({
  notes: [],
  startTimes: [],
  maxDuration: 0
});

export const lowerBound = (sortedValues, target) => {
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sortedValues[mid] < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

export const upperBound = (sortedValues, target) => {
  let low = 0;
  let high = sortedValues.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (sortedValues[mid] <= target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
};

export const buildNoteRenderWindow = (notes = []) => {
  if (!Array.isArray(notes) || notes.length === 0) {
    return EMPTY_RENDER_WINDOW;
  }

  const sortedNotes = notes
    .map((note) => ({
      ...note,
      endTime: note.time + note.duration
    }))
    .sort((a, b) => a.time - b.time);

  const startTimes = new Array(sortedNotes.length);
  let maxDuration = 0;

  for (let i = 0; i < sortedNotes.length; i += 1) {
    const note = sortedNotes[i];
    startTimes[i] = note.time;
    if (note.duration > maxDuration) {
      maxDuration = note.duration;
    }
  }

  return {
    notes: sortedNotes,
    startTimes,
    maxDuration
  };
};
