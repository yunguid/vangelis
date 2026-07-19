import { useCallback, useEffect, useRef, useState } from 'react';
import { clamp } from '../../../utils/math.js';

/**
 * useDragValue — the one drag/quantize interaction language shared by every
 * control-kit primitive (Knob, NumField, Fader).
 *
 * Contract:
 * - Pointer capture on pointerdown so drags keep tracking outside the
 *   element's box.
 * - Axis-aligned delta only: 'vertical' (up = increase) or 'horizontal'
 *   (right = increase).
 * - The full [min,max] range is mapped across `travel` px of pointer
 *   movement (default ~150px — a Fader passes its own physical track
 *   length instead so the cap tracks the pointer 1:1).
 * - Shift held = fine mode (delta scaled by 0.1 — ten times the movement
 *   for the same value change).
 * - Double-click resets to `defaultValue` when one is provided.
 * - `nudge`/`commit` expose the same quantized-value math for keyboard and
 *   wheel handlers so every input method agrees on the result.
 */

const DEFAULT_TRAVEL_PX = 150;
const FINE_MULTIPLIER = 0.1;

/**
 * Snap `raw` to the nearest `step` inside [min, max]. A falsy/zero step
 * leaves the value continuous (clamped only) — used by e.g. a Fader with no
 * `step` prop.
 */
export const quantizeValue = (raw, min, max, step) => {
  const clamped = clamp(Number.isFinite(raw) ? raw : min, min, max);
  if (!step || step <= 0) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  // Avoid float dust like 0.30000000000000004.
  const decimals = Math.min(10, Math.max(0, -Math.floor(Math.log10(step)) + 2));
  return clamp(Number(snapped.toFixed(decimals)), min, max);
};

const useDragValue = ({
  value,
  min,
  max,
  step = 0,
  defaultValue,
  travel = DEFAULT_TRAVEL_PX,
  axis = 'vertical',
  disabled = false,
  onChange
}) => {
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const pendingPositionRef = useRef(null);
  const pendingFineRef = useRef(false);
  const moveFrameRef = useRef(null);

  // `quantStep` defaults to the control's own `step` (drag and normal
  // keyboard nudges land on that grid). Fine keyboard/wheel nudges pass a
  // finer quantStep explicitly (see `nudge` below) — otherwise a sub-step
  // delta would be re-snapped straight back to the value it started from,
  // making Shift+Arrow a no-op whenever step > 0.
  const commit = useCallback((next, quantStep = step) => {
    if (disabled || typeof onChange !== 'function') return;
    const quantized = quantizeValue(next, min, max, quantStep);
    if (quantized !== value) onChange(quantized);
  }, [disabled, onChange, min, max, step, value]);

  const commitPointerPosition = useCallback((currentPos, fineMode) => {
    const drag = dragRef.current;
    if (!drag) return;
    // vertical: up (smaller clientY) = increase. horizontal: right = increase.
    const rawDelta = axis === 'vertical'
      ? drag.startPos - currentPos
      : currentPos - drag.startPos;
    const fine = fineMode ? FINE_MULTIPLIER : 1;
    const span = max - min;
    const safeTravel = travel > 0 ? travel : DEFAULT_TRAVEL_PX;
    commit(drag.startValue + (rawDelta / safeTravel) * span * fine);
  }, [axis, commit, max, min, travel]);

  const flushPointerMove = useCallback(() => {
    moveFrameRef.current = null;
    const currentPos = pendingPositionRef.current;
    const fineMode = pendingFineRef.current;
    pendingPositionRef.current = null;
    pendingFineRef.current = false;
    if (currentPos !== null) commitPointerPosition(currentPos, fineMode);
  }, [commitPointerPosition]);

  const cancelPendingPointerMove = useCallback(() => {
    if (moveFrameRef.current !== null) {
      cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
    pendingPositionRef.current = null;
    pendingFineRef.current = false;
  }, []);

  useEffect(() => cancelPendingPointerMove, [cancelPendingPointerMove]);

  const handlePointerDown = useCallback((event) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    cancelPendingPointerMove();
    // Guarded: setPointerCapture throws NotFoundError if the UA doesn't
    // consider this pointerId "active" (observed with certain synthetic
    // dispatch sequences). A throw here must never abort arming the drag —
    // that would silently break the whole interaction.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* capture is a nice-to-have; the drag still tracks via move/up. */
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startPos: axis === 'vertical' ? event.clientY : event.clientX,
      startValue: value
    };
    setDragging(true);
  }, [axis, cancelPendingPointerMove, disabled, value]);

  const handlePointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pendingPositionRef.current = axis === 'vertical' ? event.clientY : event.clientX;
    pendingFineRef.current = event.shiftKey;
    if (moveFrameRef.current === null) {
      moveFrameRef.current = requestAnimationFrame(flushPointerMove);
    }
  }, [axis, flushPointerMove]);

  const endDrag = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag || (event && drag.pointerId !== event.pointerId)) return;
    const pendingPosition = pendingPositionRef.current;
    const pendingFine = pendingFineRef.current;
    cancelPendingPointerMove();
    if (pendingPosition !== null) {
      commitPointerPosition(pendingPosition, pendingFine);
    }
    try {
      event?.currentTarget?.releasePointerCapture?.(event.pointerId);
    } catch {
      /* already released or never captured — nothing to clean up. */
    }
    dragRef.current = null;
    setDragging(false);
  }, [cancelPendingPointerMove, commitPointerPosition]);

  const handleDoubleClick = useCallback(() => {
    if (disabled || typeof defaultValue !== 'number') return;
    commit(defaultValue);
  }, [disabled, defaultValue, commit]);

  /**
   * direction: +1/-1. fine = step/10. coarse = step*10 (PageUp/PageDown).
   * Fine nudges quantize against the finer grid (effStep) rather than the
   * control's normal `step` — otherwise commit()'s own step-quantization
   * would round the sub-step delta straight back to where it started.
   */
  const nudge = useCallback((direction, fine, coarse) => {
    if (disabled) return;
    const baseStep = step > 0 ? step : (max - min) / 100 || 1;
    const effStep = fine ? baseStep / 10 : coarse ? baseStep * 10 : baseStep;
    commit(value + direction * effStep, fine ? effStep : step);
  }, [disabled, step, max, min, value, commit]);

  return {
    dragging,
    dragHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag
    },
    handleDoubleClick,
    nudge,
    commit
  };
};

export default useDragValue;
