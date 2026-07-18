import React from 'react';
import AppHeader from '../components/AppHeader.jsx';
import PresetShelf from '../components/PresetShelf.jsx';
import Sidebar from '../components/Sidebar';
import SynthKeyboard from '../components/SynthKeyboard';
import WaveCandy from '../components/WaveCandy';
import {
  ADSR_SLIDERS,
  DELAY_FEEDBACK_SLIDER,
  DELAY_MIX_SLIDER,
  DELAY_TIME_SLIDER,
  DISTORTION_SLIDER,
  FILTER_SLIDERS,
  FM_SLIDERS,
  InlineToggle,
  LFO1_RATE_SLIDER,
  LFO2_RATE_SLIDER,
  ModMatrixEditor,
  REVERB_DECAY_SLIDER,
  REVERB_MIX_SLIDER,
  REVERB_SIZE_SLIDER,
  SliderControl,
  UNISON_SLIDERS
} from '../components/AudioControls.jsx';
import { audioEngine } from '../utils/audioEngine.js';
import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_WAVEFORM,
  WAVEFORM_OPTIONS,
  sanitizeAudioParams
} from '../utils/audioParams.js';
import { saveUserPreset } from '../utils/presetStorage.js';
import { HOME_HREF } from '../utils/routes.js';
import './SoundDesignerPage.css';

// The wizard thread: five stages, freely navigable (nothing is ever locked —
// the default BASE is just "whatever waveform is already selected"), with
// "← back" / "next →" affordances on each card nudging along the thread in
// order (Base has no back, Mint has no next).
const STAGES = [
  { id: 'base', label: 'Base' },
  { id: 'tone', label: 'Tone' },
  { id: 'motion', label: 'Motion' },
  { id: 'space', label: 'Space' },
  { id: 'mint', label: 'Mint' }
];

const STAGE_INDEX = Object.fromEntries(STAGES.map((stage, index) => [stage.id, index]));

// Stable empty set: this page has no MIDI playback / web-MIDI input, so no
// note is ever externally active. A fresh Set() on every render would
// needlessly re-trigger key highlight lookups downstream.
const NO_EXTERNAL_ACTIVE_NOTES = new Set();

