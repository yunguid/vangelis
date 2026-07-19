import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import Fader, {
  CAP_EXTENT,
  getFaderTravel,
  getHorizontalCapCenter,
  getVerticalCapCenter
} from './Fader.jsx';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    class PointerEvent extends MouseEvent {
      constructor(type, params = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 1;
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

// GEOMETRY CONTRACT (see INTERFACE_LEDGER.md's D4 lesson): the cap is
// positioned by its own EDGE, not its center — travel = length - capExtent;
// capCenter = capExtent/2 + ratio*travel. At ratio 0 or 1 the cap sits
// flush INSIDE the track: zero overhang, zero clipping. Pin the pure
// geometry functions directly (no jsdom layout needed), at both extremes,
// for both orientations, at multiple lengths.
describe('Fader geometry contract', () => {
  it.each([160, 120, 200])('horizontal: cap sits flush at ratio 0 and 1 (length=%d)', (length) => {
    const atMin = getHorizontalCapCenter(0, length);
    const atMax = getHorizontalCapCenter(1, length);

    // Flush left: the cap's left edge is exactly at the track's left edge (0).
    expect(atMin - CAP_EXTENT / 2).toBe(0);
    // Flush right: the cap's right edge is exactly at the track's right edge (length).
    expect(atMax + CAP_EXTENT / 2).toBe(length);
  });

  it.each([120, 100, 160])('vertical: cap sits flush at ratio 0 (bottom/min) and 1 (top/max) (length=%d)', (length) => {
    const atMin = getVerticalCapCenter(0, length);
    const atMax = getVerticalCapCenter(1, length);

    // ratio 0 = min = bottom, flush: cap's bottom edge at the track's bottom edge (length).
    expect(atMin + CAP_EXTENT / 2).toBe(length);
    // ratio 1 = max = top, flush: cap's top edge at the track's top edge (0).
    expect(atMax - CAP_EXTENT / 2).toBe(0);
  });

  it('never overhangs or clips at any ratio in between', () => {
    const length = 160;
    for (let i = 0; i <= 10; i += 1) {
      const ratio = i / 10;
      const center = getHorizontalCapCenter(ratio, length);
      expect(center - CAP_EXTENT / 2).toBeGreaterThanOrEqual(-1e-9);
      expect(center + CAP_EXTENT / 2).toBeLessThanOrEqual(length + 1e-9);
    }
  });

  it('getFaderTravel never goes negative even if capExtent > length', () => {
    expect(getFaderTravel(5, 12)).toBe(0);
  });
});

describe('Fader component', () => {
  const renderFader = (props = {}) => render(
    <Fader
      id="f1"
      label="Mix"
      value={0.5}
      min={0}
      max={1}
      defaultValue={0.5}
      onChange={vi.fn()}
      {...props}
    />
  );

  it('renders role=slider with aria-orientation matching the orientation prop', () => {
    const { container } = renderFader({ orientation: 'vertical' });
    const track = container.querySelector('#f1');
    expect(track).toHaveAttribute('role', 'slider');
    expect(track).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('defaults to horizontal orientation', () => {
    const { container } = renderFader();
    const track = container.querySelector('#f1');
    expect(track).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('horizontal drag: dragging the full track length reaches max', () => {
    const onChange = vi.fn();
    const { container } = renderFader({ value: 0.5, min: 0, max: 1, length: 160, onChange });
    const track = container.querySelector('#f1');

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 160, clientY: 0 });
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 160, clientY: 0 });

    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('vertical drag: dragging up the full track length reaches max (up = increase)', () => {
    const onChange = vi.fn();
    const { container } = renderFader({ value: 0.5, min: 0, max: 1, orientation: 'vertical', length: 120, onChange });
    const track = container.querySelector('#f1');

    fireEvent.pointerDown(track, { pointerId: 1, clientX: 0, clientY: 120, button: 0 });
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 0, clientY: 0 });

    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('keyboard: ArrowRight/ArrowUp nudge by +step, Home/End jump to min/max', () => {
    const onChange = vi.fn();
    const { container } = renderFader({ value: 0.5, step: 0.1, onChange });
    const track = container.querySelector('#f1');

    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(0.6);

    fireEvent.keyDown(track, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith(0);

    fireEvent.keyDown(track, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it('double-click resets to defaultValue', () => {
    const onChange = vi.fn();
    const { container } = renderFader({ value: 0.9, defaultValue: 0.3, onChange });
    const track = container.querySelector('#f1');

    fireEvent.doubleClick(track);
    expect(onChange).toHaveBeenLastCalledWith(0.3);
  });

  it('step snapping quantizes drag/keyboard results to whole ticks', () => {
    const onChange = vi.fn();
    const { container } = renderFader({ value: 3, min: 0, max: 7, step: 1, ticks: 8, onChange });
    const track = container.querySelector('#f1');

    fireEvent.keyDown(track, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith(4);
    expect(Number.isInteger(onChange.mock.calls.at(-1)[0])).toBe(true);
  });

  it('skips unchanged parent rerenders while updating when its value changes', () => {
    const format = vi.fn((value) => `${value}`);
    const onChange = vi.fn();
    const props = { id: 'memo-fader', label: 'Memo', value: 0.5, format, onChange };
    const { rerender } = render(<Fader {...props} />);
    expect(format).toHaveBeenCalledTimes(1);

    rerender(<Fader {...props} />);
    expect(format).toHaveBeenCalledTimes(1);

    rerender(<Fader {...props} value={0.7} />);
    expect(format).toHaveBeenCalledTimes(2);
  });
});
