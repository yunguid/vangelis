import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import Knob from './Knob.jsx';

// jsdom has no PointerEvent constructor and Elements lack
// setPointerCapture/releasePointerCapture — polyfill/stub both so drag
// simulation via dispatchEvent works, matching the pattern already used for
// pointer-capture calls in ValueSlider/EffectMacroDial (optional-chained,
// so these are strictly additive for the tests that want to assert on them).
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEvent extends MouseEvent {
      constructor(type, params = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
        this.pointerType = params.pointerType ?? 'mouse';
      }
    }
    window.PointerEvent = PointerEvent;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

describe('Knob', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const renderKnob = (props = {}) => render(
    <Knob
      id="k1"
      label="Cutoff"
      value={0.5}
      min={0}
      max={1}
      step={0.01}
      defaultValue={0.5}
      onChange={vi.fn()}
      {...props}
    />
  );

  it('renders role=slider with correct ARIA attributes', () => {
    const { container } = renderKnob({ value: 0.25, min: 0, max: 1 });
    const slider = container.querySelector('#k1');
    expect(slider).toHaveAttribute('role', 'slider');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '1');
    expect(slider).toHaveAttribute('aria-valuenow', '0.25');
    expect(slider).toHaveAttribute('aria-label', 'Cutoff');
    expect(slider).toHaveAttribute('tabIndex', '0');
  });

  it('sets aria-valuetext from the format function', () => {
    const { container } = renderKnob({
      value: 0.5,
      format: (v) => `${Math.round(v * 100)}%`
    });
    const slider = container.querySelector('#k1');
    expect(slider).toHaveAttribute('aria-valuetext', '50%');
  });

  it('disabled knob has tabIndex -1 and aria-disabled', () => {
    const { container } = renderKnob({ disabled: true });
    const slider = container.querySelector('#k1');
    expect(slider).toHaveAttribute('tabIndex', '-1');
    expect(slider).toHaveAttribute('aria-disabled', 'true');
  });

  it('ArrowUp/ArrowRight nudge by +step, ArrowDown/ArrowLeft by -step', () => {
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.5, step: 0.1, onChange });
    const slider = container.querySelector('#k1');

    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith(0.6);

    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith(0.4);
  });

  it('Shift+Arrow nudges by a fine step (step/10)', () => {
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.5, step: 0.1, onChange });
    const slider = container.querySelector('#k1');

    fireEvent.keyDown(slider, { key: 'ArrowUp', shiftKey: true });
    expect(onChange).toHaveBeenLastCalledWith(0.51);
  });

  it('PageUp/PageDown nudge by 10x step', () => {
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.5, step: 0.1, min: 0, max: 1, onChange });
    const slider = container.querySelector('#k1');

    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('Home/End jump to min/max', () => {
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.5, min: 0, max: 1, onChange });
    const slider = container.querySelector('#k1');

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);

    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('a disabled knob ignores keyboard nudges', () => {
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.5, disabled: true, onChange });
    const slider = container.querySelector('#k1');

    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('vertical pointer drag up increases the value, drag down decreases it', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.5, min: 0, max: 1, onChange });
    const slider = container.querySelector('#k1');

    fireEvent.pointerDown(slider, { pointerId: 1, clientY: 100, clientX: 0, button: 0 });
    fireEvent.pointerMove(slider, { pointerId: 1, clientY: 25, clientX: 0 }); // up 75px of 150 travel
    expect(onChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(16));
    expect(onChange).toHaveBeenLastCalledWith(1);

    fireEvent.pointerUp(slider, { pointerId: 1, clientY: 25, clientX: 0 });
  });

  it('wheel over the knob adjusts by a fine step and calls preventDefault (non-passive listener)', () => {
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.5, step: 0.1, onChange });
    const slider = container.querySelector('#k1');

    // The wheel listener is attached natively with { passive: false } —
    // React's own onWheel is registered passive at the root, which silently
    // swallows preventDefault (value changes AND the page scrolls).
    // fireEvent returns false when preventDefault was called.
    const notPrevented = fireEvent.wheel(slider, { deltaY: -50 });
    expect(notPrevented).toBe(false);
    expect(onChange).toHaveBeenLastCalledWith(0.51);

    fireEvent.wheel(slider, { deltaY: 50 });
    expect(onChange).toHaveBeenLastCalledWith(0.49);
  });

  it('wheel over a disabled knob neither changes the value nor blocks page scroll', () => {
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.5, disabled: true, onChange });
    const slider = container.querySelector('#k1');

    const notPrevented = fireEvent.wheel(slider, { deltaY: -50 });
    expect(notPrevented).toBe(true); // preventDefault NOT called
    expect(onChange).not.toHaveBeenCalled();
  });

  it('double-click on the body resets to defaultValue', () => {
    const onChange = vi.fn();
    const { container } = renderKnob({ value: 0.9, defaultValue: 0.5, onChange });
    const slider = container.querySelector('#k1');

    fireEvent.doubleClick(slider);
    expect(onChange).toHaveBeenLastCalledWith(0.5);
  });

  it('composes a bare NumField readout below the body sharing the same value', () => {
    const { container } = renderKnob({ value: 0.5, label: 'Cutoff' });
    const readout = container.querySelector('.kit-numfield--bare');
    expect(readout).toBeTruthy();
    expect(readout.textContent).toContain('Cutoff');
  });

  it('batches all eleven visual ticks into two constant-size paths', () => {
    const { container } = renderKnob();
    const tickPaths = container.querySelectorAll('.kit-knob__tick');

    expect(tickPaths).toHaveLength(2);
    expect(tickPaths[0].getAttribute('d').match(/M /g)).toHaveLength(8);
    expect(tickPaths[1].getAttribute('d').match(/M /g)).toHaveLength(3);
  });

  it('skips unchanged parent rerenders while updating when its value changes', () => {
    const format = vi.fn((value) => `${value}`);
    const onChange = vi.fn();
    const props = { id: 'memo-knob', label: 'Memo', value: 0.5, format, onChange };
    const { rerender } = render(<Knob {...props} />);
    const callsAfterMount = format.mock.calls.length;

    rerender(<Knob {...props} />);
    expect(format).toHaveBeenCalledTimes(callsAfterMount);

    rerender(<Knob {...props} value={0.7} />);
    expect(format.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });
});
