import React, { useState } from 'react';
import EffectMacroDial from './EffectMacroDial.jsx';
import ValueSlider from './controls/ValueSlider.jsx';
import {
  AUDIO_PARAM_DEFAULTS,
  AUDIO_PARAM_RANGES,
  DELAY_DIVISION_OPTIONS,
  DELAY_MODE_OPTIONS,
  DELAY_PRESET_OPTIONS,
  LFO_SHAPE_OPTIONS,
  MAX_MOD_ROUTES,
  MOD_DEST_OPTIONS,
  MOD_SOURCE_OPTIONS,
  REVERB_MODE_OPTIONS,
  getDelayPresetPatch,
  getDelayPresetValue,
  getDelaySeconds
} from '../utils/audioParams.js';

const percentValue = (value) => Math.round(value * 100);
const percentRange = (range) => ({
  min: Math.round(range.min * 100),
  max: Math.round(range.max * 100),
  step: Math.max(1, Math.round(range.step * 100))
});

const formatFrequency = (value) => {
  if (value >= 1000) {
    const precision = value >= 10000 ? 0 : 1;
    return `${(value / 1000).toFixed(precision)} kHz`;
  }
  return `${Math.round(value)} Hz`;
};

const formatMilliseconds = (value) => `${Math.round(value)} ms`;
const getOptionLabel = (options, value) => options.find((option) => option.value === value)?.label || value;

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

