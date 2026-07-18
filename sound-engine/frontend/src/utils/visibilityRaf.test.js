import { describe, expect, it, vi } from 'vitest';
import { startVisibilityAwareRafLoop } from './visibilityRaf.js';

const createDocument = (visibilityState = 'visible') => {
  const listeners = new Set();
  return {
    visibilityState,
    addEventListener: vi.fn((type, listener) => {
      if (type === 'visibilitychange') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type, listener) => {
      if (type === 'visibilitychange') listeners.delete(listener);
    }),
    setVisibility(nextState) {
      this.visibilityState = nextState;
      listeners.forEach((listener) => listener());
    }
  };
};

describe('startVisibilityAwareRafLoop', () => {
  it('does not schedule work until a hidden document becomes visible', () => {
    const documentRef = createDocument('hidden');
    const requestFrame = vi.fn();

    const stop = startVisibilityAwareRafLoop(vi.fn(), {
      documentRef,
      requestFrame,
      cancelFrame: vi.fn()
    });

    expect(requestFrame).not.toHaveBeenCalled();
    documentRef.setVisibility('visible');
    expect(requestFrame).toHaveBeenCalledTimes(1);
    stop();
  });

  it('cancels the pending frame while hidden and resumes with one frame', () => {
    const documentRef = createDocument();
    const callbacks = new Map();
    let nextId = 1;
    const requestFrame = vi.fn((callback) => {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    });
    const cancelFrame = vi.fn((id) => callbacks.delete(id));
    const callback = vi.fn();

    const stop = startVisibilityAwareRafLoop(callback, {
      documentRef,
      requestFrame,
      cancelFrame
    });

    expect(requestFrame).toHaveBeenCalledTimes(1);
    callbacks.get(1)(16);
    expect(callback).toHaveBeenCalledWith(16);
    expect(requestFrame).toHaveBeenCalledTimes(2);

    documentRef.setVisibility('hidden');
    expect(cancelFrame).toHaveBeenCalledWith(2);
    expect(callback).toHaveBeenCalledTimes(1);

    documentRef.setVisibility('visible');
    documentRef.setVisibility('visible');
    expect(requestFrame).toHaveBeenCalledTimes(3);
    stop();
    expect(cancelFrame).toHaveBeenCalledWith(3);
    expect(documentRef.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
