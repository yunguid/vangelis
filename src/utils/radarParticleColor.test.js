import { describe, expect, it } from 'vitest';
import {
  RADAR_PARTICLE_ALPHA_BUCKET_COUNT,
  RADAR_PARTICLE_COLOR_COUNT,
  getRadarParticleAlphaBucket,
  getRadarParticleBatchAlpha,
  getRadarParticleBatchColor,
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

  it('maps low-opacity particles into a bounded batch palette', () => {
    expect(RADAR_PARTICLE_ALPHA_BUCKET_COUNT).toBe(12);
    expect(getRadarParticleAlphaBucket(-1)).toBe(0);
    expect(getRadarParticleAlphaBucket(1)).toBe(11);
    expect(getRadarParticleBatchAlpha(0)).toBe(0.015);
    expect(getRadarParticleBatchAlpha(11)).toBe(0.135);
    expect(getRadarParticleBatchColor(0)).toBe('rgba(255, 176, 110, 0.015)');
    expect(getRadarParticleBatchColor(11)).toBe('rgba(255, 176, 110, 0.135)');
  });
});
