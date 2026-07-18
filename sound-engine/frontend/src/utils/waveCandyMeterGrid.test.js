import { describe, expect, it, vi } from 'vitest';
import {
  METER_GRID_LABELS,
  METER_GRID_RATIOS,
  drawWaveCandyMeterGrid
} from './waveCandyMeterGrid.js';

describe('drawWaveCandyMeterGrid', () => {
  it('batches all guide lines into one path while retaining label geometry and paint order', () => {
    const calls = [];
    const context = {
      beginPath: vi.fn(() => calls.push(['beginPath'])),
      moveTo: vi.fn((x, y) => calls.push(['moveTo', x, y])),
      lineTo: vi.fn((x, y) => calls.push(['lineTo', x, y])),
      stroke: vi.fn(() => calls.push(['stroke'])),
      fillText: vi.fn((label, x, y) => calls.push(['fillText', label, x, y]))
    };

    drawWaveCandyMeterGrid(context, 100, 80);

    expect(context.beginPath).toHaveBeenCalledTimes(1);
    expect(context.moveTo).toHaveBeenCalledTimes(5);
    expect(context.lineTo).toHaveBeenCalledTimes(5);
    expect(context.stroke).toHaveBeenCalledTimes(1);
    expect(context.fillText).toHaveBeenCalledTimes(5);
    expect(context.moveTo.mock.calls).toEqual(
      Array.from(METER_GRID_RATIOS, (ratio) => [16, 80 - ratio * 80])
    );
    expect(context.lineTo.mock.calls).toEqual(
      Array.from(METER_GRID_RATIOS, (ratio) => [84, 80 - ratio * 80])
    );
    expect(context.fillText.mock.calls).toEqual(
      Array.from(METER_GRID_RATIOS, (ratio, index) => [
        METER_GRID_LABELS[index],
        2,
        83 - ratio * 80
      ])
    );
    expect(calls.findIndex(([type]) => type === 'stroke')).toBeLessThan(
      calls.findIndex(([type]) => type === 'fillText')
    );
  });
});
