import { describe, expect, it, vi } from 'vitest';
import {
  createRadarStaticGradientCache,
  getRadarStaticGradients
} from './radarGradientCache.js';

const createContext = () => {
  const createGradient = () => ({ addColorStop: vi.fn() });
  return {
    createLinearGradient: vi.fn(createGradient),
    createRadialGradient: vi.fn(createGradient)
  };
};

describe('radarGradientCache', () => {
  it('reuses all four static gradients until dimensions change', () => {
    const context = createContext();
    const cache = createRadarStaticGradientCache();
    const first = getRadarStaticGradients(context, cache, 800, 300, 26);
    const second = getRadarStaticGradients(context, cache, 800, 300, 26);

    expect(second).toBe(first);
    expect(context.createLinearGradient).toHaveBeenCalledTimes(2);
    expect(context.createRadialGradient).toHaveBeenCalledTimes(2);

    const resized = getRadarStaticGradients(context, cache, 900, 300, 26);
    expect(resized).not.toBe(first);
    expect(context.createLinearGradient).toHaveBeenCalledTimes(4);
    expect(context.createRadialGradient).toHaveBeenCalledTimes(4);
  });
});
