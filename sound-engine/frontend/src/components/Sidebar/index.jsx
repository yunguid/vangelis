import React, { useEffect, useCallback } from 'react';
import {
  useMidiTransport,
  useSoundControls
} from '../../context/SynthContexts.jsx';
import SidebarRail from './SidebarRail.jsx';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 900px)';

let midiTabPromise;
let soundTabPromise;
const loadMidiTab = () => {
  midiTabPromise ||= import('./MidiTab.jsx');
  return midiTabPromise;
};
const loadSoundTab = () => {
  soundTabPromise ||= import('./SoundTab.jsx');
  return soundTabPromise;
};
const MidiTab = React.lazy(loadMidiTab);
const SoundTab = React.lazy(loadSoundTab);
const preloadPanel = (tab) => {
  const promise = tab === 'midi' ? loadMidiTab() : loadSoundTab();
  promise.catch(() => undefined);
};

const MidiPanelContent = () => {
  const {
    isPlaying,
    isPaused,
    progress,
    currentMidi,
    tempoFactor,
    onPlay,
    onPause,
    onResume,
    onStop,
    onTempoChange
  } = useMidiTransport();

  return (
    <MidiTab
      isPlaying={isPlaying}
      isPaused={isPaused}
      progress={progress}
      currentMidi={currentMidi}
      tempoFactor={tempoFactor}
      onPlay={onPlay}
      onPause={onPause}
      onResume={onResume}
      onStop={onStop}
      onTempoChange={onTempoChange}
    />
  );
};

const SoundPanelContent = () => {
  const {
    waveformType,
    onWaveformChange,
    audioParams,
    onParamChange,
    onParamsChange,
    transportBpm,
    controlSections,
    onControlSectionToggle,
    activePresetName,
    onPresetApplied
  } = useSoundControls();

  return (
    <SoundTab
      currentWaveform={waveformType}
      onWaveformChange={onWaveformChange}
      audioParams={audioParams}
      onParamChange={onParamChange}
      onParamsChange={onParamsChange}
      transportBpm={transportBpm}
      sections={controlSections}
      onSectionToggle={onControlSectionToggle}
      onPresetApplied={onPresetApplied}
      activePresetName={activePresetName}
    />
  );
};

/**
 * Collapsed sidebar rail with expandable panel
 * Supports multiple tabs: MIDI, Voice, Sound
 * MIDI transport, voice phrase, and sound-control state come from contexts.
 */
const Sidebar = ({
  isOpen,
  onClose = () => {},
  onOpen = () => {},
  activeTab,
  onTabChange = () => {},
  disabled = false,
  currentView = 'keyboard',
  isMidiPlaying = false,
  midiName = '',
  soundLabel = ''
}) => {
  const [hasOpened, setHasOpened] = React.useState(isOpen);
  // Close on escape key
  useEffect(() => {
    if (disabled || !isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;
    const isMobileViewport = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
    if (!isMobileViewport) return undefined;

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  const handleRailClick = useCallback((tab) => {
    if (disabled) return;

    if (isOpen && activeTab === tab) {
      onClose();
    } else {
      onTabChange(tab);
      if (!isOpen) onOpen();
    }
  }, [disabled, isOpen, activeTab, onClose, onOpen, onTabChange]);

  const panelTitle = activeTab === 'midi'
    ? 'MIDI'
    : 'Sound controls';
  const panelSubtitle = activeTab === 'midi'
    ? midiName
    : soundLabel;

  return (
    <div className={`sidebar-container ${isOpen ? 'sidebar-container--open' : ''} ${disabled ? 'sidebar-container--disabled' : ''}`}>
      <SidebarRail
        isOpen={isOpen}
        activeTab={activeTab}
        disabled={disabled}
        currentView={currentView}
        isMidiPlaying={isMidiPlaying}
        onTabSelect={handleRailClick}
        onPanelPreload={preloadPanel}
      />

      {/* Expandable Panel */}
      <div
        className={`sidebar-panel ${isOpen ? 'sidebar-panel--open' : ''}`}
        aria-hidden={!isOpen || disabled}
        role="complementary"
        aria-label={activeTab === 'midi' ? 'MIDI browser' : 'Sound controls'}
        {...((!isOpen || disabled) && { inert: '' })}
      >
        <div className="sidebar-panel__header">
          <div className="sidebar-panel__heading-group">
            <h2 className="sidebar-panel__title">{panelTitle}</h2>
            {panelSubtitle && <p className="sidebar-panel__subtitle">{panelSubtitle}</p>}
          </div>
          <button
            type="button"
            className="sidebar-panel__close"
            onClick={onClose}
            aria-label="Close sidebar panel"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="sidebar-panel__content">
          {(hasOpened || isOpen) && (
            <React.Suspense fallback={<div className="sidebar-panel__loading" role="status">Loading controls…</div>}>
              {activeTab === 'midi' && (
                <MidiPanelContent />
              )}
              {activeTab === 'sound' && (
                <SoundPanelContent />
              )}
            </React.Suspense>
          )}
        </div>
      </div>

      {/* Backdrop for closing */}
      {isOpen && !disabled && (
        <div
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default React.memo(Sidebar);
