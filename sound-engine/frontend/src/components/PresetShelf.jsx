import React, { useCallback, useState } from 'react';
import {
  FACTORY_PRESETS,
  deleteUserPreset,
  loadUserPresets,
  saveUserPreset
} from '../utils/presetStorage.js';

/**
 * PresetShelf — named preset save/load for the Sound tab.
 * Factory patches showcase the mod-matrix engine; user presets persist in
 * localStorage. Applying a preset merges its params over the current sound.
 */
const PresetShelf = ({ waveformType, audioParams, onApply }) => {
  const [userPresets, setUserPresets] = useState(() => loadUserPresets());
  const [name, setName] = useState('');

  const handleSave = useCallback(() => {
    const preset = saveUserPreset({ name, waveformType, audioParams });
    setUserPresets((prev) => [preset, ...prev].slice(0, 50));
    setName('');
  }, [name, waveformType, audioParams]);

  const handleDelete = useCallback((id) => {
    setUserPresets(deleteUserPreset(id));
  }, []);

  const handleApply = useCallback((preset) => {
    onApply?.(preset);
  }, [onApply]);

  const renderPreset = (preset) => (
    <li key={preset.id} className="preset-shelf__item">
      <button
        type="button"
        className="preset-shelf__apply"
        onClick={() => handleApply(preset)}
        aria-label={`Load preset ${preset.name}`}
      >
        {preset.name}
      </button>
      {!preset.factory && (
        <button
          type="button"
          className="button-icon preset-shelf__delete"
          onClick={() => handleDelete(preset.id)}
          aria-label={`Delete preset ${preset.name}`}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
    </li>
  );

  return (
    <section className="preset-shelf" aria-label="Synth presets">
      <div className="preset-shelf__save-row">
        <input
          type="text"
          className="preset-shelf__name-input"
          placeholder="Preset name"
          maxLength={48}
          value={name}
          aria-label="New preset name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
          }}
        />
        <button
          type="button"
          className="button-primary preset-shelf__save"
          onClick={handleSave}
        >
          Save
        </button>
      </div>
      <ul className="preset-shelf__list" aria-label="Factory presets">
        {FACTORY_PRESETS.map(renderPreset)}
      </ul>
      {userPresets.length > 0 && (
        <ul className="preset-shelf__list" aria-label="Your presets">
          {userPresets.map(renderPreset)}
        </ul>
      )}
    </section>
  );
};

export default PresetShelf;
