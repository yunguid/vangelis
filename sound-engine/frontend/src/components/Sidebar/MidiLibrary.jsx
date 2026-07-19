import React, { useCallback, useMemo, useRef, useState } from 'react';
import { getBuiltInMidiFiles, parseMidiFile } from '../../utils/midiParser.js';

const numericPatchName = (id) => {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return String(100000 + ((hash >>> 0) % 900000));
};

const MidiLibrary = ({ active = true, onPlay }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const builtInFiles = useMemo(() => getBuiltInMidiFiles().map((file) => ({
    ...file,
    displayName: numericPatchName(file.id)
  })), []);
  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return builtInFiles;
    return builtInFiles.filter((file) => (
      `${file.displayName} ${file.name} ${file.composer || ''}`.toLowerCase().includes(query)
    ));
  }, [builtInFiles, searchQuery]);
  const groups = useMemo(() => [
    {
      key: 'originals',
      title: 'Originals',
      files: filteredFiles.filter((file) => file.id.startsWith('original-'))
    },
    {
      key: 'classics',
      title: 'Classics',
      files: filteredFiles.filter((file) => !file.id.startsWith('original-'))
    }
  ].filter((group) => group.files.length > 0), [filteredFiles]);

  const loadMidiWithFallback = useCallback(async (file) => {
    try {
      return await parseMidiFile(file.path);
    } catch (loadError) {
      if (!file.sourceUrl || file.sourceUrl === file.path) throw loadError;
      return parseMidiFile(file.sourceUrl);
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
        name: file.displayName,
        sourceFileId: file.id,
        sourcePath: file.path,
        sourceUrl: file.sourceUrl || null,
        composer: file.composer
      });
    } catch (loadError) {
      console.error('Failed to load MIDI file:', loadError);
      setError(file.sourceUrl
        ? 'MIDI load failed. Run sync scripts.'
        : 'MIDI load failed. Try again.');
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
      onPlay(await parseMidiFile(file));
    } catch (loadError) {
      console.error('Failed to parse MIDI file:', loadError);
      setError('MIDI parse failed. Use .mid only.');
    } finally {
      setIsLoading(false);
    }
  }, [onPlay]);

  if (!active) return null;

  return (
    <>
      <div className="midi-tab__section">
        <input
          type="search"
          className="midi-tab__search"
          placeholder="Find title or composer"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          aria-label="Filter MIDI files"
        />
        {isLoading ? (
          <div className="midi-tab__skeleton" aria-hidden="true">
            <div className="midi-tab__skeleton-row" />
            <div className="midi-tab__skeleton-row" />
            <div className="midi-tab__skeleton-row" />
          </div>
        ) : groups.map((group) => (
          <div key={group.key} className="midi-tab__group">
            {group.key !== 'originals' && (
              <div className="midi-tab__group-header">
                <h4 className="midi-tab__group-title">{group.title}</h4>
                <span className="midi-tab__group-count">{group.files.length}</span>
              </div>
            )}
            <ul className="midi-tab__list">
              {group.files.map((file) => (
                <li key={file.id} className="midi-tab__item">
                  <button
                    type="button"
                    className={`midi-tab__file-btn ${selectedFile?.id === file.id ? 'midi-tab__file-btn--active' : ''}`}
                    onClick={() => handleLoadBuiltIn(file)}
                    disabled={isLoading}
                  >
                    <span className="midi-tab__file-title-row">
                      <span className="midi-tab__file-name">{file.displayName}</span>
                    </span>
                    {file.composer && (
                      <span className="midi-tab__file-composer">{file.composer}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
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

      {error && <div className="midi-tab__error">{error}</div>}
    </>
  );
};

export default React.memo(MidiLibrary);
