import React, { useCallback, useId, useRef } from 'react';

/**
 * SegmentSelect — joined enum selector.
 *
 * A single hairline-bordered row, cells divided by shared 1px hairlines (no
 * double borders). role="radiogroup" + role="radio" cells with roving
 * tabindex and arrow-key navigation. Ships built-in waveform glyphs
 * (sine/square/sawtooth/triangle, 1.5px-stroke SVG) selectable via
 * `glyph: 'sine'`; `glyph` may also be any ReactNode.
 */

const WAVEFORM_PATHS = {
  sine: 'M1,6 C4,1 7,1 10,6 C13,11 16,11 19,6',
  square: 'M1,9 L1,3 L6,3 L6,9 L11,9 L11,3 L16,3 L16,9 L19,9',
  sawtooth: 'M1,9 L9,3 L9,9 L18,3',
  triangle: 'M1,9 L5,3 L10,9 L15,3 L19,9'
};

export const WAVEFORM_GLYPH_NAMES = Object.keys(WAVEFORM_PATHS);

const WaveformGlyph = ({ shape }) => {
  const d = WAVEFORM_PATHS[shape];
  if (!d) return null;
  return (
    <svg viewBox="0 0 20 12" width="20" height="12" className="kit-segment__glyph-svg" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const SegmentSelect = ({
  id,
  label,
  options = [],
  value,
  onChange,
  size = 'md',
  disabled = false
}) => {
  const generatedId = useId();
  const groupId = id || `kit-segment-${generatedId}`;
  const cellRefs = useRef(null);
  if (!cellRefs.current) cellRefs.current = [];

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const focusableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const handleSelect = useCallback((index) => {
    if (disabled) return;
    const opt = options[index];
    if (opt && opt.value !== value && typeof onChange === 'function') {
      onChange(opt.value);
    }
  }, [disabled, options, value, onChange]);

  const handleKeyDown = useCallback((event, index) => {
    if (disabled) return;
    let nextIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    }
    if (nextIndex !== -1) {
      event.preventDefault();
      handleSelect(nextIndex);
      cellRefs.current[nextIndex]?.focus();
    }
  }, [disabled, options.length, handleSelect]);

  return (
    <div
      id={groupId}
      className={`kit-segment kit-segment--${size}${disabled ? ' kit-segment--disabled' : ''}${options.length === 4 ? ' kit-segment--wrap4' : ''}`}
    >
      {label && <span className="kit-segment__label">{label}</span>}
      <div role="radiogroup" aria-label={label} className="kit-segment__row">
        {options.map((opt, index) => {
          const isActive = index === selectedIndex;
          return (
            <button
              key={opt.value}
              ref={(el) => { cellRefs.current[index] = el; }}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={disabled ? -1 : (index === focusableIndex ? 0 : -1)}
              disabled={disabled}
              className={`kit-segment__cell${isActive ? ' kit-segment__cell--active' : ''}`}
              onClick={() => handleSelect(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {opt.glyph && (
                <span className="kit-segment__glyph">
                  {typeof opt.glyph === 'string' ? <WaveformGlyph shape={opt.glyph} /> : opt.glyph}
                </span>
              )}
              <span className="kit-segment__cell-label">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SegmentSelect;
