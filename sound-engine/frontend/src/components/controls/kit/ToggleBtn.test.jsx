import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import ToggleBtn from './ToggleBtn.jsx';

describe('ToggleBtn', () => {
  it('renders aria-pressed matching the checked prop', () => {
    const { rerender, getByRole } = render(
      <ToggleBtn id="t1" label="Filter" checked={false} onChange={vi.fn()} />
    );
    expect(getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<ToggleBtn id="t1" label="Filter" checked onChange={vi.fn()} />);
    expect(getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking flips aria-pressed via onChange(!checked)', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <ToggleBtn id="t1" label="Filter" checked={false} onChange={onChange} />
    );
    fireEvent.click(getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('clicking again from checked flips back to false', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <ToggleBtn id="t1" label="Filter" checked onChange={onChange} />
    );
    fireEvent.click(getByRole('button'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('applies the kit-togglebtn--on class only when checked', () => {
    const { rerender, getByRole } = render(
      <ToggleBtn id="t1" label="Filter" checked={false} onChange={vi.fn()} />
    );
    expect(getByRole('button').className).not.toMatch(/kit-togglebtn--on/);

    rerender(<ToggleBtn id="t1" label="Filter" checked onChange={vi.fn()} />);
    expect(getByRole('button').className).toMatch(/kit-togglebtn--on/);
  });

  it('disabled: click does not call onChange', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <ToggleBtn id="t1" label="Filter" checked={false} disabled onChange={onChange} />
    );
    const button = getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('DOM structure (label + LED bar) is identical between on/off states — only color classes differ', () => {
    const { rerender, container } = render(
      <ToggleBtn id="t1" label="Filter" checked={false} onChange={vi.fn()} size="md" />
    );
    const structureOff = Array.from(container.querySelectorAll('.kit-togglebtn__face *'))
      .map((el) => el.className.replace(/kit-togglebtn--on\s*/, ''));

    rerender(<ToggleBtn id="t1" label="Filter" checked onChange={vi.fn()} size="md" />);
    const structureOn = Array.from(container.querySelectorAll('.kit-togglebtn__face *'))
      .map((el) => el.className.replace(/kit-togglebtn--on\s*/, ''));

    // Same elements, same base classes — no layout-affecting nodes added or
    // removed between states (no translate/movement, only color changes).
    expect(structureOn).toEqual(structureOff);
  });
});
