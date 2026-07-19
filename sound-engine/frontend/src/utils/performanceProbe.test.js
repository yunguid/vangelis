import { describe, expect, it } from 'vitest';
import {
  getDomStats,
  percentile,
  PERFORMANCE_HISTORY_LIMIT,
  PERFORMANCE_SETTLED_REPORT_DELAY_MS,
  runRouteLifecycleProfile,
  startPerformanceProbe,
  summarizeInteractions
} from './performanceProbe.js';

describe('performanceProbe helpers', () => {
  it('computes stable percentile boundaries', () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([8, 2, 4, 6], 0.5)).toBe(4);
    expect(percentile([8, 2, 4, 6], 0.95)).toBe(8);
  });

  it('summarizes named interaction distributions without mixing scenarios', () => {
    expect(summarizeInteractions([
      { name: 'input.keydown', durationMs: 1 },
      { name: 'input.keydown', durationMs: 4 },
      { name: 'input.keydown', durationMs: 2 },
      { name: 'ui.sidebar.paint', durationMs: 12 },
      { name: '', durationMs: 99 },
      { name: 'invalid', durationMs: Number.NaN }
    ])).toEqual({
      'input.keydown': { count: 3, p50Ms: 2, p95Ms: 4, maxMs: 4 },
      'ui.sidebar.paint': { count: 1, p50Ms: 12, p95Ms: 12, maxMs: 12 }
    });
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
      dom: { nodes: 1, maxDepth: 1, canvases: 0 },
      routeTransitionCount: 0,
      routeTransitions: [],
      manualInteractionCount: 0,
      manualInteractions: []
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

  it('resolves route readiness when the app listener runs before the probe listener', () => {
    let hashchangeListener;
    const frameCallbacks = [];
    const times = [10, 18, 26];
    const windowRef = {
      location: { hash: '#/' },
      requestAnimationFrame: (callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      },
      addEventListener: (type, listener) => {
        if (type === 'hashchange') hashchangeListener = listener;
      },
      removeEventListener: () => {}
    };
    const probe = startPerformanceProbe({
      performanceRef: { now: () => times.shift(), getEntriesByType: () => [] },
      documentRef: { documentElement: document.createElement('html') },
      windowRef
    });

    windowRef.location.hash = '#/sound-designer';
    probe.markRouteReady('#/sound-designer');
    hashchangeListener();
    while (frameCallbacks.length > 0) frameCallbacks.shift()();

    expect(probe.snapshot().routeTransitions).toEqual([{
      route: '#/sound-designer',
      nextPaintMs: 8,
      interactiveMs: 16,
      timestamp: expect.any(Number)
    }]);
    probe.stop();
  });

  it('bounds retained profiling histories', async () => {
    const frameCallbacks = [];
    let hashchangeListener;
    let now = 0;
    const windowRef = {
      location: { hash: '#/' },
      requestAnimationFrame: (callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      },
      addEventListener: (type, listener) => {
        if (type === 'hashchange') hashchangeListener = listener;
      },
      removeEventListener: () => {}
    };
    const probe = startPerformanceProbe({
      performanceRef: { now: () => ++now, getEntriesByType: () => [] },
      documentRef: { documentElement: document.createElement('html') },
      windowRef
    });

    for (let index = 0; index < PERFORMANCE_HISTORY_LIMIT + 5; index += 1) {
      windowRef.location.hash = `#/route-${index}`;
      hashchangeListener();
      probe.markRouteReady(windowRef.location.hash);
      while (frameCallbacks.length > 0) frameCallbacks.shift()();
      await probe.measureInteraction(`interaction-${index}`, async () => undefined);
    }

    const snapshot = probe.snapshot();
    expect(snapshot.routeTransitions).toHaveLength(PERFORMANCE_HISTORY_LIMIT);
    expect(snapshot.routeTransitions[0].route).toBe('#/route-5');
    expect(snapshot.manualInteractions).toHaveLength(PERFORMANCE_HISTORY_LIMIT);
    expect(snapshot.manualInteractions[0].name).toBe('interaction-5');
    probe.stop();
  });

  it('records sync and painted interactions with bounded details and summaries', () => {
    const frameCallbacks = [];
    const times = [10, 26];
    const windowRef = {
      location: { hash: '#/' },
      requestAnimationFrame: (callback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      },
      addEventListener: () => {},
      removeEventListener: () => {}
    };
    const probe = startPerformanceProbe({
      performanceRef: { now: () => times.shift(), getEntriesByType: () => [] },
      documentRef: { documentElement: document.createElement('html') },
      windowRef
    });

    while (frameCallbacks.length > 0) frameCallbacks.shift()();
    expect(probe.recordInteraction('input.keydown', 3, { input: 'keyboard' })).toMatchObject({
      name: 'input.keydown',
      durationMs: 3,
      details: { input: 'keyboard' }
    });
    expect(probe.recordInteraction('invalid', -1)).toBeNull();
    probe.markInteractionPaint('ui.sidebar.paint', { tab: 'sound' });
    while (frameCallbacks.length > 0) frameCallbacks.shift()();

    expect(probe.snapshot()).toMatchObject({
      manualInteractions: [
        { name: 'input.keydown', durationMs: 3, details: { input: 'keyboard' } },
        { name: 'ui.sidebar.paint', durationMs: 16, details: { tab: 'sound' } }
      ],
      interactionSummary: {
        'input.keydown': { count: 1, p50Ms: 3, p95Ms: 3, maxMs: 3 },
        'ui.sidebar.paint': { count: 1, p50Ms: 16, p95Ms: 16, maxMs: 16 }
      }
    });
    probe.stop();
  });

  it('cancels pending painted interactions on reset', () => {
    const frameCallbacks = [];
    let now = 0;
    const probe = startPerformanceProbe({
      performanceRef: { now: () => ++now, getEntriesByType: () => [] },
      documentRef: { documentElement: document.createElement('html') },
      windowRef: {
        location: { hash: '#/' },
        requestAnimationFrame: (callback) => {
          frameCallbacks.push(callback);
          return frameCallbacks.length;
        },
        addEventListener: () => {},
        removeEventListener: () => {}
      }
    });

    while (frameCallbacks.length > 0) frameCallbacks.shift()();
    probe.markInteractionPaint('ui.cancelled.paint');
    probe.reset();
    while (frameCallbacks.length > 0) frameCallbacks.shift()();
    expect(probe.snapshot().manualInteractions).toEqual([]);
    probe.stop();
  });

  it('runs a quiet route lifecycle profile with bounded checkpoints', async () => {
    let snapshotIndex = 0;
    const windowRef = {
      location: { hash: '#/' },
      setTimeout: (callback) => {
        callback();
        return 1;
      }
    };
    const report = await runRouteLifecycleProfile({
      performanceProbe: {
        snapshot: () => ({ sample: ++snapshotIndex, route: windowRef.location.hash })
      },
      windowRef,
      cycles: 2,
      settleMs: 0
    });

    expect(report).toMatchObject({
      cycles: 2,
      settleMs: 0,
      routes: ['#/sound-designer', '#/'],
      checkpoints: [
        {
          cycle: 1,
          route: '#/sound-designer',
          snapshot: { sample: 1, route: '#/sound-designer' }
        },
        { cycle: 1, route: '#/', snapshot: { sample: 2, route: '#/' } },
        {
          cycle: 2,
          route: '#/sound-designer',
          snapshot: { sample: 3, route: '#/sound-designer' }
        },
        { cycle: 2, route: '#/', snapshot: { sample: 4, route: '#/' } }
      ]
    });
  });

  it('reports a profiling-only settled snapshot after each route transition', () => {
    let hashchangeListener;
    const reports = [];
    const timeouts = [];
    const windowRef = {
      location: { hash: '#/' },
      requestAnimationFrame: (callback) => {
        callback();
        return 1;
      },
      addEventListener: (type, listener) => {
        if (type === 'hashchange') hashchangeListener = listener;
      },
      removeEventListener: () => {},
      setTimeout: (callback, delay) => {
        timeouts.push({ callback, delay });
        return timeouts.length;
      },
      clearTimeout: () => {},
      console: { info: (...args) => reports.push(args) }
    };
    const probe = startPerformanceProbe({
      performanceRef: { now: () => 10, getEntriesByType: () => [] },
      documentRef: { documentElement: document.createElement('html') },
      windowRef,
      reportToConsole: true
    });

    windowRef.location.hash = '#/sound-designer';
    hashchangeListener();
    expect(timeouts).toHaveLength(2);
    expect(timeouts[1].delay).toBe(PERFORMANCE_SETTLED_REPORT_DELAY_MS);
    timeouts[1].callback();
    expect(reports.at(-1).slice(0, 2)).toEqual(['[vangelis-perf]', 'route-settled']);
    expect(JSON.parse(reports.at(-1)[2]).route).toBe('#/sound-designer');
    probe.stop();
  });
});
