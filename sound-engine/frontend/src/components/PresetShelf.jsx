import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteUserPreset,
  loadUserPresets,
  saveUserPreset
} from '../utils/userPresetStorage.js';
import { FACTORY_PRESET_COUNT, PATCH_LAB_PRESET_COUNT } from '../utils/presetCatalogMeta.js';

/**
 * PresetShelf — categorized preset browser for the Sound tab.
 * Factory bank is grouped by category with one-click apply and prev/next
 * cycling; user presets persist in localStorage. Applying a preset merges
 * its params over the current sound.
 *
 * `foldBrowse` is optional and additive: when omitted (the Sound tab's use),
 * behavior is unchanged after its lazy panel mounts — the transport, save row,
 * and full category/preset lists all render. When `true` (the sound-designer
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
  foldBrowse = false,
  hideSave = false
}) => {
  const [browseOpen, setBrowseOpen] = useState(false);
  const [userPresets, setUserPresets] = useState(() => loadUserPresets());
  const [factoryCatalog, setFactoryCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const catalogPromiseRef = useRef(null);
  const mountedRef = useRef(true);
  const [name, setName] = useState('');
  const [activeId, setActiveId] = useState(null);
  const factoryPresets = factoryCatalog?.FACTORY_PRESETS || [];
  const presetCategories = factoryCatalog?.PRESET_CATEGORIES || [];

  const ensureFactoryCatalog = useCallback(() => {
    if (factoryCatalog) return Promise.resolve(factoryCatalog);
    if (!catalogPromiseRef.current) {
      // Factory bank + Patch Lab load together in one deferred step; both
      // stay out of every route's static closure.
      catalogPromiseRef.current = Promise.all([
        import('../utils/factoryPresets.js'),
        import('../utils/patchLabPresets.js')
      ])
        .then(([factory, lab]) => {
          const catalog = {
            FACTORY_PRESETS: [...factory.FACTORY_PRESETS, ...lab.PATCH_LAB_PRESETS],
            PRESET_CATEGORIES: [...factory.PRESET_CATEGORIES, ...lab.PATCH_LAB_CATEGORIES]
          };
          if (mountedRef.current) {
            setFactoryCatalog(catalog);
            setCatalogError('');
          }
          return catalog;
        })
        .catch((error) => {
          catalogPromiseRef.current = null;
          if (mountedRef.current) setCatalogError('Preset bank failed to load.');
          throw error;
        });
    }
    return catalogPromiseRef.current;
  }, [factoryCatalog]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // The Sound tab shows the complete browser, so it fetches the bank as soon
  // as that already-lazy panel mounts. Sound Designer keeps its folded bank
  // out of the route's critical path until browse/step interaction.
  useEffect(() => {
    if (!foldBrowse) ensureFactoryCatalog().catch(() => {});
  }, [ensureFactoryCatalog, foldBrowse]);

  // Flattened ordering for prev/next cycling: factory bank, then user bank.
  const orderedPresets = useMemo(
    () => [...factoryPresets, ...userPresets],
    [factoryPresets, userPresets]
  );
  const presetCount = (
    factoryCatalog
      ? factoryPresets.length
      : FACTORY_PRESET_COUNT + PATCH_LAB_PRESET_COUNT
  ) + userPresets.length;

  const factoryByCategory = useMemo(() => {
    const groups = new Map(presetCategories.map((category) => [category, []]));
    factoryPresets.forEach((preset) => {
      const bucket = groups.get(preset.category);
      if (bucket) bucket.push(preset);
      else groups.set(preset.category, [preset]);
    });
    return [...groups.entries()].filter(([, presets]) => presets.length > 0);
  }, [factoryPresets, presetCategories]);

  useEffect(() => {
    if (!activePresetName) return;
    const match = orderedPresets.find((preset) => preset.name === activePresetName);
    if (match) setActiveId(match.id);
  }, [activePresetName, orderedPresets]);

  const activePreset = useMemo(
    () => orderedPresets.find((preset) => preset.id === activeId) || null,
    [orderedPresets, activeId]
  );

  const applyPreset = useCallback((preset) => {
    setActiveId(preset.id);
    onApply?.(preset);
  }, [onApply]);

  const handleApply = useCallback((preset) => {
    const performanceProbe = typeof window !== 'undefined'
      ? window.__vangelisPerf
      : null;
    const handlerStart = performanceProbe && typeof performance !== 'undefined'
      ? performance.now()
      : null;
    performanceProbe?.markInteractionPaint?.('preset.apply.paint', {
      factory: !!preset.factory
    });
    try {
      applyPreset(preset);
    } finally {
      if (handlerStart !== null) {
        performanceProbe?.recordInteraction?.(
          'preset.apply.handler',
          performance.now() - handlerStart,
          { factory: !!preset.factory }
        );
      }
    }
  }, [applyPreset]);

  const handleStep = useCallback(async (direction) => {
    const performanceProbe = typeof window !== 'undefined'
      ? window.__vangelisPerf
      : null;
    const stepStart = performanceProbe && typeof performance !== 'undefined'
      ? performance.now()
      : null;
    const startedCold = !factoryCatalog;
    const paintInteraction = performanceProbe?.beginInteractionPaint?.(
      'preset.step.paint',
      { cold: startedCold, direction }
    );
    let catalog;
    try {
      catalog = factoryCatalog || await ensureFactoryCatalog();
    } catch {
      paintInteraction?.cancel();
      return;
    }
    const availablePresets = [...catalog.FACTORY_PRESETS, ...userPresets];
    if (availablePresets.length === 0) {
      paintInteraction?.cancel();
      return;
    }
    const index = availablePresets.findIndex((preset) => preset.id === activeId);
    const nextIndex = index === -1
      ? (direction > 0 ? 0 : availablePresets.length - 1)
      : (index + direction + availablePresets.length) % availablePresets.length;
    applyPreset(availablePresets[nextIndex]);
    paintInteraction?.complete();
    if (stepStart !== null) {
      performanceProbe?.recordInteraction?.(
        `preset.step.${startedCold ? 'cold' : 'warm'}`,
        performance.now() - stepStart,
        { direction }
      );
    }
  }, [activeId, applyPreset, ensureFactoryCatalog, factoryCatalog, userPresets]);

  const handleBrowseToggle = useCallback(() => {
    const nextOpen = !browseOpen;
    setBrowseOpen(nextOpen);
    if (nextOpen) ensureFactoryCatalog().catch(() => {});
  }, [browseOpen, ensureFactoryCatalog]);

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
            {activePreset?.name || activePresetName || 'Presets'}
          </span>
          <span className="preset-shelf__readout-detail">
            {activePreset
              ? (activePreset.category || 'Your preset')
              : `${presetCount} patches`}
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
          onClick={handleBrowseToggle}
          aria-expanded={browseOpen}
        >
          {browseOpen ? 'Hide all presets' : `Browse all presets (${presetCount})`}
        </button>
      )}
      {(!foldBrowse || browseOpen) && !factoryCatalog && !catalogError && (
        <div className="preset-shelf__hint" role="status">Loading preset bank…</div>
      )}
      {catalogError && <div className="preset-shelf__hint" role="alert">{catalogError}</div>}
      {(!foldBrowse || browseOpen) && factoryCatalog && (
        <div className={`preset-shelf__browse${foldBrowse ? ' preset-shelf__browse--capped' : ''}`}>
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
              <ul className="preset-shelf__list" aria-label="Your presets">
                <li className="preset-shelf__hint">Shape a sound, name it, save it here.</li>
              </ul>
            )}
          </div>
        </div>
      )}
      {!hideSave && <div className="preset-shelf__group preset-shelf__group--save">
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
      </div>}
    </section>
  );
};

export default React.memo(PresetShelf);
