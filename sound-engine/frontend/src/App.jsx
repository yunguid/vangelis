import React, { useState, useEffect, useRef, useCallback } from 'react';
import SynthKeyboard from './components/SynthKeyboard';
import AudioControls from './components/AudioControls';
import UIOverlay from './components/UIOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import Scene from './components/Scene';
import WaveCandy from './components/WaveCandy';
import Sidebar from './components/Sidebar';
import { audioEngine } from './utils/audioEngine.js';
import { AUDIO_PARAM_DEFAULTS, DEFAULT_WAVEFORM } from './utils/audioParams.js';
import { useMidiPlayback } from './hooks/useMidiPlayback.js';

const App = () => {
  const [engineStatus, setEngineStatus] = useState(() => audioEngine.getStatus());
  const [waveformType, setWaveformType] = useState(DEFAULT_WAVEFORM);
  const [audioParams, setAudioParams] = useState(() => ({ ...AUDIO_PARAM_DEFAULTS }));
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sampleInfo, setSampleInfo] = useState(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('midi');
  const [activeSampleId, setActiveSampleId] = useState(null);
  const fileInputRef = useRef(null);
  const scrollRaf = useRef(null);
  const wasmLoaded = engineStatus.wasmReady;
  const isGraphWarm = engineStatus.graphWarmed;

  // MIDI playback hook
  const midiPlayback = useMidiPlayback({ waveformType, audioParams });

  useEffect(() => {
    audioEngine.setGlobalParams(audioParams);
  }, [audioParams]);

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

  // Handle sample file upload
  const handleFileSelect = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSampleLoading(true);
    try {
      const info = await audioEngine.loadCustomSample(file);
      setSampleInfo({
        name: file.name,
        duration: info.duration.toFixed(2),
        channels: info.channels
      });
    } catch (err) {
      console.error('Failed to load sample:', err);
      alert('Failed to load audio file. Please try a different file.');
    } finally {
      setSampleLoading(false);
    }
  }, []);

  const handleClearSample = useCallback(() => {
    audioEngine.clearCustomSample();
    setSampleInfo(null);
    setActiveSampleId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle sample selection from sidebar
  const handleSampleSelect = useCallback(async (sample) => {
    if (!sample || !sample.audioData) return;

    setSampleLoading(true);
    try {
      // Create a File-like object from the stored audio data
      const blob = new Blob([sample.audioData], { type: sample.mimeType || 'audio/wav' });
      const file = new File([blob], sample.name + '.wav', { type: sample.mimeType || 'audio/wav' });

      const info = await audioEngine.loadCustomSample(file);
      setSampleInfo({
        name: sample.name,
        duration: info.duration.toFixed(2),
        channels: info.channels
      });
      setActiveSampleId(sample.id);
    } catch (err) {
      console.error('Failed to load sample:', err);
    } finally {
      setSampleLoading(false);
    }
  }, []);

  const handleRecordToggle = useCallback(() => {
    audioEngine.toggleRecording();
  }, []);

  useEffect(() => {
    const handleKeyboardShortcuts = (event) => {
      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault();
        setShowShortcuts(prev => !prev);
      }

      if (event.key === 'Escape') {
        setShowShortcuts(false);
      }

      // Space bar toggles recording (only if not focused on input)
      if (event.key === ' ' && event.target.tagName !== 'INPUT' && event.target.tagName !== 'BUTTON') {
        event.preventDefault();
        audioEngine.toggleRecording();
      }
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, []);

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

  const handleAudioParamChange = (paramName, value) => {
    setAudioParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  return (
    <ErrorBoundary>
      <div className="app-stage">
        <Scene />
        
        <div className="app-shell">
        <header className="zone-top tier-subtle content-tertiary" aria-label="Branding and quick actions">
          <div className="brand-title">Vangelis</div>
          <div className="header-controls">
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
              title={sampleInfo ? `Sample: ${sampleInfo.name}` : 'Upload custom sample'}
            >
              <span aria-hidden="true">{sampleInfo ? '!' : '+'}</span>
            </label>
            {sampleInfo && (
              <button
                type="button"
                className="button-icon"
                onClick={handleClearSample}
                title="Clear sample"
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
              title={isRecording ? 'Stop recording (Space)' : 'Start recording (Space)'}
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
              <span>Keyboard</span>
              <span className="keyboard-legend">
                {sampleInfo ? `Sample: ${sampleInfo.name}` : `Waveform: ${waveformType}`}
                {isRecording && <span className="recording-indicator"> [REC]</span>}
              </span>
            </div>
            <div className="keyboard-region">
              <SynthKeyboard
                waveformType={waveformType}
                audioParams={audioParams}
                wasmLoaded={wasmLoaded}
                externalActiveNotes={midiPlayback.activeNotes}
              />
              {!isGraphWarm && (
                <div className="warmup-indicator" aria-live="polite">
                  <span className="warmup-indicator__pulse" aria-hidden="true" />
                  <span>Warming up audio engine…</span>
                </div>
              )}
              <div className="keyboard-hints"> .    
                <span className="keyboard-hint">Shift + / opens shortcuts </span>
                <span className="keyboard-hint">Z / X for octave</span>
              </div>
            </div>
          </div>
        </main>

        <section className="zone-bottom content-secondary" aria-label="Control surface">
          <div className="controls-surface tier-support">
            <div className="controls-panel" aria-label="Waveform selection">
              <UIOverlay
                currentWaveform={waveformType}
                onWaveformChange={setWaveformType}
              />
            </div>
            <div className="controls-panel wide" aria-label="Audio controls">
              <AudioControls
                audioParams={audioParams}
                onParamChange={handleAudioParamChange}
              />
            </div>
          </div>
        </section>

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
                  <span aria-hidden="true"></span>
                </button>
              </div>
              <dl className="shortcuts-grid">
                <div>
                  <dt>A – ;</dt>
                  <dd>Play white keys across the active octave</dd>
                </div>
                <div>
                  <dt>W – P</dt>
                  <dd>Play black keys across the active octave</dd>
                </div>
                <div>
                  <dt>Z / X</dt>
                  <dd>Shift octave down or up</dd>
                </div>
                <div>
                  <dt>C / V</dt>
                  <dd>Adjust key velocity</dd>
                </div>
                <div>
                  <dt>Shift + / (?)</dt>
                  <dd>Toggle this overlay</dd>
                </div>
                <div>
                  <dt>Escape</dt>
                  <dd>Close overlays</dd>
                </div>
              </dl>
            </div>
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
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;
