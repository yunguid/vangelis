import React from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import {
  HOME_HREF,
  MIDI_PIPELINE_HREF,
  STUDY_SONGS_HREF
} from '../utils/routes.js';

const NAV_ITEMS = [
  { id: 'studio', label: 'Studio', href: HOME_HREF },
  { id: 'pipeline', label: 'MIDI pipeline', href: MIDI_PIPELINE_HREF },
  { id: 'studies', label: 'Song studies', href: STUDY_SONGS_HREF }
];

const AppHeader = ({
  activeSection,
  className = '',
  onResetSound,
  onUploadSample,
  onClearSample,
  onToggleRecording,
  onShowShortcuts,
  hasCustomSample,
  isRecording,
  sampleLabel = '',
  sampleLoading = false
}) => {
  const uploadInputId = React.useId();
  const [engineStatus, setEngineStatus] = React.useState(() => audioEngine.getStatus());
  const [recordingState, setRecordingState] = React.useState(() => audioEngine.getStatus().isRecording);
  const [localSampleName, setLocalSampleName] = React.useState('');
  const [localSampleLoading, setLocalSampleLoading] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = audioEngine.subscribe(setEngineStatus);
    const unsubscribeRecording = audioEngine.subscribeRecording(setRecordingState);
    return () => {
      unsubscribe();
      unsubscribeRecording();
    };
  }, []);

  const resolvedHasCustomSample = hasCustomSample ?? engineStatus.hasCustomSample;
  const resolvedIsRecording = isRecording ?? recordingState;
  const resolvedSampleLoading = sampleLoading || localSampleLoading;
  const resolvedSampleLabel = sampleLabel || localSampleName;
  const showHeaderActions = Boolean(
    onResetSound
    || onUploadSample
    || onClearSample
    || onToggleRecording
    || onShowShortcuts
  );
  const canResetSound = typeof onResetSound === 'function';
  const canUploadSample = typeof onUploadSample === 'function';
  const canClearSample = resolvedHasCustomSample && typeof onClearSample === 'function';
  const canToggleRecording = typeof onToggleRecording === 'function';
  const canShowShortcuts = typeof onShowShortcuts === 'function';

  React.useEffect(() => {
    if (!resolvedHasCustomSample && sampleLabel.length === 0) {
      setLocalSampleName('');
    }
  }, [resolvedHasCustomSample, sampleLabel]);

  const handleUploadSample = React.useCallback(async (file) => {
    if (!file) return;

    if (typeof onUploadSample === 'function') {
      await onUploadSample(file);
      return;
    }

    setLocalSampleLoading(true);
    try {
      await audioEngine.loadCustomSample(file);
      setLocalSampleName(file.name);
    } catch (error) {
      console.error('Failed to load sample from shared header:', error);
    } finally {
      setLocalSampleLoading(false);
    }
  }, [onUploadSample]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await handleUploadSample(file);
  };

  const handleClearSample = () => {
    if (typeof onClearSample === 'function') {
      onClearSample();
      return;
    }

    audioEngine.clearCustomSample();
    setLocalSampleName('');
  };

  const handleRecordToggle = () => {
    if (typeof onToggleRecording === 'function') {
      onToggleRecording();
      return;
    }

    audioEngine.toggleRecording?.();
  };

  const headerClassName = ['zone-top', 'tier-subtle', 'content-tertiary', className]
    .filter(Boolean)
    .join(' ');

  return (
    <header className={headerClassName} aria-label="Branding and quick actions">
      <div className="brand-block">
        <div className="brand-title">Vangelis</div>
      </div>

      <div className="header-controls">
        <nav className="header-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const isActive = item.id === activeSection;
            return (
              <a
                key={item.id}
                className={`button-link button-link--nav ${isActive ? 'is-active' : ''}`}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {showHeaderActions && (
          <div className="header-actions">
            <button
              type="button"
              className="button-link button-link--quiet"
              onClick={canResetSound ? onResetSound : undefined}
              disabled={!canResetSound}
              title={canResetSound ? 'Restore the default dry sound' : 'Available in Studio'}
            >
              Reset sound
            </button>

            <input
              id={uploadInputId}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              disabled={!canUploadSample || resolvedSampleLoading}
              style={{ display: 'none' }}
            />
            <label
              htmlFor={canUploadSample ? uploadInputId : undefined}
              className={`button-icon ${resolvedSampleLoading ? 'loading' : ''} ${canUploadSample ? '' : 'is-disabled'}`}
              aria-label={resolvedSampleLabel ? `Loaded sample ${resolvedSampleLabel}` : 'Upload sample'}
              aria-disabled={!canUploadSample}
              title={canUploadSample ? 'Upload sample' : 'Available in Studio'}
            >
              <span aria-hidden="true">{resolvedHasCustomSample ? '!' : '+'}</span>
            </label>

            {resolvedHasCustomSample && (
              <button
                type="button"
                className="button-icon"
                onClick={canClearSample ? handleClearSample : undefined}
                disabled={!canClearSample}
                aria-label="Clear custom sample"
                title={canClearSample ? 'Clear custom sample' : 'Available in Studio'}
              >
                <span aria-hidden="true">x</span>
              </button>
            )}

            <button
              type="button"
              className={`button-icon record-button ${resolvedIsRecording ? 'recording' : ''}`}
              onClick={canToggleRecording ? handleRecordToggle : undefined}
              disabled={!canToggleRecording}
              aria-label={resolvedIsRecording ? 'Stop recording' : 'Start recording'}
              title={canToggleRecording ? 'Record output' : 'Available in Studio'}
            >
              <span aria-hidden="true">{resolvedIsRecording ? '||' : 'O'}</span>
            </button>

            <button
              type="button"
              className="button-icon"
              onClick={canShowShortcuts ? onShowShortcuts : undefined}
              disabled={!canShowShortcuts}
              aria-label="View keyboard shortcuts"
              title={canShowShortcuts ? 'View keyboard shortcuts' : 'Available in Studio'}
            >
              <span aria-hidden="true">?</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
