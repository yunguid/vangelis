import React from 'react';

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
              className={`button-icon record-button ${isRecording ? 'recording' : ''}`}
              onClick={onToggleRecording}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              title="Record output"
            >
              <span aria-hidden="true">{isRecording ? '||' : 'O'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default React.memo(AppHeader);
