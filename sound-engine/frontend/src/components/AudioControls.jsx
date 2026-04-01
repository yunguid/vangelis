import React, { useState } from 'react';
import EffectMacroDial from './EffectMacroDial.jsx';
import {
  AUDIO_PARAM_DEFAULTS,
  AUDIO_PARAM_RANGES,
  DELAY_DIVISION_OPTIONS,
  DELAY_MODE_OPTIONS,
  DELAY_PRESET_OPTIONS,
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

const SelectControl = ({
  id,
  label,
  value,
  onChange,
  options,
  helpText,
  displayValue
}) => (
  <div className="slider-group">
    <div className="label-stack">
      <label htmlFor={id}>{label}</label>
      {displayValue ? <span className="slider-value">{displayValue}</span> : null}
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
  displayValue
}) => (
  <div className="slider-group">
    <div className="label-stack">
      <label htmlFor={id}>{label}</label>
      {displayValue ? <span className="slider-value">{displayValue}</span> : null}
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

const EffectSummary = ({ items }) => (
  <div className="effect-summary">
    {items.filter(Boolean).map((item, index) => (
      <div key={`${item}-${index}`} className="effect-chip">
        {item}
      </div>
    ))}
  </div>
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
  children
}) => (
  <section
    className={`control-section-shell ${open ? 'is-open' : 'is-collapsed'}`}
    data-control-section={id}
  >
    <button
      type="button"
      className="control-section-toggle"
      onClick={() => onToggle(id)}
      aria-expanded={open}
      aria-controls={`${id}-panel`}
    >
      <span className="control-section-toggle__copy">
        <span className="controls-heading">{title}</span>
        <span className="control-section-toggle__meta">{open ? 'Collapse' : 'Expand'}</span>
      </span>
      <span className="control-section-toggle__chevron" aria-hidden="true">
        {open ? '−' : '+'}
      </span>
    </button>
    {summary ? <div className="control-section-summary">{summary}</div> : null}
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
  onSectionToggle
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
    ? `${delayPreviewMs} ms @ ${Math.round(transportBpm)} BPM`
    : `${delayPreviewMs} ms free`;
  const reverbStatus = reverbEnabled
    ? `${Math.round(getParam('reverbPreDelay'))} ms pre-delay`
    : 'Bypassed';
  const applyDelayPreset = (preset) => {
    const patch = getDelayPresetPatch(preset);
    if (!patch) return;
    if (typeof onParamsChange === 'function') {
      onParamsChange(patch);
      return;
    }
    Object.entries(patch).forEach(([key, value]) => onParamChange(key, value));
  };

  return (
    <div className="panel elevated control-groups">
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
        summary={<EffectSummary items={[
          getOptionLabel(DELAY_PRESET_OPTIONS, delayPreset),
          getOptionLabel(DELAY_MODE_OPTIONS, delayMode),
          delayStatus
        ]} />}
      >
        <div className="control-section">
          <div className="section-inline-actions">
            <button
              type="button"
              className="button-link"
              onClick={() => setShowDelayAdvanced((prev) => !prev)}
            >
              {showDelayAdvanced ? 'Hide detail' : 'Shape repeats'}
            </button>
          </div>

          <label className="toggle-row" htmlFor="delay-enabled">
            <span>Delay active</span>
            <input
              id="delay-enabled"
              type="checkbox"
              checked={delayEnabled}
              onChange={(e) => onParamChange('delayEnabled', e.target.checked)}
            />
          </label>

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
            displayValue={delayEnabled ? 'On' : 'Bypassed'}
            helpText="Choose the stereo repeat character."
            options={DELAY_MODE_OPTIONS}
            onChange={(value) => onParamChange('delayMode', value)}
          />

          <label className="toggle-row" htmlFor="delay-sync">
            <span>Sync to tempo</span>
            <input
              id="delay-sync"
              type="checkbox"
              checked={delaySync}
              onChange={(e) => onParamChange('delaySync', e.target.checked)}
            />
          </label>

          {delaySync ? (
            <SelectControl
              id="delay-division"
              label="Division"
              value={delayDivision}
              displayValue={delayStatus}
              helpText="Lock repeats to the current transport tempo."
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
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="reverb"
        title="Reverb"
        open={activeSections.reverb}
        onToggle={toggleSection}
        summary={<EffectSummary items={[
          getOptionLabel(REVERB_MODE_OPTIONS, reverbMode),
          reverbStatus,
          `${Math.round(getParam('reverbMix') * 100)}% wet`
        ]} />}
      >
        <div className="control-section">
          <div className="section-inline-actions">
            <button
              type="button"
              className="button-link"
              onClick={() => setShowReverbAdvanced((prev) => !prev)}
            >
              {showReverbAdvanced ? 'Hide detail' : 'Shape space'}
            </button>
          </div>

          <label className="toggle-row" htmlFor="reverb-enabled">
            <span>Reverb active</span>
            <input
              id="reverb-enabled"
              type="checkbox"
              checked={reverbEnabled}
              onChange={(e) => onParamChange('reverbEnabled', e.target.checked)}
            />
          </label>

          <SegmentedControl
            id="reverb-mode"
            label="Mode"
            value={reverbMode}
            displayValue={reverbEnabled ? 'On' : 'Bypassed'}
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
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default AudioControls;
