import React from 'react';
import { PIANO_ROLL_HREF, SOUND_DESIGNER_HREF, STUDY_SONGS_HREF } from '../../utils/routes.js';
import './Sidebar.css';

let soundDesignerRoutePromise;

const preloadSoundDesignerRoute = () => {
  soundDesignerRoutePromise ||= import('../../pages/SoundDesignerPage.jsx');
  soundDesignerRoutePromise.catch(() => undefined);
};

let pianoRollRoutePromise;

const preloadPianoRollRoute = () => {
  pianoRollRoutePromise ||= import('../../pages/PianoRollPage.jsx');
  pianoRollRoutePromise.catch(() => undefined);
};

let studySongsRoutePromise;

const preloadStudySongsRoute = () => {
  studySongsRoutePromise ||= import('../../pages/StudySongsPage.jsx');
  studySongsRoutePromise.catch(() => undefined);
};

const SidebarRail = ({
  isOpen = false,
  activeTab = 'sound',
  disabled = false,
  currentView = 'keyboard',
  isMidiPlaying = false,
  onTabSelect = () => {},
  onPanelPreload = () => {}
}) => {
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
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      ),
      isActive: !disabled && isMidiPlaying
    }
  ];

  return (
    <div className="sidebar-rail">
      <div className="sidebar-rail__nav">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sidebar-rail__btn ${isOpen && activeTab === tab.id ? 'sidebar-rail__btn--active' : ''} ${tab.isActive ? 'sidebar-rail__btn--playing' : ''}`}
            onClick={() => onTabSelect(tab.id)}
            onPointerEnter={() => onPanelPreload(tab.id)}
            onFocus={() => onPanelPreload(tab.id)}
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
        <a
          className={`sidebar-rail__btn sidebar-rail__btn--nav ${currentView === 'keyboard' ? 'sidebar-rail__btn--current' : ''}`}
          href="#/"
          aria-label="Open the keyboard player"
          aria-current={currentView === 'keyboard' ? 'page' : undefined}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="12" rx="1.5" />
            <line x1="8.5" y1="6" x2="8.5" y2="13.5" />
            <line x1="15.5" y1="6" x2="15.5" y2="13.5" />
          </svg>
          <span className="sidebar-rail__label">Play</span>
        </a>
        <a
          className={`sidebar-rail__btn sidebar-rail__btn--nav ${currentView === 'editor' ? 'sidebar-rail__btn--current' : ''}`}
          href={PIANO_ROLL_HREF}
          aria-label="Open the pattern editor"
          aria-current={currentView === 'editor' ? 'page' : undefined}
          onPointerEnter={preloadPianoRollRoute}
          onFocus={preloadPianoRollRoute}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="1.5" />
            <line x1="9" y1="4" x2="9" y2="20" />
            <rect x="10.5" y="7" width="6" height="2.6" rx="0.6" fill="currentColor" stroke="none" />
            <rect x="13" y="12" width="5" height="2.6" rx="0.6" fill="currentColor" stroke="none" />
          </svg>
          <span className="sidebar-rail__label">Editor</span>
        </a>
        <a
          className={`sidebar-rail__btn sidebar-rail__btn--nav ${currentView === 'design' ? 'sidebar-rail__btn--current' : ''}`}
          href={SOUND_DESIGNER_HREF}
          aria-label="Open the sound design workspace"
          aria-current={currentView === 'design' ? 'page' : undefined}
          onPointerEnter={preloadSoundDesignerRoute}
          onFocus={preloadSoundDesignerRoute}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 15 L9 15 L11 9 L14 19 L16 12 L20 12" />
          </svg>
          <span className="sidebar-rail__label">Design</span>
        </a>
        <a
          className={`sidebar-rail__btn sidebar-rail__btn--nav ${currentView === 'studies' ? 'sidebar-rail__btn--current' : ''}`}
          href={STUDY_SONGS_HREF}
          aria-label="Open the song study library"
          aria-current={currentView === 'studies' ? 'page' : undefined}
          onPointerEnter={preloadStudySongsRoute}
          onFocus={preloadStudySongsRoute}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 6.5C10.3 5.1 7.9 4.5 4.5 4.5v13c3.4 0 5.8.6 7.5 2 1.7-1.4 4.1-2 7.5-2v-13c-3.4 0-5.8.6-7.5 2Z" />
            <line x1="12" y1="6.5" x2="12" y2="19.5" />
          </svg>
          <span className="sidebar-rail__label">Studies</span>
        </a>
      </div>
      <div className="sidebar-rail__status" aria-label="Audio engine active">
        <span className="sidebar-rail__status-dot" />
        DSP
      </div>
    </div>
  );
};

export default React.memo(SidebarRail);
