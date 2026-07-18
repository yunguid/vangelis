import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteUserPreset,
  loadUserPresets,
  saveUserPreset
} from './userPresetStorage.js';

describe('userPresetStorage', () => {
  beforeEach(() => localStorage.clear());

  it('filters malformed stored entries', () => {
    localStorage.setItem('vangelis.presets.v1', JSON.stringify([
      { id: 'valid', name: 'Valid' },
      { id: 'missing-name' },
      null
    ]));
    expect(loadUserPresets()).toEqual([{ id: 'valid', name: 'Valid' }]);
  });

  it('saves a normalized preset at the front of the bank', () => {
    const preset = saveUserPreset({
      name: '  Night Glass  ',
      waveformType: 'Sine',
      audioParams: { attack: 0.1 }
    });
    expect(preset.name).toBe('Night Glass');
    expect(loadUserPresets()[0]).toEqual(preset);
  });

  it('caps the persisted user bank at fifty entries', () => {
    localStorage.setItem('vangelis.presets.v1', JSON.stringify(
      Array.from({ length: 50 }, (_, index) => ({ id: `old-${index}`, name: `Old ${index}` }))
    ));
    saveUserPreset({ name: 'Newest', waveformType: 'Square', audioParams: {} });
    const presets = loadUserPresets();
    expect(presets).toHaveLength(50);
    expect(presets[0].name).toBe('Newest');
    expect(presets.some(({ id }) => id === 'old-49')).toBe(false);
  });

  it('deletes only the requested preset', () => {
    localStorage.setItem('vangelis.presets.v1', JSON.stringify([
      { id: 'keep', name: 'Keep' },
      { id: 'remove', name: 'Remove' }
    ]));
    expect(deleteUserPreset('remove')).toEqual([{ id: 'keep', name: 'Keep' }]);
    expect(loadUserPresets()).toEqual([{ id: 'keep', name: 'Keep' }]);
  });
});
