import { lowerBound, upperBound } from '../components/midiBirdsEyeMath.js';

const LOOK_BEHIND_SECONDS = 0.08;
const LOOK_AHEAD_SECONDS = 0.24;
const FALLBACK_LOOK_AHEAD_SECONDS = 0.42;

/**
 * Resolve the currently sounding study notes from a prebuilt sorted index.
 * Lookup is O(log n + k), where k is the small local note window.
 */
export function getStudyNotesAroundTime(renderWindow, time) {
  const { notes = [], startTimes = [], maxDuration = 0 } = renderWindow || {};
  if (notes.length === 0 || startTimes.length === 0) return [];

  const activeStart = lowerBound(
    startTimes,
    time - LOOK_BEHIND_SECONDS - maxDuration
  );
  const activeEnd = upperBound(startTimes, time + LOOK_BEHIND_SECONDS);
  const activeNotes = [];

  for (let index = activeStart; index < activeEnd; index += 1) {
    const note = notes[index];
    if (note.endTime >= time - LOOK_BEHIND_SECONDS) {
      activeNotes.push(note);
    }
  }

  if (activeNotes.length > 0) return activeNotes;

  const upcomingStart = lowerBound(startTimes, time);
  const upcomingEnd = upperBound(startTimes, time + FALLBACK_LOOK_AHEAD_SECONDS);
  if (upcomingStart >= upcomingEnd) return [];

  const anchorTime = notes[upcomingStart].time;
  const clusterEnd = Math.min(
    upcomingEnd,
    upperBound(startTimes, anchorTime + LOOK_AHEAD_SECONDS)
  );
  return notes.slice(upcomingStart, clusterEnd);
}
