import React, { useEffect, useState } from 'react';
import {
  Fader,
  Knob,
  NumField,
  SegmentSelect,
  ToggleBtn
} from '../components/controls/kit/index.js';
import { SOUND_DESIGNER_HREF } from '../utils/routes.js';
import './ControlKitPage.css';

/**
 * ControlKitPage — hidden specimen sheet for the ground-up control-kit
 * proposal (see INTERFACE_LEDGER.md's handoff). Linked from nowhere; reached
 * only via #/control-kit. Nothing here is wired to the audio engine — every
 * control just drives local React state so the kit can be judged on feel.
 */

const WAVEFORM_OPTIONS = [
  { value: 'sine', label: 'Sine', glyph: 'sine' },
  { value: 'square', label: 'Square', glyph: 'square' },
  { value: 'sawtooth', label: 'Saw', glyph: 'sawtooth' },
  { value: 'triangle', label: 'Tri', glyph: 'triangle' }
];

const VOICE_MODE_OPTIONS = [
  { value: 'mono', label: 'Mono' },
  { value: 'poly', label: 'Poly' },
  { value: 'uni', label: 'Uni' }
];

const useIsNarrow = (breakpoint) => {
  const [isNarrow, setIsNarrow] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= breakpoint : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handleChange = (event) => setIsNarrow(event.matches);
    setIsNarrow(query.matches);
    if (query.addEventListener) {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }
    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, [breakpoint]);

  return isNarrow;
};

const SpecimenRow = ({ title, children }) => (
  <section className="control-kit__row" aria-label={title}>
    <h2 className="control-kit__row-title">{title}</h2>
    <div className="control-kit__row-items">{children}</div>
  </section>
);

const Specimen = ({ caption, children }) => (
  <div className="control-kit__specimen">
    <div className="control-kit__specimen-control">{children}</div>
    <span className="control-kit__caption">{caption}</span>
  </div>
);

const Module = ({ title, children }) => (
  <div className="control-kit__module">
    <h3 className="control-kit__module-title">{title}</h3>
    <div className="control-kit__module-body">{children}</div>
  </div>
);