const renderSlider = (slider, audioParams, onParamChange) => {
  const paramValue = typeof audioParams?.[slider.param] === 'number'
    ? audioParams[slider.param]
    : AUDIO_PARAM_DEFAULTS[slider.param];
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

// The wizard's back/next affordances. Every stage except the first (Base)
// gets a "← back" to the previous stage; every stage except the last (Mint)
// keeps its "next →". Both just call the same onNavigate (goToStage) — the
// stage rail tabs remain freely clickable regardless, this is only the
// wizard's forward/backward thread.
const StageFooterNav = ({ stageId, onNavigate }) => {
  const index = STAGE_INDEX[stageId];
  const prevStage = index > 0 ? STAGES[index - 1] : null;
  const nextStage = index < STAGES.length - 1 ? STAGES[index + 1] : null;
  if (!prevStage && !nextStage) return null;
  return (
    <div className="stage-card__footer">
      {prevStage && (
        <button
          type="button"
          className="stage-card__back"
          onClick={() => onNavigate(prevStage.id)}
        >
          {`← back: ${prevStage.label}`}
        </button>
      )}
      {nextStage && (
        <button
          type="button"
          className="stage-card__next"
          onClick={() => onNavigate(nextStage.id)}
        >
          {`next: ${nextStage.label} →`}
        </button>
      )}
    </div>
  );
};

const BaseStage = ({ waveformType, onWaveformChange, presetShelfProps, onAdvance }) => (
  <div className="stage-card stage-card--base">
    <div className="stage-card__body">
      <div className="stage-section">
        <h3 className="stage-section__title">Waveform</h3>
        <div className="base-waveform-grid" role="radiogroup" aria-label="Waveform selection">
          {WAVEFORM_OPTIONS.map((wave) => {
            const isActive = waveformType === wave;
            return (
              <button
                key={wave}
                type="button"
                className={`base-waveform-card${isActive ? ' is-active' : ''}`}
                onClick={() => onWaveformChange(wave)}
                role="radio"
                aria-checked={isActive}
                aria-label={wave}
              >
                {wave}
              </button>
            );
          })}
        </div>
      </div>
      <div className="stage-section">
        <h3 className="stage-section__title">Or start from a patch</h3>
        <PresetShelf {...presetShelfProps} />
      </div>
    </div>
    <StageFooterNav stageId="base" onNavigate={onAdvance} />
  </div>
);

const ToneStage = ({ audioParams, onParamChange, onAdvance }) => {
  const useFilter = !!audioParams.useFilter;
  return (
    <div className="stage-card stage-card--tone">
      <div className="stage-card__body">
        <div className="stage-section">
          <label className="toggle-row" htmlFor="tone-use-filter">
            <span>Tone filter</span>
            <input
              id="tone-use-filter"
              type="checkbox"
              checked={useFilter}
              onChange={(e) => onParamChange('useFilter', e.target.checked)}
            />
          </label>
          <div className="slider-grid">
            {FILTER_SLIDERS.map((slider) => renderSlider(slider, audioParams, onParamChange))}
          </div>
        </div>
        <div className="stage-section">
          <h3 className="stage-section__title">Color</h3>
          <div className="slider-grid">
            {renderSlider(DISTORTION_SLIDER, audioParams, onParamChange)}
          </div>
        </div>
      </div>
      <StageFooterNav stageId="tone" onNavigate={onAdvance} />
    </div>
  );
};

const MotionStage = ({ audioParams, onParamChange, onAdvance }) => {
  const useFM = !!audioParams.useFM;
  return (
    <div className="stage-card stage-card--motion">
      <div className="stage-card__body">
        <div className="stage-section">
          <h3 className="stage-section__title">Amplitude envelope</h3>
          <div className="slider-grid slider-grid--four">
            {ADSR_SLIDERS.map((slider) => renderSlider(slider, audioParams, onParamChange))}
          </div>
        </div>
        <div className="stage-section">
          <label className="toggle-row" htmlFor="motion-use-fm">
            <span>Frequency modulation</span>
            <input
              id="motion-use-fm"
              type="checkbox"
              checked={useFM}
              onChange={(e) => onParamChange('useFM', e.target.checked)}
            />
          </label>
          {useFM && (
            <div className="slider-grid">
              {FM_SLIDERS.map((slider) => renderSlider(slider, audioParams, onParamChange))}
            </div>
          )}
        </div>
        <div className="stage-section">
          <h3 className="stage-section__title">LFOs</h3>
          <div className="slider-grid">
            {renderSlider(LFO1_RATE_SLIDER, audioParams, onParamChange)}
            {renderSlider(LFO2_RATE_SLIDER, audioParams, onParamChange)}
          </div>
        </div>
        <div className="stage-section">
          <h3 className="stage-section__title">Mod routes</h3>
          <ModMatrixEditor
            routes={Array.isArray(audioParams.modRoutes) ? audioParams.modRoutes : []}
            onChange={(routes) => onParamChange('modRoutes', routes)}
          />
        </div>
      </div>
      <StageFooterNav stageId="motion" onNavigate={onAdvance} />
    </div>
  );
};

const SpaceStage = ({ audioParams, onParamChange, onAdvance }) => {
  const delayEnabled = !!audioParams.delayEnabled;
  const reverbEnabled = !!audioParams.reverbEnabled;
  return (
    <div className="stage-card stage-card--space">
      <div className="stage-card__body">
        <div className="stage-section">
          <label className="toggle-row" htmlFor="space-use-delay">
            <span>Delay</span>
            <input
              id="space-use-delay"
              type="checkbox"
              checked={delayEnabled}
              onChange={(e) => onParamChange('delayEnabled', e.target.checked)}
            />
          </label>
          <div className="slider-grid">
            {renderSlider(DELAY_MIX_SLIDER, audioParams, onParamChange)}
            {renderSlider(DELAY_FEEDBACK_SLIDER, audioParams, onParamChange)}
            {renderSlider(DELAY_TIME_SLIDER, audioParams, onParamChange)}
          </div>
        </div>
        <div className="stage-section">
          <label className="toggle-row" htmlFor="space-use-reverb">
            <span>Reverb</span>
            <input
              id="space-use-reverb"
              type="checkbox"
              checked={reverbEnabled}
              onChange={(e) => onParamChange('reverbEnabled', e.target.checked)}
            />
          </label>
          <div className="slider-grid">
            {renderSlider(REVERB_MIX_SLIDER, audioParams, onParamChange)}
            {renderSlider(REVERB_SIZE_SLIDER, audioParams, onParamChange)}
            {renderSlider(REVERB_DECAY_SLIDER, audioParams, onParamChange)}
          </div>
        </div>
        <div className="stage-section">
          <h3 className="stage-section__title">Unison</h3>
          <div className="slider-grid">
            {UNISON_SLIDERS.map((slider) => renderSlider(slider, audioParams, onParamChange))}
          </div>
        </div>
      </div>
      <StageFooterNav stageId="space" onNavigate={onAdvance} />
    </div>
  );
};

const MintStage = ({ waveformType, audioParams, onMint, mintedName, onAdvance }) => {
  const [name, setName] = React.useState('');

  const filterSummary = audioParams.useFilter ? 'filter on' : 'filter off';
  const delaySummary = audioParams.delayEnabled ? 'delay on' : 'delay off';
  const reverbSummary = audioParams.reverbEnabled ? 'reverb on' : 'reverb off';
  const summaryLine = `${waveformType} base, ${filterSummary}, ${delaySummary}, ${reverbSummary}`;

  const handleMint = () => {
    onMint(name);
  };

  return (
    <div className="stage-card stage-card--mint">
      <div className="stage-card__body stage-card__body--centered">
        {mintedName ? (
          <div className="mint-confirmation" role="status">
            <p className="mint-confirmation__title">{`"${mintedName}" minted.`}</p>
            <a className="mint-confirmation__link" href={HOME_HREF}>
              use it on the main page &rarr;
            </a>
          </div>
        ) : (
          <>
            <p className="stage-section__summary">{summaryLine}</p>
            <label className="mint-name-label" htmlFor="mint-name">
              Name this sound
            </label>
            <input
              id="mint-name"
              type="text"
              className="mint-name-input"
              placeholder="Sound name"
              maxLength={48}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleMint();
              }}
            />
            <button
              type="button"
              className="mint-button"
              onClick={handleMint}
            >
              Mint sound
            </button>
          </>
        )}
      </div>
      <StageFooterNav stageId="mint" onNavigate={onAdvance} />
    </div>
  );
};

