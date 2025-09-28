import React from 'react';

const waveforms = ['Sine', 'Sawtooth', 'Square', 'Triangle'];

const UIOverlay = ({ currentWaveform, onWaveformChange }) => {
  return (
    <div className="panel elevated waveform-panel">
      <div className="label-stack">
        <h2 className="controls-heading">Waveform</h2>
        <span className="slider-value">{currentWaveform}</span>
      </div>
      <p className="panel-subtitle">
        Choose the harmonic profile for the instrument. Changes update instantly.
      </p>
      <div className="waveform-grid" role="radiogroup" aria-label="Waveform selection">
        {waveforms.map(wave => {
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
      <div className="panel-footer">
        <span className="control-chip">Shift + / opens shortcuts</span>
        <span className="control-chip">Z / X for octave</span>
      </div>
    </div>
  );
};

export default UIOverlay;
