import React, { useState } from 'react';

const SliderControl = ({
  id,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  helpText
}) => {
  const numericMin = typeof min === 'number' ? min : Number(min ?? 0);
  const numericMax = typeof max === 'number' ? max : Number(max ?? 1);
  const numericValue = typeof value === 'number' ? value : Number(value ?? 0);
  const safeRange = numericMax - numericMin === 0 ? 1 : numericMax - numericMin;
  const progress = Math.min(Math.max((numericValue - numericMin) / safeRange, 0), 1);
  const sliderProgressStyle = { '--slider-progress': `${(progress * 100).toFixed(2)}%` };

  return (
    <div className="slider-group">
      <div className="label-stack">
        <label htmlFor={id}>{label}</label>
        <span className="slider-value">{displayValue}</span>
      </div>
      {helpText && <p className="slider-description">{helpText}</p>}
      <div className="slider-input-wrapper" style={sliderProgressStyle}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          style={sliderProgressStyle}
        />
      </div>
    </div>
  );
};

const AudioControls = ({ audioParams, onParamChange }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="panel elevated control-groups">
      <div className="control-section">
        <div className="label-stack">
          <h2 className="controls-heading">Essentials</h2>
          <button
            type="button"
            className="button-link"
            onClick={() => setShowAdvanced(prev => !prev)}
          >
            {showAdvanced ? 'Hide advanced' : 'Show advanced'}
          </button>
        </div>
        <SliderControl
          id="volume"
          label="Volume"
          value={Math.round((audioParams.volume ?? 0.7) * 100)}
          displayValue={`${Math.round((audioParams.volume ?? 0.7) * 100)}%`}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onParamChange('volume', v / 100)}
          helpText="Set the output level. Designed for quick sweeps and precise control."
        />
        <SliderControl
          id="pan"
          label="Stereo pan"
          value={Math.round((audioParams.pan ?? 0.5) * 100)}
          displayValue={`L${Math.round(((audioParams.pan ?? 0.5) - 0.5) * 200)} R`}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onParamChange('pan', v / 100)}
        />
      </div>

      <div className="control-section">
        <h2 className="controls-heading">Effects</h2>
        <SliderControl
          id="delay"
          label="Delay"
          value={audioParams.delay ?? 0}
          displayValue={`${Math.round(audioParams.delay ?? 0)} ms`}
          min={0}
          max={500}
          step={10}
          onChange={(v) => onParamChange('delay', v)}
        />
        <SliderControl
          id="reverb"
          label="Reverb"
          value={Math.round((audioParams.reverb ?? 0) * 100)}
          displayValue={`${Math.round((audioParams.reverb ?? 0) * 100)}%`}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onParamChange('reverb', v / 100)}
        />
        <SliderControl
          id="distortion"
          label="Distortion"
          value={Math.round((audioParams.distortion ?? 0) * 100)}
          displayValue={`${Math.round((audioParams.distortion ?? 0) * 100)}%`}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onParamChange('distortion', v / 100)}
        />
      </div>

      {showAdvanced && (
        <div className="control-section">
          <h2 className="controls-heading">Modulation</h2>
          <label className="toggle-row" htmlFor="use-adsr">
            <span>ADSR envelope</span>
            <input
              id="use-adsr"
              type="checkbox"
              checked={audioParams.useADSR ?? false}
              onChange={(e) => onParamChange('useADSR', e.target.checked)}
            />
          </label>
          {audioParams.useADSR && (
            <div className="slider-grid">
              <SliderControl
                id="attack"
                label="Attack"
                value={audioParams.attack ?? 0.05}
                displayValue={`${(audioParams.attack ?? 0.05).toFixed(2)} s`}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => onParamChange('attack', v)}
              />
              <SliderControl
                id="decay"
                label="Decay"
                value={audioParams.decay ?? 0.1}
                displayValue={`${(audioParams.decay ?? 0.1).toFixed(2)} s`}
                min={0}
                max={2}
                step={0.01}
                onChange={(v) => onParamChange('decay', v)}
              />
              <SliderControl
                id="sustain"
                label="Sustain"
                value={Math.round((audioParams.sustain ?? 0.7) * 100)}
                displayValue={`${Math.round((audioParams.sustain ?? 0.7) * 100)}%`}
                min={0}
                max={100}
                step={1}
                onChange={(v) => onParamChange('sustain', v / 100)}
              />
              <SliderControl
                id="release"
                label="Release"
                value={audioParams.release ?? 0.3}
                displayValue={`${(audioParams.release ?? 0.3).toFixed(2)} s`}
                min={0}
                max={3}
                step={0.01}
                onChange={(v) => onParamChange('release', v)}
              />
            </div>
          )}

          <label className="toggle-row" htmlFor="use-fm">
            <span>Frequency modulation</span>
            <input
              id="use-fm"
              type="checkbox"
              checked={audioParams.useFM ?? false}
              onChange={(e) => onParamChange('useFM', e.target.checked)}
            />
          </label>
          {audioParams.useFM && (
            <div className="slider-grid">
              <SliderControl
                id="fm-ratio"
                label="FM ratio"
                value={audioParams.fmRatio ?? 2.5}
                displayValue={`${(audioParams.fmRatio ?? 2.5).toFixed(2)} : 1`}
                min={0.5}
                max={6}
                step={0.1}
                onChange={(v) => onParamChange('fmRatio', v)}
              />
              <SliderControl
                id="fm-index"
                label="FM index"
                value={audioParams.fmIndex ?? 5}
                displayValue={`${(audioParams.fmIndex ?? 5).toFixed(1)}`}
                min={0}
                max={20}
                step={0.5}
                onChange={(v) => onParamChange('fmIndex', v)}
              />
            </div>
          )}

          <SliderControl
            id="phase-offset"
            label="Phase offset"
            value={audioParams.phaseOffset ?? 0}
            displayValue={`${Math.round(audioParams.phaseOffset ?? 0)}°`}
            min={0}
            max={360}
            step={1}
            onChange={(v) => onParamChange('phaseOffset', v)}
          />
        </div>
      )}
    </div>
  );
};

export default AudioControls;
