import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteProject,
  findProject,
  loadProjects,
  markProjectSynced,
  nextUntitledName,
  saveProject,
  unsyncedProjects
} from './projectLibrary.js';

const pattern = (name, notes = []) => ({ name, bpm: 120, bars: 4, tracks: [], notes });

describe('projectLibrary', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('adopts the old saved patterns once, as projects nobody has synced', () => {
    localStorage.setItem('vangelis.patterns.v1', JSON.stringify([
      { id: 'a', name: 'Old loop', pattern: pattern('Old loop'), createdAt: 5 },
      { id: 'broken', name: 'No notes', pattern: { name: 'x' } }
    ]));
    expect(loadProjects()).toEqual([
      { id: 'a', name: 'Old loop', pattern: pattern('Old loop'), updatedAt: 5, cloudId: null, syncedAt: null }
    ]);
    expect(localStorage.getItem('vangelis.patterns.v1')).toBeNull();
    expect(loadProjects()).toHaveLength(1);
  });

  it('saves newest first, names from the pattern, and keeps the account link', () => {
    saveProject({ id: 'a', pattern: pattern('First') });
    saveProject({ id: 'b', pattern: pattern('  ') });
    markProjectSynced('a', { cloudId: 'row-a', syncedAt: 1 });
    saveProject({ id: 'a', pattern: pattern('First, edited') });
    expect(loadProjects().map((entry) => [entry.id, entry.name])).toEqual([
      ['a', 'First, edited'],
      ['b', 'Untitled']
    ]);
    expect(findProject('a').cloudId).toBe('row-a');
  });

  it('marks a sync without moving the project or bumping its time', () => {
    saveProject({ id: 'a', pattern: pattern('A'), updatedAt: 10 });
    saveProject({ id: 'b', pattern: pattern('B'), updatedAt: 20 });
    markProjectSynced('a', { cloudId: 'row-a', syncedAt: 10 });
    expect(loadProjects().map((entry) => entry.id)).toEqual(['b', 'a']);
    expect(findProject('a')).toMatchObject({ updatedAt: 10, cloudId: 'row-a', syncedAt: 10 });
  });

  it('lists projects with edits the account has not received', () => {
    saveProject({ id: 'never', pattern: pattern('N'), updatedAt: 1 });
    saveProject({ id: 'current', pattern: pattern('C'), updatedAt: 5 });
    saveProject({ id: 'behind', pattern: pattern('B'), updatedAt: 9 });
    markProjectSynced('current', { cloudId: 'row-c', syncedAt: 5 });
    markProjectSynced('behind', { cloudId: 'row-b', syncedAt: 7 });
    expect(unsyncedProjects().map((entry) => entry.id).sort()).toEqual(['behind', 'never']);
  });

  it('numbers new untitled projects so they can be told apart', () => {
    expect(nextUntitledName([])).toBe('Untitled');
    saveProject({ id: 'a', pattern: pattern('Untitled') });
    saveProject({ id: 'b', pattern: pattern('Untitled 2') });
    expect(nextUntitledName()).toBe('Untitled 3');
  });

  it('deletes by id', () => {
    saveProject({ id: 'a', pattern: pattern('A') });
    saveProject({ id: 'b', pattern: pattern('B') });
    expect(deleteProject('a').map((entry) => entry.id)).toEqual(['b']);
    expect(findProject('a')).toBeNull();
  });

  it('reports a refused write instead of pretending it saved', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(saveProject({ id: 'a', pattern: pattern('A') })).toBeNull();
    expect(error).toHaveBeenCalled();
  });
});
