import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useDragValue, { quantizeValue } from './useDragValue.js';

describe('quantizeValue', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clamps to min/max', () => {
    expect(quantizeValue(-5, 0, 10, 1)).toBe(0);
    expect(quantizeValue(50, 0, 10, 1)).toBe(10);
  });

  it('snaps to the nearest step', () => {
    expect(quantizeValue(4.6, 0, 10, 1)).toBe(5);
    expect(quantizeValue(4.4, 0, 10, 1)).toBe(4);
  });

  it('snaps fractional steps without float dust', () => {
    expect(quantizeValue(0.29, 0, 1, 0.1)).toBeCloseTo(0.3, 10);
    expect(quantizeValue(0.31, 0, 1, 0.1)).toBeCloseTo(0.3, 10);
    // The classic 0.1 + 0.2 float-dust trap: value should come back exact.
    expect(quantizeValue(0.30000000000000004, 0, 1, 0.01)).toBe(0.3);
  });

  it('stays continuous (clamp-only) when step is falsy', () => {
    expect(quantizeValue(0.123456, 0, 1, 0)).toBeCloseTo(0.123456, 10);
    expect(quantizeValue(0.123456, 0, 1, undefined)).toBeCloseTo(0.123456, 10);
  });

  it('treats a non-finite raw value as min', () => {
    expect(quantizeValue(NaN, 5, 10, 1)).toBe(5);
  });

  it('snaps to integer steps for a Fader-style stepped range', () => {
    expect(quantizeValue(3.6, 0, 7, 1)).toBe(4);
    expect(quantizeValue(-1, 0, 7, 1)).toBe(0);
    expect(quantizeValue(9, 0, 7, 1)).toBe(7);
  });

  it('coalesces drag values by frame and flushes the release position', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { result } = renderHook(() => useDragValue({
      value: 0,
      min: 0,
      max: 1,
      travel: 100,
      onChange
    }));
    const currentTarget = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn()
    };

    act(() => result.current.dragHandlers.onPointerDown({
      button: 0,
      pointerId: 4,
      clientY: 100,
      preventDefault: vi.fn(),
      currentTarget
    }));
    act(() => {
      result.current.dragHandlers.onPointerMove({ pointerId: 4, clientY: 90, shiftKey: false });
      result.current.dragHandlers.onPointerMove({ pointerId: 4, clientY: 80, shiftKey: false });
      result.current.dragHandlers.onPointerMove({ pointerId: 4, clientY: 70, shiftKey: false });
      result.current.dragHandlers.onPointerMove({ pointerId: 4, clientY: 60, shiftKey: false });
    });
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(16));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(0.4);

    act(() => {
      result.current.dragHandlers.onPointerMove({ pointerId: 4, clientY: 50, shiftKey: false });
      result.current.dragHandlers.onPointerUp({ pointerId: 4, currentTarget });
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    act(() => vi.advanceTimersByTime(16));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
