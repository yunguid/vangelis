import React from 'react';
import { WAVEFORM_OPTIONS } from '../utils/audioParams.js';

const UIOverlay = ({ currentWaveform, onWaveformChange }) => {
  const mobileSelectId = 'waveform-mobile-select';

  return (
    <div className="panel elevated waveform-panel">
      <div className="label-stack">
        <h2 className="controls-heading">Waveform</h2>
        <span className="slider-value">{currentWaveform}</span>
      </div>
      <p className="panel-subtitle">
        Choose the harmonic profile for the instrument. Changes update instantly.
      </p>
      <div className="waveform-mobile-select">
        <label htmlFor={mobileSelectId} className="waveform-mobile-select__label">
          Synth selector
        </label>
        <select
          id={mobileSelectId}
          className="waveform-mobile-select__input"
          value={currentWaveform}
          onChange={(event) => onWaveformChange(event.target.value)}
          aria-label="Synth selector"
        >
          {WAVEFORM_OPTIONS.map((wave) => (
            <option key={wave} value={wave}>{wave}</option>
          ))}
        </select>
      </div>
      <div className="waveform-grid" role="radiogroup" aria-label="Waveform selection">
        {WAVEFORM_OPTIONS.map((wave) => {
          const isActive = currentWaveform === wave;
          return (
            <button
              key={wave}
              type="button"
              className={`waveform-button${isActive ? ' is-active' : ''}`}
              onClick={() => onWaveformChange(wave)}
              role="radio"
              aria-checked={isActive}
            >
              <span>{wave}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default UIOverlay;
