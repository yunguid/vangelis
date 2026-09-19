import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getBuiltInMidiFiles,
  parseMidiFile,
  preloadMidiFile,
  preloadMidiParser
} from '../../utils/midiParser.js';
import { audioEngine } from '../../utils/audioEngine.js';
import {
  arrangeBuiltInPiece,
  isLandingEligible,
  loadLandingSelection,
  saveLandingSelection
} from '../../data/landingQueue.js';
import { loadMidiLibraryPrefs, saveMidiLibraryPrefs } from '../../utils/midiLibraryPrefs.js';

const HEART_ICON = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </svg>
);

const MidiLibrary = ({ active = true, onPlay }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  // Originals keep their machine code-names; curated catalog entries (real
  // classical works with provenance) display their true titles and sort
  // featured-first so the flagship study is always the first classical row.
  const builtInFiles = useMemo(() => getBuiltInMidiFiles().map((file) => ({
    ...file,
    displayName: file.displayTitle || file.name
  })), []);
  // Which pieces may play by themselves when the page opens.
  const [landingSelection, setLandingSelection] = useState(() => loadLandingSelection(builtInFiles));
  const handleLandingToggle = useCallback((fileId) => {
    setLandingSelection((current) => {
      const next = new Set(current);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      saveLandingSelection(next);
      return next;
    });
  }, []);

  // Liked pieces lead the list; removed ones leave it until they are restored.
  const [prefs, setPrefs] = useState(loadMidiLibraryPrefs);
  const updatePrefs = useCallback((change) => {
    setPrefs((current) => {
      const next = change(current);
      saveMidiLibraryPrefs(next);
      return next;
    });
  }, []);
  const handleLikeToggle = useCallback((fileId) => updatePrefs(({ liked, removed }) => {
    const next = new Set(liked);
    if (!next.delete(fileId)) next.add(fileId);
    return { liked: next, removed };
  }), [updatePrefs]);
  const handleRemove = useCallback((fileId) => updatePrefs(({ liked, removed }) => (
    { liked, removed: new Set(removed).add(fileId) }
  )), [updatePrefs]);
  const handleRestore = useCallback(() => updatePrefs(({ liked }) => (
    { liked, removed: new Set() }
  )), [updatePrefs]);

  const removedCount = useMemo(() => (
    builtInFiles.filter((file) => prefs.removed.has(file.id)).length
  ), [builtInFiles, prefs.removed]);
  const filteredFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const kept = builtInFiles.filter((file) => !prefs.removed.has(file.id));
    if (!query) return kept;
    return kept.filter((file) => (
      `${file.displayName} ${file.name} ${file.composer || ''}`.toLowerCase().includes(query)
    ));
  }, [builtInFiles, prefs.removed, searchQuery]);
  const groups = useMemo(() => {
    const rest = filteredFiles.filter((file) => !prefs.liked.has(file.id));
    return [
      {
        key: 'favorites',
        title: 'Favorites',
        files: filteredFiles.filter((file) => prefs.liked.has(file.id))
      },
      {
        key: 'performances',
        title: 'Performances',
        files: rest.filter((file) => file.instrument)
      },
      {
        key: 'originals',
        title: 'Originals',
        // Pieces with a landing switch lead the group, so the whole queue can be
        // seen without scrolling through every original.
        files: rest
          .filter((file) => file.id.startsWith('original-'))
          .sort((left, right) => Number(isLandingEligible(right)) - Number(isLandingEligible(left)))
      },
      {
        key: 'classics',
        title: 'Classics',
        files: rest
          .filter((file) => !file.id.startsWith('original-') && !file.instrument)
          .sort((left, right) => (
            (left.featuredRank ?? Infinity) - (right.featuredRank ?? Infinity)
          ))
      }
    ].filter((group) => group.files.length > 0);
  }, [filteredFiles, prefs.liked]);

  useEffect(() => {
    if (!active) return undefined;
    const warmParser = () => {
      preloadMidiParser().catch(() => {});
    };
    if (typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(warmParser, { timeout: 1500 });
      return () => window.cancelIdleCallback?.(idleId);
    }
    const timeoutId = window.setTimeout(warmParser, 150);
    return () => window.clearTimeout(timeoutId);
  }, [active]);

  const handleFileIntent = useCallback((event) => {
    preloadMidiParser().catch(() => {});
    preloadMidiFile(event.currentTarget.dataset.midiPath);
  }, []);

  const loadMidiWithFallback = useCallback(async (file) => {
    try {
      return await parseMidiFile(file.path);
    } catch (loadError) {
      if (!file.sourceUrl || file.sourceUrl === file.path) throw loadError;
      return parseMidiFile(file.sourceUrl);
    }
  }, []);

  const handleLoadBuiltIn = useCallback(async (file) => {
    const performanceProbe = typeof window !== 'undefined'
      ? window.__vangelisPerf
      : null;
    const loadStart = performanceProbe && typeof performance !== 'undefined'
      ? performance.now()
      : null;
    setIsLoading(true);
    setError(null);
    setSelectedFile(file);

    try {
      // A performance brings its own sampled instrument and puts it on the
      // sound dial, where the listener can turn to another; everything else
      // plays through whatever sound is loaded.
      const arranged = file.instrument
        ? await arrangeBuiltInPiece(await audioEngine.ensureAudioContext(), file)
        : { score: await loadMidiWithFallback(file) };
      const midiData = {
        ...arranged.score,
        name: file.displayName,
        sourceFileId: file.id,
        sourcePath: file.path,
        sourceUrl: file.sourceUrl || null,
        composer: file.composer
      };
      if (arranged.sound) onPlay(midiData, { sound: arranged.sound });
      else onPlay(midiData);
      if (loadStart !== null) {
        performanceProbe?.recordInteraction?.(
          'midi.file.parse-and-dispatch',
          performance.now() - loadStart,
          { fileId: file.id }
        );
      }
    } catch (loadError) {
      console.error('Failed to load MIDI file:', loadError);
      setError(file.sourceUrl
        ? 'MIDI load failed. Run sync scripts.'
        : 'MIDI load failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadMidiWithFallback, onPlay]);

  const handleSearchChange = useCallback((event) => {
    const nextQuery = event.target.value;
    const performanceProbe = typeof window !== 'undefined'
      ? window.__vangelisPerf
      : null;
    const handlerStart = performanceProbe && typeof performance !== 'undefined'
      ? performance.now()
      : null;
    performanceProbe?.markInteractionPaint?.('midi.search.paint', {
      queryLength: nextQuery.length
    });
    try {
      setSearchQuery(nextQuery);
    } finally {
      if (handlerStart !== null) {
        performanceProbe?.recordInteraction?.(
          'midi.search.handler',
          performance.now() - handlerStart,
          { queryLength: nextQuery.length }
        );
      }
    }
  }, []);

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
          onChange={handleSearchChange}
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
                  {/* Like and remove lie over the row's own end, so rows keep their full width. */}
                  <div className="midi-tab__piece">
                    <button
                      type="button"
                      className={`midi-tab__file-btn ${selectedFile?.id === file.id ? 'midi-tab__file-btn--active' : ''}`}
                      onClick={() => handleLoadBuiltIn(file)}
                      onPointerEnter={handleFileIntent}
                      onFocus={handleFileIntent}
                      data-midi-path={file.path}
                      disabled={isLoading}
                    >
                      <span className="midi-tab__file-title-row">
                        <span className="midi-tab__file-name">{file.displayName}</span>
                      </span>
                      {(file.composer || file.instrumentLabel) && (
                        <span className="midi-tab__file-composer">
                          {file.catalogLabel
                            ? `${file.composer} · ${file.catalogLabel}`
                            : file.composer || file.instrumentLabel}
                        </span>
                      )}
                    </button>
                    <div className="midi-tab__row-actions">
                      <button
                        type="button"
                        className="midi-tab__row-action"
                        aria-pressed={prefs.liked.has(file.id)}
                        aria-label={`Like ${file.displayName}`}
                        title="Liked pieces lead the list, under Favorites"
                        onClick={() => handleLikeToggle(file.id)}
                      >
                        {HEART_ICON}
                      </button>
                      <button
                        type="button"
                        className="midi-tab__row-action"
                        aria-label={`Remove ${file.displayName} from the library`}
                        title="Remove from the library"
                        onClick={() => handleRemove(file.id)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  </div>
                  {isLandingEligible(file) && (
                    <button
                      type="button"
                      className="midi-tab__landing"
                      aria-pressed={landingSelection.has(file.id)}
                      aria-label={`Play ${file.displayName} when the page opens`}
                      title="One of the pieces switched on here plays, at random, each time the page opens"
                      onClick={() => handleLandingToggle(file.id)}
                    >
                      On load
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {filteredFiles.length === 0 && searchQuery.trim() && !isLoading && (
          <div className="midi-tab__empty">
            No matches for “{searchQuery.trim()}”.
          </div>
        )}
        {removedCount > 0 && !isLoading && (
          <p className="midi-tab__removed">
            {removedCount} removed
            <button type="button" className="midi-tab__restore" onClick={handleRestore}>
              Restore
            </button>
          </p>
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
