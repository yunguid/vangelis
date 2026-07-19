import React, { useCallback, useEffect, useRef } from 'react';
import { clamp } from '../../utils/math.js';

/**
 * ValueSlider — the one accessible control primitive for continuous values.
 *
 * Interactions:
 * - Pointer drag (with capture) and track click-to-jump
 * - Arrow keys nudge by step; Shift+Arrow = fine (step/10)
 * - PageUp/PageDown = coarse (10 steps); Home/End = min/max
 * - Mouse wheel nudges while hovering (Shift = fine)
 * - Double-click resets to defaultValue (when provided)
 *
 * Accessibility:
 * - role="slider" with aria-valuemin/max/now/text and aria-label
 * - Focusable, with a visible focus ring (see .value-slider CSS)
 */
const ValueSlider = ({
  id,
  ariaLabel,
  ariaLabelledBy,
  min = 0,
  max = 1,
  step = 0.01,
  value = 0,
  defaultValue,
  formatValue,
  disabled = false,
  onChange,
  className = ''
}) => {
  const trackRef = useRef(null);
  const draggingRef = useRef(false);
  const pendingPointerXRef = useRef(null);
  const pointerMoveFrameRef = useRef(null);

  const span = max - min === 0 ? 1 : max - min;
  const safeValue = clamp(Number.isFinite(value) ? value : min, min, max);
  const progress = (safeValue - min) / span;

  const quantize = useCallback((raw, quantStep) => {
    const snapped = min + Math.round((raw - min) / quantStep) * quantStep;
    // Avoid float dust like 0.30000000000000004
    const decimals = Math.min(10, Math.max(0, -Math.floor(Math.log10(quantStep)) + 2));
    return clamp(Number(snapped.toFixed(decimals)), min, max);
  }, [min, max]);

  const commit = useCallback((next) => {
    if (disabled || typeof onChange !== 'function') return;
    if (next !== safeValue) onChange(next);
  }, [disabled, onChange, safeValue]);

  const valueFromPointer = useCallback((clientX) => {
    const track = trackRef.current;
    if (!track) return safeValue;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return safeValue;
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return quantize(min + ratio * span, step);
  }, [min, span, step, quantize, safeValue]);

  const flushPointerMove = useCallback(() => {
    pointerMoveFrameRef.current = null;
    const clientX = pendingPointerXRef.current;
    pendingPointerXRef.current = null;
    if (clientX !== null && draggingRef.current) {
      commit(valueFromPointer(clientX));
    }
  }, [commit, valueFromPointer]);

  const cancelPendingPointerMove = useCallback(() => {
    if (pointerMoveFrameRef.current !== null) {
      cancelAnimationFrame(pointerMoveFrameRef.current);
      pointerMoveFrameRef.current = null;
    }
    pendingPointerXRef.current = null;
  }, []);

  useEffect(() => cancelPendingPointerMove, [cancelPendingPointerMove]);

  const handlePointerDown = useCallback((event) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    cancelPendingPointerMove();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.focus();
    commit(valueFromPointer(event.clientX));
  }, [disabled, cancelPendingPointerMove, commit, valueFromPointer]);

  const handlePointerMove = useCallback((event) => {
    if (!draggingRef.current) return;
    pendingPointerXRef.current = event.clientX;
    if (pointerMoveFrameRef.current === null) {
      pointerMoveFrameRef.current = requestAnimationFrame(flushPointerMove);
    }
  }, [flushPointerMove]);

  const endDrag = useCallback((event) => {
    if (!draggingRef.current) return;
    const pendingClientX = pendingPointerXRef.current;
    cancelPendingPointerMove();
    if (pendingClientX !== null) {
      commit(valueFromPointer(pendingClientX));
    }
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, [cancelPendingPointerMove, commit, valueFromPointer]);

  const nudge = useCallback((direction, fine, coarse) => {
    const effStep = fine ? step / 10 : coarse ? step * 10 : step;
    commit(quantize(safeValue + direction * effStep, effStep));
  }, [step, safeValue, commit, quantize]);

  const handleKeyDown = useCallback((event) => {
    if (disabled) return;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        nudge(1, event.shiftKey, false);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        nudge(-1, event.shiftKey, false);
        break;
      case 'PageUp':
        event.preventDefault();
        nudge(1, false, true);
        break;
      case 'PageDown':
        event.preventDefault();
        nudge(-1, false, true);
        break;
      case 'Home':
        event.preventDefault();
        commit(min);
        break;
      case 'End':
        event.preventDefault();
        commit(max);
        break;
      default:
        break;
    }
  }, [disabled, nudge, commit, min, max]);

  const handleWheel = useCallback((event) => {
    if (disabled) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    nudge(direction, event.shiftKey, false);
  }, [disabled, nudge]);

  const handleDoubleClick = useCallback(() => {
    if (disabled || typeof defaultValue !== 'number') return;
    commit(clamp(defaultValue, min, max));
  }, [disabled, defaultValue, commit, min, max]);

  const valueText = typeof formatValue === 'function'
    ? formatValue(safeValue)
    : `${safeValue}`;

  return (
    <div
      id={id}
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabelledBy ? undefined : ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={safeValue}
      aria-valuetext={valueText}
      aria-orientation="horizontal"
      aria-disabled={disabled || undefined}
      className={`value-slider${disabled ? ' value-slider--disabled' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--slider-progress': progress.toFixed(4) }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <div className="value-slider__track" aria-hidden="true" />
      <div className="value-slider__fill" aria-hidden="true" />
      <div className="value-slider__thumb" aria-hidden="true" />
    </div>
  );
};

export default ValueSlider;
