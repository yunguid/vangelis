import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearEditorDraft,
  loadEditorDraft,
  saveEditorDraft
} from './patternDraft.js';

const STORAGE_KEY = 'vangelis.editorDraft.v1';

const draftPattern = {
  name: 'Night drive',
  bpm: 128,
  bars: 4,
  nextNoteId: 2,
  nextTrackId: 2,
  tracks: [{ id: 'track-1', name: 'Lead' }],
  loopRange: null,
  notes: [{ id: 'note-1', midi: 60, start: 0, duration: 1, velocity: 0.8, trackId: 'track-1' }]
};

describe('patternDraft', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when nothing has been drafted', () => {
    expect(loadEditorDraft()).toBeNull();
  });

  it('round-trips the pattern and editor view state', () => {
    saveEditorDraft({
      pattern: draftPattern,
      snapId: '1/8',
      scaleId: 'dorian',
      scaleRoot: 5,
      chordTypeId: 'minor',
      activeTrackId: 'track-1',
      pxPerBeat: 72
    });
    const draft = loadEditorDraft();
    expect(draft.pattern).toEqual(draftPattern);
    expect(draft.snapId).toBe('1/8');
    expect(draft.scaleId).toBe('dorian');
    expect(draft.scaleRoot).toBe(5);
    expect(draft.chordTypeId).toBe('minor');
    expect(draft.activeTrackId).toBe('track-1');
    expect(draft.pxPerBeat).toBe(72);
    expect(draft.updatedAt).toBeGreaterThan(0);
  });

  it('keeps the newest draft only', () => {
    saveEditorDraft({ pattern: draftPattern });
    saveEditorDraft({ pattern: { ...draftPattern, name: 'Second pass', notes: [] } });
    expect(loadEditorDraft().pattern.name).toBe('Second pass');
    expect(loadEditorDraft().pattern.notes).toEqual([]);
  });

  it('falls back to null view state when fields are missing or malformed', () => {
    saveEditorDraft({
      pattern: draftPattern,
      snapId: 42,
      scaleRoot: Number.NaN,
      pxPerBeat: 'wide'
    });
    const draft = loadEditorDraft();
    expect(draft.snapId).toBeNull();
    expect(draft.scaleId).toBeNull();
    expect(draft.scaleRoot).toBeNull();
    expect(draft.chordTypeId).toBeNull();
    expect(draft.activeTrackId).toBeNull();
    expect(draft.pxPerBeat).toBeNull();
  });

  it('tolerates unparsable or wrongly shaped stored drafts', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadEditorDraft()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(['nope']));
    expect(loadEditorDraft()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ snapId: '1/16' }));
    expect(loadEditorDraft()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pattern: { notes: 'many' } }));
    expect(loadEditorDraft()).toBeNull();
  });

  it('ignores save calls without a usable pattern', () => {
    saveEditorDraft({ pattern: draftPattern });
    saveEditorDraft(null);
    saveEditorDraft({ pattern: { notes: null } });
    expect(loadEditorDraft().pattern.name).toBe('Night drive');
  });

  it('clears the stored draft', () => {
    saveEditorDraft({ pattern: draftPattern });
    clearEditorDraft();
    expect(loadEditorDraft()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
