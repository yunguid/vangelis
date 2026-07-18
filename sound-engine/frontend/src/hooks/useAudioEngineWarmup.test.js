import { describe, expect, it, vi } from 'vitest';
import { scheduleAudioEngineWarmup } from './useAudioEngineWarmup.js';

const createHarness = () => {
  const listeners = new Map();
  let idleCallback = null;
  const engine = {
    ensureWasm: vi.fn(() => Promise.resolve()),
    warmGraph: vi.fn(() => Promise.resolve())
  };
  const windowRef = {
    addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
    removeEventListener: vi.fn((name) => listeners.delete(name)),
    requestIdleCallback: vi.fn((callback) => {
      idleCallback = callback;
      return 17;
    }),
    cancelIdleCallback: vi.fn(),
    setTimeout: vi.fn(),
    clearTimeout: vi.fn()
  };
  return { engine, windowRef, listeners, getIdleCallback: () => idleCallback };
};

describe('scheduleAudioEngineWarmup', () => {
  it('leaves audio cold until idle time or a real interaction', () => {
    const harness = createHarness();
    scheduleAudioEngineWarmup(harness);

    expect(harness.engine.ensureWasm).not.toHaveBeenCalled();
    expect(harness.engine.warmGraph).not.toHaveBeenCalled();
    expect(harness.windowRef.requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 1200 }
    );
  });

  it('warms once on the first captured interaction', async () => {
    const harness = createHarness();
    scheduleAudioEngineWarmup(harness);

    harness.listeners.get('pointerdown')();

    expect(harness.engine.ensureWasm).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(harness.engine.warmGraph).toHaveBeenCalledTimes(1);
    });
    harness.getIdleCallback()();
    expect(harness.engine.ensureWasm).toHaveBeenCalledTimes(1);
  });

  it('cancels idle and interaction work when its route unmounts', () => {
    const harness = createHarness();
    const cancel = scheduleAudioEngineWarmup(harness);

    cancel();
    harness.getIdleCallback()();

    expect(harness.windowRef.cancelIdleCallback).toHaveBeenCalledWith(17);
    expect(harness.engine.ensureWasm).not.toHaveBeenCalled();
  });
});
