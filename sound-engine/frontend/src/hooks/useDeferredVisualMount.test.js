import { describe, expect, it, vi } from 'vitest';
import { scheduleDeferredVisualMount } from './useDeferredVisualMount.js';

const createHarness = (visibilityState = 'visible') => {
  const frameCallbacks = new Map();
  const idleCallbacks = new Map();
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
    setTimeout: vi.fn(),
    clearTimeout: vi.fn()
  };
  return { documentRef, windowRef, frameCallbacks, idleCallbacks };
};

describe('scheduleDeferredVisualMount', () => {
  it('waits for a post-paint idle slot before activating', () => {
    const harness = createHarness();
    const activate = vi.fn();
    scheduleDeferredVisualMount(activate, { ...harness, timeoutMs: 700 });

    expect(activate).not.toHaveBeenCalled();
    expect(harness.windowRef.requestAnimationFrame).toHaveBeenCalledTimes(1);
    harness.frameCallbacks.get(1)(16);
    expect(activate).not.toHaveBeenCalled();
    expect(harness.windowRef.requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 700 }
    );
    harness.idleCallbacks.get(2)();
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
    expect(harness.windowRef.cancelIdleCallback).toHaveBeenCalledWith(2);
    harness.documentRef.setVisibility('visible');
    expect(harness.windowRef.requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('cancels pending frame and idle work on unmount', () => {
    const harness = createHarness();
    const activate = vi.fn();
    const cancelFrameStage = scheduleDeferredVisualMount(activate, harness);
    cancelFrameStage();
    expect(harness.windowRef.cancelAnimationFrame).toHaveBeenCalledWith(1);

    const second = createHarness();
    const cancelIdleStage = scheduleDeferredVisualMount(activate, second);
    second.frameCallbacks.get(1)(16);
    cancelIdleStage();
    expect(second.windowRef.cancelIdleCallback).toHaveBeenCalledWith(2);
    expect(activate).not.toHaveBeenCalled();
  });
});
