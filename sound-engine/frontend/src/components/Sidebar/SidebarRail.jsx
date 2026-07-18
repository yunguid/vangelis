import React from 'react';
import { SOUND_DESIGNER_HREF } from '../../utils/routes.js';
import './Sidebar.css';

let homeRoutePromise;
let soundDesignerRoutePromise;

const preloadHomeRoute = () => {
  homeRoutePromise ||= import('../../App.jsx');
  homeRoutePromise.catch(() => undefined);
};

const preloadSoundDesignerRoute = () => {
  soundDesignerRoutePromise ||= import('../../pages/SoundDesignerPage.jsx');
  soundDesignerRoutePromise.catch(() => undefined);
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
      <a
        className="sidebar-rail__brand"
        href="#/"
        aria-label="Return to keyboard"
        onPointerEnter={preloadHomeRoute}
        onFocus={preloadHomeRoute}
      >
        V
      </a>
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
      </div>
      <div className="sidebar-rail__status" aria-label="Audio engine active">
        <span className="sidebar-rail__status-dot" />
        DSP
      </div>
    </div>
  );
};

export default React.memo(SidebarRail);
