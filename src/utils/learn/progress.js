/**
 * What the learner has practised, per piece, phrase and hands: the best accuracy of a finished
 * run. Kept in this browser only (a convenience: the page works the same without it).
 */
const STORAGE_KEY = 'vangelis.learnProgress.v1';

const read = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
};

export const loadProgress = (slug) => read()[slug] || {};

/** Record a finished run; returns the piece's updated progress. */
export const recordRun = (slug, phraseIndex, hands, accuracy) => {
  const all = read();
  const piece = { ...(all[slug] || {}) };
  const key = `${phraseIndex}:${hands}`;
  piece[key] = Math.max(piece[key] || 0, Math.round(accuracy * 100) / 100);
  all[slug] = piece;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Private windows and full storage: progress lasts until the page closes.
  }
  return piece;
};

/**
 * How far a phrase has come: 'learned' (both hands at 90% or better), 'practising' (any
 * hand finished at 80% or better), 'started' (a run finished) or null.
 */
export const phraseStanding = (progress, phraseIndex) => {
  const both = progress[`${phraseIndex}:both`] || 0;
  const best = Math.max(both, progress[`${phraseIndex}:left`] || 0, progress[`${phraseIndex}:right`] || 0);
  if (both >= 0.9) return 'learned';
  if (best >= 0.8) return 'practising';
  if (best > 0) return 'started';
  return null;
};
