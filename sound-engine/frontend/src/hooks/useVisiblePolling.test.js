import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisiblePolling } from './useVisiblePolling.js';

describe('useVisiblePolling', () => {
  let visibilityState;
  let originalVisibilityState;

  beforeEach(() => {
    vi.useFakeTimers();
    visibilityState = 'visible';
    originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    } else {
      delete document.visibilityState;
    }
  });

  it('pauses while hidden and refreshes immediately when visible again', async () => {
    const poll = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useVisiblePolling(poll, 2_000));
    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(10_000);
    });
    expect(poll).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => {
      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(poll).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await Promise.resolve();
    });
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it('does not overlap polls when a request exceeds the interval', async () => {
    let resolvePoll;
    const pendingPoll = new Promise((resolve) => {
      resolvePoll = resolve;
    });
    const poll = vi.fn(() => pendingPoll);
    renderHook(() => useVisiblePolling(poll, 2_000));

    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(poll).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(poll).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePoll();
      await pendingPoll;
    });
    expect(vi.getTimerCount()).toBe(1);
  });
});
