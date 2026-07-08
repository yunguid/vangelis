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
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);

  const builtInFiles = getBuiltInMidiFiles();
  const filteredFiles = builtInFiles.filter((file) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${file.name} ${file.composer || ''}`.toLowerCase().includes(query);
  });

  // Strip a trailing "(Tag)" so the row title displays cleanly.
  const splitTag = (name) => {
    const match = /^(.*?)\s*\(([^)]+)\)$/.exec(name);
    return match ? { title: match[1] } : { title: name };
  };
  const originals = filteredFiles.filter((file) => file.id.startsWith('original-'));
  const classics = filteredFiles.filter((file) => !file.id.startsWith('original-'));

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
      onPlay({
        ...midiData,
        name: file.name || midiData.name,
        sourceFileId: file.id,
        sourcePath: file.path,
        sourceUrl: file.sourceUrl || null,
        composer: file.composer
      });
    } catch (err) {
      console.error('Failed to load MIDI file:', err);
      setError(file.sourceUrl
        ? 'MIDI load failed. Run sync scripts.'
        : 'MIDI load failed. Try again.'
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
      setError('MIDI parse failed. Use .mid only.');
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
        <input
          type="search"
          className="midi-tab__search"
          placeholder="Find title or composer"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Filter MIDI library"
        />
        {isLoading ? (
          <div className="midi-tab__skeleton" aria-hidden="true">
            <div className="midi-tab__skeleton-row" />
            <div className="midi-tab__skeleton-row" />
            <div className="midi-tab__skeleton-row" />
          </div>
        ) : (
          [
            { key: 'originals', title: 'Originals', files: originals },
            { key: 'classics', title: 'Classics', files: classics }
          ].filter((group) => group.files.length > 0).map((group) => (
            <div key={group.key} className="midi-tab__group">
              <div className="midi-tab__group-header">
                <h4 className="midi-tab__group-title">{group.title}</h4>
                <span className="midi-tab__group-count">{group.files.length}</span>
              </div>
              <ul className="midi-tab__list">
                {group.files.map((file) => {
                  const { title } = splitTag(file.name);
                  return (
                    <li key={file.id} className="midi-tab__item">
                      <button
                        type="button"
                        className={`midi-tab__file-btn ${selectedFile?.id === file.id ? 'midi-tab__file-btn--active' : ''}`}
                        onClick={() => handleLoadBuiltIn(file)}
                        disabled={isLoading}
                      >
                        <span className="midi-tab__file-title-row">
                          <span className="midi-tab__file-name">{title}</span>
                        </span>
                        {file.composer && (
                          <span className="midi-tab__file-composer">{file.composer}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {filteredFiles.length === 0 && !isLoading && (
          <div className="midi-tab__empty">
            No matches for “{searchQuery.trim()}”.
          </div>
        )}
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
          {isLoading ? 'Loading...' : 'Choose MIDI file'}
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
