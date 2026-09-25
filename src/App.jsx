import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useOpeningPerformance } from './hooks/useOpeningPerformance.js';
import AppHeader from './components/AppHeader.jsx';
import SynthKeyboard from './components/SynthKeyboard';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import { audioEngine } from './utils/audioEngine.js';
import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_WAVEFORM,
  sanitizeAudioParams,
  upgradeLegacyAudioParams
} from './utils/audioParams.js';
import { useMidiPlayback } from './hooks/useMidiPlayback.js';
import { useWebMidiInput } from './hooks/useWebMidiInput.js';
import { useAudioEngineWarmup } from './hooks/useAudioEngineWarmup.js';
import {
  AMBIENT_VISUAL_DELAY_MS,
  PRIMARY_VISUAL_DELAY_MS,
  useDeferredVisualMount
} from './hooks/useDeferredVisualMount.js';
import {
  MidiTransportContext,
  SoundControlsContext
} from './context/SynthContexts.jsx';
import { loadAppSession, saveAppSession } from './utils/appSession.js';
import { consumePendingMidi } from './utils/pendingMidiHandoff.js';
import { getLandingFiles } from './data/landingQueue.js';
import { createTrailingDeadlineScheduler } from './utils/trailingDeadlineScheduler.js';
import './styles/overlays.css';

const Scene = React.lazy(() => import('./components/Scene'));
const WaveCandy = React.lazy(() => import('./components/WaveCandy'));
const BirdsEyeRadar = React.lazy(() => import('./components/BirdsEyeRadar'));

const NOTICE_TIMEOUT_MS = 2200;
const NOTES_SLIDE_MS = 500; // styles/layout.css .notes-panel__drawer
const SESSION_SAVE_DELAY_MS = 200;
const DEFAULT_CONTROL_SECTIONS = Object.freeze({
  essentials: true,
  delay: false,
  reverb: false,
  color: false,
  modulation: false
});

const isTextInputTarget = (target) => {
  const tagName = target?.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA') return true;
  return !!target?.isContentEditable;
};

const SoundDial = React.lazy(() => import('./components/SoundDial.jsx'));

const CHEVRON_ICON = (
  <svg className="notes-panel__chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const SOUND_OFF_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
    <path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5" />
  </svg>
);

