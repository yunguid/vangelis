import { describe, expect, it, vi } from 'vitest';
import { scheduleDeferredVisualMount } from './useDeferredVisualMount.js';

const createHarness = (visibilityState = 'visible') => {
  const frameCallbacks = new Map();
  const idleCallbacks = new Map();
  const timeoutCallbacks = new Map();
  const visibilityListeners = new Set();
  let nextId = 1;
  const documentRef = {
    visibilityState,
    addEventListener: vi.fn((name, listener) => {
      if (name === 'visibilitychange') visibilityListeners.add(listener);
    }),
    removeEventListener: vi.fn((name, listener) => {
      if (name === 'visibilitychange') visibilityListeners.delete(listener);
    }),
    setVisibility(nextState) {
      this.visibilityState = nextState;
      visibilityListeners.forEach((listener) => listener());
    }
  };
  const windowRef = {
    requestAnimationFrame: vi.fn((callback) => {
      const id = nextId++;
      frameCallbacks.set(id, callback);
      return id;
    }),
    cancelAnimationFrame: vi.fn((id) => frameCallbacks.delete(id)),
    requestIdleCallback: vi.fn((callback) => {
      const id = nextId++;
      idleCallbacks.set(id, callback);
      return id;
    }),
    cancelIdleCallback: vi.fn((id) => idleCallbacks.delete(id)),
    setTimeout: vi.fn((callback) => {
      const id = nextId++;
      timeoutCallbacks.set(id, callback);
      return id;
    }),
    clearTimeout: vi.fn((id) => timeoutCallbacks.delete(id))
  };
  return { documentRef, windowRef, frameCallbacks, idleCallbacks, timeoutCallbacks };
};

describe('scheduleDeferredVisualMount', () => {
  it('waits for a minimum post-paint delay and then an idle slot before activating', () => {
    const harness = createHarness();
    const activate = vi.fn();
    scheduleDeferredVisualMount(activate, { ...harness, delayMs: 700 });

    expect(activate).not.toHaveBeenCalled();
    expect(harness.windowRef.requestAnimationFrame).toHaveBeenCalledTimes(1);
    harness.frameCallbacks.get(1)(16);
    expect(activate).not.toHaveBeenCalled();
    expect(harness.windowRef.setTimeout).toHaveBeenCalledWith(expect.any(Function), 700);
    harness.timeoutCallbacks.get(2)();
    expect(activate).not.toHaveBeenCalled();
    expect(harness.windowRef.requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 250 }
    );
    harness.idleCallbacks.get(3)();
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('does not allocate visual work while the document is hidden', () => {
    const harness = createHarness('hidden');
    scheduleDeferredVisualMount(vi.fn(), harness);

    expect(harness.windowRef.requestAnimationFrame).not.toHaveBeenCalled();
    harness.documentRef.setVisibility('visible');
    expect(harness.windowRef.requestAnimationFrame).toHaveBeenCalledTimes(1);

    harness.frameCallbacks.get(1)(16);
    harness.documentRef.setVisibility('hidden');
    expect(harness.windowRef.clearTimeout).toHaveBeenCalledWith(2);
    harness.documentRef.setVisibility('visible');
    expect(harness.windowRef.requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('keeps the minimum delay when requestIdleCallback is unavailable', () => {
    const harness = createHarness();
    const activate = vi.fn();
    delete harness.windowRef.requestIdleCallback;
    delete harness.windowRef.cancelIdleCallback;
    scheduleDeferredVisualMount(activate, { ...harness, delayMs: 700 });

    harness.frameCallbacks.get(1)(16);
    harness.timeoutCallbacks.get(2)();
    expect(activate).not.toHaveBeenCalled();
    expect(harness.windowRef.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 0);
    harness.timeoutCallbacks.get(3)();
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('cancels pending frame, delay, and idle work on unmount', () => {
    const harness = createHarness();
    const activate = vi.fn();
    const cancelFrameStage = scheduleDeferredVisualMount(activate, harness);
    cancelFrameStage();
    expect(harness.windowRef.cancelAnimationFrame).toHaveBeenCalledWith(1);

    const second = createHarness();
    const cancelDelayStage = scheduleDeferredVisualMount(activate, second);
    second.frameCallbacks.get(1)(16);
    cancelDelayStage();
    expect(second.windowRef.clearTimeout).toHaveBeenCalledWith(2);

    const third = createHarness();
    const cancelIdleStage = scheduleDeferredVisualMount(activate, third);
    third.frameCallbacks.get(1)(16);
    third.timeoutCallbacks.get(2)();
    cancelIdleStage();
    expect(third.windowRef.cancelIdleCallback).toHaveBeenCalledWith(3);
    expect(activate).not.toHaveBeenCalled();
  });
});
