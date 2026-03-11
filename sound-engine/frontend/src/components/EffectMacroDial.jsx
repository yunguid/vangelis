import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine.js';

const CANVAS_SIZE = 112;
const TRACK_START = Math.PI * 0.72;
const TRACK_END = Math.PI * 2.28;
const TRACK_SPAN = TRACK_END - TRACK_START;

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

const ACCENTS = {
  delay: {
    glow: '246, 176, 112',
    fill: '255, 216, 170',
    shadow: '255, 122, 61'
  },
  reverb: {
    glow: '126, 214, 255',
    fill: '210, 241, 255',
    shadow: '74, 166, 255'
  }
};

const drawDial = (ctx, size, value, accent, isActive, isDisabled, labelSeed) => {
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size * 0.42;
  const innerRadius = size * 0.26;
  const start = TRACK_START;
  const end = TRACK_START + TRACK_SPAN * clamp01(value);
  const accentSet = ACCENTS[accent] || ACCENTS.delay;

  ctx.clearRect(0, 0, size, size);

  const background = ctx.createRadialGradient(cx, cy, innerRadius * 0.4, cx, cy, outerRadius * 1.15);
  background.addColorStop(0, isDisabled ? 'rgba(20, 24, 30, 0.92)' : 'rgba(16, 20, 28, 0.96)');
  background.addColorStop(1, 'rgba(7, 10, 15, 0)');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  for (let tick = 0; tick < 20; tick += 1) {
    const ratio = tick / 19;
    const angle = TRACK_START + TRACK_SPAN * ratio;
    const inner = outerRadius - 8;
    const outer = outerRadius + (tick % 2 === 0 ? 3 : 0);
    const x0 = cx + Math.cos(angle) * inner;
    const y0 = cy + Math.sin(angle) * inner;
    const x1 = cx + Math.cos(angle) * outer;
    const y1 = cy + Math.sin(angle) * outer;
    ctx.strokeStyle = `rgba(180, 190, 205, ${isDisabled ? 0.08 : 0.12})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  ctx.strokeStyle = `rgba(255, 255, 255, ${isDisabled ? 0.08 : 0.1})`;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, TRACK_START, TRACK_END);
  ctx.stroke();

  const pulse = isActive ? 0.18 : 0.08;
  ctx.strokeStyle = `rgba(${accentSet.glow}, ${isDisabled ? 0.12 : 0.34 + pulse})`;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, start, end);
  ctx.stroke();

  ctx.strokeStyle = `rgba(${accentSet.fill}, ${isDisabled ? 0.24 : 0.92})`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, start, end);
  ctx.stroke();

  const knobAngle = end;
  const knobRadius = outerRadius;
  const knobX = cx + Math.cos(knobAngle) * knobRadius;
  const knobY = cy + Math.sin(knobAngle) * knobRadius;

  ctx.beginPath();
  ctx.fillStyle = `rgba(${accentSet.shadow}, ${isDisabled ? 0.16 : 0.26 + pulse})`;
  ctx.arc(knobX, knobY, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = `rgba(${accentSet.fill}, ${isDisabled ? 0.42 : 1})`;
  ctx.arc(knobX, knobY, 5.2, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(cx, cy, 4, cx, cy, innerRadius * 1.1);
  core.addColorStop(0, isDisabled ? 'rgba(30, 35, 44, 0.98)' : 'rgba(20, 24, 32, 0.98)');
  core.addColorStop(1, isDisabled ? 'rgba(10, 12, 18, 0.98)' : 'rgba(7, 10, 16, 0.98)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${accentSet.glow}, ${isDisabled ? 0.08 : 0.16})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius + 4, 0, Math.PI * 2);
  ctx.stroke();

  const orbitAngle = (labelSeed * 0.17) + (performance.now() * 0.00035);
  const orbitX = cx + Math.cos(orbitAngle) * (innerRadius - 4);
  const orbitY = cy + Math.sin(orbitAngle) * (innerRadius - 4);
  ctx.beginPath();
  ctx.fillStyle = `rgba(${accentSet.fill}, ${isDisabled ? 0.14 : 0.3 + pulse})`;
  ctx.arc(orbitX, orbitY, isActive ? 2.2 : 1.6, 0, Math.PI * 2);
  ctx.fill();
};

const EffectMacroDial = ({
  id,
  label,
  value,
  displayValue,
  onChange,
  accent = 'delay',
  disabled = false
}) => {
  const canvasRef = useRef(null);
  const dragRef = useRef({
    active: false,
    pointerId: null,
    startY: 0,
    startValue: 0
  });
  const activityRef = useRef(audioEngine.getActivity());

  useEffect(() => audioEngine.subscribeActivity((activity) => {
    activityRef.current = activity;
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return () => undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => undefined;

    let rafId = 0;
    const seed = Array.from(label).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const render = () => {
      drawDial(
        ctx,
        canvas.width,
        value,
        accent,
        !!activityRef.current?.isActive,
        disabled,
        seed
      );
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [accent, disabled, label, value]);

  const updateFromDelta = (clientY) => {
    const drag = dragRef.current;
    const delta = (drag.startY - clientY) / 180;
    onChange(clamp01(drag.startValue + delta));
  };

  const handlePointerDown = (event) => {
    if (disabled) return;
    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startValue: clamp01(value)
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) return;
    updateFromDelta(event.clientY);
  };

  const handlePointerUp = (event) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;
    const coarse = event.shiftKey ? 0.08 : 0.02;
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
      event.preventDefault();
      onChange(clamp01(value + coarse));
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
      event.preventDefault();
      onChange(clamp01(value - coarse));
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      onChange(1);
    }
  };

  return (
    <div className={`effect-macro-dial ${disabled ? 'is-disabled' : ''}`}>
      <div
        id={id}
        className="effect-macro-dial__touch"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamp01(value) * 100)}
        aria-valuetext={displayValue}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="effect-macro-dial__canvas"
          aria-hidden="true"
        />
      </div>
      <div className="effect-macro-dial__meta">
        <span className="effect-macro-dial__label">{label}</span>
        <span className="effect-macro-dial__value">{displayValue}</span>
      </div>
    </div>
  );
};

export default EffectMacroDial;
