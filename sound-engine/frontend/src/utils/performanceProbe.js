const percentile = (values, ratio) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)];
};

export function getDomStats(root = document.documentElement) {
  if (!root) return { nodes: 0, maxDepth: 0, canvases: 0 };
  let nodes = 0;
  let maxDepth = 0;
  let canvases = 0;
  const stack = [{ node: root, depth: 1 }];

  while (stack.length > 0) {
    const { node, depth } = stack.pop();
    nodes += 1;
    if (depth > maxDepth) maxDepth = depth;
    if (node.tagName === 'CANVAS') canvases += 1;
    for (const child of node.children || []) {
      stack.push({ node: child, depth: depth + 1 });
    }
  }

  return { nodes, maxDepth, canvases };
}

const rounded = (value) => Number((value || 0).toFixed(2));

export function startPerformanceProbe({
  performanceRef = performance,
  documentRef = document,
  windowRef = window,
  reportToConsole = false
} = {}) {
  const state = {
    fcp: 0,
    lcp: 0,
    cls: 0,
    longTasks: [],
    events: [],
    routeTransitions: [],
    manualInteractions: []
  };
  const observers = [];
  const supported = new Set(globalThis.PerformanceObserver?.supportedEntryTypes || []);
  const pendingRouteTransitions = new Map();
  let reportSnapshot = () => {};

  const observe = (type, onEntries, extra = {}) => {
    if (typeof PerformanceObserver === 'undefined' || !supported.has(type)) return;
    try {
      const observer = new PerformanceObserver((list) => onEntries(list.getEntries()));
      observer.observe({ type, buffered: true, ...extra });
      observers.push(observer);
    } catch (_) {
      // Some browsers expose an entry type but reject newer options.
    }
  };

  observe('paint', (entries) => {
    const fcp = entries.find((entry) => entry.name === 'first-contentful-paint');
    if (fcp) {
      state.fcp = fcp.startTime;
      reportSnapshot('paint');
    }
  });
  observe('largest-contentful-paint', (entries) => {
    const latest = entries[entries.length - 1];
    if (latest) {
      state.lcp = latest.startTime;
      reportSnapshot('lcp');
    }
  });
  observe('layout-shift', (entries) => {
    for (const entry of entries) {
      if (!entry.hadRecentInput) state.cls += entry.value;
    }
  });
  observe('longtask', (entries) => {
    state.longTasks.push(...entries.map((entry) => entry.duration));
  });
  observe('event', (entries) => {
    state.events.push(...entries.map((entry) => entry.duration));
  }, { durationThreshold: 16 });

  const nextFrame = windowRef.requestAnimationFrame.bind(windowRef);
  const handleRouteChange = () => {
    const route = windowRef.location.hash || '#/';
    if (pendingRouteTransitions.has(route)) return;
    const start = performanceRef.now();
    const transition = {
      route,
      start,
      timestamp: Date.now(),
      nextPaintMs: null
    };
    pendingRouteTransitions.set(route, transition);
    nextFrame(() => nextFrame(() => {
      transition.nextPaintMs = performanceRef.now() - start;
    }));
  };
  windowRef.addEventListener('hashchange', handleRouteChange);
  windowRef.addEventListener('popstate', handleRouteChange);

  const snapshot = () => {
    const navigation = performanceRef.getEntriesByType('navigation')[0];
    const resources = performanceRef.getEntriesByType('resource');
    const memory = performanceRef.memory;
    return {
      route: windowRef.location.hash || '#/',
      capturedAt: new Date().toISOString(),
      environment: {
        userAgent: windowRef.navigator?.userAgent || '',
        hardwareConcurrency: windowRef.navigator?.hardwareConcurrency || null,
        deviceMemoryGb: windowRef.navigator?.deviceMemory || null,
        viewport: {
          width: windowRef.innerWidth || 0,
          height: windowRef.innerHeight || 0,
          dpr: windowRef.devicePixelRatio || 1
        },
        visibility: documentRef.visibilityState || 'unknown'
      },
      navigation: navigation ? {
        ttfbMs: rounded(navigation.responseStart - navigation.requestStart),
        domContentLoadedMs: rounded(navigation.domContentLoadedEventEnd),
        loadMs: rounded(navigation.loadEventEnd)
      } : null,
      vitals: {
        fcpMs: rounded(state.fcp),
        lcpMs: rounded(state.lcp),
        cls: Number(state.cls.toFixed(4)),
        interactionP95Ms: rounded(percentile(state.events, 0.95)),
        interactionMaxMs: rounded(Math.max(0, ...state.events))
      },
      mainThread: {
        longTaskCount: state.longTasks.length,
        longTaskTotalMs: rounded(state.longTasks.reduce((sum, value) => sum + value, 0)),
        worstLongTaskMs: rounded(Math.max(0, ...state.longTasks))
      },
      resources: {
        count: resources.length,
        transferKb: rounded(resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0) / 1024),
        decodedKb: rounded(resources.reduce((sum, entry) => sum + (entry.decodedBodySize || 0), 0) / 1024),
        workletRequests: resources.filter((entry) => /worklet/i.test(entry.name)).length
      },
      dom: getDomStats(documentRef.documentElement),
      memory: memory ? {
        usedJsHeapMb: rounded(memory.usedJSHeapSize / 1024 / 1024),
        totalJsHeapMb: rounded(memory.totalJSHeapSize / 1024 / 1024)
      } : null,
      routeTransitions: [...state.routeTransitions],
      manualInteractions: [...state.manualInteractions]
    };
  };

  const measureInteraction = async (name, operation) => {
    const start = performanceRef.now();
    try {
      return await operation();
    } finally {
      state.manualInteractions.push({
        name,
        durationMs: performanceRef.now() - start,
        route: windowRef.location.hash || '#/',
        timestamp: Date.now()
      });
    }
  };

  const markRouteReady = (route = windowRef.location.hash || '#/') => {
    const transition = pendingRouteTransitions.get(route);
    if (!transition) return;
    nextFrame(() => nextFrame(() => {
      const interactiveMs = performanceRef.now() - transition.start;
      state.routeTransitions.push({
        route,
        nextPaintMs: transition.nextPaintMs ?? interactiveMs,
        interactiveMs,
        timestamp: transition.timestamp
      });
      pendingRouteTransitions.delete(route);
      reportSnapshot('route-ready');
    }));
  };

  reportSnapshot = (phase = 'manual') => {
    if (!reportToConsole) return null;
    const report = snapshot();
    windowRef.console?.info?.('[vangelis-perf]', phase, JSON.stringify(report));
    return report;
  };

  const api = {
    snapshot,
    markRouteReady,
    reportSnapshot,
    measureInteraction,
    exportJson: () => JSON.stringify(snapshot(), null, 2),
    reset() {
      state.longTasks.length = 0;
      state.events.length = 0;
      state.routeTransitions.length = 0;
      state.manualInteractions.length = 0;
      state.cls = 0;
      pendingRouteTransitions.clear();
    },
    stop() {
      observers.forEach((observer) => observer.disconnect());
      windowRef.removeEventListener('hashchange', handleRouteChange);
      windowRef.removeEventListener('popstate', handleRouteChange);
      pendingRouteTransitions.clear();
      if (windowRef.__vangelisPerf === api) delete windowRef.__vangelisPerf;
    }
  };

  windowRef.__vangelisPerf?.stop?.();
  windowRef.__vangelisPerf = api;
  nextFrame(() => nextFrame(() => reportSnapshot('initial')));
  return api;
}

export { percentile };
