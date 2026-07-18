import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  AMBIENT_VISUAL_IDLE_TIMEOUT_MS,
  PRIMARY_VISUAL_IDLE_TIMEOUT_MS,
  useDeferredVisualMount
} from './hooks/useDeferredVisualMount.js';
import {
  MidiTransportContext,
  SoundControlsContext
} from './context/SynthContexts.jsx';
import { loadAppSession, saveAppSession } from './utils/appSession.js';

const Scene = React.lazy(() => import('./components/Scene'));
const WaveCandy = React.lazy(() => import('./components/WaveCandy'));
const BirdsEyeRadar = React.lazy(() => import('./components/BirdsEyeRadar'));

const NOTICE_TIMEOUT_MS = 2200;
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

const App = () => {
  useAudioEngineWarmup();
  const showPrimaryVisual = useDeferredVisualMount(PRIMARY_VISUAL_IDLE_TIMEOUT_MS);
  const showAmbientScene = useDeferredVisualMount(AMBIENT_VISUAL_IDLE_TIMEOUT_MS);
  const initialSessionRef = useRef(loadAppSession());
  const initialSession = initialSessionRef.current;
  const [engineStatus, setEngineStatus] = useState(() => audioEngine.getStatus());
  const [waveformType, setWaveformType] = useState(() => initialSession.waveformType || DEFAULT_WAVEFORM);
  const [audioParams, setAudioParams] = useState(() => (
    sanitizeAudioParams(initialSession.audioParams || AUDIO_PARAM_DEFAULTS)
  ));
  const [showShortcuts, setShowShortcuts] = useState(() => initialSession.showShortcuts || false);
  const [isRecording, setIsRecording] = useState(false);
  const [sampleInfo, setSampleInfo] = useState(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  // On phones the sidebar is a full-screen sheet; never restore it open there,
  // or the app boots with the synth hidden behind a modal.
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 900px)').matches) return false;
    return initialSession.sidebarOpen || false;
  });
  const [sidebarTab, setSidebarTab] = useState(() => initialSession.sidebarTab || 'sound');
  const [activeSampleId, setActiveSampleId] = useState(() => initialSession.activeSampleId || null);
  const [sampleSelection, setSampleSelection] = useState(() => initialSession.sampleSelection || null);
  const voiceText = initialSession.voiceText;
  const [notice, setNotice] = useState('');
  const [activePresetName, setActivePresetName] = useState(null);
  const [controlSections, setControlSections] = useState(() => (
    initialSession.controlSections || DEFAULT_CONTROL_SECTIONS
  ));
  const scrollRaf = useRef(null);
  const noticeTimeoutRef = useRef(null);
  const sessionSaveTimeoutRef = useRef(null);
  const sessionSnapshotRef = useRef(null);
  const wasmLoaded = engineStatus.wasmReady;
  const isGraphWarm = engineStatus.graphWarmed;

  // MIDI playback hook
  const midiPlayback = useMidiPlayback({ waveformType, audioParams });
  const transportBpm = (midiPlayback.currentMidi?.bpm || 120) * midiPlayback.tempoFactor;

  // Hardware MIDI input (notes + pitch bend + mod wheel)
  const webMidi = useWebMidiInput({ waveformType, audioParams });
  const externalActiveNotes = useMemo(() => {
    if (webMidi.activeNotes.size === 0) return midiPlayback.activeNotes;
    const merged = new Set(midiPlayback.activeNotes);
    webMidi.activeNotes.forEach((noteId) => merged.add(noteId));
    return merged;
  }, [midiPlayback.activeNotes, webMidi.activeNotes]);

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
    audioEngine.setGlobalParams(audioParams);
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

    setSampleLoading(true);
    try {
      const info = await audioEngine.loadCustomSample(file);
      setSampleInfo({
        name: file.name,
        duration: info.duration.toFixed(2),
        channels: info.channels
      });
      setActiveSampleId(selection?.id || null);
      setSampleSelection(selection);
      pushNotice('Sample is ready.');
    } catch (err) {
      console.error('Failed to load sample:', err);
      pushNotice('Sample load failed.');
    } finally {
      setSampleLoading(false);
    }
  }, [pushNotice]);

  const handleClearSample = useCallback(() => {
    audioEngine.clearCustomSample();
    setSampleInfo(null);
    setActiveSampleId(null);
    setSampleSelection(null);
    pushNotice('Sample cleared.');
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

      // Space bar toggles recording (only if not focused on input)
      if (event.key === ' ' && event.target.tagName !== 'BUTTON') {
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
          midiPlayback.play(midiData);
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
  }, [handleAudioFileImport, midiPlayback.play, pushNotice]);

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
      controlSections,
      sidebarTab,
      sidebarOpen,
      activeSampleId,
      sampleSelection,
      voiceText,
      showShortcuts,
      tempoFactor: midiPlayback.tempoFactor
    };
    sessionSnapshotRef.current = snapshot;

    const timeoutId = window.setTimeout(() => {
      saveAppSession(snapshot);
      if (sessionSaveTimeoutRef.current === timeoutId) {
        sessionSaveTimeoutRef.current = null;
      }
    }, SESSION_SAVE_DELAY_MS);
    sessionSaveTimeoutRef.current = timeoutId;

    return () => {
      window.clearTimeout(timeoutId);
      if (sessionSaveTimeoutRef.current === timeoutId) {
        sessionSaveTimeoutRef.current = null;
      }
    };
  }, [
    activeSampleId,
    audioParams,
    controlSections,
    midiPlayback.tempoFactor,
    sampleSelection,
    voiceText,
    showShortcuts,
    sidebarOpen,
    sidebarTab,
    waveformType
  ]);

  useEffect(() => {
    const flushSession = () => {
      if (sessionSaveTimeoutRef.current !== null) {
        window.clearTimeout(sessionSaveTimeoutRef.current);
        sessionSaveTimeoutRef.current = null;
      }
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

  const handleResetSound = useCallback(() => {
    setAudioParams(sanitizeAudioParams(AUDIO_PARAM_DEFAULTS));
    setActivePresetName(null);
    pushNotice('Sound reset to dry defaults.');
  }, [pushNotice]);

  const handleShowShortcuts = useCallback(() => {
    setShowShortcuts(true);
  }, []);

  const handleSidebarOpen = useCallback(() => setSidebarOpen(true), []);
  const handleSidebarClose = useCallback(() => setSidebarOpen(false), []);

  const handlePresetApplied = useCallback((presetName) => {
    setActivePresetName(presetName || null);
    if (presetName) pushNotice(`Patch loaded: ${presetName}`);
  }, [pushNotice]);

  const handleControlSectionToggle = useCallback((section) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONTROL_SECTIONS, section)) return;
    setControlSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const soundControlsValue = useMemo(() => ({
    waveformType,
    onWaveformChange: setWaveformType,
    audioParams,
    onParamChange: handleAudioParamChange,
    onParamsChange: handleAudioParamsChange,
    transportBpm,
    controlSections,
    onControlSectionToggle: handleControlSectionToggle,
    activePresetName,
    onPresetApplied: handlePresetApplied
  }), [
    waveformType,
    audioParams,
    transportBpm,
    controlSections,
    handleAudioParamChange,
    handleAudioParamsChange,
    handleControlSectionToggle,
    activePresetName,
    handlePresetApplied
  ]);

  const midiTransportValue = useMemo(() => ({
    isPlaying: midiPlayback.isPlaying,
    isPaused: midiPlayback.isPaused,
    progress: midiPlayback.progress,
    currentMidi: midiPlayback.currentMidi,
    tempoFactor: midiPlayback.tempoFactor,
    onPlay: midiPlayback.play,
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
    midiPlayback.play,
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
          <AppHeader
            activeSection="studio"
            onResetSound={handleResetSound}
            onUploadSample={handleAudioFileImport}
            onClearSample={handleClearSample}
            onToggleRecording={handleRecordToggle}
            onShowShortcuts={handleShowShortcuts}
            hasCustomSample={engineStatus.hasCustomSample}
            isRecording={isRecording}
            sampleLabel={sampleInfo?.name || sampleSelection?.name || ''}
            sampleLoading={sampleLoading}
          />

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
                {midiPlayback.currentMidi && (
                  <React.Suspense fallback={null}>
                    <BirdsEyeRadar
                      currentMidi={midiPlayback.currentMidi}
                      progress={midiPlayback.progress}
                      activeNotes={midiPlayback.activeNotes}
                      isPlaying={midiPlayback.isPlaying}
                    />
                  </React.Suspense>
                )}
                <SynthKeyboard
                  waveformType={waveformType}
                  audioParams={audioParams}
                  wasmLoaded={wasmLoaded}
                  externalActiveNotes={externalActiveNotes}
                />
                {!isGraphWarm && (
                  <div className="warmup-indicator" aria-live="polite">
                    <span className="warmup-indicator__marker" aria-hidden="true" />
                    <span>Audio engine warms now.</span>
                  </div>
                )}
              </div>
            </div>
          </main>

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
