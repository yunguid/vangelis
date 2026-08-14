/**
 * The piano-roll editor's live working document, mirrored to localStorage.
 *
 * Unlike the named snapshots in `patternStorage.js`, the draft is written on
 * every edit and never cleared by navigation: leaving the editor and coming
 * back restores the pattern exactly as it was left.
 */
const STORAGE_KEY = 'vangelis.editorDraft.v1';

const stringOrNull = (value) => (typeof value === 'string' ? value : null);

const finiteOrNull = (value) => (Number.isFinite(value) ? value : null);

export const loadEditorDraft = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    const { pattern } = parsed;
    if (!pattern || typeof pattern !== 'object' || !Array.isArray(pattern.notes)) return null;
    return {
      pattern,
      snapId: stringOrNull(parsed.snapId),
      scaleId: stringOrNull(parsed.scaleId),
      scaleRoot: finiteOrNull(parsed.scaleRoot),
      chordTypeId: stringOrNull(parsed.chordTypeId),
      activeTrackId: stringOrNull(parsed.activeTrackId),
      pxPerBeat: finiteOrNull(parsed.pxPerBeat),
      updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0
    };
  } catch {
    return null;
  }
};

export const saveEditorDraft = (draft) => {
  const pattern = draft?.pattern;
  if (!pattern || !Array.isArray(pattern.notes)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      pattern,
      snapId: stringOrNull(draft.snapId),
      scaleId: stringOrNull(draft.scaleId),
      scaleRoot: finiteOrNull(draft.scaleRoot),
      chordTypeId: stringOrNull(draft.chordTypeId),
      activeTrackId: stringOrNull(draft.activeTrackId),
      pxPerBeat: finiteOrNull(draft.pxPerBeat),
      updatedAt: Date.now()
    }));
  } catch {
    // Storage full or unavailable; the draft stays in memory only.
  }
};

export const clearEditorDraft = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable; a stale draft is harmless.
  }
};
