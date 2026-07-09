import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import NumField from './NumField.jsx';

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

describe('NumField', () => {
  const renderField = (props = {}) => render(
    <NumField
      id="nf1"
      label="Voices"
      value={4}
      min={1}
      max={16}
      step={1}
      defaultValue={4}
      onChange={vi.fn()}
      {...props}
    />
  );

  it('renders a static spinbutton readout with the formatted value', () => {
    const { container } = renderField({ value: 8, unit: 'ms' });
    const spin = container.querySelector('[role="spinbutton"]');
    expect(spin).toHaveAttribute('aria-valuenow', '8');
    expect(spin.textContent).toBe('8 ms');
  });

  it('double-click enters edit mode with a real input, pre-filled and selected', () => {
    const { container } = renderField({ value: 8 });
    const spin = container.querySelector('[role="spinbutton"]');
    fireEvent.doubleClick(spin);

    const input = container.querySelector('.kit-numfield__input');
    expect(input).toBeTruthy();
    expect(input.value).toBe('8');
  });

  it('F2 while focused (idle) also enters edit mode', () => {
    const { container } = renderField({ value: 3 });
    const spin = container.querySelector('[role="spinbutton"]');
    fireEvent.keyDown(spin, { key: 'F2' });
    expect(container.querySelector('.kit-numfield__input')).toBeTruthy();
  });

  it('Enter commits the parsed, clamped value and exits edit mode', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: 4, min: 1, max: 16, onChange });
    const spin = container.querySelector('[role="spinbutton"]');
    fireEvent.doubleClick(spin);

    const input = container.querySelector('.kit-numfield__input');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(9);
    expect(container.querySelector('.kit-numfield__input')).toBeNull();
  });

  it('Enter commits a value clamped into [min,max]', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: 4, min: 1, max: 16, onChange });
    const spin = container.querySelector('[role="spinbutton"]');
    fireEvent.doubleClick(spin);

    const input = container.querySelector('.kit-numfield__input');
    fireEvent.change(input, { target: { value: '999' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(16);
  });

  it('Escape cancels the edit without committing', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: 4, onChange });
    const spin = container.querySelector('[role="spinbutton"]');
    fireEvent.doubleClick(spin);

    const input = container.querySelector('.kit-numfield__input');
    fireEvent.change(input, { target: { value: '11' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('.kit-numfield__input')).toBeNull();
    expect(container.querySelector('[role="spinbutton"]').textContent).toBe('4');
  });

  it('an invalid (non-numeric) commit reverts to the previous value', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: 4, onChange });
    const spin = container.querySelector('[role="spinbutton"]');
    fireEvent.doubleClick(spin);

    const input = container.querySelector('.kit-numfield__input');
    fireEvent.change(input, { target: { value: 'not-a-number' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    expect(container.querySelector('[role="spinbutton"]').textContent).toBe('4');
  });

  it('blur commits the edit like Enter', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: 4, onChange });
    const spin = container.querySelector('[role="spinbutton"]');
    fireEvent.doubleClick(spin);

    const input = container.querySelector('.kit-numfield__input');
    fireEvent.change(input, { target: { value: '7' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('vertical drag on the readout commits a quantized value', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: 4, min: 1, max: 16, step: 1, onChange });
    const spin = container.querySelector('[role="spinbutton"]');

    fireEvent.pointerDown(spin, { pointerId: 2, clientY: 100, clientX: 0, button: 0 });
    fireEvent.pointerMove(spin, { pointerId: 2, clientY: 25, clientX: 0 }); // up 75px of default 150 travel
    fireEvent.pointerUp(spin, { pointerId: 2, clientY: 25, clientX: 0 });

    // span 15 over 150px travel => +7.5, quantized to nearest int from 4 -> 12 (rounded)
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0]).toBeGreaterThan(4);
  });

  it('clicking the up/down chevron steppers steps by +/- step', () => {
    const onChange = vi.fn();
    const { container } = renderField({ value: 4, step: 1, onChange, variant: 'boxed' });
    const steppers = container.querySelectorAll('.kit-numfield__stepper');
    expect(steppers).toHaveLength(2);

    fireEvent.click(steppers[0]);
    expect(onChange).toHaveBeenLastCalledWith(5);

    fireEvent.click(steppers[1]);
    expect(onChange).toHaveBeenLastCalledWith(3);
  });

  it('bare variant omits the box and chevron steppers', () => {
    const { container } = renderField({ variant: 'bare' });
    expect(container.querySelector('.kit-numfield--bare')).toBeTruthy();
    expect(container.querySelector('.kit-numfield__stepper')).toBeNull();
  });
});
