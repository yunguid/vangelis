import React from 'react';
import { WAVEFORM_OPTIONS } from '../utils/audioParams.js';

const WAVEFORM_LABELS = {
  Sine: 'Sine',
  Sawtooth: 'Saw',
  Square: 'Square',
  Triangle: 'Triangle'
};

const UIOverlay = ({ currentWaveform, onWaveformChange, compact = false }) => {
  const rootClassName = compact
    ? 'waveform-panel waveform-panel--inline'
    : 'panel elevated waveform-panel';

  return (
    <div className={rootClassName}>
      <div className="label-stack">
        <h2 className="controls-heading">Waveform</h2>
        <span className="slider-value">{currentWaveform}</span>
      </div>
      <div
        className={`waveform-grid${compact ? ' waveform-grid--inline' : ''}`}
        role="radiogroup"
        aria-label="Waveform selection"
      >
        {WAVEFORM_OPTIONS.map((wave) => {
          const isActive = currentWaveform === wave;
          return (
            <button
              key={wave}
              type="button"
              className={`waveform-button${isActive ? ' is-active' : ''}${compact ? ' waveform-button--compact' : ''}`}
              onClick={() => onWaveformChange(wave)}
              role="radio"
              aria-checked={isActive}
              aria-label={wave}
            >
              <span>{compact ? WAVEFORM_LABELS[wave] : wave}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default UIOverlay;
