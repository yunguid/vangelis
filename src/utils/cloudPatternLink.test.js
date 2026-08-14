import { beforeEach, describe, expect, it } from 'vitest';
import { loadCloudPatternId, saveCloudPatternId } from './cloudPatternLink.js';

const STORAGE_KEY = 'vangelis.editorCloudPattern.v1';

describe('cloudPatternLink', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when the editor is not linked to a cloud row', () => {
    expect(loadCloudPatternId()).toBeNull();
  });

  it('round-trips the linked row id', () => {
    saveCloudPatternId('4f0f8b0e-1f0e-4c2a-9a0a-2f6b1c3d4e5f');
    expect(loadCloudPatternId()).toBe('4f0f8b0e-1f0e-4c2a-9a0a-2f6b1c3d4e5f');
  });

  it('keeps the newest link only', () => {
    saveCloudPatternId('row-1');
    saveCloudPatternId('row-2');
    expect(loadCloudPatternId()).toBe('row-2');
  });

  it('forgets the link when saved without an id', () => {
    saveCloudPatternId('row-1');
    saveCloudPatternId(null);
    expect(loadCloudPatternId()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('treats a blank stored id as no link', () => {
    localStorage.setItem(STORAGE_KEY, '');
    expect(loadCloudPatternId()).toBeNull();
  });
});
