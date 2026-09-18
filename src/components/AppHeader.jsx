import React from 'react';

const RECORD_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <circle cx="12" cy="12" r="7" />
  </svg>
);

const STOP_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <rect x="7" y="7" width="10" height="10" rx="1" />
  </svg>
);

const AppHeader = ({ className = '', onToggleRecording, isRecording }) => {
  const headerClassName = ['zone-top', 'tier-subtle', 'content-tertiary', className]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClassName} aria-label="Branding and quick actions">
      <div className="brand-block">
        <div className="brand-title">Vangelis</div>
      </div>
      {onToggleRecording && (
        <div className="header-controls">
          <div className="header-actions">
            <button
              type="button"
              className={`btn btn--icon ${isRecording ? 'btn--accent' : ''}`}
              onClick={onToggleRecording}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              title={isRecording ? 'Stop recording' : 'Record output'}
            >
              {isRecording ? STOP_ICON : RECORD_ICON}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default React.memo(AppHeader);
