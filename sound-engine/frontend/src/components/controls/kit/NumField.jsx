import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { clamp } from '../../../utils/math.js';
import useDragValue from './useDragValue.js';

/**
 * NumField — drag-vertical numeric value field (Ableton-style).
 *
 * Three states:
 * - idle: static tabular-nums readout, drag vertically to change, hover
 *   reveals chevron steppers.
 * - dragging: readout text turns accent while the pointer is held.
 * - editing: swaps to a real text <input> (double-click, Enter or F2 to
 *   enter; Enter commits, Escape cancels, blur commits; invalid input
 *   reverts to the previous value).
 *
 * `variant="bare"` drops the hairline box (used to compose the readout
 * under a Knob); `variant="boxed"` (default) is the standalone field.
 */

export const defaultFormat = (value, unit) => {
  if (!Number.isFinite(value)) return '--';
  const rounded = Math.round(value * 10000) / 10000;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded);
  return unit ? `${text}${unit.startsWith('%') ? '' : ' '}${unit}` : text;
};

const defaultParse = (text) => {
  const cleaned = String(text).replace(/[^0-9eE+\-.]/g, '');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const ChevronSteppers = ({ onStepUp, onStepDown, disabled }) => (
  <span className="kit-numfield__steppers" aria-hidden="true">
    <button
      type="button"
      className="kit-numfield__stepper"
      tabIndex={-1}
      disabled={disabled}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onStepUp}
    >
      <svg viewBox="0 0 10 6" width="10" height="6">
        <path d="M1 5 L5 1 L9 5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    <button
      type="button"
      className="kit-numfield__stepper"
      tabIndex={-1}
      disabled={disabled}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onStepDown}
    >
      <svg viewBox="0 0 10 6" width="10" height="6">
        <path d="M1 1 L5 5 L9 1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </span>
);

const NumField = ({
  id,
  label,
  value,
  min = -Infinity,
  max = Infinity,
  step = 1,
  fineStep,
  defaultValue,
  unit = '',
  format,
  parse,
  onChange,
  variant = 'boxed',
  align,
  disabled = false,
  emphasize = false,
  className = ''
}) => {
  const generatedId = useId();
  const fieldId = id || `kit-numfield-${generatedId}`;
  const inputRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const safeValue = clamp(Number.isFinite(value) ? value : 0, min, max);

  const { dragging, dragHandlers } = useDragValue({
    value: safeValue,
    min,
    max,
    step,
    axis: 'vertical',
    disabled: disabled || editing,
    onChange
  });

  const commitNumber = useCallback((next) => {
    if (disabled || typeof onChange !== 'function') return;
    const clamped = clamp(next, min, max);
    if (clamped !== safeValue) onChange(clamped);
  }, [disabled, onChange, min, max, safeValue]);

  const beginEdit = useCallback(() => {
    if (disabled) return;
    setDraft(String(safeValue));
    setEditing(true);
  }, [disabled, safeValue]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = useCallback(() => {
    const parseFn = typeof parse === 'function' ? parse : defaultParse;
    const parsed = parseFn(draft);
    if (Number.isFinite(parsed)) {
      commitNumber(parsed);
    }
    setEditing(false);
  }, [draft, parse, commitNumber]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
  }, []);

  const handleEditKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  }, [commitEdit, cancelEdit]);

  const handleIdleKeyDown = useCallback((event) => {
    if (disabled) return;
    switch (event.key) {
      case 'Enter':
      case 'F2':
        event.preventDefault();
        beginEdit();
        break;
      case 'ArrowUp':
      case 'ArrowRight':
        event.preventDefault();
        commitNumber(safeValue + (event.shiftKey ? (fineStep ?? step / 10) : step));
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        event.preventDefault();
        commitNumber(safeValue - (event.shiftKey ? (fineStep ?? step / 10) : step));
        break;
      case 'PageUp':
        event.preventDefault();
        commitNumber(safeValue + step * 10);
        break;
      case 'PageDown':
        event.preventDefault();
        commitNumber(safeValue - step * 10);
        break;
      case 'Home':
        if (Number.isFinite(min)) {
          event.preventDefault();
          commitNumber(min);
        }
        break;
      case 'End':
        if (Number.isFinite(max)) {
          event.preventDefault();
          commitNumber(max);
        }
        break;
      default:
        break;
    }
  }, [disabled, beginEdit, commitNumber, safeValue, step, fineStep, min, max]);

  const handleDoubleClick = useCallback(() => {
    beginEdit();
  }, [beginEdit]);

  const formatFn = typeof format === 'function' ? format : (v) => defaultFormat(v, unit);
  const displayText = formatFn(safeValue);
  const resolvedAlign = align || (variant === 'bare' ? 'center' : 'right');
  const active = dragging || emphasize;

  const classNames = [
    'kit-numfield',
    `kit-numfield--${variant}`,
    `kit-numfield--align-${resolvedAlign}`,
    active ? 'kit-numfield--active' : '',
    disabled ? 'kit-numfield--disabled' : '',
    editing ? 'kit-numfield--editing' : '',
    className
  ].filter(Boolean).join(' ');

  if (editing) {
    return (
      <span className={classNames}>
        {label && <span className="kit-numfield__label">{label}</span>}
        <input
          ref={inputRef}
          id={fieldId}
          className="kit-numfield__input"
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleEditKeyDown}
          onBlur={commitEdit}
          aria-label={label}
        />
      </span>
    );
  }

  return (
    <span className={classNames}>
      {label && <span className="kit-numfield__label">{label}</span>}
      <span
        id={fieldId}
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuenow={safeValue}
        aria-valuetext={displayText}
        aria-disabled={disabled || undefined}
        className="kit-numfield__value"
        onPointerDown={dragHandlers.onPointerDown}
        onPointerMove={dragHandlers.onPointerMove}
        onPointerUp={dragHandlers.onPointerUp}
        onPointerCancel={dragHandlers.onPointerCancel}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleIdleKeyDown}
      >
        {displayText}
      </span>
      {variant === 'boxed' && (
        <ChevronSteppers
          disabled={disabled}
          onStepUp={() => commitNumber(safeValue + step)}
          onStepDown={() => commitNumber(safeValue - step)}
        />
      )}
    </span>
  );
};

export default NumField;
