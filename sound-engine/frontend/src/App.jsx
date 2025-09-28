import React, { useState, useEffect } from 'react';
import SynthKeyboard from './components/SynthKeyboard';
import AudioControls from './components/AudioControls';
import UIOverlay from './components/UIOverlay';
import { audioEngine } from './utils/audioEngine.js';

const App = () => {
  const [engineStatus, setEngineStatus] = useState(() => audioEngine.getStatus());
  const [waveformType, setWaveformType] = useState('Sine');
  const [audioParams, setAudioParams] = useState({
    reverb: 0,
    delay: 0,
    distortion: 0,
    volume: 0.7,
    useADSR: false,
    attack: 0.05,
    decay: 0.1,
    sustain: 0.7,
    release: 0.3,
    useFM: false,
    fmRatio: 2.5,
    fmIndex: 5,
    pan: 0.5,
    phaseOffset: 0
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const wasmLoaded = engineStatus.wasmReady;
  const isGraphWarm = engineStatus.graphWarmed;

  useEffect(() => {
    audioEngine.setGlobalParams(audioParams);
  }, [audioParams]);

  useEffect(() => {
    const unsubscribe = audioEngine.subscribe(setEngineStatus);

    audioEngine.ensureWasm().catch(() => {});
    audioEngine.ensureAudioContext().then(() => {
      audioEngine.warmGraph();
    });

    return unsubscribe;
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
    };

    window.addEventListener('keydown', handleKeyboardShortcuts);
    return () => window.removeEventListener('keydown', handleKeyboardShortcuts);
  }, []);

  const handleAudioParamChange = (paramName, value) => {
    setAudioParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  return (
    <div className="app-shell">
      <header className="zone-top" aria-label="Branding and quick actions">
        <div className="branding">
          <span className="brand-title">Vangelis</span>
        </div>
        <div className="top-actions"
          role="group"
          aria-label="Utility controls"
        >
          <button
            type="button"
            className="button-icon"
            aria-label="View keyboard shortcuts"
            onClick={() => setShowShortcuts(true)}
          >
            <span aria-hidden="true">?</span>
          </button>
          <button
            type="button"
            className="button-icon"
            aria-label="Open settings"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <main className="zone-center" aria-label="Keyboard area">
        <div className="keyboard-surface">
          <div className="keyboard-header">
            <span>Keyboard</span>
            <span className="keyboard-legend">Waveform · {waveformType}</span>
          </div>
          <div className="keyboard-wrapper">
            <SynthKeyboard
              waveformType={waveformType}
              audioParams={audioParams}
              wasmLoaded={wasmLoaded}
            />
            {!isGraphWarm && (
              <div className="warmup-indicator" aria-live="polite">
                <span className="warmup-indicator__pulse" aria-hidden="true" />
                <span>Warming up audio engine…</span>
              </div>
            )}
          </div>
        </div>
      </main>

      <section className="zone-bottom" aria-label="Control surface">
        <div className="controls-surface">
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
          <div className="shortcuts-card">
            <div className="shortcuts-header">
              <span>Keyboard Shortcuts</span>
              <button
                type="button"
                className="button-icon"
                aria-label="Close shortcuts"
                onClick={() => setShowShortcuts(false)}
              >
                <span aria-hidden="true">×</span>
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
  );
};

export default App;