const ControlKitPage = () => {
  const isNarrow = useIsNarrow(480);
  const verticalFaderLength = isNarrow ? 100 : 120;

  // --- Section 1: specimens ---
  const [knobMd, setKnobMd] = useState(0.5);
  const [knobSm, setKnobSm] = useState(0.3);
  const [knobBipolar, setKnobBipolar] = useState(0);
  const [numBoxed, setNumBoxed] = useState(64);
  const [numBare, setNumBare] = useState(12);
  const [numMs, setNumMs] = useState(240);
  const [faderContinuous, setFaderContinuous] = useState(0.6);
  const [faderStepped, setFaderStepped] = useState(3);
  const [faderTrio, setFaderTrio] = useState(() => [0.7, 0.4, 0.9]);
  const [toggleOn, setToggleOn] = useState(true);
  const [toggleOff, setToggleOff] = useState(false);
  const [segmentWaveform, setSegmentWaveform] = useState('sine');
  const [segmentMode, setSegmentMode] = useState('poly');

  // --- Section 2: composed module row ---
  const [oscWaveform, setOscWaveform] = useState('sawtooth');
  const [oscDetune, setOscDetune] = useState(0);
  const [oscVoices, setOscVoices] = useState(1);
  const [filterOn, setFilterOn] = useState(true);
  const [filterCutoff, setFilterCutoff] = useState(8000);
  const [filterRes, setFilterRes] = useState(0.2);
  const [filterEnv, setFilterEnv] = useState(40);
  const [envAttack, setEnvAttack] = useState(0.05);
  const [envDecay, setEnvDecay] = useState(0.3);
  const [envSustain, setEnvSustain] = useState(0.7);
  const [envRelease, setEnvRelease] = useState(0.4);
  const [delayOn, setDelayOn] = useState(true);
  const [delayMix, setDelayMix] = useState(0.3);
  const [delayTime, setDelayTime] = useState(375);

  return (
    <div className="control-kit">
      <div className="control-kit__shell">
        <header className="control-kit__header">
          <span className="control-kit__kicker">Control Kit — Proposal</span>
          <p className="control-kit__note">specimen sheet — not wired to the engine</p>
          <a className="control-kit__back" href={SOUND_DESIGNER_HREF}>back to sound designer</a>
        </header>

        <section className="control-kit__section" aria-labelledby="specimens-title">
          <h1 id="specimens-title" className="control-kit__section-title">Specimens</h1>

          <SpecimenRow title="Knob">
            <Specimen caption="md">
              <Knob id="spec-knob-md" label="Level" value={knobMd} min={0} max={1} step={0.01}
                defaultValue={0.5} format={(v) => `${Math.round(v * 100)}%`} onChange={setKnobMd} />
            </Specimen>
            <Specimen caption="sm">
              <Knob id="spec-knob-sm" label="Trim" value={knobSm} min={0} max={1} step={0.01}
                defaultValue={0.3} size="sm" format={(v) => `${Math.round(v * 100)}%`} onChange={setKnobSm} />
            </Specimen>
            <Specimen caption="bipolar">
              <Knob id="spec-knob-bipolar" label="Detune" value={knobBipolar} min={-50} max={50} step={1}
                defaultValue={0} bipolar unit="ct" onChange={setKnobBipolar} />
            </Specimen>
            <Specimen caption="disabled">
              <Knob id="spec-knob-disabled" label="Locked" value={75} min={0} max={100} step={1} disabled />
            </Specimen>
          </SpecimenRow>

          <SpecimenRow title="NumField">
            <Specimen caption="boxed">
              <NumField id="spec-num-boxed" label="Cutoff" value={numBoxed} min={0} max={127} step={1}
                defaultValue={64} onChange={setNumBoxed} />
            </Specimen>
            <Specimen caption="bare">
              <NumField id="spec-num-bare" label="Semi" value={numBare} min={-24} max={24} step={1}
                defaultValue={0} variant="bare" onChange={setNumBare} />
            </Specimen>
            <Specimen caption="unit'd (ms)">
              <NumField id="spec-num-ms" label="Time" value={numMs} min={1} max={2000} step={1}
                fineStep={0.1} defaultValue={240} unit="ms" onChange={setNumMs} />
            </Specimen>
          </SpecimenRow>

          <SpecimenRow title="Fader">
            <Specimen caption="horizontal, continuous">
              <Fader id="spec-fader-continuous" label="Mix" value={faderContinuous} min={0} max={1}
                defaultValue={0.6} unit="%" format={(v) => `${Math.round(v * 100)}%`} onChange={setFaderContinuous} />
            </Specimen>
            <Specimen caption="horizontal, stepped (8 ticks)">
              <Fader id="spec-fader-stepped" label="Steps" value={faderStepped} min={0} max={7} step={1}
                ticks={8} defaultValue={3} onChange={setFaderStepped} />
            </Specimen>
            <Specimen caption="vertical trio">
              <div className="control-kit__fader-trio">
                {faderTrio.map((v, index) => (
                  <Fader
                    key={index}
                    id={`spec-fader-trio-${index}`}
                    label={['A', 'B', 'C'][index]}
                    value={v}
                    min={0}
                    max={1}
                    defaultValue={0.5}
                    orientation="vertical"
                    length={verticalFaderLength}
                    format={(val) => `${Math.round(val * 100)}%`}
                    onChange={(next) => setFaderTrio((prev) => prev.map((p, i) => (i === index ? next : p)))}
                  />
                ))}
              </div>
            </Specimen>
          </SpecimenRow>

          <SpecimenRow title="ToggleBtn">
            <Specimen caption="on">
              <ToggleBtn id="spec-toggle-on" label="On" checked={toggleOn} onChange={setToggleOn} />
            </Specimen>
            <Specimen caption="off">
              <ToggleBtn id="spec-toggle-off" label="Off" checked={toggleOff} onChange={setToggleOff} />
            </Specimen>
            <Specimen caption="disabled">
              <ToggleBtn id="spec-toggle-disabled" label="Locked" checked={false} disabled />
            </Specimen>
          </SpecimenRow>

          <SpecimenRow title="SegmentSelect">
            <Specimen caption="waveform glyphs">
              <SegmentSelect id="spec-segment-wave" label="Wave" options={WAVEFORM_OPTIONS}
                value={segmentWaveform} onChange={setSegmentWaveform} />
            </Specimen>
            <Specimen caption="text-only, 3 options">
              <SegmentSelect id="spec-segment-mode" label="Mode" options={VOICE_MODE_OPTIONS}
                value={segmentMode} onChange={setSegmentMode} />
            </Specimen>
          </SpecimenRow>
        </section>

        <section className="control-kit__section" aria-labelledby="composed-title">
          <h1 id="composed-title" className="control-kit__section-title">Composed</h1>
          <div className="control-kit__module-row">
            <Module title="Osc">
              <SegmentSelect id="mod-osc-wave" label="Wave" options={WAVEFORM_OPTIONS}
                value={oscWaveform} onChange={setOscWaveform} />
              <Knob id="mod-osc-detune" label="Detune" value={oscDetune} min={-50} max={50} step={1}
                defaultValue={0} bipolar unit="ct" onChange={setOscDetune} />
              <NumField id="mod-osc-voices" label="Voices" value={oscVoices} min={1} max={8} step={1}
                defaultValue={1} onChange={setOscVoices} />
            </Module>

            <Module title="Filter">
              <ToggleBtn id="mod-filter-on" label="Filter" checked={filterOn} onChange={setFilterOn} />
              <Knob id="mod-filter-cutoff" label="Cutoff" value={filterCutoff} min={20} max={20000} step={10}
                defaultValue={8000} disabled={!filterOn} unit="Hz" format={(v) => `${Math.round(v)}`} onChange={setFilterCutoff} />
              <Knob id="mod-filter-res" label="Res" value={filterRes} min={0} max={1} step={0.01}
                defaultValue={0.2} disabled={!filterOn} format={(v) => `${Math.round(v * 100)}%`} onChange={setFilterRes} />
              <NumField id="mod-filter-env" label="Env" value={filterEnv} min={-100} max={100} step={1}
                defaultValue={0} disabled={!filterOn} unit="%" onChange={setFilterEnv} />
            </Module>

            <Module title="Envelope">
              <div className="control-kit__adsr">
                <Fader id="mod-env-a" label="A" value={envAttack} min={0} max={2} step={0.01}
                  defaultValue={0.05} orientation="vertical" length={verticalFaderLength} unit="s"
                  format={(v) => v.toFixed(2)} onChange={setEnvAttack} />
                <Fader id="mod-env-d" label="D" value={envDecay} min={0} max={2} step={0.01}
                  defaultValue={0.3} orientation="vertical" length={verticalFaderLength} unit="s"
                  format={(v) => v.toFixed(2)} onChange={setEnvDecay} />
                <Fader id="mod-env-s" label="S" value={envSustain} min={0} max={1} step={0.01}
                  defaultValue={0.7} orientation="vertical" length={verticalFaderLength}
                  format={(v) => `${Math.round(v * 100)}%`} onChange={setEnvSustain} />
                <Fader id="mod-env-r" label="R" value={envRelease} min={0} max={4} step={0.01}
                  defaultValue={0.4} orientation="vertical" length={verticalFaderLength} unit="s"
                  format={(v) => v.toFixed(2)} onChange={setEnvRelease} />
              </div>
            </Module>

            <Module title="Delay">
              <ToggleBtn id="mod-delay-on" label="Delay" checked={delayOn} onChange={setDelayOn} />
              <Fader id="mod-delay-mix" label="Mix" value={delayMix} min={0} max={1} step={0.01}
                defaultValue={0.3} disabled={!delayOn} format={(v) => `${Math.round(v * 100)}%`} onChange={setDelayMix} />
              <NumField id="mod-delay-time" label="Time" value={delayTime} min={10} max={2000} step={5}
                defaultValue={375} disabled={!delayOn} unit="ms" onChange={setDelayTime} />
            </Module>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ControlKitPage;
