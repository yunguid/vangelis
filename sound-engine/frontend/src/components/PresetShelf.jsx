import React, { useCallback, useMemo, useState } from 'react';
import {
  FACTORY_PRESETS,
  PRESET_CATEGORIES,
  deleteUserPreset,
  loadUserPresets,
  saveUserPreset
} from '../utils/presetStorage.js';

/**
 * PresetShelf — categorized preset browser for the Sound tab.
 * Factory bank is grouped by category with one-click apply and prev/next
 * cycling; user presets persist in localStorage. Applying a preset merges
 * its params over the current sound.
 *
 * `foldBrowse` is optional and additive: when omitted (the Sound tab's use),
 * behavior is unchanged — the transport, save row, and full category/preset
 * lists all render every time, as before. When `true` (the sound-designer
 * page's use), the transport + description + save row still always render,
 * but the factory-category groups and the "Your presets" list collapse
 * behind a disclosure button, so a 45-button preset wall doesn't dominate a
 * compact strip. The save row is deliberately kept out of the collapsible
 * region in both branches — saving is a core action, never hidden.
 */
const PresetShelf = ({
  waveformType,
  audioParams,
  onApply,
  activePresetName,
  foldBrowse = false
}) => {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [userPresets, setUserPresets] = useState(() => loadUserPresets());
  const [name, setName] = useState('');
  // Highlight survives remounts (tab switches) by re-deriving the active
  // entry from the app-level patch name.
  const [activeId, setActiveId] = useState(() => {
    if (!activePresetName) return null;
    const match = [...FACTORY_PRESETS, ...loadUserPresets()]
      .find((preset) => preset.name === activePresetName);
    return match?.id || null;
  });

  // Flattened ordering for prev/next cycling: factory bank, then user bank.
  const orderedPresets = useMemo(
    () => [...FACTORY_PRESETS, ...userPresets],
    [userPresets]
  );

  const factoryByCategory = useMemo(() => {
    const groups = new Map(PRESET_CATEGORIES.map((category) => [category, []]));
    FACTORY_PRESETS.forEach((preset) => {
      const bucket = groups.get(preset.category);
      if (bucket) bucket.push(preset);
      else groups.set(preset.category, [preset]);
    });
    return [...groups.entries()].filter(([, presets]) => presets.length > 0);
  }, []);

  const activePreset = useMemo(
    () => orderedPresets.find((preset) => preset.id === activeId) || null,
    [orderedPresets, activeId]
  );

  const handleApply = useCallback((preset) => {
    setActiveId(preset.id);
    onApply?.(preset);
  }, [onApply]);

  const handleStep = useCallback((direction) => {
    if (orderedPresets.length === 0) return;
    const index = orderedPresets.findIndex((preset) => preset.id === activeId);
    const nextIndex = index === -1
      ? (direction > 0 ? 0 : orderedPresets.length - 1)
      : (index + direction + orderedPresets.length) % orderedPresets.length;
    handleApply(orderedPresets[nextIndex]);
  }, [orderedPresets, activeId, handleApply]);

  const handleSave = useCallback(() => {
    const preset = saveUserPreset({ name, waveformType, audioParams });
    setUserPresets((prev) => [preset, ...prev].slice(0, 50));
    setActiveId(preset.id);
    setName('');
  }, [name, waveformType, audioParams]);

  const handleDelete = useCallback((id) => {
    setUserPresets(deleteUserPreset(id));
    setActiveId((prev) => (prev === id ? null : prev));
  }, []);

  const renderPreset = (preset) => (
    <li
      key={preset.id}
      className={`preset-shelf__item ${preset.id === activeId ? 'preset-shelf__item--active' : ''}`}
    >
      <button
        type="button"
        className="preset-shelf__apply"
        onClick={() => handleApply(preset)}
        title={preset.description || ''}
        aria-label={`Load preset ${preset.name}`}
        aria-pressed={preset.id === activeId}
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
      <div className="preset-shelf__transport">
        <button
          type="button"
          className="preset-shelf__step"
          onClick={() => handleStep(-1)}
          aria-label="Previous preset"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className="preset-shelf__readout" aria-live="polite">
          <span className="preset-shelf__readout-name">
            {activePreset ? activePreset.name : 'Presets'}
          </span>
          <span className="preset-shelf__readout-detail">
            {activePreset
              ? (activePreset.category || 'Your preset')
              : `${orderedPresets.length} patches`}
          </span>
        </div>
        <button
          type="button"
          className="preset-shelf__step"
          onClick={() => handleStep(1)}
          aria-label="Next preset"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
      {activePreset?.description && (
        <p className="preset-shelf__description">{activePreset.description}</p>
      )}
      {foldBrowse && (
        <button
          type="button"
          className="button-link preset-shelf__browse-toggle"
          onClick={() => setBrowseOpen((prev) => !prev)}
          aria-expanded={browseOpen}
        >
          {browseOpen ? 'Hide all presets' : `Browse all presets (${orderedPresets.length})`}
        </button>
      )}
      {(!foldBrowse || browseOpen) && (
        <>
          {factoryByCategory.map(([category, presets]) => (
            <div key={category} className="preset-shelf__group">
              <h4 className="preset-shelf__category">{category}</h4>
              <ul className="preset-shelf__list" aria-label={`${category} presets`}>
                {presets.map(renderPreset)}
              </ul>
            </div>
          ))}
          <div className="preset-shelf__group">
            <h4 className="preset-shelf__category">Your presets</h4>
            {userPresets.length > 0 ? (
              <ul className="preset-shelf__list" aria-label="Your presets">
                {userPresets.map(renderPreset)}
              </ul>
            ) : (
              <p className="preset-shelf__hint">Shape a sound, name it, save it here.</p>
            )}
          </div>
        </>
      )}
      <div className="preset-shelf__group preset-shelf__group--save">
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
      </div>
    </section>
  );
};

export default PresetShelf;
