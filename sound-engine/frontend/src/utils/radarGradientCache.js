export const createRadarStaticGradientCache = () => ({
  width: 0,
  height: 0,
  gradients: null
});

export const getRadarStaticGradients = (
  context,
  cache,
  width,
  height,
  bottomPadding
) => {
  if (cache.gradients && cache.width === width && cache.height === height) {
    return cache.gradients;
  }

  const base = context.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, 'rgba(5, 10, 18, 0.98)');
  base.addColorStop(0.45, 'rgba(8, 14, 25, 0.98)');
  base.addColorStop(1, 'rgba(3, 7, 13, 1)');

  const horizon = context.createRadialGradient(
    width * 0.5,
    height * 0.78,
    24,
    width * 0.5,
    height * 0.78,
    width * 0.66
  );
  horizon.addColorStop(0, 'rgba(255, 146, 86, 0.24)');
  horizon.addColorStop(0.38, 'rgba(255, 112, 58, 0.08)');
  horizon.addColorStop(1, 'rgba(255, 112, 58, 0)');

  const canopy = context.createRadialGradient(
    width * 0.5,
    height * 0.08,
    10,
    width * 0.5,
    height * 0.08,
    width * 0.7
  );
  canopy.addColorStop(0, 'rgba(105, 190, 255, 0.1)');
  canopy.addColorStop(0.42, 'rgba(40, 112, 174, 0.04)');
  canopy.addColorStop(1, 'rgba(40, 112, 174, 0)');

  const trackBottom = height - bottomPadding;
  const gridHorizon = context.createLinearGradient(0, trackBottom - 2, 0, trackBottom + 8);
  gridHorizon.addColorStop(0, 'rgba(255, 168, 104, 0.96)');
  gridHorizon.addColorStop(1, 'rgba(255, 110, 56, 0.24)');

  cache.width = width;
  cache.height = height;
  cache.gradients = { base, horizon, canopy, gridHorizon };
  return cache.gradients;
};
