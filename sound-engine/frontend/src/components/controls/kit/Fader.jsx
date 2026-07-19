import React, { useCallback, useId, useMemo } from 'react';
import { clamp } from '../../../utils/math.js';
import useDragValue from './useDragValue.js';
import { defaultFormat } from './NumField.jsx';

/**
 * Fader — stepped fader, both orientations.
 *
 * GEOMETRY CONTRACT (regressing this is an auto-reject — see the D4 lesson
 * in INTERFACE_LEDGER.md): the cap is positioned by its own EDGE, not its
 * center. `travel = length - capExtent`; `capCenter = capExtent/2 +
 * ratio * travel`. At ratio 0 or 1 the cap sits flush INSIDE the track —
 * zero overhang, zero clipping, at any container width. The two pure
 * functions below are exported specifically so the geometry can be pinned
 * by a test without needing jsdom layout.
 */

export const CAP_EXTENT = 12; // cap size along the travel axis
export const CAP_CROSS = 22; // cap size across the travel axis (the grip)

export const getFaderTravel = (length, capExtent = CAP_EXTENT) => Math.max(0, length - capExtent);

/** Horizontal: ratio 0 = left (flush), ratio 1 = right (flush). */
export const getHorizontalCapCenter = (ratio, length, capExtent = CAP_EXTENT) => {
  const travel = getFaderTravel(length, capExtent);
  return capExtent / 2 + clamp(ratio, 0, 1) * travel;
};

/** Vertical: ratio 0 = bottom (flush, min), ratio 1 = top (flush, max — up = increase). */
export const getVerticalCapCenter = (ratio, length, capExtent = CAP_EXTENT) => {
  const travel = getFaderTravel(length, capExtent);
  return (length - capExtent / 2) - clamp(ratio, 0, 1) * travel;
};

const resolveTickRatios = (ticksProp, min, max) => {
  if (Array.isArray(ticksProp)) {
    if (ticksProp.length === 0) return [];
    return ticksProp.map((v) => (max === min ? 0 : (v - min) / (max - min)));
  }
  const count = typeof ticksProp === 'number' && ticksProp > 1 ? ticksProp : 5;
  return Array.from({ length: count }, (_, i) => i / (count - 1));
};

const CROSS_SIZE = 30;
const GROOVE_THICKNESS = 2;

