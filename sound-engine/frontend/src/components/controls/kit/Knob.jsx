import React, { useCallback, useEffect, useId, useRef } from 'react';
import { clamp } from '../../../utils/math.js';
import useDragValue from './useDragValue.js';
import NumField, { defaultFormat } from './NumField.jsx';

/**
 * Knob — the workhorse continuous-parameter control.
 *
 * SVG-drawn: an 11-tick hairline ring over a 270deg sweep (-135deg to
 * +135deg), an accent value arc (from the sweep start, or from the CENTER
 * when `bipolar`), and a flat ink body with a pointer line. The value
 * readout below the body is a bare-variant NumField — one interaction
 * language, and typing a precise value works on every knob.
 */

const START_ANGLE = -135;
const SWEEP = 270;
const TICK_COUNT = 11; // majors at 0, 5, 10 (both ends + center)

const SIZE_CONFIG = {
  md: {
    svg: 68, bodyR: 22, ringR: 30, arcR: 26,
    tickMinor: 2.5, tickMajor: 5.5, pointerStart: 6, pointerLen: 14
  },
  sm: {
    svg: 50, bodyR: 16, ringR: 22, arcR: 19,
    tickMinor: 2, tickMajor: 4.5, pointerStart: 5, pointerLen: 10
  }
};

const toRad = (angleDeg) => ((angleDeg - 90) * Math.PI) / 180;

const polarToCartesian = (cx, cy, r, angleDeg) => {
  const rad = toRad(angleDeg);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  if (Math.abs(endAngle - startAngle) < 0.0001) return '';
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

const STATIC_TICK_PATHS_BY_SIZE = Object.fromEntries(
  Object.entries(SIZE_CONFIG).map(([size, cfg]) => {
    const cx = cfg.svg / 2;
    const cy = cfg.svg / 2;
    const paths = { major: [], minor: [] };
    for (let index = 0; index < TICK_COUNT; index += 1) {
      const angle = START_ANGLE + (index * SWEEP) / (TICK_COUNT - 1);
      const isMajor = index === 0 || index === 5 || index === TICK_COUNT - 1;
      const tickLen = isMajor ? cfg.tickMajor : cfg.tickMinor;
      const outer = polarToCartesian(cx, cy, cfg.ringR, angle);
      const inner = polarToCartesian(cx, cy, cfg.ringR - tickLen, angle);
      paths[isMajor ? 'major' : 'minor'].push(
        `M ${inner.x} ${inner.y} L ${outer.x} ${outer.y}`
      );
    }
    return [size, [
      <path
        key="minor"
        d={paths.minor.join(' ')}
        className="kit-knob__tick kit-knob__tick--minor"
        fill="none"
        strokeWidth={1}
      />,
      <path
        key="major"
        d={paths.major.join(' ')}
        className="kit-knob__tick kit-knob__tick--major"
        fill="none"
        strokeWidth={1.25}
      />
    ]];
  })
);

const Knob = ({
  id,
  label,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue,
  unit = '',
  format,
  bipolar = false,
  size = 'md',
  onChange,
  disabled = false
}) => {
  const generatedId = useId();
  const knobId = id || `kit-knob-${generatedId}`;
  const cfg = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const cx = cfg.svg / 2;
  const cy = cfg.svg / 2;

  const safeValue = clamp(Number.isFinite(value) ? value : min, min, max);
  const ratio = max === min ? 0 : (safeValue - min) / (max - min);
  const valueAngle = START_ANGLE + ratio * SWEEP;
  const centerAngle = START_ANGLE + SWEEP / 2;

  const { dragging, dragHandlers, nudge, commit, handleDoubleClick } = useDragValue({
    value: safeValue,
    min,
    max,
    step,
    defaultValue,
    axis: 'vertical',
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

  // Wheel must be attached natively with { passive: false }: React 17+
  // registers root wheel listeners as PASSIVE, so a preventDefault inside a
  // React onWheel is silently ignored — the knob would adjust AND the page
  // would scroll (with a Chrome passive-listener warning). The latest
  // nudge/disabled live in a ref so the native listener is attached once
  // per mount instead of churning on every value change.
  const bodyRef = useRef(null);
  const wheelStateRef = useRef(null);
  if (!wheelStateRef.current) wheelStateRef.current = { disabled, nudge };

  useEffect(() => {
    wheelStateRef.current = { disabled, nudge };
  }, [disabled, nudge]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const handleWheel = (event) => {
      const { disabled: isDisabled, nudge: doNudge } = wheelStateRef.current;
      if (isDisabled) return;
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      doNudge(direction, true, false);
    };
    body.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      body.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const tickPaths = STATIC_TICK_PATHS_BY_SIZE[size] || STATIC_TICK_PATHS_BY_SIZE.md;

  const arcPath = bipolar
    ? (valueAngle >= centerAngle
      ? describeArc(cx, cy, cfg.arcR, centerAngle, valueAngle)
      : describeArc(cx, cy, cfg.arcR, valueAngle, centerAngle))
    : describeArc(cx, cy, cfg.arcR, START_ANGLE, valueAngle);

  const pointerInner = polarToCartesian(cx, cy, cfg.pointerStart, valueAngle);
  const pointerOuter = polarToCartesian(cx, cy, cfg.pointerStart + cfg.pointerLen, valueAngle);

  const formatFn = typeof format === 'function' ? format : (v) => defaultFormat(v, unit);
  const valueText = formatFn(safeValue);

  return (
    <div className={`kit-knob kit-knob--${size}${disabled ? ' kit-knob--disabled' : ''}`}>
      <div
        id={knobId}
        ref={bodyRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={safeValue}
        aria-valuetext={valueText}
        aria-orientation="vertical"
        aria-disabled={disabled || undefined}
        className={`kit-knob__body${dragging ? ' kit-knob__body--dragging' : ''}`}
        style={{ '--kit-knob-svg': `${cfg.svg}px` }}
        onPointerDown={dragHandlers.onPointerDown}
        onPointerMove={dragHandlers.onPointerMove}
        onPointerUp={dragHandlers.onPointerUp}
        onPointerCancel={dragHandlers.onPointerCancel}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
      >
        <svg viewBox={`0 0 ${cfg.svg} ${cfg.svg}`} shapeRendering="geometricPrecision" aria-hidden="true">
          <g className="kit-knob__ticks">{tickPaths}</g>
          {arcPath && <path d={arcPath} className="kit-knob__arc" fill="none" strokeWidth={2.5} strokeLinecap="round" />}
          <circle cx={cx} cy={cy} r={cfg.bodyR} className="kit-knob__face" strokeWidth={1} />
          <line
            x1={pointerInner.x} y1={pointerInner.y}
            x2={pointerOuter.x} y2={pointerOuter.y}
            className="kit-knob__pointer"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="kit-knob__meta">
        <NumField
          id={`${knobId}-readout`}
          label={label}
          value={safeValue}
          min={min}
          max={max}
          step={step}
          defaultValue={defaultValue}
          unit={unit}
          format={format}
          onChange={onChange}
          variant="bare"
          align="center"
          disabled={disabled}
          emphasize={dragging}
        />
      </div>
    </div>
  );
};

export default React.memo(Knob);
