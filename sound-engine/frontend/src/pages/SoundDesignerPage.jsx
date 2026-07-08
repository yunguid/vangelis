import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import AudioControls from '../components/AudioControls.jsx';
import PresetShelf from '../components/PresetShelf.jsx';
import Sidebar from '../components/Sidebar';
import SynthKeyboard from '../components/SynthKeyboard';
import UIOverlay from '../components/UIOverlay.jsx';
import WaveCandy from '../components/WaveCandy';
import { audioEngine } from '../utils/audioEngine.js';
import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_WAVEFORM,
  sanitizeAudioParams
} from '../utils/audioParams.js';
import './SoundDesignerPage.css';

// Unlike the sidebar's compact Sound tab (Essentials only, everything else
// collapsed to save space), this is a workstation: the sections a designer
// actually shapes a sound with — envelope/filter/FM/mod live under
// "Modulation" — start open. Delay/reverb stay collapsed (secondary, not the
// core shaping loop) but are one click away, same as everywhere else.
const DEFAULT_CONTROL_SECTIONS = Object.freeze({
  essentials: true,
  delay: false,
  reverb: false,
  color: false,
  modulation: true
});

// Stable empty set: this page has no MIDI playback / web-MIDI input, so no
// note is ever externally active. A fresh Set() on every render would
// needlessly re-trigger key highlight lookups downstream.
const NO_EXTERNAL_ACTIVE_NOTES = new Set();

const SoundDesignerPage = () => {
  const [engineStatus, setEngineStatus] = React.useState(() => audioEngine.getStatus());
  const [waveformType, setWaveformType] = React.useState(() => DEFAULT_WAVEFORM);
  const [audioParams, setAudioParams] = React.useState(() => (
    sanitizeAudioParams(AUDIO_PARAM_DEFAULTS)
  ));
  const [controlSections, setControlSections] = React.useState(() => (
    DEFAULT_CONTROL_SECTIONS
  ));
  const [activePresetName, setActivePresetName] = React.useState(null);

  React.useEffect(() => {
    audioEngine.setGlobalParams(audioParams);
  }, [audioParams]);

  React.useEffect(() => {
    const unsubscribe = audioEngine.subscribe(setEngineStatus);

    audioEngine.ensureWasm().catch(() => {});
    audioEngine.ensureAudioContext().then(() => {
      audioEngine.warmGraph();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleAudioParamChange = React.useCallback((paramName, value) => {
    setAudioParams((prev) => sanitizeAudioParams({
      ...prev,
      [paramName]: value
    }));
  }, []);

  const handleAudioParamsChange = React.useCallback((nextParams) => {
    setAudioParams((prev) => sanitizeAudioParams({
      ...prev,
      ...nextParams
    }));
  }, []);

  const handleControlSectionToggle = React.useCallback((section) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONTROL_SECTIONS, section)) return;
    setControlSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const handlePresetApplied = React.useCallback((preset) => {
    if (preset.waveformType) setWaveformType(preset.waveformType);
    if (preset.audioParams) setAudioParams(sanitizeAudioParams(preset.audioParams));
    setActivePresetName(preset.name || null);
  }, []);

  return (
    <div className="sound-designer-page">
      <main className="sound-designer-page__shell">
        <AppHeader activeSection="sound-designer" className="sound-designer-page__header" />

        <div className="sound-designer-workspace">
          <div className="sound-designer-workspace__main">
            <div className="sound-designer-column sound-designer-column--controls">
              <div className="sound-designer-waveform">
                <UIOverlay
                  currentWaveform={waveformType}
                  onWaveformChange={setWaveformType}
                  compact
                />
              </div>

              <div className="sound-designer-presets" role="region" aria-label="Save and load sounds">
                <PresetShelf
                  waveformType={waveformType}
                  audioParams={audioParams}
                  activePresetName={activePresetName}
                  onApply={handlePresetApplied}
                  foldBrowse
                />
              </div>

              <AudioControls
                audioParams={audioParams}
                onParamChange={handleAudioParamChange}
                onParamsChange={handleAudioParamsChange}
                sections={controlSections}
                onSectionToggle={handleControlSectionToggle}
              />
            </div>

            <div className="sound-designer-column sound-designer-column--scope">
              <div className="sound-designer-scope" role="region" aria-label="Live sound visualization">
                <WaveCandy />
              </div>
            </div>
          </div>

          {/* Panel chrome lives on the wrapper, not on .keyboard-surface:
              gruvbox.css strips background/border from .keyboard-surface with
              !important (correct for the main page's full-bleed stage), so the
              surface stays chrome-less and this wrapper provides the flat
              bordered dock that matches the columns above. */}
          <div className="sound-designer-keyboard" role="region" aria-label="Test keyboard">
            <div className="keyboard-surface">
              <div className="keyboard-region">
                <SynthKeyboard
                  waveformType={waveformType}
                  audioParams={audioParams}
                  wasmLoaded={engineStatus.wasmReady}
                  externalActiveNotes={NO_EXTERNAL_ACTIVE_NOTES}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Sidebar disabled isOpen={false} activeTab="sound" />
    </div>
  );
};

export default SoundDesignerPage;
