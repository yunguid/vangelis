import React, { useState, useEffect } from 'react';

const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:8000/api'
  : '/api';

const SYSTEM_PRESETS = ['default', 'pad', 'pluck', 'warm_pad', 'glass_keys', 'soft_ep', 'lofi_tape', 'analog_bass'];

const PresetManager = ({ audioParams, waveformType, onParamChange, onWaveformChange }) => {
  const [presets, setPresets] = useState([]);
  const [active, setActive] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const res = await fetch(`${API_BASE}/presets`);
      const data = await res.json();
      if (data.success && data.data) {
        setPresets(data.data);
        setMessage(null);
      }
    } catch {
      setMessage({ type: 'error', text: 'Backend offline' });
    }
  };

  const loadPreset = async (key) => {
    try {
      const res = await fetch(`${API_BASE}/presets/${key}`);
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        setActive(p.name);
        onWaveformChange(p.waveform);
        onParamChange('volume', p.effects.volume);
        onParamChange('reverb', p.effects.reverb);
        onParamChange('delay', p.effects.delay);
        onParamChange('distortion', p.effects.distortion);
        onParamChange('attack', p.adsr.attack);
        onParamChange('decay', p.adsr.decay);
        onParamChange('sustain', p.adsr.sustain);
        onParamChange('release', p.adsr.release);
        onParamChange('useADSR', true);
        showMessage('success', `Loaded: ${p.name}`);
      }
    } catch {
      showMessage('error', 'Load failed');
    }
  };

  const savePreset = async (name) => {
    if (!name.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          waveform: waveformType,
          adsr: {
            attack: audioParams.attack || 0.05,
            decay: audioParams.decay || 0.1,
            sustain: audioParams.sustain || 0.7,
            release: audioParams.release || 0.3,
          },
          effects: {
            reverb: audioParams.reverb || 0,
            delay: audioParams.delay || 0,
            distortion: audioParams.distortion || 0,
            volume: audioParams.volume || 0.7,
          },
          author: 'User',
          description: 'Custom',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showMessage('success', 'Saved');
        loadPresets();
      }
    } catch {
      showMessage('error', 'Save failed');
    }
  };

  const deletePreset = async (key) => {
    if (!window.confirm('Delete?')) return;
    try {
      const res = await fetch(`${API_BASE}/presets/${key}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showMessage('success', 'Deleted');
        loadPresets();
      }
    } catch {
      showMessage('error', 'Delete failed');
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 2500);
  };

  const toKey = (name) => name.toLowerCase().replace(/\s+/g, '_');

  return (
    <div className="preset-manager panel elevated">
      <div className="preset-header">
        <h2 className="controls-heading">Presets</h2>
        <button type="button" className="button-link" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {expanded && (
        <div className="preset-content">
          {message && (
            <div className={`preset-message preset-${message.type}`}>
              {message.type === 'error' ? '⚠' : '✓'} {message.text}
            </div>
          )}

          <div className="preset-section">
            <h3 className="preset-section-title">Save</h3>
            <div className="preset-save-form">
              <input
                type="text"
                className="preset-input"
                placeholder="Name..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    savePreset(e.target.value);
                    e.target.value = '';
                  }
                }}
              />
            </div>
          </div>

          <div className="preset-section">
            <h3 className="preset-section-title">Load ({presets.length})</h3>
            {presets.length === 0 ? (
              <p className="preset-empty">No presets</p>
            ) : (
              <div className="preset-list">
                {presets.map((p) => {
                  const key = toKey(p.name);
                  const isSystem = SYSTEM_PRESETS.includes(key);
                  return (
                    <div key={p.name} className={`preset-item ${active === p.name ? 'preset-item-active' : ''}`}>
                      <div className="preset-item-info">
                        <div className="preset-item-name">{p.name}</div>
                        <div className="preset-item-meta">{p.waveform}</div>
                      </div>
                      <div className="preset-item-actions">
                        <button
                          type="button"
                          className="preset-action-btn preset-load-btn"
                          onClick={() => loadPreset(key)}
                        >
                          Load
                        </button>
                        {!isSystem && (
                          <button
                            type="button"
                            className="preset-action-btn preset-delete-btn"
                            onClick={() => deletePreset(key)}
                          >
                            Del
                          </button>
                        )}
                      </div>
                    </div>
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

