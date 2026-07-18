/** User-created synth presets persisted in localStorage. */
const STORAGE_KEY = 'vangelis.presets.v1';

const makeId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

export const loadUserPresets = () => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((preset) => (
      preset && preset.id && preset.name
    )) : [];
  } catch {
    return [];
  }
};

const persist = (presets) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Storage full or unavailable; preset stays in memory only.
  }
};

export const saveUserPreset = ({ name, waveformType, audioParams }) => {
  const trimmed = (name || '').trim().slice(0, 48) || 'Untitled';
  const preset = {
    id: makeId(),
    name: trimmed,
    waveformType,
    audioParams,
    createdAt: Date.now()
  };
  persist([preset, ...loadUserPresets()].slice(0, 50));
  return preset;
};

export const deleteUserPreset = (id) => {
  const next = loadUserPresets().filter((preset) => preset.id !== id);
  persist(next);
  return next;
};
