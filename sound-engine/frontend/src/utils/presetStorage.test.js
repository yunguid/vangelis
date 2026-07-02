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
    expect(FACTORY_PRESETS.length).toBeGreaterThanOrEqual(40);
  });

  it('covers every category with a played-in set', () => {
    for (const category of PRESET_CATEGORIES) {
      const inCategory = FACTORY_PRESETS.filter((p) => p.category === category);
      expect(inCategory.length, category).toBeGreaterThanOrEqual(4);
    }
  });

  it('includes the modern-genre patches (hyperpop / trap / rage)', () => {
    for (const genre of ['hyperpop', 'trap', 'rage']) {
      const matches = FACTORY_PRESETS.filter((p) => p.id.includes(genre));
      expect(matches.length, genre).toBeGreaterThanOrEqual(1);
    }
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

  it.each(FACTORY_PRESETS.map((preset) => [preset.name, preset]))(
    '%s stays inside musically-stable modulation bounds',
    (_name, preset) => {
      const params = preset.audioParams;
      const routes = params.modRoutes ?? [];
      const sumDepths = (dst, positiveOnly = true) => routes
        .filter((r) => r.dst === dst)
        .reduce((acc, r) => acc + (positiveOnly ? Math.max(0, r.depth) : Math.abs(r.depth)), 0);

      // Resonance: the TPT filter is unconditionally stable, but beyond ~6
      // the self-oscillation dominates the note — keep factory patches tame.
      expect(params.filterResonance).toBeLessThanOrEqual(6);

      // Worst-case cutoff push (all positive routes at full tilt): <= 1.3
      // (~5.2 octaves) so the sound brightens without pinning at the ceiling.
      expect(sumDepths(1)).toBeLessThanOrEqual(1.3);

      // Worst-case FM index: base + routed (10 rad per unit depth) <= 30 rad,
      // matching the engine's fmIndex range ceiling.
      const worstFm = (params.useFM ? params.fmIndex : 0) + sumDepths(3) * 10;
      expect(worstFm).toBeLessThanOrEqual(30);

      // Pitch routes stay expressive, not chaotic: total |depth| <= 0.5 (6 st).
      expect(sumDepths(0, false)).toBeLessThanOrEqual(0.5);

      // Amp routes are tremolo-scale, never gating the voice off.
      expect(sumDepths(2, false)).toBeLessThanOrEqual(0.5);
    }
  );
});
