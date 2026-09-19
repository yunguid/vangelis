import { beforeEach, describe, expect, it } from 'vitest';
import { loadMidiLibraryPrefs, saveMidiLibraryPrefs } from './midiLibraryPrefs.js';

const KEY = 'vangelis.midiLibrary.v1';

describe('midiLibraryPrefs', () => {
  beforeEach(() => localStorage.clear());

  it('reads unreadable or malformed storage as an untouched library', () => {
    for (const stored of ['{not json', '"liked"', JSON.stringify({ liked: 'all', removed: [7, null, 'kept-id'] })]) {
      localStorage.setItem(KEY, stored);
      const { liked, removed } = loadMidiLibraryPrefs();
      expect([...liked]).toEqual([]);
      expect([...removed]).toEqual(stored.includes('kept-id') ? ['kept-id'] : []);
    }
  });

  it('round-trips what was liked and removed', () => {
    saveMidiLibraryPrefs({ liked: new Set(['a', 'b']), removed: new Set(['c']) });
    const { liked, removed } = loadMidiLibraryPrefs();
    expect([...liked]).toEqual(['a', 'b']);
    expect([...removed]).toEqual(['c']);
  });
});
