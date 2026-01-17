import React, { useState } from 'react';
import { AUDIO_PARAM_DEFAULTS, AUDIO_PARAM_RANGES } from '../utils/audioParams.js';

const percentValue = (value) => Math.round(value * 100);
const percentRange = (range) => ({
  min: Math.round(range.min * 100),
  max: Math.round(range.max * 100),
  step: Math.max(1, Math.round(range.step * 100))
});

const makeSlider = (param, { id, label, display, helpText }) => {
  const range = AUDIO_PARAM_RANGES[param];
  return {
    id,
    label,
    param,
    min: range.min,
    max: range.max,
    step: range.step,
    toSlider: (value) => value,
    fromSlider: (value) => value,
    display: display || ((value) => `${value}`),
    helpText
  };
};

const makePercentSlider = (param, { id, label, display, helpText }) => {
  const range = AUDIO_PARAM_RANGES[param];
  const uiRange = percentRange(range);
  return {
    id,
    label,
    param,
    min: uiRange.min,
    max: uiRange.max,
    step: uiRange.step,
    toSlider: (value) => percentValue(value),
    fromSlider: (value) => value / 100,
    display: display || ((value) => `${percentValue(value)}%`),
    helpText
  };
};

const ESSENTIAL_SLIDERS = [
  makePercentSlider('volume', {
    id: 'volume',
    label: 'Volume',
    helpText: 'Set the output level. Designed for quick sweeps and precise control.'
  }),
  makePercentSlider('pan', {
    id: 'pan',
    label: 'Stereo pan',
    display: (value) => `L${Math.round((value - 0.5) * 200)} R`
  })
];

const EFFECT_SLIDERS = [
  makeSlider('delay', {
    id: 'delay',
    label: 'Delay',
    display: (value) => `${Math.round(value)} ms`
  }),
  makePercentSlider('reverb', {
    id: 'reverb',
    label: 'Reverb'
  }),
  makePercentSlider('distortion', {
    id: 'distortion',
    label: 'Distortion'
  })
];

const ADSR_SLIDERS = [
  makeSlider('attack', {
    id: 'attack',
    label: 'Attack',
    display: (value) => `${value.toFixed(2)} s`
  }),
  makeSlider('decay', {
    id: 'decay',
    label: 'Decay',
    display: (value) => `${value.toFixed(2)} s`
  }),
  makePercentSlider('sustain', {
    id: 'sustain',
    label: 'Sustain'
  }),
  makeSlider('release', {
    id: 'release',
    label: 'Release',
    display: (value) => `${value.toFixed(2)} s`
  })
];

const FM_SLIDERS = [
  makeSlider('fmRatio', {
    id: 'fm-ratio',
    label: 'FM ratio',
    display: (value) => `${value.toFixed(2)} : 1`
  }),
  makeSlider('fmIndex', {
    id: 'fm-index',
    label: 'FM index',
    display: (value) => `${value.toFixed(1)}`
  })
];

const PHASE_SLIDER = makeSlider('phaseOffset', {
  id: 'phase-offset',
  label: 'Phase offset',
  display: (value) => `${Math.round(value)}°`
});

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

  const getParam = (key) => {
    const value = audioParams?.[key];
    if (typeof value === 'number') return value;
    return AUDIO_PARAM_DEFAULTS[key];
  };

  const getToggle = (key) => {
    const value = audioParams?.[key];
    if (typeof value === 'boolean') return value;
    return !!AUDIO_PARAM_DEFAULTS[key];
  };

  const renderSlider = (slider) => {
    const paramValue = getParam(slider.param);
    return (
      <SliderControl
        key={slider.id}
        id={slider.id}
        label={slider.label}
        value={slider.toSlider(paramValue)}
        displayValue={slider.display(paramValue)}
        min={slider.min}
        max={slider.max}
        step={slider.step}
        onChange={(value) => onParamChange(slider.param, slider.fromSlider(value))}
        helpText={slider.helpText}
      />
    );
  };

  const useADSR = getToggle('useADSR');
  const useFM = getToggle('useFM');

  return (
    <div className="panel elevated control-groups">
      <div className="control-section">
        <div className="label-stack">
          <h2 className="controls-heading">Essentials</h2>
          <button
            type="button"
            className="button-link"
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            {showAdvanced ? 'Hide advanced' : 'Show advanced'}
          </button>
        </div>
        {ESSENTIAL_SLIDERS.map(renderSlider)}
      </div>

      <div className="control-section">
        <h2 className="controls-heading">Effects</h2>
        {EFFECT_SLIDERS.map(renderSlider)}
      </div>

      {showAdvanced && (
        <div className="control-section">
          <h2 className="controls-heading">Modulation</h2>
          <label className="toggle-row" htmlFor="use-adsr">
            <span>ADSR envelope</span>
            <input
              id="use-adsr"
              type="checkbox"
              checked={useADSR}
              onChange={(e) => onParamChange('useADSR', e.target.checked)}
            />
          </label>
          {useADSR && (
            <div className="slider-grid">
              {ADSR_SLIDERS.map(renderSlider)}
            </div>
          )}

          <label className="toggle-row" htmlFor="use-fm">
            <span>Frequency modulation</span>
            <input
              id="use-fm"
              type="checkbox"
              checked={useFM}
              onChange={(e) => onParamChange('useFM', e.target.checked)}
            />
          </label>
          {useFM && (
            <div className="slider-grid">
              {FM_SLIDERS.map(renderSlider)}
            </div>
          )}

          {renderSlider(PHASE_SLIDER)}
        </div>
      )}
    </div>
  );
};

export default AudioControls;