const SoundDesignerPage = () => {
  const [engineStatus, setEngineStatus] = React.useState(() => audioEngine.getStatus());
  const [waveformType, setWaveformType] = React.useState(() => DEFAULT_WAVEFORM);
  const [audioParams, setAudioParams] = React.useState(() => (
    sanitizeAudioParams(AUDIO_PARAM_DEFAULTS)
  ));
  const [activePresetName, setActivePresetName] = React.useState(null);
  const [activeStage, setActiveStage] = React.useState('base');
  const [visitedStages, setVisitedStages] = React.useState(() => new Set(['base']));
  const [mintedName, setMintedName] = React.useState(null);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarTab, setSidebarTab] = React.useState('sound');

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

  const goToStage = React.useCallback((stageId) => {
    if (!STAGE_INDEX.hasOwnProperty(stageId)) return;
    setActiveStage(stageId);
    setVisitedStages((prev) => {
      if (prev.has(stageId)) return prev;
      const next = new Set(prev);
      next.add(stageId);
      return next;
    });
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

  const handlePresetApplied = React.useCallback((preset) => {
    if (preset.waveformType) setWaveformType(preset.waveformType);
    if (preset.audioParams) setAudioParams(sanitizeAudioParams(preset.audioParams));
    setActivePresetName(preset.name || null);
  }, []);

  const handleMint = React.useCallback((name) => {
    const preset = saveUserPreset({ name, waveformType, audioParams });
    setActivePresetName(preset.name);
    setMintedName(preset.name);
  }, [waveformType, audioParams]);

  const presetShelfProps = {
    waveformType,
    audioParams,
    activePresetName,
    onApply: handlePresetApplied,
    foldBrowse: true,
    hideSave: true
  };

  return (
    <div className="sound-designer-page">
      <main className="sound-designer-page__shell">
        <AppHeader activeSection="sound-designer" className="sound-designer-page__header" />

        <div className="sound-designer-workspace">
          <div className="sound-designer-scope" role="region" aria-label="Live sound visualization">
            <WaveCandy />
          </div>

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

          <div className="sound-designer-section-header">
            <div>
              <span className="sound-designer-section-header__eyebrow">Sound architecture</span>
              <h1>{STAGES[STAGE_INDEX[activeStage]].label}</h1>
            </div>
            <span className="sound-designer-section-header__count">0{STAGE_INDEX[activeStage] + 1} / 05</span>
          </div>

          <nav className="stage-rail" aria-label="Sound design stages">
            {STAGES.map((stage, index) => {
              const isActive = activeStage === stage.id;
              const isVisited = visitedStages.has(stage.id);
              return (
                <button
                  key={stage.id}
                  type="button"
                  className={`stage-rail__tab${isActive ? ' is-active' : ''}${isVisited ? ' is-visited' : ''}`}
                  onClick={() => goToStage(stage.id)}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={stage.label}
                >
                  <span className="stage-rail__index">0{index + 1}</span>
                  <span>{stage.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="stage-stage" role="region" aria-label={`${STAGES[STAGE_INDEX[activeStage]].label} stage`}>
            {activeStage === 'base' && (
              <BaseStage
                waveformType={waveformType}
                onWaveformChange={setWaveformType}
                presetShelfProps={presetShelfProps}
                onAdvance={goToStage}
              />
            )}
            {activeStage === 'tone' && (
              <ToneStage
                audioParams={audioParams}
                onParamChange={handleAudioParamChange}
                onAdvance={goToStage}
              />
            )}
            {activeStage === 'motion' && (
              <MotionStage
                audioParams={audioParams}
                onParamChange={handleAudioParamChange}
                onAdvance={goToStage}
              />
            )}
            {activeStage === 'space' && (
              <SpaceStage
                audioParams={audioParams}
                onParamChange={handleAudioParamChange}
                onAdvance={goToStage}
              />
            )}
            {activeStage === 'mint' && (
              <MintStage
                waveformType={waveformType}
                audioParams={audioParams}
                onMint={handleMint}
                mintedName={mintedName}
                onAdvance={goToStage}
              />
            )}
          </div>

        </div>
      </main>
      <Sidebar
        isOpen={sidebarOpen}
        onOpen={() => setSidebarOpen(true)}
        onClose={() => setSidebarOpen(false)}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        currentView="design"
      />
    </div>
  );
};

export default SoundDesignerPage;
