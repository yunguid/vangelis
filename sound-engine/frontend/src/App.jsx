import React, { useState, useEffect, useRef, useCallback } from 'react';
import SynthKeyboard from './components/SynthKeyboard';
import ErrorBoundary from './components/ErrorBoundary';
import Scene from './components/Scene';
import WaveCandy from './components/WaveCandy';
import BirdsEyeRadar from './components/BirdsEyeRadar';
import Sidebar from './components/Sidebar';
import { audioEngine } from './utils/audioEngine.js';
import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_WAVEFORM,
  sanitizeAudioParams,
  upgradeLegacyAudioParams
} from './utils/audioParams.js';
import { useMidiPlayback } from './hooks/useMidiPlayback.js';
import { parseMidiFile } from './utils/midiParser.js';
import { loadAppSession, saveAppSession } from './utils/appSession.js';

const NOTICE_TIMEOUT_MS = 2200;
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

const parseBaseNote = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.trim().toUpperCase().match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;
  return { noteName: match[1], octave: Number(match[2]) };
};

const buildStarterFetchCandidates = (sourceUrl) => {
  const candidates = [];
  const add = (value) => {
    if (typeof value !== 'string' || value.length === 0) return;
    if (!candidates.includes(value)) candidates.push(value);
  };

  add(sourceUrl);

  if (typeof window !== 'undefined') {
    try {
      const resolved = new URL(sourceUrl, window.location.href);
      add(resolved.toString());

      const samplesIndex = resolved.pathname.indexOf('/samples/');
      if (samplesIndex > -1) {
        add(`${resolved.origin}${resolved.pathname.slice(samplesIndex)}${resolved.search}`);
      }
    } catch (_) {
      // Ignore invalid URL candidates.
    }
  }

  return candidates;
};

const fetchStarterSampleBlob = async (sourceUrl) => {
  const candidates = buildStarterFetchCandidates(sourceUrl);
  let lastError = null;

  for (const url of candidates) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        lastError = new Error(`Unexpected HTML response for ${url}`);
        continue;
      }

      return await response.blob();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Failed to fetch starter sample');
};

const getSampleSelection = (sample) => {
  if (!sample || typeof sample !== 'object') return null;

  if (sample.sourceUrl && sample.id) {
    return {
      type: 'starter',
      id: sample.id,
      name: sample.name,
      sourceUrl: sample.sourceUrl,
      mimeType: sample.mimeType || 'audio/wav',
      baseNote: sample.baseNote || null
    };
  }

  if (sample.id) {
    return {
      type: 'stored',
      id: sample.id,
      name: sample.name
    };
  }

  return null;
};

