import { describe, expect, it } from 'vitest';
import {
  RADAR_PARTICLE_COLOR_COUNT,
  getRadarParticleColor
} from './radarParticleColor.js';

describe('radarParticleColor', () => {
  it('uses the exact three-decimal endpoint strings', () => {
    expect(getRadarParticleColor(0.015)).toBe('rgba(255, 176, 110, 0.015)');
    expect(getRadarParticleColor(0.135)).toBe('rgba(255, 176, 110, 0.135)');
    expect(RADAR_PARTICLE_COLOR_COUNT).toBe(121);
  });

  it('quantizes and clamps dynamic alpha without constructing strings', () => {
    expect(getRadarParticleColor(0.0746)).toBe('rgba(255, 176, 110, 0.075)');
    expect(getRadarParticleColor(-1)).toBe('rgba(255, 176, 110, 0.015)');
    expect(getRadarParticleColor(1)).toBe('rgba(255, 176, 110, 0.135)');
  });
});
