import { clamp } from './math.js';

export const RADAR_PARTICLE_ALPHA_MIN_MILLI = 15;
export const RADAR_PARTICLE_ALPHA_MAX_MILLI = 135;
export const RADAR_PARTICLE_COLOR_COUNT = (
  RADAR_PARTICLE_ALPHA_MAX_MILLI - RADAR_PARTICLE_ALPHA_MIN_MILLI + 1
);
export const RADAR_PARTICLE_ALPHA_BUCKET_COUNT = 12;

const particleColors = Array.from(
  { length: RADAR_PARTICLE_COLOR_COUNT },
  (_, index) => {
    const alphaMilli = RADAR_PARTICLE_ALPHA_MIN_MILLI + index;
    return `rgba(255, 176, 110, ${(alphaMilli / 1000).toFixed(3)})`;
  }
);

export const getRadarParticleColor = (alpha) => {
  const alphaMilli = clamp(
    Math.round(alpha * 1000),
    RADAR_PARTICLE_ALPHA_MIN_MILLI,
    RADAR_PARTICLE_ALPHA_MAX_MILLI
  );
  return particleColors[alphaMilli - RADAR_PARTICLE_ALPHA_MIN_MILLI];
};

export const getRadarParticleAlphaBucket = (alpha) => {
  const alphaMilli = clamp(
    Math.round(alpha * 1000),
    RADAR_PARTICLE_ALPHA_MIN_MILLI,
    RADAR_PARTICLE_ALPHA_MAX_MILLI
  );
  const normalized = (
    (alphaMilli - RADAR_PARTICLE_ALPHA_MIN_MILLI)
    / (RADAR_PARTICLE_ALPHA_MAX_MILLI - RADAR_PARTICLE_ALPHA_MIN_MILLI)
  );
  return Math.round(normalized * (RADAR_PARTICLE_ALPHA_BUCKET_COUNT - 1));
};

export const getRadarParticleBatchAlpha = (bucket) => (
  Math.round(
    RADAR_PARTICLE_ALPHA_MIN_MILLI
    + (
      clamp(Math.round(bucket), 0, RADAR_PARTICLE_ALPHA_BUCKET_COUNT - 1)
      * (RADAR_PARTICLE_ALPHA_MAX_MILLI - RADAR_PARTICLE_ALPHA_MIN_MILLI)
      / (RADAR_PARTICLE_ALPHA_BUCKET_COUNT - 1)
    )
  ) / 1000
);

const particleBatchColors = Array.from(
  { length: RADAR_PARTICLE_ALPHA_BUCKET_COUNT },
  (_, bucket) => getRadarParticleColor(getRadarParticleBatchAlpha(bucket))
);

export const getRadarParticleBatchColor = (bucket) => (
  particleBatchColors[clamp(
    Math.round(bucket),
    0,
    RADAR_PARTICLE_ALPHA_BUCKET_COUNT - 1
  )]
);