const App = () => {
  useAudioEngineWarmup();
  const showPrimaryVisual = useDeferredVisualMount(PRIMARY_VISUAL_DELAY_MS);
  const showAmbientScene = useDeferredVisualMount(AMBIENT_VISUAL_DELAY_MS);
  const [initialSession] = useState(loadAppSession);
  const [engineStatus, setEngineStatus] = useState(() => audioEngine.getStatus());
  const [waveformType, setWaveformType] = useState(() => initialSession.waveformType || DEFAULT_WAVEFORM);
  const [audioParams, setAudioParams] = useState(() => (
    sanitizeAudioParams(initialSession.audioParams || AUDIO_PARAM_DEFAULTS)
  ));
  const [showShortcuts, setShowShortcuts] = useState(() => initialSession.showShortcuts || false);
  // The notes of what is playing, in a tall panel that slides the keyboard down.
  const [showNotes, setShowNotes] = useState(() => initialSession.showNotes || false);
  // The notes canvas stays mounted until the panel has finished closing.
  const [notesMounted, setNotesMounted] = useState(showNotes);
  const [isRecording, setIsRecording] = useState(false);
  // Arrival is just the keyboard playing the opening; the sidebar opens on request.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState(() => initialSession.sidebarTab || 'sound');
  const [activeSampleId, setActiveSampleId] = useState(() => initialSession.activeSampleId || null);
  const [sampleSelection, setSampleSelection] = useState(() => initialSession.sampleSelection || null);
  const [notice, setNotice] = useState('');
  const [activePresetName, setActivePresetName] = useState(() => initialSession.activePresetName || null);
  // A sampled instrument under the keys (data/sampledInstruments.js), or null for the synth.
  const [instrument, setInstrument] = useState(() => initialSession.instrument || null);
  const [controlSections, setControlSections] = useState(() => (
    initialSession.controlSections || DEFAULT_CONTROL_SECTIONS
  ));
  const scrollRaf = useRef(null);
  const noticeTimeoutRef = useRef(null);
  const sessionSnapshotRef = useRef(null);
  const sessionSaveSchedulerRef = useRef(null);
  if (sessionSaveSchedulerRef.current === null) {
    sessionSaveSchedulerRef.current = createTrailingDeadlineScheduler({
      delayMs: SESSION_SAVE_DELAY_MS,
      run: () => {
        if (sessionSnapshotRef.current) saveAppSession(sessionSnapshotRef.current);
      }
    });
  }
  const wasmLoaded = engineStatus.wasmReady;
  const isGraphWarm = engineStatus.graphWarmed;

  // MIDI playback hook
  const midiPlayback = useMidiPlayback({ waveformType, audioParams });
  const opening = useOpeningPerformance({ audioParams });
  const playMidi = useCallback((...args) => {
    opening.stop();
    midiPlayback.play(...args);
    // A piece started from the library opens its notes, as it always has.
    setShowNotes(true);
  }, [opening.stop, midiPlayback.play]);
  const transportBpm = (midiPlayback.currentMidi?.bpm || 120) * midiPlayback.tempoFactor;

  // A MIDI file picked on another page (Design, a study) lands here to play.
  useEffect(() => {
    const pending = consumePendingMidi();
    if (!pending) return;
    playMidi(pending);
    setSidebarTab('midi');
    setSidebarOpen(true);
  }, [playMidi]);

  // Hardware MIDI input (notes + pitch bend + mod wheel)
  const webMidi = useWebMidiInput({ waveformType, audioParams, onUserPlay: opening.stop });
  const notesSource = midiPlayback.currentMidi ? midiPlayback : opening;
  const toggleNotes = useCallback(() => setShowNotes((shown) => !shown), []);
  useEffect(() => {
    if (showNotes) {
      setNotesMounted(true);
      return undefined;
    }
    // Once the panel has slid shut (styles/layout.css, .notes-panel__drawer) the canvas goes.
    const timer = window.setTimeout(() => setNotesMounted(false), NOTES_SLIDE_MS + 50);
    return () => window.clearTimeout(timer);
  }, [showNotes]);

  // A performance that brings a still picture of its waveform shows it in the
  // open sound dial while its instrument is the sound under the keys.
  const shownPiece = useMemo(() => {
    const id = midiPlayback.currentMidi?.sourceFileId;
    return id ? getLandingFiles().find((file) => file.id === id) || null : opening.piece;
  }, [midiPlayback.currentMidi, opening.piece]);
  const noteCount = notesSource.currentMidi?.notes?.length ?? 0;
  const dialArtifact = useMemo(() => (
    shownPiece?.waveform && instrument === shownPiece.instrument
      ? {
        src: shownPiece.waveform,
        title: shownPiece.name,
        caption: [
          shownPiece.composer,
          noteCount
            ? `${noteCount.toLocaleString('en-US')} notes${shownPiece.transcription ? ' transcribed from the record' : ''}`
            : null
        ].filter(Boolean).join(' · ')
      }
      : null
  ), [instrument, noteCount, shownPiece]);

  const externalActiveNotes = useMemo(() => {
    const merged = new Set(midiPlayback.activeNotes);
    opening.activeNotes.forEach((noteId) => merged.add(noteId));
    webMidi.activeNotes.forEach((noteId) => merged.add(noteId));
    return merged;
  }, [midiPlayback.activeNotes, webMidi.activeNotes, opening.activeNotes]);

  const pushNotice = useCallback((message) => {
    setNotice(message);
    if (noticeTimeoutRef.current) {
      clearTimeout(noticeTimeoutRef.current);
    }
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice('');
      noticeTimeoutRef.current = null;
    }, NOTICE_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    audioEngine.setSanitizedGlobalParams(audioParams);
  }, [audioParams]);

  useEffect(() => {
    audioEngine.setTransportTempo?.(transportBpm);
  }, [transportBpm]);

  useEffect(() => {
    if (webMidi.deviceName) {
      pushNotice(`MIDI in: ${webMidi.deviceName}`);
    }
  }, [webMidi.deviceName, pushNotice]);

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe(setEngineStatus);
    const unsubRecording = audioEngine.subscribeRecording(setIsRecording);

    return () => {
      unsubscribe();
      unsubRecording();
    };
  }, []);

  useEffect(() => {
    if (Math.abs(initialSession.tempoFactor - 1) < 0.001) return;
    midiPlayback.setTempo(initialSession.tempoFactor);
  }, [initialSession.tempoFactor, midiPlayback.setTempo]);

  const handleAudioFileImport = useCallback(async (file, selection = null) => {
    if (!file) return;

    try {
      await audioEngine.loadCustomSample(file);
      setActiveSampleId(selection?.id || null);
      setSampleSelection(selection);
      pushNotice('Sample is ready.');
    } catch (err) {
      console.error('Failed to load sample:', err);
      pushNotice('Sample load failed.');
    }
  }, [pushNotice]);

  const handleRecordToggle = useCallback(() => {
    audioEngine.toggleRecording();
    pushNotice(isRecording ? 'Recording stopped.' : 'Recording started.');
  }, [isRecording, pushNotice]);

  const copySettingsToClipboard = useCallback(async () => {
    const payload = {
      waveformType,
      audioParams,
      tempoFactor: midiPlayback.tempoFactor
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      pushNotice('Settings copied.');
    } catch {
      pushNotice('Clipboard blocked.');
    }
  }, [audioParams, midiPlayback.tempoFactor, pushNotice, waveformType]);

  const pasteSettingsFromClipboard = useCallback(async () => {
    try {
      const raw = await navigator.clipboard.readText();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        pushNotice('Clipboard is not JSON.');
        return;
      }

      if (typeof parsed.waveformType === 'string') {
        setWaveformType(parsed.waveformType);
      }
      setAudioParams(sanitizeAudioParams(
        upgradeLegacyAudioParams(parsed.audioParams || undefined)
      ));
      if (typeof parsed.tempoFactor === 'number') {
        midiPlayback.setTempo(parsed.tempoFactor);
      }
      pushNotice('Settings pasted.');
    } catch {
      pushNotice('Paste failed.');
    }
  }, [midiPlayback.setTempo, pushNotice]);

  useEffect(() => {
    const handleKeyboardShortcuts = (event) => {
      const key = event.key.toLowerCase();
      const textInputActive = isTextInputTarget(event.target);

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'c') {
        event.preventDefault();
        copySettingsToClipboard();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && key === 'v') {
        event.preventDefault();
        pasteSettingsFromClipboard();
        return;
      }

      if (textInputActive) {
        if (event.key === 'Escape') {
          setShowShortcuts(false);
        }
        return;
      }

      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setShowShortcuts((prev) => !prev);
      }

      if (event.key === 'Escape') {
        setShowShortcuts(false);
      }

      // Space bar toggles recording — but never on key auto-repeat (a held
      // Space would otherwise machine-gun start/stop, downloading a WAV per
      // toggle), and never when Space belongs to the focused control.
      const targetTag = event.target?.tagName;
      if (
        event.key === ' '
        && !event.repeat
        && targetTag !== 'BUTTON'
        && targetTag !== 'SELECT'
        && targetTag !== 'A'
        && event.target?.getAttribute?.('role') !== 'slider'
      ) {
        event.preventDefault();
        handleRecordToggle();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [copySettingsToClipboard, handleRecordToggle, pasteSettingsFromClipboard]);

  useEffect(() => {
    const onPaste = async (event) => {
      const files = Array.from(event.clipboardData?.files || []);
      if (files.length === 0) return;

      const midiFile = files.find((file) => /\.(mid|midi)$/i.test(file.name));
      if (midiFile) {
        event.preventDefault();
        try {
          const { parseMidiFile } = await import('./utils/midiParser.js');
          const midiData = await parseMidiFile(midiFile);
          playMidi(midiData);
          setSidebarTab('midi');
          setSidebarOpen(true);
          pushNotice('MIDI pasted.');
        } catch (error) {
          console.error('Failed to paste MIDI:', error);
          pushNotice('MIDI paste failed.');
        }
        return;
      }

      const audioFile = files.find((file) => (
        file.type.startsWith('audio/') || /\.(wav|mp3|ogg|flac|aiff|m4a)$/i.test(file.name)
      ));

      if (audioFile) {
        event.preventDefault();
        await handleAudioFileImport(audioFile, null);
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleAudioFileImport, playMidi, pushNotice]);

  useEffect(() => {
    const root = document.documentElement;

    const updateScrollProgress = () => {
      scrollRaf.current = null;
      const max = root.scrollHeight - root.clientHeight;
      const ratio = max > 0 ? window.scrollY / max : 0;
      root.style.setProperty('--scroll-progress', ratio.toFixed(4));
    };

    const handleScroll = () => {
      if (scrollRaf.current !== null) return;
      scrollRaf.current = requestAnimationFrame(updateScrollProgress);
    };

    updateScrollProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (scrollRaf.current !== null) {
        cancelAnimationFrame(scrollRaf.current);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const snapshot = {
      waveformType,
      audioParams,
      activePresetName,
      instrument,
      controlSections,
      sidebarTab,
      activeSampleId,
      sampleSelection,
      showShortcuts,
      showNotes,
      tempoFactor: midiPlayback.tempoFactor
    };
    sessionSnapshotRef.current = snapshot;
    sessionSaveSchedulerRef.current.schedule();
  }, [
    activePresetName,
    activeSampleId,
    audioParams,
    instrument,
    controlSections,
    midiPlayback.tempoFactor,
    sampleSelection,
    showNotes,
    showShortcuts,
    sidebarTab,
    waveformType
  ]);

  useEffect(() => {
    const flushSession = () => {
      sessionSaveSchedulerRef.current.cancel();
      if (sessionSnapshotRef.current) {
        saveAppSession(sessionSnapshotRef.current);
      }
    };

    window.addEventListener('pagehide', flushSession);
    return () => {
      window.removeEventListener('pagehide', flushSession);
      flushSession();
    };
  }, []);

  const handleAudioParamChange = useCallback((paramName, value) => {
    setAudioParams((prev) => sanitizeAudioParams({
      ...prev,
      [paramName]: value
    }));
  }, []);

  const handleAudioParamsChange = useCallback((nextParams) => {
    setAudioParams((prev) => sanitizeAudioParams({
      ...prev,
      ...nextParams
    }));
  }, []);

  const handleSoundOn = useCallback(() => {
    audioEngine.context?.resume().catch(() => {});
  }, []);
  const handleSidebarOpen = useCallback(() => setSidebarOpen(true), []);
  const handleSidebarClose = useCallback(() => setSidebarOpen(false), []);

  const applySound = useCallback((sound) => {
    if (sound.waveformType) setWaveformType(sound.waveformType);
    if (sound.audioParams) handleAudioParamsChange(sound.audioParams);
    setInstrument(sound.instrument || null);
    setActivePresetName(sound.name);
  }, [handleAudioParamsChange]);

  // From the sound dial. Browsing there loads sounds one after another, so
  // no notice; and picking a sound is taking the instrument over.
  const handleSoundChosen = useCallback((sound) => {
    opening.stop();
    applySound(sound);
  }, [applySound, opening.stop]);

  // The landing piece brings its own sound; load it under the keys as well, so
  // the dial shows what is playing and playing along continues in that voice.
  useEffect(() => {
    if (opening.sound) applySound(opening.sound);
  }, [applySound, opening.sound]);

  // Hand the instrument's recordings to the engine once they are decoded; the
  // previous sound keeps playing until then. The engine is never woken for
  // this: decoding waits for the audio context the warm-up (or a first touch)
  // brings.
  const contextReady = engineStatus.contextReady;
  useEffect(() => {
    if (!instrument) {
      audioEngine.setInstrument(null);
      return undefined;
    }
    if (!contextReady) return undefined;
    let current = true;
    (async () => {
      try {
        const { loadSampledInstrument } = await import('./data/sampledInstruments.js');
        const loaded = await loadSampledInstrument(audioEngine.context, instrument);
        if (current) await audioEngine.setInstrument(loaded);
      } catch (error) {
        if (!current) return;
        console.error(`Failed to load the ${instrument} recordings:`, error);
        pushNotice('That instrument could not be loaded.');
        setInstrument(null);
        setActivePresetName(null);
      }
    })();
    return () => {
      current = false;
    };
  }, [contextReady, instrument, pushNotice]);

  // The editor and the other pages share the engine; the instrument stays here.
  useEffect(() => () => {
    audioEngine.setInstrument(null);
  }, []);

  // Choosing a waveform is choosing the synth again.
  const handleWaveformChange = useCallback((nextWaveform) => {
    setWaveformType(nextWaveform);
    if (!instrument) return;
    setInstrument(null);
    setActivePresetName(null);
  }, [instrument]);

  const handleControlSectionToggle = useCallback((section) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONTROL_SECTIONS, section)) return;
    setControlSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const soundControlsValue = useMemo(() => ({
    waveformType,
    onWaveformChange: handleWaveformChange,
    instrument,
    audioParams,
    onParamChange: handleAudioParamChange,
    onParamsChange: handleAudioParamsChange,
    transportBpm,
    controlSections,
    onControlSectionToggle: handleControlSectionToggle
  }), [
    waveformType,
    instrument,
    audioParams,
    transportBpm,
    controlSections,
    handleAudioParamChange,
    handleAudioParamsChange,
    handleControlSectionToggle,
    handleWaveformChange
  ]);

  const midiTransportValue = useMemo(() => ({
    isPlaying: midiPlayback.isPlaying,
    isPaused: midiPlayback.isPaused,
    progress: midiPlayback.progress,
    currentMidi: midiPlayback.currentMidi,
    tempoFactor: midiPlayback.tempoFactor,
    onPlay: playMidi,
    onPause: midiPlayback.pause,
    onResume: midiPlayback.resume,
    onStop: midiPlayback.stop,
    onTempoChange: midiPlayback.setTempo
  }), [
    midiPlayback.isPlaying,
    midiPlayback.isPaused,
    midiPlayback.progress,
    midiPlayback.currentMidi,
    midiPlayback.tempoFactor,
    playMidi,
    midiPlayback.pause,
    midiPlayback.resume,
    midiPlayback.stop,
    midiPlayback.setTempo
  ]);

  return (
    <ErrorBoundary>
      <div className="app-stage">
        {showAmbientScene && (
          <React.Suspense fallback={null}>
            <Scene />
          </React.Suspense>
        )}
        
        <div className="app-shell">
          <AppHeader onToggleRecording={handleRecordToggle} isRecording={isRecording} />

          <main className="zone-center content-primary" aria-label="Keyboard area">
            {showPrimaryVisual ? (
              <React.Suspense fallback={<div className="wave-candy wave-candy-placeholder" aria-hidden="true" />}>
                <WaveCandy />
              </React.Suspense>
            ) : (
              <div className="wave-candy wave-candy-placeholder" aria-hidden="true" />
            )}
            <div className="keyboard-surface" role="region" aria-label="Virtual keyboard">
              <div className="keyboard-region">
                <div className="notes-panel">
                  <button
                    type="button"
                    className="btn notes-panel__toggle"
                    aria-expanded={showNotes}
                    aria-controls="notes-panel-drawer"
                    onClick={toggleNotes}
                  >
                    Notes
                    {CHEVRON_ICON}
                  </button>
                  <div
                    id="notes-panel-drawer"
                    className={`notes-panel__drawer ${showNotes ? 'notes-panel__drawer--open' : ''}`}
                  >
                    <div className="notes-panel__content">
                      {notesMounted && (
                        <React.Suspense fallback={null}>
                          <BirdsEyeRadar
                            currentMidi={notesSource.currentMidi}
                            progress={notesSource.progress}
                            activeNotes={notesSource.activeNotes}
                            isPlaying={notesSource.isPlaying}
                          />
                        </React.Suspense>
                      )}
                    </div>
                  </div>
                </div>
                <SynthKeyboard
                  onUserPlay={opening.stop}
                  waveformType={waveformType}
                  audioParams={audioParams}
                  wasmLoaded={wasmLoaded}
                  externalActiveNotes={externalActiveNotes}
                />
                {engineStatus.audioBlocked ? (
                  // The browser is holding audio until a gesture. This one is not a
                  // note, so it starts the opening instead of taking it over.
                  <button type="button" className="btn btn--accent sound-prompt" onClick={handleSoundOn}>
                    {SOUND_OFF_ICON}
                    Turn sound on
                  </button>
                ) : !isGraphWarm && (
                  <div className="warmup-indicator" aria-live="polite">
                    <span className="warmup-indicator__marker" aria-hidden="true" />
                    <span>Audio engine warms now.</span>
                  </div>
                )}
              </div>
            </div>
          </main>

          <React.Suspense fallback={null}>
            <SoundDial
              activeSoundName={activePresetName || waveformType}
              onChoose={handleSoundChosen}
              artifact={dialArtifact}
            />
          </React.Suspense>

        {showShortcuts && (
          <div className="shortcuts-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
            <div className="shortcuts-card tier-support">
              <div className="shortcuts-header">
                <span>Keyboard Shortcuts</span>
                <button
                  type="button"
                  className="button-icon"
                  aria-label="Close shortcuts"
                  onClick={() => setShowShortcuts(false)}
                >
                  <span aria-hidden="true">x</span>
                </button>
              </div>
              <dl className="shortcuts-grid">
                <div>
                  <dt>A - ;</dt>
                  <dd>Play white keys in octave.</dd>
                </div>
                <div>
                  <dt>W - P</dt>
                  <dd>Play black keys in octave.</dd>
                </div>
                <div>
                  <dt>Z / X</dt>
                  <dd>Move octave down or up.</dd>
                </div>
                <div>
                  <dt>C / V</dt>
                  <dd>Change key velocity.</dd>
                </div>
                <div>
                  <dt>Shift + / (?)</dt>
                  <dd>Toggle shortcut list.</dd>
                </div>
                <div>
                  <dt>Escape</dt>
                  <dd>Close active panels.</dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {notice && (
          <div className="app-notice" role="status" aria-live="polite">
            {notice}
          </div>
        )}

        </div>

        <SoundControlsContext.Provider value={soundControlsValue}>
          <MidiTransportContext.Provider value={midiTransportValue}>
            <Sidebar
              isOpen={sidebarOpen}
              onOpen={handleSidebarOpen}
              onClose={handleSidebarClose}
              activeTab={sidebarTab}
              onTabChange={setSidebarTab}
              isMidiPlaying={midiPlayback.isPlaying}
              midiName={midiPlayback.currentMidi?.name || ''}
              soundLabel={activePresetName || waveformType}
            />
          </MidiTransportContext.Provider>
        </SoundControlsContext.Provider>

      </div>
    </ErrorBoundary>
  );
};

export default App;
