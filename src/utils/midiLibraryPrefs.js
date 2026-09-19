/**
 * What the listener has made of the MIDI library: the pieces they liked, which
 * lead the list under Favorites, and the ones they removed from it. Ids only,
 * in localStorage. A removed piece also leaves the landing queue.
 */
const STORAGE_KEY = 'vangelis.midiLibrary.v1';

const toIdSet = (value) => new Set(
  Array.isArray(value) ? value.filter((id) => typeof id === 'string') : []
);

export const loadMidiLibraryPrefs = () => {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    // Unreadable or unavailable storage: an untouched library.
  }
  return { liked: toIdSet(stored?.liked), removed: toIdSet(stored?.removed) };
};

export const saveMidiLibraryPrefs = ({ liked, removed }) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ liked: [...liked], removed: [...removed] }));
  } catch {
    // Private windows and full storage: the choice lasts for this visit only.
  }
};
