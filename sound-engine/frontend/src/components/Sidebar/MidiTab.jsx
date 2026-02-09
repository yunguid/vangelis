import React, { useState, useCallback, useRef } from 'react';
import { parseMidiFile, getBuiltInMidiFiles } from '../../utils/midiParser.js';
import MidiPlayer from './MidiPlayer.jsx';

/**
 * MIDI browser and player tab component
 */
const MidiTab = ({
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
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const builtInFiles = getBuiltInMidiFiles();

  const loadMidiWithFallback = useCallback(async (file) => {
    try {
      return await parseMidiFile(file.path);
    } catch (error) {
      if (!file.sourceUrl || file.sourceUrl === file.path) {
        throw error;
      }
      return await parseMidiFile(file.sourceUrl);
    }
  }, []);

  const handleLoadBuiltIn = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);
    setSelectedFile(file);

    try {
      const midiData = await loadMidiWithFallback(file);
      onPlay(midiData);
    } catch (err) {
      console.error('Failed to load MIDI file:', err);
      setError(file.sourceUrl
        ? 'Failed to load MIDI file. The library may need to be synced.'
        : 'Failed to load MIDI file. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [loadMidiWithFallback, onPlay]);

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setSelectedFile({ id: 'custom', name: file.name });

    try {
      const midiData = await parseMidiFile(file);
      onPlay(midiData);
    } catch (err) {
      console.error('Failed to parse MIDI file:', err);
      setError('Failed to parse MIDI file. Make sure it\'s a valid .mid file.');
    } finally {
      setIsLoading(false);
    }
  }, [onPlay]);

  const handlePlayCurrent = useCallback(() => {
    if (currentMidi) {
      onPlay(currentMidi);
    }
  }, [currentMidi, onPlay]);

  return (
    <div className="midi-tab">
      <div className="midi-tab__section">
        <h3 className="midi-tab__heading">Player</h3>
        <MidiPlayer
          isPlaying={isPlaying}
          isPaused={isPaused}
          progress={progress}
          currentMidi={currentMidi}
          tempoFactor={tempoFactor}
          onPlay={handlePlayCurrent}
          onPause={onPause}
          onResume={onResume}
          onStop={onStop}
          onTempoChange={onTempoChange}
        />
      </div>

      <div className="midi-tab__section">
        <h3 className="midi-tab__heading">Library</h3>
        <ul className="midi-tab__list">
          {builtInFiles.map((file) => (
            <li key={file.id} className="midi-tab__item">
              <button
                type="button"
                className={`midi-tab__file-btn ${selectedFile?.id === file.id ? 'midi-tab__file-btn--active' : ''}`}
                onClick={() => handleLoadBuiltIn(file)}
                disabled={isLoading}
              >
                <span className="midi-tab__file-name">{file.name}</span>
                <span className="midi-tab__file-composer">{file.composer}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="midi-tab__section">
        <h3 className="midi-tab__heading">Upload</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mid,.midi"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
          id="midi-upload"
        />
        <label
          htmlFor="midi-upload"
          className={`midi-tab__upload-btn ${isLoading ? 'midi-tab__upload-btn--loading' : ''}`}
        >
          {isLoading ? 'Loading...' : 'Choose MIDI File'}
        </label>
      </div>

      {error && (
        <div className="midi-tab__error">
          {error}
        </div>
      )}
    </div>
  );
};

export default MidiTab;
