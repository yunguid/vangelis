import { describe, expect, it } from 'vitest';
import { PATCH_LAB_PRESETS, PATCH_LAB_CATEGORIES } from './patchLabPresets.js';
import { FACTORY_PRESETS, PRESET_CATEGORIES } from './factoryPresets.js';
import { PATCH_LAB_PRESET_COUNT } from './presetCatalogMeta.js';
import {
  AUDIO_PARAM_RANGES,
  WAVEFORM_OPTIONS,
  sanitizeAudioParams,
  sanitizeModRoutes
} from './audioParams.js';

/**
 * The Patch Lab is original, hand-authored sound design (no imported banks).
 * Same legality contract as the factory bank: nothing may silently clamp or
 * drop at load time, and modulation stays inside musically-stable bounds.
 */
describe('PATCH_LAB_PRESETS', () => {
  it('matches its advertised count', () => {
    expect(PATCH_LAB_PRESETS).toHaveLength(PATCH_LAB_PRESET_COUNT);
  });

  it('has unique ids and names, disjoint from the factory bank', () => {
    const ids = PATCH_LAB_PRESETS.map((preset) => preset.id);
    const names = PATCH_LAB_PRESETS.map((preset) => preset.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);

    const factoryIds = new Set(FACTORY_PRESETS.map((preset) => preset.id));
    const factoryNames = new Set(FACTORY_PRESETS.map((preset) => preset.name));
    for (const id of ids) expect(factoryIds.has(id), id).toBe(false);
    for (const name of names) expect(factoryNames.has(name), name).toBe(false);
  });

  it('keeps lab categories distinct from factory categories', () => {
    for (const category of PATCH_LAB_CATEGORIES) {
      expect(PRESET_CATEGORIES).not.toContain(category);
    }
  });

  it('covers every lab category with at least three patches', () => {
    for (const category of PATCH_LAB_CATEGORIES) {
      const inCategory = PATCH_LAB_PRESETS.filter((p) => p.category === category);
      expect(inCategory.length, category).toBeGreaterThanOrEqual(3);
    }
  });

  it.each(PATCH_LAB_PRESETS.map((preset) => [preset.name, preset]))(
    '%s is well-formed',
    (_name, preset) => {
      expect(preset.factory).toBe(true);
      expect(preset.id.startsWith('lab-')).toBe(true);
      expect(PATCH_LAB_CATEGORIES).toContain(preset.category);
      expect(typeof preset.description).toBe('string');
      expect(preset.description.length).toBeGreaterThan(0);
      expect(WAVEFORM_OPTIONS).toContain(preset.waveformType);
    }
  );

  it.each(PATCH_LAB_PRESETS.map((preset) => [preset.name, preset]))(
    '%s parameters are in range (sanitize is a no-op)',
    (_name, preset) => {
      const params = preset.audioParams;

      Object.entries(AUDIO_PARAM_RANGES).forEach(([key, range]) => {
        if (typeof params[key] !== 'number') return;
        expect(params[key], key).toBeGreaterThanOrEqual(range.min);
        expect(params[key], key).toBeLessThanOrEqual(range.max);
      });

      const sanitized = sanitizeAudioParams(params);
      expect(sanitized.delayMode).toBe(params.delayMode);
      expect(sanitized.delayDivision).toBe(params.delayDivision);
      expect(sanitized.reverbMode).toBe(params.reverbMode);
      expect(sanitized.filterMode).toBe(params.filterMode);

      expect(sanitizeModRoutes(params.modRoutes)).toEqual(params.modRoutes);
      expect(params.modRoutes.length).toBeLessThanOrEqual(8);
      expect(params.lfoDepth).toBe(0);
    }
  );

  it.each(PATCH_LAB_PRESETS.map((preset) => [preset.name, preset]))(
    '%s stays inside musically-stable modulation bounds',
    (_name, preset) => {
      const params = preset.audioParams;
      const routes = params.modRoutes ?? [];
      const sumDepths = (dst, positiveOnly = true) => routes
        .filter((r) => r.dst === dst)
        .reduce((acc, r) => acc + (positiveOnly ? Math.max(0, r.depth) : Math.abs(r.depth)), 0);

      expect(params.filterResonance).toBeLessThanOrEqual(6);
      expect(sumDepths(1)).toBeLessThanOrEqual(1.3);
      const worstFm = (params.useFM ? params.fmIndex : 0) + sumDepths(3) * 10;
      expect(worstFm).toBeLessThanOrEqual(30);
      expect(sumDepths(0, false)).toBeLessThanOrEqual(0.5);
      expect(sumDepths(2, false)).toBeLessThanOrEqual(0.5);
    }
  );
});
