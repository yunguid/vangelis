import React, { useEffect, useCallback } from 'react';
import MidiTab from './MidiTab.jsx';
import SoundTab from './SoundTab.jsx';
import {
  useMidiTransport,
  useSoundControls
} from '../../context/SynthContexts.jsx';
import './Sidebar.css';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 900px)';

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
  disabled = false
}) => {
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
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!disabled && e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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

  const handleRailClick = useCallback((tab) => {
    if (disabled) return;

    if (isOpen && activeTab === tab) {
      onClose();
    } else {
      onTabChange(tab);
      if (!isOpen) onOpen();
    }
  }, [disabled, isOpen, activeTab, onClose, onOpen, onTabChange]);

  const tabs = [
    {
      id: 'sound',
      label: 'Sound',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="6" y1="5" x2="6" y2="19" />
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="18" y1="5" x2="18" y2="19" />
          <circle cx="6" cy="9" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="12" cy="15" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="18" cy="8" r="2.2" fill="currentColor" stroke="none" />
        </svg>
      ),
      isActive: false
    },
    {
      id: 'midi',
      label: 'MIDI',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      ),
      isActive: !disabled && isPlaying
    },
  ];
  const activePanel = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const panelTitle = activeTab === 'midi'
    ? 'MIDI library'
    : 'Sound controls';
  const panelSubtitle = activeTab === 'midi'
    ? currentMidi?.name
    : (activePresetName || waveformType);

  return (
    <div className={`sidebar-container ${isOpen ? 'sidebar-container--open' : ''} ${disabled ? 'sidebar-container--disabled' : ''}`}>
      {/* Icon Rail - always visible */}
      <div className="sidebar-rail">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`sidebar-rail__btn ${isOpen && activeTab === tab.id ? 'sidebar-rail__btn--active' : ''} ${tab.isActive ? 'sidebar-rail__btn--playing' : ''}`}
            onClick={() => handleRailClick(tab.id)}
            disabled={disabled}
            aria-label={disabled ? `${tab.label} panel unavailable on this page` : isOpen && activeTab === tab.id ? `Close ${tab.label} ${tab.id === 'sound' ? 'controls' : 'browser'}` : `Open ${tab.label} ${tab.id === 'sound' ? 'controls' : 'browser'}`}
            aria-expanded={!disabled && isOpen && activeTab === tab.id}
            title={disabled ? 'Available on Keyboard' : undefined}
          >
            {tab.icon}
            <span className="sidebar-rail__label">{tab.label}</span>
            {tab.isActive && <span className="sidebar-rail__indicator" />}
          </button>
        ))}
      </div>

      {/* Expandable Panel */}
      <div
        className={`sidebar-panel ${isOpen ? 'sidebar-panel--open' : ''}`}
        aria-hidden={!isOpen || disabled}
        role="complementary"
        aria-label={activePanel.id === 'sound' ? 'Sound controls' : `${activePanel.label} browser`}
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
          {activeTab === 'midi' && (
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
          )}
          {activeTab === 'sound' && (
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

export default Sidebar;
