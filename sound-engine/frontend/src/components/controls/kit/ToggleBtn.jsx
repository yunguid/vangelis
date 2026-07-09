import React, { useCallback, useId } from 'react';

/**
 * ToggleBtn — labeled latching button (hardware ON button).
 *
 * A single <button aria-pressed> with an LED bar spanning the top inside
 * edge: off = paper-alpha bar / ink face / tertiary text; on = solid accent
 * bar / accent-silver face / primary text. Geometry is identical between
 * states (no layout shift) — only color changes, and pressing darkens the
 * face rather than translating it.
 *
 * The visible chrome lives on an inner `.kit-togglebtn__face` span so the
 * outer <button> can carry extra transparent padding at mobile widths to
 * reach a >=44px hit area without growing the visual control.
 */
const ToggleBtn = ({
  id,
  label,
  checked = false,
  onChange,
  size = 'md',
  disabled = false
}) => {
  const generatedId = useId();
  const buttonId = id || `kit-togglebtn-${generatedId}`;

  const handleClick = useCallback(() => {
    if (disabled || typeof onChange !== 'function') return;
    onChange(!checked);
  }, [disabled, onChange, checked]);

  return (
    <button
      id={buttonId}
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={handleClick}
      className={`kit-togglebtn kit-togglebtn--${size}${checked ? ' kit-togglebtn--on' : ''}`}
    >
      <span className="kit-togglebtn__face">
        <span className="kit-togglebtn__led" aria-hidden="true" />
        <span className="kit-togglebtn__label">{label}</span>
      </span>
    </button>
  );
};

export default ToggleBtn;