const Fader = ({
  id,
  label,
  value,
  min = 0,
  max = 1,
  step = 0,
  ticks,
  defaultValue,
  orientation = 'horizontal',
  length,
  onChange,
  unit = '',
  format,
  showValue = true,
  disabled = false
}) => {
  const generatedId = useId();
  const faderId = id || `kit-fader-${generatedId}`;
  const isVertical = orientation === 'vertical';
  const trackLength = length || (isVertical ? 120 : 160);
  const travelPx = getFaderTravel(trackLength);

  const safeValue = clamp(Number.isFinite(value) ? value : min, min, max);
  const ratio = max === min ? 0 : (safeValue - min) / (max - min);

  const { dragging, dragHandlers, nudge, commit } = useDragValue({
    value: safeValue,
    min,
    max,
    step,
    defaultValue,
    axis: isVertical ? 'vertical' : 'horizontal',
    travel: travelPx,
    disabled,
    onChange
  });

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

  const handleDoubleClick = useCallback(() => {
    if (disabled || typeof defaultValue !== 'number') return;
    commit(defaultValue);
  }, [disabled, defaultValue, commit]);

  const tickRatios = useMemo(() => resolveTickRatios(ticks, min, max), [ticks, min, max]);

  const capCenter = isVertical
    ? getVerticalCapCenter(ratio, trackLength)
    : getHorizontalCapCenter(ratio, trackLength);
  const travelStart = isVertical
    ? getVerticalCapCenter(0, trackLength)
    : getHorizontalCapCenter(0, trackLength);

  const formatFn = typeof format === 'function' ? format : (v) => defaultFormat(v, unit);
  const valueText = formatFn(safeValue);

  const svgWidth = isVertical ? CROSS_SIZE : trackLength;
  const svgHeight = isVertical ? trackLength : CROSS_SIZE;
  const grooveCross = CROSS_SIZE / 2;

  const tickPaths = useMemo(() => {
    const lastIndex = tickRatios.length - 1;
    const middleIndex = Math.floor(lastIndex / 2);
    const paths = { major: [], minor: [] };
    tickRatios.forEach((tickRatio, index) => {
      const isMajor = index === 0 || index === middleIndex || index === lastIndex;
      const tickLen = isMajor ? 7 : 4;
      if (isVertical) {
        const y = getVerticalCapCenter(tickRatio, trackLength);
        paths[isMajor ? 'major' : 'minor'].push(
          `M ${grooveCross + CAP_CROSS / 2 + 2} ${y} h ${tickLen}`
        );
        return;
      }
      const x = getHorizontalCapCenter(tickRatio, trackLength);
      paths[isMajor ? 'major' : 'minor'].push(
        `M ${x} ${grooveCross + CAP_CROSS / 2 + 2} v ${tickLen}`
      );
    });
    return {
      major: paths.major.join(' '),
      minor: paths.minor.join(' ')
    };
  }, [isVertical, tickRatios, trackLength]);

  const tickElements = useMemo(() => (
    <>
      {tickPaths.minor && (
        <path
          d={tickPaths.minor}
          className="kit-fader__tick kit-fader__tick--minor"
          fill="none"
          strokeWidth={1}
        />
      )}
      {tickPaths.major && (
        <path
          d={tickPaths.major}
          className="kit-fader__tick kit-fader__tick--major"
          fill="none"
          strokeWidth={1.25}
        />
      )}
    </>
  ), [tickPaths]);

  return (
    <div className={`kit-fader kit-fader--${orientation}${disabled ? ' kit-fader--disabled' : ''}`}>
      {label && <span className="kit-fader__label">{label}</span>}
      <div
        id={faderId}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-orientation={orientation}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={safeValue}
        aria-valuetext={valueText}
        aria-disabled={disabled || undefined}
        className={`kit-fader__track${dragging ? ' kit-fader__track--dragging' : ''}`}
        style={{
          '--kit-fader-length': `${trackLength}px`,
          '--kit-fader-cross': `${CROSS_SIZE}px`
        }}
        onPointerDown={dragHandlers.onPointerDown}
        onPointerMove={dragHandlers.onPointerMove}
        onPointerUp={dragHandlers.onPointerUp}
        onPointerCancel={dragHandlers.onPointerCancel}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
      >
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} shapeRendering="crispEdges" aria-hidden="true">
          {isVertical ? (
            <>
              <rect
                x={grooveCross - GROOVE_THICKNESS / 2}
                y={0}
                width={GROOVE_THICKNESS}
                height={trackLength}
                className="kit-fader__groove"
              />
              {tickElements}
              <rect
                x={grooveCross - GROOVE_THICKNESS / 2}
                y={Math.min(travelStart, capCenter)}
                width={GROOVE_THICKNESS}
                height={Math.abs(capCenter - travelStart)}
                className="kit-fader__fill"
              />
              <rect
                x={grooveCross - CAP_CROSS / 2}
                y={capCenter - CAP_EXTENT / 2}
                width={CAP_CROSS}
                height={CAP_EXTENT}
                rx={2}
                className={`kit-fader__cap${dragging ? ' kit-fader__cap--dragging' : ''}`}
              />
              <line
                x1={grooveCross - CAP_CROSS / 2 + 2}
                x2={grooveCross + CAP_CROSS / 2 - 2}
                y1={capCenter}
                y2={capCenter}
                className="kit-fader__cap-line"
                strokeWidth={1}
              />
            </>
          ) : (
            <>
              <rect
                x={0}
                y={grooveCross - GROOVE_THICKNESS / 2}
                width={trackLength}
                height={GROOVE_THICKNESS}
                className="kit-fader__groove"
              />
              {tickElements}
              <rect
                x={Math.min(travelStart, capCenter)}
                y={grooveCross - GROOVE_THICKNESS / 2}
                width={Math.abs(capCenter - travelStart)}
                height={GROOVE_THICKNESS}
                className="kit-fader__fill"
              />
              <rect
                x={capCenter - CAP_EXTENT / 2}
                y={grooveCross - CAP_CROSS / 2}
                width={CAP_EXTENT}
                height={CAP_CROSS}
                rx={2}
                className={`kit-fader__cap${dragging ? ' kit-fader__cap--dragging' : ''}`}
              />
              <line
                x1={capCenter}
                x2={capCenter}
                y1={grooveCross - CAP_CROSS / 2 + 2}
                y2={grooveCross + CAP_CROSS / 2 - 2}
                className="kit-fader__cap-line"
                strokeWidth={1}
              />
            </>
          )}
        </svg>
      </div>
      {showValue && (
        <span className={`kit-fader__value${dragging ? ' kit-fader__value--active' : ''}`}>{valueText}</span>
      )}
    </div>
  );
};

export default React.memo(Fader);
