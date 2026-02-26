import React from 'react';
import { WAVEFORM_OPTIONS } from '../utils/audioParams.js';

const UIOverlay = ({ currentWaveform, onWaveformChange }) => {
  return (
    <div className="panel elevated waveform-panel">
      <div className="label-stack">
        <h2 className="controls-heading">Waveform</h2>
        <span className="slider-value">{currentWaveform}</span>
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
