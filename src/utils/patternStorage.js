/** Piano-roll patterns persisted in localStorage. */
const STORAGE_KEY = 'vangelis.patterns.v1';
const MAX_PATTERNS = 50;

const makeId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pattern-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

export const loadSavedPatterns = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((entry) => (
      entry && entry.id && entry.name && entry.pattern
      && Array.isArray(entry.pattern.notes)
    )) : [];
  } catch {
    return [];
  }
};

const persist = (entries) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable; pattern stays in memory only.
  }
};

export const saveSavedPattern = (pattern) => {
  const trimmed = (pattern.name || '').trim().slice(0, 48) || 'Untitled loop';
  const entry = {
    id: makeId(),
    name: trimmed,
    pattern: { ...pattern, name: trimmed },
    createdAt: Date.now()
  };
  persist([entry, ...loadSavedPatterns()].slice(0, MAX_PATTERNS));
  return entry;
};

export const deleteSavedPattern = (id) => {
  const next = loadSavedPatterns().filter((entry) => entry.id !== id);
  persist(next);
  return next;
};
