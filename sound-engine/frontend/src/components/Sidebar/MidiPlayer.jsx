import React from 'react';

/**
 * MIDI playback controls component
 */
const MidiPlayer = ({
  isPlaying,
  isPaused,
  progress,
  currentMidi,
  tempoFactor = 1.0,
  onPlay,
  onPause,
  onResume,
  onStop,
  onTempoChange
}) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const elapsed = currentMidi ? progress * currentMidi.duration : 0;
  const total = currentMidi?.duration || 0;

  return (
    <div className="midi-player">
      <div className="midi-player__progress">
        <div
          className="midi-player__progress-bar"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="midi-player__time">
        <span>{formatTime(elapsed)}</span>
        <span>{formatTime(total)}</span>
      </div>

      <div className="midi-player__controls">
        {!isPlaying && !isPaused && (
          <button
            type="button"
            className="midi-player__btn midi-player__btn--play"
            onClick={onPlay}
            disabled={!currentMidi}
            aria-label="Play"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        )}

        {isPlaying && (
          <button
            type="button"
            className="midi-player__btn midi-player__btn--pause"
            onClick={onPause}
            aria-label="Pause"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
        )}

        {isPaused && (
          <button
            type="button"
            className="midi-player__btn midi-player__btn--play"
            onClick={onResume}
            aria-label="Resume"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        )}

        <button
          type="button"
          className="midi-player__btn midi-player__btn--stop"
          onClick={onStop}
          disabled={!isPlaying && !isPaused}
          aria-label="Stop"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M6 6h12v12H6z"/>
          </svg>
        </button>
      </div>

      {currentMidi && (
        <div className="midi-player__info">
          <span className="midi-player__title">{currentMidi.name}</span>
          <span className="midi-player__meta">
            {Math.round(currentMidi.bpm * tempoFactor)} BPM
          </span>
        </div>
      )}

      <div className="midi-player__tempo">
        <label className="midi-player__tempo-label">
          <span>Tempo</span>
          <span className="midi-player__tempo-value">{tempoFactor.toFixed(2)}×</span>
        </label>
        <input
          type="range"
          className="midi-player__tempo-slider"
          min="0.25"
          max="2"
          step="0.05"
          value={tempoFactor}
          onChange={(e) => onTempoChange?.(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
};

export default MidiPlayer;
