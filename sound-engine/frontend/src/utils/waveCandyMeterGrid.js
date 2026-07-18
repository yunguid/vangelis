const METER_GRID_DECIBELS = Object.freeze([0, -12, -24, -36, -48]);

export const METER_GRID_RATIOS = Float64Array.from(
  METER_GRID_DECIBELS,
  (db) => Math.min(Math.max((db + 60) / 60, 0), 1)
);

export const METER_GRID_LABELS = Object.freeze(METER_GRID_DECIBELS.map(String));

export const drawWaveCandyMeterGrid = (ctx, width, height) => {
  const startX = width * 0.16;
  const endX = width * 0.84;
  const y0 = height - METER_GRID_RATIOS[0] * height;
  const y1 = height - METER_GRID_RATIOS[1] * height;
  const y2 = height - METER_GRID_RATIOS[2] * height;
  const y3 = height - METER_GRID_RATIOS[3] * height;
  const y4 = height - METER_GRID_RATIOS[4] * height;

  ctx.beginPath();
  ctx.moveTo(startX, y0);
  ctx.lineTo(endX, y0);
  ctx.moveTo(startX, y1);
  ctx.lineTo(endX, y1);
  ctx.moveTo(startX, y2);
  ctx.lineTo(endX, y2);
  ctx.moveTo(startX, y3);
  ctx.lineTo(endX, y3);
  ctx.moveTo(startX, y4);
  ctx.lineTo(endX, y4);
  ctx.stroke();

  ctx.fillText(METER_GRID_LABELS[0], 2, y0 + 3);
  ctx.fillText(METER_GRID_LABELS[1], 2, y1 + 3);
  ctx.fillText(METER_GRID_LABELS[2], 2, y2 + 3);
  ctx.fillText(METER_GRID_LABELS[3], 2, y3 + 3);
  ctx.fillText(METER_GRID_LABELS[4], 2, y4 + 3);
};
