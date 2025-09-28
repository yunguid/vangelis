import React from 'react';

const Row = ({ label, children }) => (
  <div className="mb-3">
    <div className="text-xs text-white/70 mb-1">{label}</div>
    {children}
  </div>
);

const Slider = ({ value, min, max, step, onChange }) => (
  <input
    type="range"
    className="w-64 max-w-full accent-orange-500"
    min={min}
    max={max}
    step={step}
    value={value}
    onChange={(e) => onChange(parseFloat(e.target.value))}
  />
);

const AudioControls = ({ audioParams, onParamChange }) => {
  return (
    <div className="glass p-3 rounded-xl">
      <Row label={`Volume: ${Math.round((audioParams.volume ?? 0.7) * 100)}%`}>
        <Slider
          value={Math.round((audioParams.volume ?? 0.7) * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onParamChange('volume', v / 100)}
        />
      </Row>
      <Row label={`Delay: ${Math.round(audioParams.delay ?? 0)} ms`}>
        <Slider
          value={audioParams.delay ?? 0}
          min={0}
          max={500}
          step={10}
          onChange={(v) => onParamChange('delay', v)}
        />
      </Row>
      <Row label={`Reverb: ${Math.round((audioParams.reverb ?? 0) * 100)}%`}>
        <Slider
          value={Math.round((audioParams.reverb ?? 0) * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onParamChange('reverb', v / 100)}
        />
      </Row>
      <Row label={`Distortion: ${Math.round((audioParams.distortion ?? 0) * 100)}%`}>
        <Slider
          value={Math.round((audioParams.distortion ?? 0) * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onParamChange('distortion', v / 100)}
        />
      </Row>
      <Row label={`Pan: ${Math.round(((audioParams.pan ?? 0.5) - 0.5) * 200)}`}> 
        <Slider
          value={Math.round((audioParams.pan ?? 0.5) * 100)}
          min={0}
          max={100}
          step={1}
          onChange={(v) => onParamChange('pan', v / 100)}
        />
      </Row>
    </div>
  );
};

export default AudioControls;