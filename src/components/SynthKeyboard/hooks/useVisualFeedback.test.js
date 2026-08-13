import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVisualFeedback } from './useVisualFeedback.js';

describe('useVisualFeedback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('batches key DOM changes without committing React state', () => {
    let scheduledFrame = null;
    let hookRenderCount = 0;
    const keyElement = { dataset: {} };
    const keyElementsRef = {
      current: new Map([['C4', keyElement]])
    };
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback) => {
      scheduledFrame = callback;
      return 17;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { result } = renderHook(() => {
      hookRenderCount += 1;
      return useVisualFeedback(keyElementsRef);
    });

    act(() => {
      result.current.scheduleVisualUpdate('C4', true);
    });
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(hookRenderCount).toBe(1);

    act(() => scheduledFrame());
    expect(keyElement.dataset.active).toBe('true');
    expect(hookRenderCount).toBe(1);
  });
});
