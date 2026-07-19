import React from 'react';
import { BrandHeader } from '../components/Sidebar/SidebarNavigation.jsx';
import PresetShelf from '../components/PresetShelf.jsx';
import Sidebar from '../components/Sidebar';
import SynthKeyboard from '../components/SynthKeyboard';
import { useAudioEngineWarmup } from '../hooks/useAudioEngineWarmup.js';
import {
  PRIMARY_VISUAL_DELAY_MS,
  useDeferredVisualMount
} from '../hooks/useDeferredVisualMount.js';
import { audioEngine } from '../utils/audioEngine.js';
import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_WAVEFORM,
  WAVEFORM_OPTIONS,
  sanitizeAudioParams
} from '../utils/audioParams.js';
import { saveUserPreset } from '../utils/userPresetStorage.js';
import './SoundDesignerPage.css';

const WaveCandy = React.lazy(() => import('../components/WaveCandy'));
const loadAdvancedStages = () => import('./SoundDesignerAdvancedStages.jsx');
const SoundDesignerAdvancedStages = React.lazy(loadAdvancedStages);

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

// The wizard's back/next affordances. Every stage except the first (Base)
// gets a "← back" to the previous stage; every stage except the last (Mint)
// keeps its "next →". Both just call the same onNavigate (goToStage) — the
// stage rail tabs remain freely clickable regardless, this is only the
// wizard's forward/backward thread.
const StageFooterNav = React.memo(({ stageId, onNavigate }) => {
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
});

const BaseStage = React.memo(({ waveformType, onWaveformChange, presetShelfProps, onAdvance }) => (
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
));

const SoundDesignerPage = () => {
  useAudioEngineWarmup();
  const showWaveCandy = useDeferredVisualMount(PRIMARY_VISUAL_DELAY_MS);
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
  const handleSidebarOpen = React.useCallback(() => setSidebarOpen(true), []);
  const handleSidebarClose = React.useCallback(() => setSidebarOpen(false), []);

  React.useEffect(() => {
    audioEngine.setSanitizedGlobalParams(audioParams);
  }, [audioParams]);

  React.useEffect(() => {
    const unsubscribe = audioEngine.subscribe(setEngineStatus);

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

  const presetShelfProps = React.useMemo(() => ({
    activePresetName,
    onApply: handlePresetApplied,
    foldBrowse: true,
    hideSave: true
  }), [activePresetName, handlePresetApplied]);

  return (
    <div className="sound-designer-page">
      <main className="sound-designer-page__shell">
        <BrandHeader className="sound-designer-page__header" />

        <div className="sound-designer-workspace">
          <div className="sound-designer-scope" role="region" aria-label="Live sound visualization">
            {showWaveCandy ? (
              <React.Suspense fallback={<div className="wave-candy wave-candy-placeholder" aria-hidden="true" />}>
                <WaveCandy />
              </React.Suspense>
            ) : (
              <div className="wave-candy wave-candy-placeholder" aria-hidden="true" />
            )}
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
                  onPointerEnter={stage.id === 'base' ? undefined : loadAdvancedStages}
                  onFocus={stage.id === 'base' ? undefined : loadAdvancedStages}
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
            {activeStage !== 'base' && (
              <React.Suspense
                fallback={<div className="stage-card stage-card--loading" role="status">Loading controls…</div>}
              >
                <SoundDesignerAdvancedStages
                  stageId={activeStage}
                  waveformType={waveformType}
                  audioParams={audioParams}
                  onParamChange={handleAudioParamChange}
                  onMint={handleMint}
                  mintedName={mintedName}
                  onAdvance={goToStage}
                />
              </React.Suspense>
            )}
          </div>

        </div>
      </main>
      <Sidebar
        isOpen={sidebarOpen}
        onOpen={handleSidebarOpen}
        onClose={handleSidebarClose}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        currentView="design"
        soundLabel={activePresetName || waveformType}
      />
    </div>
  );
};

export default SoundDesignerPage;
