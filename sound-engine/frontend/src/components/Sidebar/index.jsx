import React, { useEffect, useCallback } from 'react';
import MidiTab from './MidiTab.jsx';
import SamplesTab from './SamplesTab.jsx';
import SoundTab from './SoundTab.jsx';
import './Sidebar.css';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 900px)';

/**
 * Collapsed sidebar rail with expandable panel
 * Supports multiple tabs: MIDI, Samples, Sound
 */
const Sidebar = ({
  isOpen,
  onClose,
  onOpen,
  activeTab,
  onTabChange,
  // MIDI props
  isPlaying,
  isPaused,
  progress,
  currentMidi,
  tempoFactor,
  onPlay,
  onPause,
  onResume,
  onStop,
  onTempoChange,
  // Samples props
  onSampleSelect,
  activeSampleId,
  // Sound props
  waveformType,
  onWaveformChange,
  audioParams,
  onParamChange,
  onParamsChange,
  transportBpm,
  controlSections,
  onControlSectionToggle
}) => {
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
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
    if (isOpen && activeTab === tab) {
      onClose();
    } else {
      onTabChange(tab);
      if (!isOpen) onOpen();
    }
  }, [isOpen, activeTab, onClose, onOpen, onTabChange]);

  const tabs = [
    {
      id: 'midi',
      label: 'MIDI',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      ),
      isActive: isPlaying
    },
    {
      id: 'samples',
      label: 'Samples',
      icon: (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      ),
      isActive: !!activeSampleId
    },
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
    }
  ];
  const activePanel = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const panelTitle = activeTab === 'midi'
    ? 'MIDI library'
    : activeTab === 'samples'
      ? 'Sample library'
      : 'Sound controls';
  const panelSubtitle = activeTab === 'midi'
    ? (currentMidi?.name || 'Pick a file, then play')
    : activeTab === 'samples'
      ? (activeSampleId ? 'Sample ready' : 'Pick or import a sample')
      : `Waveform: ${waveformType}`;

  return (
    <div className={`sidebar-container ${isOpen ? 'sidebar-container--open' : ''}`}>
      {/* Icon Rail - always visible */}
      <div className="sidebar-rail">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`sidebar-rail__btn ${isOpen && activeTab === tab.id ? 'sidebar-rail__btn--active' : ''} ${tab.isActive ? 'sidebar-rail__btn--playing' : ''}`}
            onClick={() => handleRailClick(tab.id)}
            aria-label={isOpen && activeTab === tab.id ? `Close ${tab.label} ${tab.id === 'sound' ? 'controls' : 'browser'}` : `Open ${tab.label} ${tab.id === 'sound' ? 'controls' : 'browser'}`}
            aria-expanded={isOpen && activeTab === tab.id}
          >
            {tab.icon}
            <span className="sidebar-rail__label">{tab.label}</span>
            {tab.isActive && <span className="sidebar-rail__pulse" />}
          </button>
        ))}
      </div>

      {/* Expandable Panel */}
      <div
        className={`sidebar-panel ${isOpen ? 'sidebar-panel--open' : ''}`}
        aria-hidden={!isOpen}
        role="complementary"
        aria-label={activePanel.id === 'sound' ? 'Sound controls' : `${activePanel.label} browser`}
        {...(!isOpen && { inert: '' })}
      >
        <div className="sidebar-panel__header">
          <div className="sidebar-panel__heading-group">
            <h2 className="sidebar-panel__title">{panelTitle}</h2>
            <p className="sidebar-panel__subtitle">{panelSubtitle}</p>
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
          {activeTab === 'samples' && (
            <SamplesTab
              onSampleSelect={onSampleSelect}
              activeSampleId={activeSampleId}
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
            />
          )}
        </div>
      </div>

      {/* Backdrop for closing */}
      {isOpen && (
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
