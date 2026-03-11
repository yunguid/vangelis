import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import {
  DELAY_MODE_OPTIONS,
  REVERB_MODE_OPTIONS,
  getDelaySeconds
} from '../utils/audioParams.js';

const CANVAS_WIDTH = 184;
const CANVAS_HEIGHT = 68;

const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || value;

const getNextOptionValue = (options, current) => {
  const index = options.findIndex((option) => option.value === current);
  if (index < 0) return options[0]?.value ?? current;
  return options[(index + 1) % options.length]?.value ?? current;
};

const clamp01 = (value) => Math.min(Math.max(value, 0), 1);

const drawDelayScene = (ctx, width, height, time, { enabled, intensity, motion, colorPulse, mode }) => {
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, enabled ? 'rgba(7, 11, 18, 0.96)' : 'rgba(9, 12, 16, 0.92)');
  background.addColorStop(1, enabled ? 'rgba(19, 13, 10, 0.98)' : 'rgba(13, 13, 13, 0.9)');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(120, 170, 220, 0.1)';
  ctx.lineWidth = 1;
  for (let row = 1; row < 4; row += 1) {
    const y = (height / 4) * row;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const pulseCount = mode === 'ping-pong' ? 6 : 4;
  for (let index = 0; index < pulseCount; index += 1) {
    const offset = (time * (0.24 + motion * 0.22) + index / pulseCount) % 1;
    const pulseX = width * (0.18 + offset * 0.72);
    const radius = 7 + offset * 26 + motion * 16;
    const alpha = enabled ? (0.14 + (1 - offset) * 0.22 + colorPulse * 0.08) : 0.06;
    ctx.strokeStyle = `rgba(246, 176, 112, ${alpha})`;
    ctx.lineWidth = 1.5 + (1 - offset) * 1.8;
    ctx.beginPath();
    ctx.arc(
      pulseX,
      height * (mode === 'ping-pong' ? (index % 2 === 0 ? 0.34 : 0.66) : 0.5),
      radius,
      Math.PI * 0.12,
      Math.PI * 1.88
    );
    ctx.stroke();
  }

  ctx.strokeStyle = enabled ? 'rgba(255, 207, 152, 0.92)' : 'rgba(170, 176, 184, 0.42)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (let x = 0; x <= width; x += 3) {
    const ratio = x / width;
    const waveA = Math.sin(time * 5.2 + ratio * Math.PI * 5.5);
    const waveB = Math.sin(time * 3.1 + ratio * Math.PI * (mode === 'tape' ? 2.5 : 3.6));
    const y = height * 0.5 + (waveA * (6 + motion * 10) + waveB * (3 + intensity * 8)) * 0.46;
    if (x === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
};

const drawReverbScene = (ctx, width, height, time, { enabled, intensity, motion, colorPulse, tone }) => {
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, enabled ? 'rgba(6, 10, 18, 0.98)' : 'rgba(9, 12, 16, 0.92)');
  background.addColorStop(1, enabled ? 'rgba(6, 13, 24, 0.94)' : 'rgba(13, 13, 13, 0.9)');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const centerX = width * 0.54;
  const centerY = height * 0.48;
  const halo = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, width * 0.44);
  halo.addColorStop(0, `rgba(130, 214, 255, ${enabled ? 0.22 + colorPulse * 0.12 : 0.08})`);
  halo.addColorStop(0.45, `rgba(84, 162, 255, ${enabled ? 0.1 + intensity * 0.12 : 0.04})`);
  halo.addColorStop(1, 'rgba(10, 18, 28, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  const ringCount = 5;
  for (let index = 0; index < ringCount; index += 1) {
    const phase = (time * (0.1 + motion * 0.08) + index / ringCount) % 1;
    const radius = 10 + phase * width * 0.32;
    const alpha = enabled ? (0.12 + (1 - phase) * 0.12 + tone * 0.06) : 0.05;
    ctx.strokeStyle = `rgba(122, 206, 255, ${alpha})`;
    ctx.lineWidth = 1.2 + (1 - phase) * 1.3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI * (0.15 + index * 0.06), Math.PI * (1.76 + index * 0.05));
    ctx.stroke();
  }

  const particles = 14;
  for (let index = 0; index < particles; index += 1) {
    const drift = time * (0.24 + motion * 0.14) + index * 0.73;
    const x = ((Math.sin(drift * 1.3) * 0.42) + 0.5) * width;
    const y = ((Math.cos(drift * 0.92) * 0.26) + 0.5) * height;
    const radius = 1.2 + ((index % 3) * 0.8) + intensity * 0.9;
    ctx.fillStyle = enabled
      ? `rgba(255, 232, 196, ${0.18 + (index % 4) * 0.04 + colorPulse * 0.05})`
      : 'rgba(180, 184, 194, 0.08)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
};

