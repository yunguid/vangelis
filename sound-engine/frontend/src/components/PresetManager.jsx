import React, { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api'
  : '/api';

const SYSTEM_PRESETS = [
  'default',
  'nocturne_piano',
  'aurora_glass',
  'cathedral_bloom',
  'bronze_reed',
  'ember_pulse',
  'dusty_tape',
  'analog_bass'
];

const normalizeKey = (name) => name.toLowerCase().replace(/\s+/g, '_');

const sortPresets = (presets) => {
  const rank = new Map(SYSTEM_PRESETS.map((key, index) => [key, index]));
  return [...presets].sort((a, b) => {
    const aKey = normalizeKey(a.name);
    const bKey = normalizeKey(b.name);
    const aRank = rank.has(aKey) ? rank.get(aKey) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(bKey) ? rank.get(bKey) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name);
  });
};

const PresetManager = ({
  audioParams,
  waveformType,
  onPresetApply
}) => {
  const [presets, setPresets] = useState([]);
  const [activeKey, setActiveKey] = useState('default');
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const messageTimeoutRef = useRef(null);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    window.clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = window.setTimeout(() => setMessage(null), 2600);
  };

  useEffect(() => {
    return () => window.clearTimeout(messageTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!expanded || hasLoaded || isLoading) return;
    loadPresets();
  }, [expanded, hasLoaded, isLoading]);

  const loadPresets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/presets`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPresets(sortPresets(data.data));
        setMessage(null);
      } else {
        showMessage('error', data.error || 'Preset library unavailable.');
      }
    } catch {
      showMessage('error', 'Preset backend offline.');
    } finally {
      setHasLoaded(true);
      setIsLoading(false);
    }
  };

  const loadPreset = async (key) => {
    try {
      const res = await fetch(`${API_BASE}/presets/${key}`);
      const data = await res.json();
      if (data.success && data.data) {
        setActiveKey(key);
        onPresetApply?.(data.data);
        showMessage('success', `Loaded ${data.data.name}.`);
      } else {
        showMessage('error', data.error || 'Preset load failed.');
      }
    } catch {
      showMessage('error', 'Preset load failed.');
    }
  };

  const savePreset = async (name) => {
    if (!name.trim()) return;

    const payload = {
      name: name.trim(),
      waveform: waveformType,
      adsr: {
        attack: audioParams.attack || 0.01,
        decay: audioParams.decay || 0.18,
        sustain: audioParams.sustain || 0.76,
        release: audioParams.release || 0.42
      },
      effects: {
        reverb: audioParams.reverb || 0,
        delay: audioParams.delay || 0,
        distortion: audioParams.distortion || 0,
        volume: audioParams.volume || 0.68
      },
      engine: {
        pan: audioParams.pan || 0.5,
        useFilter: !!audioParams.useFilter,
        filterCutoff: audioParams.filterCutoff || 18000,
        filterResonance: audioParams.filterResonance || 0.7,
        filterMode: audioParams.filterMode || 0,
        unisonVoices: audioParams.unisonVoices || 1,
        unisonDetune: audioParams.unisonDetune || 0,
        useFM: !!audioParams.useFM,
        fmRatio: audioParams.fmRatio || 2,
        fmIndex: audioParams.fmIndex || 2,
        lfoRate: audioParams.lfoRate || 0,
        lfoDepth: audioParams.lfoDepth || 0,
        lfoTarget: audioParams.lfoTarget || 0
      },
      author: 'User',
      description: 'Saved from current control state.'
    };

    try {
      const res = await fetch(`${API_BASE}/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setActiveKey(data.data || normalizeKey(name));
        showMessage('success', `Saved ${payload.name}.`);
        await loadPresets();
      } else {
        showMessage('error', data.error || 'Save failed.');
      }
    } catch {
      showMessage('error', 'Save failed.');
    }
  };

  const deletePreset = async (key) => {
    if (!window.confirm('Delete this preset?')) return;
    try {
      const res = await fetch(`${API_BASE}/presets/${key}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        if (activeKey === key) setActiveKey('default');
        showMessage('success', 'Preset deleted.');
        await loadPresets();
      } else {
        showMessage('error', data.error || 'Delete failed.');
      }
    } catch {
      showMessage('error', 'Delete failed.');
    }
  };

  const featuredPresets = useMemo(
    () => presets.filter((preset) => SYSTEM_PRESETS.includes(normalizeKey(preset.name))),
    [presets]
  );

  const customPresets = useMemo(
    () => presets.filter((preset) => !SYSTEM_PRESETS.includes(normalizeKey(preset.name))),
    [presets]
  );

  return (
    <div className="preset-manager panel elevated">
      <div className="preset-header">
        <div className="preset-header__copy">
          <h2 className="controls-heading">Presets</h2>
          <p className="preset-header__description">
            Curated playback colors that use the upgraded engine path.
          </p>
        </div>
        <button type="button" className="button-link" onClick={() => setExpanded((prev) => !prev)}>
          {expanded ? 'Hide presets' : 'Open presets'}
        </button>
      </div>

      {expanded && (
        <div className="preset-content">
          {message && (
            <div className={`preset-message preset-${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="preset-section">
            <h3 className="preset-section-title">Save Current Sound</h3>
            <div className="preset-save-form">
              <input
                type="text"
                className="preset-input"
                placeholder="Name this preset"
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  savePreset(event.currentTarget.value);
                  event.currentTarget.value = '';
                }}
              />
            </div>
          </div>

          <div className="preset-section">
            <div className="preset-section__header">
              <h3 className="preset-section-title">Featured</h3>
              {!hasLoaded && <span className="preset-section__meta">Opens the backend library</span>}
            </div>
            {isLoading ? (
              <p className="preset-empty">Loading preset catalog...</p>
            ) : (
              <div className="preset-list preset-list--featured">
                {featuredPresets.map((preset) => {
                  const key = normalizeKey(preset.name);
                  return (
                    <article
                      key={preset.name}
                      className={`preset-item ${activeKey === key ? 'preset-item-active' : ''}`}
                    >
                      <div className="preset-item-info">
                        <div className="preset-item-name">{preset.name}</div>
                        <div className="preset-item-meta">
                          {preset.waveform} · {Math.round((preset.effects?.reverb || 0) * 100)}% space
                        </div>
                        <p className="preset-item-description">{preset.description}</p>
                      </div>
                      <div className="preset-item-actions">
                        <button
                          type="button"
                          className="preset-action-btn preset-load-btn"
                          onClick={() => loadPreset(key)}
                        >
                          Load
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="preset-section">
            <div className="preset-section__header">
              <h3 className="preset-section-title">Custom</h3>
              <span className="preset-section__meta">{customPresets.length} saved</span>
            </div>
            {customPresets.length === 0 ? (
              <p className="preset-empty">Save a sound to build your own collection.</p>
            ) : (
              <div className="preset-list">
                {customPresets.map((preset) => {
                  const key = normalizeKey(preset.name);
                  return (
                    <article
                      key={preset.name}
                      className={`preset-item ${activeKey === key ? 'preset-item-active' : ''}`}
                    >
                      <div className="preset-item-info">
                        <div className="preset-item-name">{preset.name}</div>
                        <div className="preset-item-meta">{preset.waveform}</div>
                      </div>
                      <div className="preset-item-actions">
                        <button
                          type="button"
                          className="preset-action-btn preset-load-btn"
                          onClick={() => loadPreset(key)}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          className="preset-action-btn preset-delete-btn"
                          onClick={() => deletePreset(key)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PresetManager;
