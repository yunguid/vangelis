/**
 * The editor's projects on this device, newest first. Every project the
 * editor touches autosaves here, so the device always holds a copy. When the
 * owner is signed in, `cloudId` names the account row a project syncs to and
 * `syncedAt` is the `updatedAt` that row last received: a project whose
 * `updatedAt` is newer still has edits to send.
 */
const STORAGE_KEY = 'vangelis.projects.v1';
// Named snapshots from before projects autosaved (patternStorage.js).
const LEGACY_KEY = 'vangelis.patterns.v1';
const MAX_PROJECTS = 100;
export const UNTITLED = 'Untitled';

export const newProjectId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
);

const isEntry = (entry) => Boolean(
  entry && typeof entry.id === 'string' && entry.pattern && Array.isArray(entry.pattern.notes)
);

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (entries) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch (error) {
    console.error('[vangelis] could not save projects on this device', error);
    return false;
  }
};

/** Every project on this device, newest first. */
export const loadProjects = () => {
  if (typeof localStorage === 'undefined') return [];
  const stored = readJson(STORAGE_KEY);
  if (Array.isArray(stored)) return stored.filter(isEntry);
  // First run with projects: the old saved patterns become projects.
  const legacy = readJson(LEGACY_KEY);
  const migrated = (Array.isArray(legacy) ? legacy : [])
    .filter(isEntry)
    .map((entry) => ({
      id: entry.id,
      name: entry.name || UNTITLED,
      pattern: entry.pattern,
      updatedAt: Number(entry.createdAt) || 0,
      cloudId: null,
      syncedAt: null
    }));
  if (migrated.length > 0 && write(migrated)) localStorage.removeItem(LEGACY_KEY);
  return migrated;
};

export const findProject = (id) => loadProjects().find((entry) => entry.id === id) || null;

/**
 * Save a project's latest state, moving it to the top. Fields not given
 * (cloudId, syncedAt) keep their stored values. Returns the saved entry, or
 * null when the device refused the write (quota).
 */
export const saveProject = ({ id, pattern, ...rest }) => {
  const entries = loadProjects();
  const existing = entries.find((entry) => entry.id === id);
  const entry = {
    cloudId: null,
    syncedAt: null,
    ...existing,
    ...rest,
    id,
    name: String(pattern.name || '').trim().slice(0, 48) || UNTITLED,
    pattern,
    updatedAt: rest.updatedAt ?? Date.now()
  };
  const next = [entry, ...entries.filter((item) => item.id !== id)].slice(0, MAX_PROJECTS);
  return write(next) ? entry : null;
};

/** Record a finished cloud save without moving the project or bumping its time. */
export const markProjectSynced = (id, { cloudId, syncedAt }) => {
  const entries = loadProjects();
  let changed = false;
  const next = entries.map((entry) => {
    if (entry.id !== id) return entry;
    changed = true;
    return { ...entry, cloudId, syncedAt };
  });
  if (changed) write(next);
};

export const deleteProject = (id) => {
  const next = loadProjects().filter((entry) => entry.id !== id);
  write(next);
  return next;
};

/** Projects with edits the account has not received yet. */
export const unsyncedProjects = (entries = loadProjects()) => entries.filter((entry) => (
  !entry.cloudId || !entry.syncedAt || entry.updatedAt > entry.syncedAt
));

/** "Untitled", then "Untitled 2", 3 ... so new projects can be told apart. */
export const nextUntitledName = (entries = loadProjects()) => {
  const taken = new Set(entries.map((entry) => entry.name));
  if (!taken.has(UNTITLED)) return UNTITLED;
  let index = 2;
  while (taken.has(`${UNTITLED} ${index}`)) index += 1;
  return `${UNTITLED} ${index}`;
};
