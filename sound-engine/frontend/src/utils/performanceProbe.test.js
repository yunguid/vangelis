import { describe, expect, it } from 'vitest';
import {
  getDomStats,
  percentile,
  PERFORMANCE_SETTLED_REPORT_DELAY_MS,
  startPerformanceProbe
} from './performanceProbe.js';

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

  it('reports an opt-in snapshot after the initial paint boundary', () => {
    const reports = [];
    const timeouts = [];
    const documentElement = document.createElement('html');
    const performanceRef = {
      now: () => 24,
      getEntriesByType: (type) => (type === 'navigation' ? [{
        requestStart: 1,
        responseStart: 3,
        domContentLoadedEventEnd: 12,
        loadEventEnd: 20
      }] : [])
    };
    const windowRef = {
      location: { hash: '#/' },
      requestAnimationFrame: (callback) => {
        callback();
        return 1;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout: (callback, delay) => {
        timeouts.push({ callback, delay });
        return timeouts.length;
      },
      clearTimeout: () => {},
      console: { info: (...args) => reports.push(args) }
    };

    const probe = startPerformanceProbe({
      performanceRef,
      documentRef: { documentElement },
      windowRef,
      reportToConsole: true
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].slice(0, 2)).toEqual(['[vangelis-perf]', 'initial']);
    expect(JSON.parse(reports[0][2])).toMatchObject({
      route: '#/',
      navigation: { ttfbMs: 2, domContentLoadedMs: 12, loadMs: 20 },
      dom: { nodes: 1, maxDepth: 1, canvases: 0 }
    });
    expect(timeouts).toHaveLength(1);
    expect(timeouts[0].delay).toBe(PERFORMANCE_SETTLED_REPORT_DELAY_MS);
    timeouts[0].callback();
    expect(reports[1].slice(0, 2)).toEqual(['[vangelis-perf]', 'settled']);
    probe.stop();
  });

  it('separates fallback paint from the painted interactive route', () => {
    let hashchangeListener;
    const times = [10, 18, 26];
    const performanceRef = {
      now: () => times.shift(),
      getEntriesByType: () => []
    };
    const windowRef = {
      location: { hash: '#/' },
      requestAnimationFrame: (callback) => {
        callback();
        return 1;
      },
      addEventListener: (type, listener) => {
        if (type === 'hashchange') hashchangeListener = listener;
      },
      removeEventListener: () => {}
    };
    const probe = startPerformanceProbe({
      performanceRef,
      documentRef: { documentElement: document.createElement('html') },
      windowRef
    });

    windowRef.location.hash = '#/voice-loop';
    hashchangeListener();
    probe.markRouteReady('#/voice-loop');

    expect(probe.snapshot().routeTransitions).toEqual([{
      route: '#/voice-loop',
      nextPaintMs: 8,
      interactiveMs: 16,
      timestamp: expect.any(Number)
    }]);
    probe.stop();
  });
});
