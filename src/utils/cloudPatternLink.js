/**
 * The cloud row the editor is currently syncing to.
 *
 * The working document survives navigation via `patternDraft.js`, so the row
 * it belongs to has to survive with it: without this, coming back and saving
 * again would insert a second copy instead of updating the first.
 */
const STORAGE_KEY = 'vangelis.editorCloudPattern.v1';

export const loadCloudPatternId = () => {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
};

/** Pass null to forget the link (sign-out, or the row disappeared). */
export const saveCloudPatternId = (id) => {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage full or unavailable; the link stays in memory only.
  }
};
