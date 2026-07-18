import { describe, expect, it } from 'vitest';
import { getDomStats, percentile } from './performanceProbe.js';

describe('performanceProbe helpers', () => {
  it('computes stable percentile boundaries', () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([8, 2, 4, 6], 0.5)).toBe(4);
    expect(percentile([8, 2, 4, 6], 0.95)).toBe(8);
  });

  it('counts DOM nodes, depth, and canvases', () => {
    const root = document.createElement('main');
    root.innerHTML = '<section><div><canvas></canvas></div></section><aside></aside>';
    expect(getDomStats(root)).toEqual({ nodes: 5, maxDepth: 4, canvases: 1 });
  });
});