const makeLogSlider = (param, { id, label, display, helpText }) => {
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

const ESSENTIAL_SLIDERS = [
  makePercentSlider('volume', {
    id: 'volume',
    label: 'Volume',
    helpText: 'Set output level.'
  })
];

const DELAY_TIME_SLIDER = makeSlider('delayTime', {
  id: 'delay-time',
  label: 'Time',
  display: (value) => `${Math.round(value)} ms`
});

const DELAY_FEEDBACK_SLIDER = makePercentSlider('delayFeedback', {
  id: 'delay-feedback',
  label: 'Feedback'
});

const DELAY_MIX_SLIDER = makePercentSlider('delayMix', {
  id: 'delay-mix',
  label: 'Blend'
});

const DELAY_WIDTH_SLIDER = makePercentSlider('delayStereo', {
  id: 'delay-width',
  label: 'Width'
});

const DELAY_LOWCUT_SLIDER = makeLogSlider('delayLowCut', {
  id: 'delay-low-cut',
  label: 'Low cut',
  display: (value) => formatFrequency(value)
});

const DELAY_HIGHCUT_SLIDER = makeLogSlider('delayHighCut', {
  id: 'delay-high-cut',
  label: 'High cut',
  display: (value) => formatFrequency(value)
});

const DELAY_DUCKING_SLIDER = makePercentSlider('delayDucking', {
  id: 'delay-ducking',
  label: 'Ducking'
});

const DELAY_AGE_SLIDER = makePercentSlider('delayAge', {
  id: 'delay-age',
  label: 'Age',
  display: (value) => {
    if (value < 0.2) return 'Clean';
    if (value < 0.55) return 'Warm';
    if (value < 0.82) return 'Worn';
    return 'Dusty';
  }
});

const DELAY_MOTION_SLIDER = makePercentSlider('delayMotion', {
  id: 'delay-motion',
  label: 'Motion',
  display: (value) => {
    if (value < 0.2) return 'Still';
    if (value < 0.55) return 'Moving';
    if (value < 0.82) return 'Shimmer';
    return 'Swirl';
  }
});

const REVERB_SIZE_SLIDER = makePercentSlider('reverbSize', {
  id: 'reverb-size',
  label: 'Size',
  display: (value) => {
    if (value < 0.2) return 'Tight';
    if (value < 0.5) return 'Room';
    if (value < 0.8) return 'Hall';
    return 'Huge';
  }
});

const REVERB_DECAY_SLIDER = makePercentSlider('reverbDecay', {
  id: 'reverb-decay',
  label: 'Decay',
  display: (value) => {
    if (value < 0.2) return 'Short';
    if (value < 0.5) return 'Medium';
    if (value < 0.8) return 'Long';
    return 'Bloom';
  }
});

const REVERB_TONE_SLIDER = makePercentSlider('reverbTone', {
  id: 'reverb-tone',
  label: 'Tone',
  display: (value) => {
    if (value < 0.2) return 'Dark';
    if (value < 0.5) return 'Warm';
    if (value < 0.8) return 'Open';
    return 'Bright';
  }
});

const REVERB_MIX_SLIDER = makePercentSlider('reverbMix', {
  id: 'reverb-mix',
  label: 'Blend'
});

const REVERB_PREDELAY_SLIDER = makeSlider('reverbPreDelay', {
  id: 'reverb-predelay',
  label: 'Pre-delay',
  display: (value) => formatMilliseconds(value)
});

const REVERB_WIDTH_SLIDER = makePercentSlider('reverbWidth', {
  id: 'reverb-width',
  label: 'Width',
  display: (value) => {
    if (value < 0.2) return 'Mono';
    if (value < 0.5) return 'Narrow';
    if (value < 0.8) return 'Wide';
    return 'Wrap';
  }
});

const DISTORTION_SLIDER = makePercentSlider('distortion', {
  id: 'distortion',
  label: 'Distortion'
});

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

const FILTER_SLIDERS = [
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

const GLIDE_SLIDER = makeSlider('glideTime', {
  id: 'glide-time',
  label: 'Glide',
  display: (value) => (value < 0.005 ? 'Off' : `${value.toFixed(2)} s`),
  helpText: 'Slide between consecutive notes.'
});

const VELOCITY_CURVE_SLIDER = makeSlider('velocityCurve', {
  id: 'velocity-curve',
  label: 'Velocity curve',
  display: (value) => {
    if (value < -0.3) return 'Soft';
    if (value > 0.3) return 'Hard';
    return 'Linear';
  },
  helpText: 'How strongly key velocity shapes loudness.'
});

const LFO1_RATE_SLIDER = makeSlider('lfoRate', {
  id: 'lfo1-rate',
  label: 'LFO 1 rate',
  display: (value) => (value <= 0 ? 'Off' : `${value.toFixed(1)} Hz`)
});

const LFO2_RATE_SLIDER = makeSlider('lfo2Rate', {
  id: 'lfo2-rate',
  label: 'LFO 2 rate',
  display: (value) => (value <= 0 ? 'Off' : `${value.toFixed(1)} Hz`)
});

const MOD_ENV_SLIDERS = [
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

const ModMatrixEditor = ({ routes, onChange }) => {
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
            onChange={(e) => updateRoute(index, { src: Number(e.target.value) })}
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
            onChange={(e) => updateRoute(index, { dst: Number(e.target.value) })}
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
            formatValue={(v) => `${Math.round(v * 100)}%`}
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

const UNISON_SLIDERS = [
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

const SliderControl = ({
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

const SelectControl = ({
  id,
  label,
  value,
  onChange,
  options,
  helpText,
  displayValue,
  headerAccessory = null
}) => (
  <div className="slider-group">
    <div className="label-stack">
      <label htmlFor={id}>{label}</label>
      <div className="label-stack__meta">
        {headerAccessory}
        {displayValue ? <span className="slider-value">{displayValue}</span> : null}
      </div>
    </div>
    {helpText && <p className="slider-description">{helpText}</p>}
    <div className="select-input-wrapper">
      <select
        id={id}
        className="control-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  </div>
);

const SegmentedControl = ({
  id,
  label,
  value,
  onChange,
  options,
  helpText,
  displayValue,
  headerAccessory = null
}) => (
  <div className="slider-group">
    <div className="label-stack">
      <label htmlFor={id}>{label}</label>
      <div className="label-stack__meta">
        {headerAccessory}
        {displayValue ? <span className="slider-value">{displayValue}</span> : null}
      </div>
    </div>
    {helpText && <p className="slider-description">{helpText}</p>}
    <div id={id} className="segment-grid" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segment-button ${value === option.value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const InlineTogglePill = ({
  pressed,
  onToggle,
  activeLabel = 'On',
  inactiveLabel = 'Off',
  srLabel,
  subtle = false
}) => (
  <button
    type="button"
    className={`inline-toggle-pill${pressed ? ' is-active' : ''}${subtle ? ' inline-toggle-pill--subtle' : ''}`}
    onClick={onToggle}
    aria-pressed={pressed}
    aria-label={srLabel || (pressed ? activeLabel : inactiveLabel)}
  >
    <span className="inline-toggle-pill__dot" aria-hidden="true" />
    <span>{pressed ? activeLabel : inactiveLabel}</span>
  </button>
);

const EffectSummary = ({ items }) => (
  <span className="effect-summary">
    {items.filter(Boolean).map((item, index) => (
      <span key={`${item}-${index}`} className="effect-chip">
        {item}
      </span>
    ))}
  </span>
);

const EFFECT_DIALS = {
  delay: [
    DELAY_FEEDBACK_SLIDER,
    DELAY_MIX_SLIDER,
    DELAY_AGE_SLIDER,
    DELAY_MOTION_SLIDER
  ],
  reverb: [
    REVERB_SIZE_SLIDER,
    REVERB_DECAY_SLIDER,
    REVERB_TONE_SLIDER,
    REVERB_MIX_SLIDER
  ]
};

const DEFAULT_CONTROL_SECTIONS = Object.freeze({
  essentials: true,
  delay: false,
  reverb: false,
  color: false,
  modulation: false
});

const CollapsibleSection = ({
  id,
  title,
  open,
  onToggle,
  summary = null,
  headerAccessory = null,
  children
}) => (
  <section
    className={`control-section-shell ${open ? 'is-open' : 'is-collapsed'}`}
    data-control-section={id}
  >
    <div className="control-section-header">
      <button
        type="button"
        className="control-section-toggle"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
      >
        <span className="control-section-toggle__copy">
          <span className="controls-heading">{title}</span>
          {summary ? <span className="control-section-summary">{summary}</span> : null}
        </span>
        <span className="control-section-toggle__chevron" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      {headerAccessory ? (
        <div className="control-section-header__accessory">
          {headerAccessory}
        </div>
      ) : null}
    </div>
    {open ? (
      <div id={`${id}-panel`} className="control-section-body">
        {children}
      </div>
    ) : null}
  </section>
);

const AudioControls = ({
  audioParams,
  onParamChange,
  onParamsChange,
  transportBpm = 120,
  sections,
  onSectionToggle,
  compact = false,
  embedded = false
}) => {
  const [localSections, setLocalSections] = useState(DEFAULT_CONTROL_SECTIONS);
  const [showDelayAdvanced, setShowDelayAdvanced] = useState(false);
  const [showReverbAdvanced, setShowReverbAdvanced] = useState(false);

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

  const getChoice = (key) => {
    const value = audioParams?.[key];
    if (typeof value === 'string' && value.length > 0) return value;
    return AUDIO_PARAM_DEFAULTS[key];
  };

  const activeSections = {
    ...DEFAULT_CONTROL_SECTIONS,
    ...(sections || localSections)
  };

  const toggleSection = (section) => {
    if (typeof onSectionToggle === 'function') {
      onSectionToggle(section);
      return;
    }
    setLocalSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const renderSlider = (slider) => {
    const paramValue = getParam(slider.param);
    const paramDefault = AUDIO_PARAM_DEFAULTS[slider.param];
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
        defaultValue={typeof paramDefault === 'number' ? slider.toSlider(paramDefault) : undefined}
        onChange={(value) => onParamChange(slider.param, slider.fromSlider(value))}
        helpText={slider.helpText}
      />
    );
  };

  const renderMacroDial = (slider, accent, disabled = false) => {
    const paramValue = getParam(slider.param);
    return (
      <EffectMacroDial
        key={slider.id}
        id={slider.id}
        label={slider.label}
        value={paramValue}
        displayValue={slider.display(paramValue)}
        accent={accent}
        disabled={disabled}
        size={compact ? 88 : 112}
        compact={compact}
        onChange={(value) => onParamChange(slider.param, value)}
      />
    );
  };

  const useADSR = getToggle('useADSR');
  const useFM = getToggle('useFM');
  const useFilter = getToggle('useFilter');
  const delayEnabled = getToggle('delayEnabled');
  const delaySync = getToggle('delaySync');
  const delayMode = getChoice('delayMode');
  const delayDivision = getChoice('delayDivision');
  const delayPreset = getDelayPresetValue(audioParams);
  const reverbEnabled = getToggle('reverbEnabled');
  const reverbMode = getChoice('reverbMode');
  const delayPreviewSeconds = getDelaySeconds({
    delaySync,
    delayTime: getParam('delayTime'),
    delayDivision
  }, transportBpm);
  const delayPreviewMs = Math.round(delayPreviewSeconds * 1000);
  const delayStatus = delaySync
    ? `${delayPreviewMs} ms at ${Math.round(transportBpm)} BPM`
    : `${delayPreviewMs} ms free`;
  const reverbStatus = reverbEnabled
    ? `${Math.round(getParam('reverbPreDelay'))} ms pre-delay`
    : 'Off';
  const applyDelayPreset = (preset) => {
    const patch = getDelayPresetPatch(preset);
    if (!patch) return;
    if (typeof onParamsChange === 'function') {
      onParamsChange(patch);
      return;
    }
    Object.entries(patch).forEach(([key, value]) => onParamChange(key, value));
  };

  const containerClassName = [
    embedded ? 'control-groups control-groups--embedded' : 'panel elevated control-groups',
    compact ? 'control-groups--compact' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClassName}>
      <CollapsibleSection
        id="essentials"
        title="Essentials"
        open={activeSections.essentials}
        onToggle={toggleSection}
        summary={<EffectSummary items={[`${percentValue(getParam('volume'))}% level`]} />}
      >
        {ESSENTIAL_SLIDERS.map(renderSlider)}
      </CollapsibleSection>

      <CollapsibleSection
        id="delay"
        title="Delay"
        open={activeSections.delay}
        onToggle={toggleSection}
        headerAccessory={(
          <InlineTogglePill
            pressed={delayEnabled}
            onToggle={() => onParamChange('delayEnabled', !delayEnabled)}
            srLabel={delayEnabled ? 'Turn delay off' : 'Turn delay on'}
          />
        )}
        summary={<EffectSummary items={[
          getOptionLabel(DELAY_PRESET_OPTIONS, delayPreset),
          getOptionLabel(DELAY_MODE_OPTIONS, delayMode),
          delayStatus
        ]} />}
      >
        <div className="control-section">
          <SegmentedControl
            id="delay-preset"
            label="Preset"
            value={delayPreset}
            helpText="Start from a tuned repeat shape, then customize."
            options={DELAY_PRESET_OPTIONS}
            onChange={applyDelayPreset}
          />

          <SegmentedControl
            id="delay-mode"
            label="Mode"
            value={delayMode}
            helpText="Choose the stereo repeat character."
            options={DELAY_MODE_OPTIONS}
            onChange={(value) => onParamChange('delayMode', value)}
          />

          {delaySync ? (
            <SelectControl
              id="delay-division"
              label="Division"
              value={delayDivision}
              displayValue={delayStatus}
              helpText="Lock repeats to the current transport tempo."
              headerAccessory={(
                <InlineTogglePill
                  pressed={delaySync}
                  onToggle={() => onParamChange('delaySync', !delaySync)}
                  activeLabel="Sync"
                  inactiveLabel="Free"
                  subtle
                  srLabel={delaySync ? 'Use free delay time' : 'Sync delay to tempo'}
                />
              )}
              options={DELAY_DIVISION_OPTIONS}
              onChange={(value) => onParamChange('delayDivision', value)}
            />
          ) : (
            <SliderControl
              id={DELAY_TIME_SLIDER.id}
              label={DELAY_TIME_SLIDER.label}
              value={DELAY_TIME_SLIDER.toSlider(getParam(DELAY_TIME_SLIDER.param))}
              displayValue={delayStatus}
              min={DELAY_TIME_SLIDER.min}
              max={DELAY_TIME_SLIDER.max}
              step={DELAY_TIME_SLIDER.step}
              onChange={(value) => onParamChange(DELAY_TIME_SLIDER.param, DELAY_TIME_SLIDER.fromSlider(value))}
              helpText="Free-run delay time in milliseconds."
              headerAccessory={(
                <InlineTogglePill
                  pressed={delaySync}
                  onToggle={() => onParamChange('delaySync', !delaySync)}
                  activeLabel="Sync"
                  inactiveLabel="Free"
                  subtle
                  srLabel={delaySync ? 'Use free delay time' : 'Sync delay to tempo'}
                />
              )}
            />
          )}

          <div className="effect-macro-grid">
            {EFFECT_DIALS.delay.map((slider) => renderMacroDial(slider, 'delay', !delayEnabled))}
          </div>

          {showDelayAdvanced ? (
            <div className="slider-grid">
              {renderSlider(DELAY_WIDTH_SLIDER)}
              {renderSlider(DELAY_DUCKING_SLIDER)}
              {renderSlider(DELAY_LOWCUT_SLIDER)}
              {renderSlider(DELAY_HIGHCUT_SLIDER)}
            </div>
          ) : null}

          <div className="section-footer-actions">
            <button
              type="button"
              className="button-link"
              onClick={() => setShowDelayAdvanced((prev) => !prev)}
            >
              {showDelayAdvanced ? 'Hide detail' : 'Shape repeats'}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="reverb"
        title="Reverb"
        open={activeSections.reverb}
        onToggle={toggleSection}
        headerAccessory={(
          <InlineTogglePill
            pressed={reverbEnabled}
            onToggle={() => onParamChange('reverbEnabled', !reverbEnabled)}
            srLabel={reverbEnabled ? 'Turn reverb off' : 'Turn reverb on'}
          />
        )}
        summary={<EffectSummary items={[
          getOptionLabel(REVERB_MODE_OPTIONS, reverbMode),
          reverbStatus,
          `${Math.round(getParam('reverbMix') * 100)}% wet`
        ]} />}
      >
        <div className="control-section">
          <SegmentedControl
            id="reverb-mode"
            label="Mode"
            value={reverbMode}
            helpText="Pick the space shape before fine-tuning it."
            options={REVERB_MODE_OPTIONS}
            onChange={(value) => onParamChange('reverbMode', value)}
          />

          <div className="effect-macro-grid">
            {EFFECT_DIALS.reverb.map((slider) => renderMacroDial(slider, 'reverb', !reverbEnabled))}
          </div>

          {showReverbAdvanced ? (
            <div className="slider-grid">
              {renderSlider(REVERB_PREDELAY_SLIDER)}
              {renderSlider(REVERB_WIDTH_SLIDER)}
            </div>
          ) : null}

          <div className="section-footer-actions">
            <button
              type="button"
              className="button-link"
              onClick={() => setShowReverbAdvanced((prev) => !prev)}
            >
              {showReverbAdvanced ? 'Hide detail' : 'Shape space'}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="color"
        title="Color"
        open={activeSections.color}
        onToggle={toggleSection}
        summary={<EffectSummary items={[`${percentValue(getParam('distortion'))}% drive`]} />}
      >
        <div className="control-section">
          {renderSlider(DISTORTION_SLIDER)}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="modulation"
        title="Modulation"
        open={activeSections.modulation}
        onToggle={toggleSection}
        summary={<EffectSummary items={[
          useADSR ? 'ADSR on' : 'ADSR off',
          useFM ? 'FM on' : 'FM off',
          useFilter ? 'Filter on' : 'Filter off'
        ]} />}
      >
        <div className="control-section">
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

          <label className="toggle-row" htmlFor="use-filter">
            <span>Tone filter</span>
            <input
              id="use-filter"
              type="checkbox"
              checked={useFilter}
              onChange={(e) => onParamChange('useFilter', e.target.checked)}
            />
          </label>
          {useFilter && (
            <div className="slider-grid">
              {FILTER_SLIDERS.map(renderSlider)}
            </div>
          )}

          <div className="slider-grid">
            {UNISON_SLIDERS.map(renderSlider)}
          </div>

          <div className="slider-grid">
            {renderSlider(GLIDE_SLIDER)}
            {renderSlider(VELOCITY_CURVE_SLIDER)}
          </div>

          <h4 className="controls-subheading">Mod matrix</h4>
          <div className="slider-grid">
            <SelectControl
              id="lfo1-shape"
              label="LFO 1 shape"
              value={String(getParam('lfo1Shape'))}
              options={LFO_SHAPE_OPTIONS.map((option) => ({
                ...option,
                value: String(option.value)
              }))}
              onChange={(value) => onParamChange('lfo1Shape', Number(value))}
            />
            {renderSlider(LFO1_RATE_SLIDER)}
            <SelectControl
              id="lfo2-shape"
              label="LFO 2 shape"
              value={String(getParam('lfo2Shape'))}
              options={LFO_SHAPE_OPTIONS.map((option) => ({
                ...option,
                value: String(option.value)
              }))}
              onChange={(value) => onParamChange('lfo2Shape', Number(value))}
            />
            {renderSlider(LFO2_RATE_SLIDER)}
          </div>

          <div className="slider-grid">
            {MOD_ENV_SLIDERS.map(renderSlider)}
          </div>

          <ModMatrixEditor
            routes={Array.isArray(audioParams?.modRoutes) ? audioParams.modRoutes : []}
            onChange={(routes) => onParamChange('modRoutes', routes)}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default AudioControls;
