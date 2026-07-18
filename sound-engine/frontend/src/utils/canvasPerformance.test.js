import { describe, expect, it, vi } from 'vitest';
import { createCanvasSizeController, getCappedDevicePixelRatio } from './canvasPerformance.js';

describe('getCappedDevicePixelRatio', () => {
  it('caps high-density displays to the requested render budget', () => {
    expect(getCappedDevicePixelRatio(1.5, 2)).toBe(1.5);
    expect(getCappedDevicePixelRatio(1.25, 3)).toBe(1.25);
  });

  it('keeps standard-density and invalid values at a safe minimum', () => {
    expect(getCappedDevicePixelRatio(1.5, 1)).toBe(1);
    expect(getCappedDevicePixelRatio(1.5, 0)).toBe(1);
  });
});

describe('createCanvasSizeController', () => {
  it('measures on resize events instead of requiring hot-loop layout reads', () => {
    const listeners = new Map();
    const windowRef = {
      devicePixelRatio: 2,
      addEventListener: (type, listener) => listeners.set(type, listener),
      removeEventListener: (type) => listeners.delete(type)
    };
    const canvas = {
      width: 0,
      height: 0,
      getBoundingClientRect: vi.fn(() => ({ width: 200, height: 100 }))
    };
    const context = { setTransform: vi.fn() };

    const controller = createCanvasSizeController(canvas, context, {
      dprCap: 1.5,
      windowRef,
      ResizeObserverClass: undefined
    });

    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(150);
    expect(controller.size).toMatchObject({ width: 200, height: 100, dpr: 1.5 });
    expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(1);

    controller.acknowledgeResize();
    expect(controller.size.resized).toBe(false);
    listeners.get('resize')();
    expect(canvas.getBoundingClientRect).toHaveBeenCalledTimes(2);
    controller.disconnect();
    expect(listeners.has('resize')).toBe(false);
  });
});