const App = () => {
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
  const [sidebarOpen, setSidebarOpen] = useState(() => initialSession.sidebarOpen || false);
  const [sidebarTab, setSidebarTab] = useState(() => initialSession.sidebarTab || 'midi');
  const [activeSampleId, setActiveSampleId] = useState(() => initialSession.activeSampleId || null);
  const [sampleSelection, setSampleSelection] = useState(() => initialSession.sampleSelection || null);
  const [notice, setNotice] = useState('');
  const [controlSections, setControlSections] = useState(() => (
    initialSession.controlSections || DEFAULT_CONTROL_SECTIONS
  ));
  const fileInputRef = useRef(null);
  const scrollRaf = useRef(null);
  const noticeTimeoutRef = useRef(null);
  const wasmLoaded = engineStatus.wasmReady;
  const isGraphWarm = engineStatus.graphWarmed;

  // MIDI playback hook
  const midiPlayback = useMidiPlayback({ waveformType, audioParams });
  const transportBpm = (midiPlayback.currentMidi?.bpm || 120) * midiPlayback.tempoFactor;

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
    const unsubscribe = audioEngine.subscribe(setEngineStatus);
    const unsubRecording = audioEngine.subscribeRecording(setIsRecording);

    audioEngine.ensureWasm().catch(() => {});
    audioEngine.ensureAudioContext().then(() => {
      audioEngine.warmGraph();
    });

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

  // Handle sample file upload
  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleAudioFileImport(file, null);
  }, [handleAudioFileImport]);

  const handleClearSample = useCallback(() => {
    audioEngine.clearCustomSample();
    setSampleInfo(null);
    setActiveSampleId(null);
    setSampleSelection(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    pushNotice('Sample cleared.');
  }, [pushNotice]);

  // Handle sample selection from sidebar
  const handleSampleSelect = useCallback(async (sample) => {
    if (!sample) return;

    setSampleLoading(true);
    try {
      let blob;
      if (sample.audioData) {
        blob = new Blob([sample.audioData], { type: sample.mimeType || 'audio/wav' });
      } else if (sample.sourceUrl) {
        blob = await fetchStarterSampleBlob(sample.sourceUrl);
      } else {
        return;
      }

      const inferredMimeType = sample.mimeType || blob.type || 'audio/wav';
      const file = new File([blob], sample.name + '.wav', { type: inferredMimeType });

      const info = await audioEngine.loadCustomSample(file);
      const parsedBase = parseBaseNote(sample.baseNote);
      if (parsedBase) {
        audioEngine.setCustomSampleBaseNote(parsedBase.noteName, parsedBase.octave);
      }
      setSampleInfo({
        name: sample.name,
        duration: info.duration.toFixed(2),
        channels: info.channels
      });
      setActiveSampleId(sample.id);
      setSampleSelection(getSampleSelection(sample));
      pushNotice('Sample changed.');
    } catch (err) {
      console.error('Failed to load sample:', err);
      pushNotice('Sample load failed.');
    } finally {
      setSampleLoading(false);
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
    saveAppSession({
      waveformType,
      audioParams,
      controlSections,
      sidebarTab,
      sidebarOpen,
      activeSampleId,
      sampleSelection,
      showShortcuts,
      tempoFactor: midiPlayback.tempoFactor
    });
  }, [
    activeSampleId,
    audioParams,
    controlSections,
    midiPlayback.tempoFactor,
    sampleSelection,
    showShortcuts,
    sidebarOpen,
    sidebarTab,
    waveformType
  ]);

  const handleAudioParamChange = (paramName, value) => {
    setAudioParams((prev) => sanitizeAudioParams({
      ...prev,
      [paramName]: value
    }));
  };

  const handleAudioParamsChange = (nextParams) => {
    setAudioParams((prev) => sanitizeAudioParams({
      ...prev,
      ...nextParams
    }));
  };

  const handleResetSound = useCallback(() => {
    setAudioParams(sanitizeAudioParams(AUDIO_PARAM_DEFAULTS));
    pushNotice('Sound reset to dry defaults.');
  }, [pushNotice]);

  const handleControlSectionToggle = useCallback((section) => {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONTROL_SECTIONS, section)) return;
    setControlSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  return (
    <ErrorBoundary>
      <div className="app-stage">
        <Scene />
        
        <div className="app-shell">
        <header className="zone-top tier-subtle content-tertiary" aria-label="Branding and quick actions">
          <div className="brand-block">
            <div className="brand-title">Vangelis</div>
          </div>
          <div className="header-controls">
            <button
              type="button"
              className="button-link"
              onClick={handleResetSound}
              title="Restore the default dry sound"
            >
              Reset sound
            </button>
            {/* Sample Upload */}
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="sample-upload"
            />
            <label
              htmlFor="sample-upload"
              className={`button-icon ${sampleLoading ? 'loading' : ''}`}
              aria-label={sampleInfo ? `Loaded sample ${sampleInfo.name}` : 'Upload sample'}
            >
              <span aria-hidden="true">{sampleInfo ? '!' : '+'}</span>
            </label>
            {sampleInfo && (
              <button
                type="button"
                className="button-icon"
                onClick={handleClearSample}
                aria-label="Clear custom sample"
              >
                <span aria-hidden="true">x</span>
              </button>
            )}

            {/* Recording Button */}
            <button
              type="button"
              className={`button-icon record-button ${isRecording ? 'recording' : ''}`}
              onClick={handleRecordToggle}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              <span aria-hidden="true">{isRecording ? '||' : 'O'}</span>
            </button>

            <button
              type="button"
              className="button-icon"
              aria-label="View keyboard shortcuts"
              onClick={() => setShowShortcuts(true)}
            >
              <span aria-hidden="true">?</span>
            </button>
          </div>
        </header>

        <main className="zone-center content-primary" aria-label="Keyboard area">
          <WaveCandy />
          <div className="keyboard-surface tier-focus" role="region" aria-label="Virtual keyboard">
            <div className="keyboard-header">
              <span className="keyboard-legend">
                {sampleInfo ? `Sample: ${sampleInfo.name}` : `Waveform: ${waveformType}`}
                {isRecording && <span className="recording-indicator"> [REC]</span>}
              </span>
            </div>
            <div className="keyboard-region">
              {midiPlayback.currentMidi && (
                <BirdsEyeRadar
                  currentMidi={midiPlayback.currentMidi}
                  progress={midiPlayback.progress}
                  activeNotes={midiPlayback.activeNotes}
                  isPlaying={midiPlayback.isPlaying}
                />
              )}
              <SynthKeyboard
                waveformType={waveformType}
                audioParams={audioParams}
                wasmLoaded={wasmLoaded}
                externalActiveNotes={midiPlayback.activeNotes}
              />
              {!isGraphWarm && (
                <div className="warmup-indicator" aria-live="polite">
                  <span className="warmup-indicator__pulse" aria-hidden="true" />
                  <span>Audio engine warms now.</span>
                </div>
              )}
              <div className="keyboard-hints">
                <span className="keyboard-hint">Press Shift + / for keys.</span>
              </div>
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

        <Sidebar
          isOpen={sidebarOpen}
          onOpen={() => setSidebarOpen(true)}
          onClose={() => setSidebarOpen(false)}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          isPlaying={midiPlayback.isPlaying}
          isPaused={midiPlayback.isPaused}
          progress={midiPlayback.progress}
          currentMidi={midiPlayback.currentMidi}
          tempoFactor={midiPlayback.tempoFactor}
          onPlay={midiPlayback.play}
          onPause={midiPlayback.pause}
          onResume={midiPlayback.resume}
          onStop={midiPlayback.stop}
          onTempoChange={midiPlayback.setTempo}
          onSampleSelect={handleSampleSelect}
          activeSampleId={activeSampleId}
          waveformType={waveformType}
          onWaveformChange={setWaveformType}
          audioParams={audioParams}
          onParamChange={handleAudioParamChange}
          onParamsChange={handleAudioParamsChange}
          transportBpm={transportBpm}
          controlSections={controlSections}
          onControlSectionToggle={handleControlSectionToggle}
        />

      </div>
    </ErrorBoundary>
  );
};

export default App;
