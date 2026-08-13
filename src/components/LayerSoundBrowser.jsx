import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { TRACK_INSTRUMENTS } from '../utils/pianoRollPattern.js';
import { loadUserPresets } from '../utils/userPresetStorage.js';
import './LayerSoundBrowser.css';

const WAVEFORM_SOUNDS = TRACK_INSTRUMENTS.map((waveformType) => ({
  id: `waveform-${waveformType.toLowerCase()}`,
  name: waveformType,
  category: 'Basic waveforms',
  description: `A clean ${waveformType.toLowerCase()} oscillator ready for shaping.`,
  waveformType,
  audioParams: null,
  bank: 'Waveforms'
}));
const SOUND_BANKS = ['Waveforms', 'Factory', 'Patch Lab', 'My sounds'];

const normalizeSearchText = (value) => String(value || '').trim().toLocaleLowerCase();

const LayerSoundBrowser = ({ track, onChoose, onClose }) => {
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [query, setQuery] = useState('');
  const [bank, setBank] = useState('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('library');
  const mountedRef = useRef(true);
  const searchRef = useRef(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    mountedRef.current = true;
    Promise.all([
      import('../utils/factoryPresets.js'),
      import('../utils/patchLabPresets.js')
    ])
      .then(([factory, lab]) => {
        if (!mountedRef.current) return;
        const userSounds = loadUserPresets().map((preset) => ({
          ...preset,
          category: 'Your sounds',
          description: preset.description || 'A sound saved from the Vangelis sound workspace.',
          bank: 'My sounds'
        }));
        setCatalog([
          ...WAVEFORM_SOUNDS,
          ...factory.FACTORY_PRESETS.map((preset) => ({ ...preset, bank: 'Factory' })),
          ...lab.PATCH_LAB_PRESETS.map((preset) => ({ ...preset, bank: 'Patch Lab' })),
          ...userSounds
        ]);
        setCatalogError('');
      })
      .catch(() => {
        if (mountedRef.current) setCatalogError('The sound bank could not be loaded.');
      });
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(focusTimer);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const categories = useMemo(() => {
    if (!catalog) return [];
    const available = bank === 'all'
      ? catalog
      : catalog.filter((sound) => sound.bank === bank);
    return [...new Set(available.map((sound) => sound.category))]
      .sort((left, right) => left.localeCompare(right));
  }, [bank, catalog]);

  const sounds = useMemo(() => {
    if (!catalog) return [];
    const searchText = normalizeSearchText(deferredQuery);
    const filtered = catalog.filter((sound) => {
      if (bank !== 'all' && sound.bank !== bank) return false;
      if (category !== 'all' && sound.category !== category) return false;
      if (!searchText) return true;
      return normalizeSearchText([
        sound.name,
        sound.bank,
        sound.category,
        sound.description
      ].join(' ')).includes(searchText);
    });
    if (sort === 'name') {
      return filtered.toSorted((left, right) => left.name.localeCompare(right.name));
    }
    if (sort === 'category') {
      return filtered.toSorted((left, right) => (
        left.category.localeCompare(right.category) || left.name.localeCompare(right.name)
      ));
    }
    if (sort === 'newest') {
      return filtered.toSorted((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
    }
    return filtered;
  }, [bank, catalog, category, deferredQuery, sort]);

  const handleChoose = useCallback((sound) => {
    onChoose?.(track.id, sound);
  }, [onChoose, track.id]);

  return (
    <section className="layer-sound-browser" aria-label={`Sound bank for ${track.name}`}>
      <header className="layer-sound-browser__header">
        <div>
          <span className="layer-sound-browser__eyebrow">Layer sound</span>
          <h3>Choose a sound for {track.name}</h3>
        </div>
        <button
          type="button"
          className="layer-sound-browser__close"
          onClick={onClose}
          aria-label="Close sound bank"
        >
          ×
        </button>
      </header>

      <div className="layer-sound-browser__filters">
        <label className="layer-sound-browser__search">
          <span>Search</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search names, character, categories…"
          />
        </label>
        <label>
          <span>Bank</span>
          <select
            value={bank}
            onChange={(event) => {
              setBank(event.target.value);
              setCategory('all');
            }}
          >
            <option value="all">All banks</option>
            {SOUND_BANKS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="library">Library order</option>
            <option value="name">Name A–Z</option>
            <option value="category">Category</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>

      {!catalog && !catalogError && (
        <div className="layer-sound-browser__status" role="status">Loading sound bank…</div>
      )}
      {catalogError && (
        <div className="layer-sound-browser__status" role="alert">{catalogError}</div>
      )}
      {catalog && (
        <>
          <div className="layer-sound-browser__result-count" aria-live="polite">
            {sounds.length} {sounds.length === 1 ? 'sound' : 'sounds'}
          </div>
          {sounds.length > 0 ? (
            <ul className="layer-sound-browser__results">
              {sounds.map((sound) => {
                const isSelected = track.soundId
                  ? track.soundId === sound.id
                  : !sound.audioParams && track.instrument === sound.waveformType;
                return (
                  <li key={`${sound.bank}-${sound.id}`}>
                    <button
                      type="button"
                      className={isSelected ? 'is-selected' : ''}
                      onClick={() => handleChoose(sound)}
                      aria-pressed={isSelected}
                    >
                      <span className="layer-sound-browser__item-main">
                        <strong>{sound.name}</strong>
                        <small>{sound.description}</small>
                      </span>
                      <span className="layer-sound-browser__item-meta">
                        <em>{sound.bank}</em>
                        <span>{sound.category}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="layer-sound-browser__status">No sounds match those filters.</div>
          )}
        </>
      )}
    </section>
  );
};

export default React.memo(LayerSoundBrowser);
