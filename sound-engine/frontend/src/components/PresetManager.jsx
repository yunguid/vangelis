import React, { useState, useEffect } from 'react';

const PresetManager = ({ audioParams, waveformType, onLoadPreset, onParamChange, onWaveformChange }) => {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // API base URL - works for both local dev and production
  const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000/api'
    : '/api';

  // Fetch presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    try {
      const response = await fetch(`${API_BASE}/presets`);
      const data = await response.json();
      
      if (data.success && data.data) {
        setPresets(data.data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load presets. Is the backend running?');
      console.error('Preset load error:', err);
    }
  };

  const loadPreset = async (presetName) => {
    try {
      const response = await fetch(`${API_BASE}/presets/${presetName}`);
      const data = await response.json();
      
      if (data.success && data.data) {
        const preset = data.data;
        setSelectedPreset(preset);
        
        // Update app state
        onWaveformChange(preset.waveform);
        
        // Update all audio parameters
        onParamChange('volume', preset.effects.volume);
        onParamChange('reverb', preset.effects.reverb);
        onParamChange('delay', preset.effects.delay);
        onParamChange('distortion', preset.effects.distortion);
        
        onParamChange('attack', preset.adsr.attack);
        onParamChange('decay', preset.adsr.decay);
        onParamChange('sustain', preset.adsr.sustain);
        onParamChange('release', preset.adsr.release);
        onParamChange('useADSR', true);
        
        showSuccess(`Loaded preset: ${preset.name}`);
      }
    } catch (err) {
      setError(`Failed to load preset: ${presetName}`);
      console.error('Preset load error:', err);
    }
  };

  const savePreset = async () => {
    if (!newPresetName.trim()) {
      setError('Please enter a preset name');
      return;
    }

    setIsSaving(true);
    setError(null);

    const presetData = {
      name: newPresetName,
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
      description: 'Custom preset saved from UI',
    };

    try {
      const response = await fetch(`${API_BASE}/presets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(presetData),
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(`Preset "${newPresetName}" saved successfully!`);
        setNewPresetName('');
        await loadPresets(); // Reload preset list
      } else {
        setError(data.error || 'Failed to save preset');
      }
    } catch (err) {
      setError('Failed to save preset. Is the backend running?');
      console.error('Preset save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const deletePreset = async (presetName) => {
    if (!confirm(`Delete preset "${presetName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/presets/${presetName}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        showSuccess(`Preset "${presetName}" deleted`);
        await loadPresets();
      } else {
        setError(data.error || 'Failed to delete preset');
      }
    } catch (err) {
      setError('Failed to delete preset');
      console.error('Preset delete error:', err);
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  return (
    <div className="preset-manager panel elevated">
      <div className="preset-header">
        <h2 className="controls-heading">Preset Manager</h2>
        <button
          type="button"
          className="button-link"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isExpanded && (
        <div className="preset-content">
          {/* Error/Success Messages */}
          {error && (
            <div className="preset-message preset-error">
              ⚠️ {error}
            </div>
          )}
          
          {successMessage && (
            <div className="preset-message preset-success">
              ✓ {successMessage}
            </div>
          )}

          {/* Save Current Settings */}
          <div className="preset-section">
            <h3 className="preset-section-title">Save Current Settings</h3>
            <div className="preset-save-form">
              <input
                type="text"
                className="preset-input"
                placeholder="Enter preset name..."
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && savePreset()}
              />
              <button
                type="button"
                className="button-primary"
                onClick={savePreset}
                disabled={isSaving || !newPresetName.trim()}
              >
                {isSaving ? 'Saving...' : 'Save Preset'}
              </button>
            </div>
            <p className="preset-hint">
              Current: {waveformType} | Volume: {Math.round((audioParams.volume || 0.7) * 100)}%
            </p>
          </div>

          {/* Load Presets */}
          <div className="preset-section">
            <h3 className="preset-section-title">
              Saved Presets ({presets.length})
              <button
                type="button"
                className="button-link"
                onClick={loadPresets}
                style={{ fontSize: '0.8rem', marginLeft: '8px' }}
              >
                Refresh
              </button>
            </h3>
            
            {presets.length === 0 ? (
              <p className="preset-empty">No presets available. Save one to get started!</p>
            ) : (
              <div className="preset-list">
                {presets.map((preset) => (
                  <div 
                    key={preset.name} 
                    className={`preset-item ${selectedPreset?.name === preset.name ? 'preset-item-active' : ''}`}
                  >
                    <div className="preset-item-info">
                      <div className="preset-item-name">{preset.name}</div>
                      <div className="preset-item-meta">
                        {preset.waveform} • {preset.description || 'No description'}
                      </div>
                    </div>
                    <div className="preset-item-actions">
                      <button
                        type="button"
                        className="preset-action-btn preset-load-btn"
                        onClick={() => loadPreset(preset.name.toLowerCase().replace(/\s+/g, '_'))}
                        title="Load this preset"
                      >
                        Load
                      </button>
                      {!['default', 'pad', 'pluck'].includes(preset.name.toLowerCase().replace(/\s+/g, '_')) && (
                        <button
                          type="button"
                          className="preset-action-btn preset-delete-btn"
                          onClick={() => deletePreset(preset.name.toLowerCase().replace(/\s+/g, '_'))}
                          title="Delete this preset"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Backend Status */}
          <div className="preset-footer">
            <small className="preset-status">
              Backend: {error ? '❌ Not Connected' : '✅ Connected'}
            </small>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresetManager;


