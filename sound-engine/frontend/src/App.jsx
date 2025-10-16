import React, { useState, useEffect, useRef } from 'react';
import SynthKeyboard from './components/SynthKeyboard';
import AudioControls from './components/AudioControls';
import UIOverlay from './components/UIOverlay';
import ErrorBoundary from './components/ErrorBoundary';
import PresetManager from './components/PresetManager';
import Scene from './components/Scene';
import { audioEngine } from './utils/audioEngine.js';

const App = () => {
  const [engineStatus, setEngineStatus] = useState(() => audioEngine.getStatus());
  const [waveformType, setWaveformType] = useState('Triangle');
  const [audioParams, setAudioParams] = useState({
    reverb: 0.6,
    delay: 180,
    distortion: 0,
    volume: 0.55,
    useADSR: true,
    attack: 0.6,
    decay: 0.25,
    sustain: 0.7,
    release: 1.5,
    useFM: false,
    fmRatio: 2,
    fmIndex: 2,
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
    const API_BASE = window.location.hostname === 'localhost'
      ? 'http://localhost:8000/api'
      : '/api';
    let cancelled = false;

    const tryLoadWarmPad = async () => {
      try {
        const response = await fetch(`${API_BASE}/presets/warm_pad`);
        const data = await response.json();
        if (!cancelled && data.success && data.data) {
          const preset = data.data;
          setWaveformType(preset.waveform);
          setAudioParams(prev => ({
            ...prev,
            volume: preset.effects.volume,
            reverb: preset.effects.reverb,
            delay: preset.effects.delay,
            distortion: preset.effects.distortion,
            attack: preset.adsr.attack,
            decay: preset.adsr.decay,
            sustain: preset.adsr.sustain,
            release: preset.adsr.release,
            useADSR: true
          }));
        }
      } catch (_) {
      }
    };

    tryLoadWarmPad();
    return () => {
      cancelled = true;
    };
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
    <ErrorBoundary>
      <div className="app-stage">
        <Scene />
        
        <div className="app-shell">
        <header className="zone-top tier-subtle content-tertiary" aria-label="Branding and quick actions">
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
          <div className="keyboard-surface tier-focus" role="region" aria-label="Virtual keyboard">
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
          <div className="controls-surface tier-support">
            <div className="controls-panel" aria-label="Waveform selection">
              <UIOverlay
                currentWaveform={waveformType}
                onWaveformChange={setWaveformType}
              />
              <div style={{ marginTop: '16px' }}>
                <PresetManager
                  audioParams={audioParams}
                  waveformType={waveformType}
                  onParamChange={handleAudioParamChange}
                  onWaveformChange={setWaveformType}
                />
              </div>
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
    </ErrorBoundary>
  );
};

export default App;
