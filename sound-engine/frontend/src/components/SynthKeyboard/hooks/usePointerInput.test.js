import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePointerInput } from './usePointerInput.js';

const originalElementFromPoint = Object.getOwnPropertyDescriptor(document, 'elementFromPoint');

describe('usePointerInput', () => {
  afterEach(() => {
    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', originalElementFromPoint);
    } else {
      delete document.elementFromPoint;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('coalesces raw glissando samples to the latest position per frame', () => {
    const listeners = new Map();
    const container = {
      addEventListener: vi.fn((name, listener, options) => {
        listeners.set(name, { listener, options });
      }),
      removeEventListener: vi.fn()
    };
    const pointerToNoteRef = { current: new Map([[7, 'C4']]) };
    const switchPointerNote = vi.fn();
    const stopNote = vi.fn();
    const keyElement = {
      dataset: {
        note: 'D4',
        name: 'D',
        octave: '4',
        frequency: '293.66'
      },
      closest: vi.fn(() => keyElement)
    };
    const elementFromPoint = vi.fn(() => keyElement);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: elementFromPoint
    });
    let scheduledFrame = null;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      scheduledFrame = callback;
      return 19;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    renderHook(() => usePointerInput({
      keyboardRef: { current: container },
      pointerToNoteRef,
      startNote: vi.fn(),
      stopNote,
      switchPointerNote,
      touchVelocityRef: { current: 0.85 }
    }));

    const pointerMove = listeners.get('pointermove');
    expect(pointerMove.options).toEqual({ passive: true });
    act(() => {
      for (let sample = 0; sample < 4; sample += 1) {
        pointerMove.listener({
          pointerId: 7,
          clientX: 20 + sample,
          clientY: 30 + sample,
          pressure: 0
        });
      }
    });

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(elementFromPoint).not.toHaveBeenCalled();
    act(() => scheduledFrame());
    expect(elementFromPoint).toHaveBeenCalledTimes(1);
    expect(elementFromPoint).toHaveBeenCalledWith(23, 33);
    expect(switchPointerNote).toHaveBeenCalledWith(7, {
      noteId: 'D4',
      noteName: 'D',
      octave: 4,
      frequency: 293.66
    }, 0.85);

    act(() => {
      pointerMove.listener({
        pointerId: 7,
        clientX: 40,
        clientY: 50,
        pressure: 0.5
      });
      listeners.get('pointerup').listener({
        pointerId: 7,
        target: { closest: () => null }
      });
    });
    expect(cancelAnimationFrame).toHaveBeenCalledWith(19);
    expect(stopNote).toHaveBeenCalledWith('C4', 7);
    expect(elementFromPoint).toHaveBeenCalledTimes(1);
  });
});
