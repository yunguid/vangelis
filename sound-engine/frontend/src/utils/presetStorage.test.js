import { describe, expect, it } from 'vitest';
import { FACTORY_PRESETS, PRESET_CATEGORIES } from './presetStorage.js';
import {
  AUDIO_PARAM_RANGES,
  WAVEFORM_OPTIONS,
  sanitizeAudioParams,
  sanitizeModRoutes
} from './audioParams.js';

/**
 * Factory presets are hand-authored sound design data. These tests pin them
 * to the engine's legal ranges so a patch never silently clamps or drops a
 * mod route at load time.
 */
describe('FACTORY_PRESETS', () => {
  it('have unique ids and names', () => {
    const ids = FACTORY_PRESETS.map((preset) => preset.id);
    const names = FACTORY_PRESETS.map((preset) => preset.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('offers a production-size bank', () => {
    expect(FACTORY_PRESETS.length).toBeGreaterThanOrEqual(12);
  });

  it.each(FACTORY_PRESETS.map((preset) => [preset.name, preset]))(
    '%s is well-formed',
    (_name, preset) => {
      expect(preset.factory).toBe(true);
      expect(PRESET_CATEGORIES).toContain(preset.category);
      expect(typeof preset.description).toBe('string');
      expect(preset.description.length).toBeGreaterThan(0);
      expect(WAVEFORM_OPTIONS).toContain(preset.waveformType);
    }
  );

  it.each(FACTORY_PRESETS.map((preset) => [preset.name, preset]))(
    '%s parameters are in range (sanitize is a no-op)',
    (_name, preset) => {
      const params = preset.audioParams;

      // No numeric value outside its declared range.
      Object.entries(AUDIO_PARAM_RANGES).forEach(([key, range]) => {
        if (typeof params[key] !== 'number') return;
        expect(params[key], key).toBeGreaterThanOrEqual(range.min);
        expect(params[key], key).toBeLessThanOrEqual(range.max);
      });

      // Enumerated values survive sanitization untouched.
      const sanitized = sanitizeAudioParams(params);
      expect(sanitized.delayMode).toBe(params.delayMode);
      expect(sanitized.delayDivision).toBe(params.delayDivision);
      expect(sanitized.reverbMode).toBe(params.reverbMode);
      expect(sanitized.filterMode).toBe(params.filterMode);

      // Every authored mod route is kept (none dropped as invalid).
      expect(sanitizeModRoutes(params.modRoutes)).toEqual(params.modRoutes);
      expect(params.modRoutes.length).toBeLessThanOrEqual(8);

      // Matrix-era patches must not trigger the legacy single-LFO route.
      expect(params.lfoDepth).toBe(0);
    }
  );
});
