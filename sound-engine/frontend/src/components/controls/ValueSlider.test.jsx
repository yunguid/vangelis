import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import ValueSlider from './ValueSlider.jsx';

// D4 regression: the thumb used to be positioned with
// `left: <progress>%` + `translate(-50%)`, which places the thumb's CENTER
// at the raw percentage — at progress 0 or 1 that puts the center flush
// with the track's edge, hanging half the thumb's own width off the track
// (clipped by whatever ancestor happens to clip overflow-x, e.g. a
// `overflow-y: auto` scroll container). The fix exposes progress as a
// unitless ratio via --slider-progress and lets the CSS confine the
// thumb's travel with `calc(thumb/2 + progress * (100% - thumb))`, so at
// the extremes the thumb's EDGE (not center) touches the track's edge.
// jsdom doesn't run layout, so these tests pin the custom-property contract
// the CSS depends on, plus the fill element's presence.
describe('ValueSlider', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderSlider = (props = {}) => render(
    <ValueSlider
      ariaLabel="Test slider"
      min={0}
      max={1}
      step={0.01}
      value={0}
      onChange={vi.fn()}
      {...props}
    />
  );

  it('exposes --slider-progress as a unitless ratio (not a percentage string)', () => {
    const { container } = renderSlider({ value: 0.5, min: 0, max: 1 });
    const slider = container.querySelector('.value-slider');
    const progress = slider.style.getPropertyValue('--slider-progress').trim();
    expect(progress).not.toMatch(/%/);
    expect(Number(progress)).toBeCloseTo(0.5, 4);
  });

  it('sets --slider-progress to exactly 0 at the minimum value', () => {
    const { container } = renderSlider({ value: 0, min: 0, max: 1 });
    const slider = container.querySelector('.value-slider');
    expect(Number(slider.style.getPropertyValue('--slider-progress'))).toBe(0);
  });

  it('sets --slider-progress to exactly 1 at the maximum value', () => {
    const { container } = renderSlider({ value: 1, min: 0, max: 1 });
    const slider = container.querySelector('.value-slider');
    expect(Number(slider.style.getPropertyValue('--slider-progress'))).toBe(1);
  });

  it('computes the same 0/1 ratio contract for a non-normalized range (e.g. Distortion 0-100)', () => {
    const atMin = renderSlider({ value: 0, min: 0, max: 100 });
    expect(Number(
      atMin.container.querySelector('.value-slider').style.getPropertyValue('--slider-progress')
    )).toBe(0);
    atMin.unmount();

    const atMax = renderSlider({ value: 100, min: 0, max: 100 });
    expect(Number(
      atMax.container.querySelector('.value-slider').style.getPropertyValue('--slider-progress')
    )).toBe(1);
  });

  it('renders a track, a flat fill, and a thumb (in that DOM order)', () => {
    const { container } = renderSlider({ value: 0.3, min: 0, max: 1 });
    const children = Array.from(container.querySelector('.value-slider').children)
      .map((el) => el.className);
    expect(children).toEqual([
      'value-slider__track',
      'value-slider__fill',
      'value-slider__thumb'
    ]);
  });

  it('coalesces raw drag samples to the latest coordinate per frame', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { container } = renderSlider({ onChange });
    const slider = container.querySelector('.value-slider');
    const getBoundingClientRect = vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      width: 100
    });
    const dispatchPointer = (type, properties) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(event, properties);
      fireEvent(slider, event);
    };

    dispatchPointer('pointerdown', { button: 0, pointerId: 7, clientX: 0 });
    getBoundingClientRect.mockClear();
    onChange.mockClear();
    dispatchPointer('pointermove', { pointerId: 7, clientX: 20 });
    dispatchPointer('pointermove', { pointerId: 7, clientX: 40 });
    dispatchPointer('pointermove', { pointerId: 7, clientX: 60 });
    dispatchPointer('pointermove', { pointerId: 7, clientX: 80 });

    expect(getBoundingClientRect).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(16));
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(0.8);

    dispatchPointer('pointermove', { pointerId: 7, clientX: 90 });
    dispatchPointer('pointerup', { pointerId: 7, clientX: 90 });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(0.9);
    act(() => vi.advanceTimersByTime(16));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
