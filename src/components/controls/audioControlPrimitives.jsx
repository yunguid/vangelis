import React from 'react';
import ValueSlider from './ValueSlider.jsx';
import {
  AUDIO_PARAM_RANGES,
  MAX_MOD_ROUTES,
  MOD_DEST_OPTIONS,
  MOD_SOURCE_OPTIONS
} from '../../utils/audioParams.js';

export const percentValue = (value) => Math.round(value * 100);

const percentRange = (range) => ({
  min: Math.round(range.min * 100),
  max: Math.round(range.max * 100),
  step: Math.max(1, Math.round(range.step * 100))
});

export const formatFrequency = (value) => {
  if (value >= 1000) {
    const precision = value >= 10000 ? 0 : 1;
    return `${(value / 1000).toFixed(precision)} kHz`;
  }
  return `${Math.round(value)} Hz`;
};

export const makeSlider = (param, { id, label, display, helpText }) => {
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

export const makePercentSlider = (param, { id, label, display, helpText }) => {
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

export const makeLogSlider = (param, { id, label, display, helpText }) => {
  const range = AUDIO_PARAM_RANGES[param];
  const logMin = Math.log(range.min);
  const logMax = Math.log(range.max);
  const logSpan = logMax - logMin;

  return {
    id,
    label,
    param,
    min: 0,
    max: 1000,
    step: 1,
    toSlider: (value) => {
      const safeValue = Math.min(Math.max(value, range.min), range.max);
      return ((Math.log(safeValue) - logMin) / logSpan) * 1000;
    },
    fromSlider: (value) => Math.exp(logMin + (value / 1000) * logSpan),
    display: display || ((value) => formatFrequency(value)),
    helpText
  };
};

export const DELAY_TIME_SLIDER = makeSlider('delayTime', {
  id: 'delay-time',
  label: 'Time',
  display: (value) => `${Math.round(value)} ms`
});

export const DELAY_FEEDBACK_SLIDER = makePercentSlider('delayFeedback', {
  id: 'delay-feedback',
  label: 'Feedback'
});

export const DELAY_MIX_SLIDER = makePercentSlider('delayMix', {
  id: 'delay-mix',
  label: 'Blend'
});

export const REVERB_SIZE_SLIDER = makePercentSlider('reverbSize', {
  id: 'reverb-size',
  label: 'Size',
  display: (value) => {
    if (value < 0.2) return 'Tight';
    if (value < 0.5) return 'Room';
    if (value < 0.8) return 'Hall';
    return 'Huge';
  }
});

export const REVERB_DECAY_SLIDER = makePercentSlider('reverbDecay', {
  id: 'reverb-decay',
  label: 'Decay',
  display: (value) => {
    if (value < 0.2) return 'Short';
    if (value < 0.5) return 'Medium';
    if (value < 0.8) return 'Long';
    return 'Bloom';
  }
});

export const REVERB_MIX_SLIDER = makePercentSlider('reverbMix', {
  id: 'reverb-mix',
  label: 'Blend'
});

export const DISTORTION_SLIDER = makePercentSlider('distortion', {
  id: 'distortion',
  label: 'Distortion'
});

export const ADSR_SLIDERS = [
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

export const FM_SLIDERS = [
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

export const FILTER_SLIDERS = [
  makeLogSlider('filterCutoff', {
    id: 'filter-cutoff',
    label: 'Filter cutoff',
    display: (value) => `${Math.round(value)} Hz`
  }),
  makeSlider('filterResonance', {
    id: 'filter-resonance',
    label: 'Filter resonance',
    display: (value) => value.toFixed(1)
  })
];

export const LFO1_RATE_SLIDER = makeSlider('lfoRate', {
  id: 'lfo1-rate',
  label: 'LFO 1 rate',
  display: (value) => (value <= 0 ? 'Off' : `${value.toFixed(1)} Hz`)
});

export const LFO2_RATE_SLIDER = makeSlider('lfo2Rate', {
  id: 'lfo2-rate',
  label: 'LFO 2 rate',
  display: (value) => (value <= 0 ? 'Off' : `${value.toFixed(1)} Hz`)
});

export const MOD_ENV_SLIDERS = [
  makeSlider('modAttack', {
    id: 'mod-attack',
    label: 'Mod attack',
    display: (value) => `${value.toFixed(2)} s`
  }),
  makeSlider('modDecay', {
    id: 'mod-decay',
    label: 'Mod decay',
    display: (value) => `${value.toFixed(2)} s`
  }),
  makePercentSlider('modSustain', {
    id: 'mod-sustain',
    label: 'Mod sustain'
  }),
  makeSlider('modRelease', {
    id: 'mod-release',
    label: 'Mod release',
    display: (value) => `${value.toFixed(2)} s`
  })
];

export const ModMatrixEditor = ({ routes, onChange }) => {
  const addRoute = () => {
    if (routes.length >= MAX_MOD_ROUTES) return;
    onChange([...routes, { src: 0, dst: 1, depth: 0.25 }]);
  };
  const updateRoute = (index, patch) => {
    onChange(routes.map((route, i) => (i === index ? { ...route, ...patch } : route)));
  };
  const removeRoute = (index) => {
    onChange(routes.filter((_, i) => i !== index));
  };

  return (
    <div className="mod-matrix" role="group" aria-label="Modulation matrix">
      {routes.length === 0 && (
        <p className="slider-description">
          Route LFOs, envelopes, velocity, key tracking, or the mod wheel to
          pitch, filter, amplitude, FM, or detune.
        </p>
      )}
      {routes.map((route, index) => (
        <div className="mod-route-row" key={index}>
          <select
            className="control-select mod-route-select"
            aria-label={`Route ${index + 1} source`}
            value={route.src}
            onChange={(event) => updateRoute(index, { src: Number(event.target.value) })}
          >
            {MOD_SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <span className="mod-route-arrow" aria-hidden="true">→</span>
          <select
            className="control-select mod-route-select"
            aria-label={`Route ${index + 1} destination`}
            value={route.dst}
            onChange={(event) => updateRoute(index, { dst: Number(event.target.value) })}
          >
            {MOD_DEST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <ValueSlider
            className="mod-route-depth"
            ariaLabel={`Route ${index + 1} depth`}
            min={-1}
            max={1}
            step={0.05}
            value={route.depth}
            defaultValue={0}
            formatValue={(value) => `${Math.round(value * 100)}%`}
            onChange={(value) => updateRoute(index, { depth: value })}
          />
          <span className="slider-value mod-route-depth-value">
            {`${Math.round(route.depth * 100)}%`}
          </span>
          <button
            type="button"
            className="button-icon mod-route-remove"
            aria-label={`Remove route ${index + 1}`}
            onClick={() => removeRoute(index)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
      <div className="section-footer-actions">
        <button
          type="button"
          className="button-link"
          onClick={addRoute}
          disabled={routes.length >= MAX_MOD_ROUTES}
        >
          {routes.length >= MAX_MOD_ROUTES ? 'Route limit reached' : '+ Add route'}
        </button>
      </div>
    </div>
  );
};

export const UNISON_SLIDERS = [
  makeSlider('unisonVoices', {
    id: 'unison-voices',
    label: 'Unison voices',
    display: (value) => `${Math.round(value)}`
  }),
  makeSlider('unisonDetune', {
    id: 'unison-detune',
    label: 'Unison detune',
    display: (value) => `${Math.round(value)} cents`
  })
];

export const SliderControl = ({
  id,
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  helpText,
  defaultValue,
  headerAccessory = null
}) => (
  <div className="slider-group">
    <div className="label-stack">
      <label id={`${id}-label`} htmlFor={id}>{label}</label>
      <div className="label-stack__meta">
        {headerAccessory}
        {displayValue ? <span className="slider-value">{displayValue}</span> : null}
      </div>
    </div>
    {helpText && <p className="slider-description">{helpText}</p>}
    <div className="slider-input-wrapper">
      <ValueSlider
        id={id}
        ariaLabelledBy={`${id}-label`}
        min={typeof min === 'number' ? min : Number(min ?? 0)}
        max={typeof max === 'number' ? max : Number(max ?? 1)}
        step={typeof step === 'number' ? step : Number(step ?? 0.01)}
        value={typeof value === 'number' ? value : Number(value ?? 0)}
        defaultValue={defaultValue}
        formatValue={() => (typeof displayValue === 'string' ? displayValue : `${value}`)}
        onChange={onChange}
      />
    </div>
  </div>
);
