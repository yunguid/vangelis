import { describe, expect, it } from 'vitest';
import {
  createSpectrogramColorLut,
  createSpectrogramRowRuns
} from './spectrogramRendering.js';

describe('spectrogramRendering', () => {
  it('builds a bounded ember-to-amber color lookup table', () => {
    const colors = createSpectrogramColorLut(256);
    expect(colors).toHaveLength(256);
    expect(colors[0]).toBe('hsl(30, 60%, 6%)');
    expect(colors[255]).toBe('hsl(16, 90%, 72%)');
  });

  it('covers every output row exactly once with the original cell mapping', () => {
    const height = 150;
    const cells = 96;
    const runs = createSpectrogramRowRuns({ height, cells });
    const rows = new Int16Array(height).fill(-1);

    for (let cell = 0; cell < cells; cell += 1) {
      const canvasY = runs[cell * 2];
      const runHeight = runs[cell * 2 + 1];
      for (let y = canvasY; y < canvasY + runHeight; y += 1) {
        expect(rows[y]).toBe(-1);
        rows[y] = cell;
      }
    }

    expect([...rows].every((cell) => cell >= 0)).toBe(true);
    for (let canvasY = 0; canvasY < height; canvasY += 1) {
      const sourceY = height - 1 - canvasY;
      expect(rows[canvasY]).toBe(Math.floor((sourceY / height) * cells));
    }
  });
});