const FxPreviewCanvas = ({
  kind,
  enabled,
  intensity,
  motion,
  tone,
  mode
}) => {
  const canvasRef = useRef(null);
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
    const render = (timestamp) => {
      const width = canvas.width;
      const height = canvas.height;
      const time = timestamp * 0.001;
      const active = activityRef.current?.isActive ? 1 : 0;
      const colorPulse = active ? 1 : 0.36;
      const sceneState = {
        enabled,
        intensity,
        motion,
        tone,
        colorPulse,
        mode
      };

      if (kind === 'delay') {
        drawDelayScene(ctx, width, height, time, sceneState);
      } else {
        drawReverbScene(ctx, width, height, time, sceneState);
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [enabled, intensity, kind, mode, motion, tone]);

  return (
    <canvas
      ref={canvasRef}
      className="wave-candy-fx-card__canvas"
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      aria-hidden="true"
    />
  );
};

const WaveCandyFxCard = ({
  kind,
  enabled,
  expanded,
  mode,
  label,
  summary,
  detail,
  intensity,
  motion,
  tone,
  onExpandToggle,
  onEnabledToggle,
  onCycleMode
}) => (
  <article
    className={`wave-candy-fx-card wave-candy-fx-card--${kind} ${enabled ? 'is-enabled' : 'is-bypassed'} ${expanded ? 'is-expanded' : ''}`}
  >
    <button
      type="button"
      className="wave-candy-fx-card__main"
      onClick={onExpandToggle}
      aria-pressed={expanded}
      aria-label={`${label} controls ${expanded ? 'open' : 'closed'}`}
    >
      <FxPreviewCanvas
        kind={kind}
        enabled={enabled}
        intensity={intensity}
        motion={motion}
        tone={tone}
        mode={mode}
      />
      <div className="wave-candy-fx-card__copy">
        <span className="wave-candy-fx-card__eyebrow">{label}</span>
        <span className="wave-candy-fx-card__headline">
          {enabled ? 'Online' : 'Bypassed'}
        </span>
        <span className="wave-candy-fx-card__summary">{summary}</span>
        <span className="wave-candy-fx-card__summary wave-candy-fx-card__summary--muted">{detail}</span>
      </div>
      <span className="wave-candy-fx-card__state">
        <span className="wave-candy-fx-card__mode">{mode}</span>
        <span className="wave-candy-fx-card__hint">{expanded ? 'Collapse' : 'Open'}</span>
      </span>
    </button>
    <div className="wave-candy-fx-card__actions">
      <button
        type="button"
        className={`wave-candy-fx-card__action ${enabled ? 'is-active' : ''}`}
        onClick={onEnabledToggle}
      >
        {enabled ? 'Bypass' : 'Enable'}
      </button>
      <button
        type="button"
        className="wave-candy-fx-card__action"
        onClick={onCycleMode}
      >
        Cycle {label}
      </button>
    </div>
  </article>
);

const WaveCandyFxDock = ({
  audioParams,
  onParamChange,
  transportBpm = 120,
  sections = {},
  onSectionToggle
}) => {
  const delaySeconds = getDelaySeconds(audioParams, transportBpm);
  const delayMs = Math.round(delaySeconds * 1000);
  const delayModeLabel = getOptionLabel(DELAY_MODE_OPTIONS, audioParams.delayMode);
  const reverbModeLabel = getOptionLabel(REVERB_MODE_OPTIONS, audioParams.reverbMode);

  const handleDelayModeCycle = () => {
    onParamChange('delayMode', getNextOptionValue(DELAY_MODE_OPTIONS, audioParams.delayMode));
  };

  const handleReverbModeCycle = () => {
    onParamChange('reverbMode', getNextOptionValue(REVERB_MODE_OPTIONS, audioParams.reverbMode));
  };

  return (
    <div className="wave-candy-fx-dock" aria-label="Effect quick controls">
      <WaveCandyFxCard
        kind="delay"
        label="Delay"
        enabled={audioParams.delayEnabled}
        expanded={!!sections.delay}
        mode={delayModeLabel}
        summary={`${delayMs} ms repeats`}
        detail={`${Math.round(clamp01(audioParams.delayMix) * 100)}% blend, ${Math.round(clamp01(audioParams.delayFeedback) * 100)}% feedback`}
        intensity={clamp01(audioParams.delayMix)}
        motion={clamp01(audioParams.delayMotion)}
        tone={1 - clamp01(audioParams.delayAge)}
        onExpandToggle={() => onSectionToggle('delay')}
        onEnabledToggle={() => onParamChange('delayEnabled', !audioParams.delayEnabled)}
        onCycleMode={handleDelayModeCycle}
      />
      <WaveCandyFxCard
        kind="reverb"
        label="Reverb"
        enabled={audioParams.reverbEnabled}
        expanded={!!sections.reverb}
        mode={reverbModeLabel}
        summary={`${Math.round(clamp01(audioParams.reverbDecay) * 100)}% decay, ${Math.round(audioParams.reverbPreDelay)} ms pre-delay`}
        detail={`${Math.round(clamp01(audioParams.reverbMix) * 100)}% blend, ${Math.round(clamp01(audioParams.reverbSize) * 100)}% size`}
        intensity={clamp01(audioParams.reverbMix)}
        motion={clamp01(audioParams.reverbSize)}
        tone={clamp01(audioParams.reverbTone)}
        onExpandToggle={() => onSectionToggle('reverb')}
        onEnabledToggle={() => onParamChange('reverbEnabled', !audioParams.reverbEnabled)}
        onCycleMode={handleReverbModeCycle}
      />
    </div>
  );
};

export default WaveCandyFxDock;
