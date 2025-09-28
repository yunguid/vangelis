import React, { useState, useEffect, useRef } from 'react';
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
  const scrollRaf = useRef(null);
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
    <div className="app-stage">
      <div className="parallax-stage" aria-hidden="true">
        <div className="parallax-layer parallax-layer--far" />
        <div className="parallax-layer parallax-layer--mid" />
        <div className="parallax-layer parallax-layer--near" />
      </div>

      <div className="app-shell">
        <header className="zone-top tier-subtle drift-slow content-tertiary" aria-label="Branding and quick actions">
          <div className="brand-title">Vangelis</div>
          <button
            type="button"
            className="button-icon"
            aria-label="View keyboard shortcuts"
            onClick={() => setShowShortcuts(true)}
          >
            <span aria-hidden="true">?</span>
          </button>
        </header>

        <main className="zone-center content-primary" aria-label="Keyboard area">
          <div className="keyboard-surface tier-focus drift-medium" role="region" aria-label="Virtual keyboard">
            <div className="keyboard-header">
              <span>Keyboard</span>
              <span className="keyboard-legend">Waveform · {waveformType}</span>
            </div>
            <div className="keyboard-region">
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

        <section className="zone-bottom content-secondary" aria-label="Control surface">
          <div className="controls-surface tier-support drift-fast">
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
    </div>
  );
};

export default App;
