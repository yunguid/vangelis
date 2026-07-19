import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import EffectMacroDial from './EffectMacroDial.jsx';

vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: {
    getActivity: () => ({ isActive: false }),
    subscribeActivity: () => () => {}
  }
}));

describe('EffectMacroDial', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('coalesces drag samples and synchronously flushes release', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { container } = render(
      <EffectMacroDial
        id="delay-mix"
        label="Mix"
        value={0.2}
        displayValue="20%"
        onChange={onChange}
      />
    );
    const dial = container.querySelector('.effect-macro-dial__touch');
    const dispatchPointer = (type, properties) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, properties);
      fireEvent(dial, event);
    };

    dispatchPointer('pointerdown', { pointerId: 8, clientY: 100 });
    dispatchPointer('pointermove', { pointerId: 8, clientY: 90 });
    dispatchPointer('pointermove', { pointerId: 8, clientY: 80 });
    dispatchPointer('pointermove', { pointerId: 8, clientY: 70 });
    dispatchPointer('pointermove', { pointerId: 8, clientY: 64 });
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(16));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(0.4);

    dispatchPointer('pointermove', { pointerId: 8, clientY: 46 });
    dispatchPointer('pointerup', { pointerId: 8, clientY: 46 });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(0.5);
    act(() => vi.advanceTimersByTime(16));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
