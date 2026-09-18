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

const ICON_CLOSE = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const normalizeSearchText = (value) => String(value || '').trim().toLocaleLowerCase();

const LayerSoundBrowser = ({ track, onChoose, onClose }) => {
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState('');
  const [query, setQuery] = useState('');
  const [bank, setBank] = useState('all');
  const [category, setCategory] = useState('all');
  const mountedRef = useRef(true);
  const searchRef = useRef(null);
  const listRef = useRef(null);
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
    return catalog.filter((sound) => {
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
  }, [bank, catalog, category, deferredQuery]);

  const handleChoose = useCallback((sound) => {
    onChoose?.(track.id, sound);
  }, [onChoose, track.id]);

  const isChosen = useCallback((sound) => (track.soundId
    ? track.soundId === sound.id
    : !sound.audioParams && track.instrument === sound.waveformType
  ), [track.instrument, track.soundId]);

  // Arrow keys scrub the visible list, applying + auditioning each sound as it is
  // highlighted. stopPropagation keeps the editor's window-level arrow handler
  // (which nudges selected notes and only skips INPUT/SELECT/TEXTAREA targets)
  // from also firing when a row button has focus.
  const handleScrub = useCallback((event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (event.target?.nodeName === 'SELECT' || sounds.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    const current = sounds.findIndex(isChosen);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    const next = current < 0
      ? 0
      : Math.min(Math.max(current + step, 0), sounds.length - 1);
    handleChoose(sounds[next]);
    listRef.current?.children[next]?.scrollIntoView?.({ block: 'nearest' });
  }, [handleChoose, isChosen, sounds]);

  return (
    <section
      className="layer-sound-browser"
      aria-label={`Sound bank for ${track.name}`}
      onKeyDown={handleScrub}
    >
      <div className="layer-sound-browser__bar">
        <input
          ref={searchRef}
          type="search"
          aria-label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search sounds for ${track.name}`}
        />
        <button
          type="button"
          className="btn btn--icon"
          onClick={onClose}
          aria-label="Close sound bank"
          title="Close sound bank"
        >
          {ICON_CLOSE}
        </button>
      </div>

      <div className="layer-sound-browser__filters">
        <select
          aria-label="Bank"
          value={bank}
          onChange={(event) => {
            setBank(event.target.value);
            setCategory('all');
          }}
        >
          <option value="all">All banks</option>
          {SOUND_BANKS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <select
          aria-label="Category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
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
            <ul className="layer-sound-browser__results" ref={listRef}>
              {sounds.map((sound) => {
                const isSelected = isChosen(sound);
                return (
                  <li key={`${sound.bank}-${sound.id}`}>
                    <button
                      type="button"
                      className={isSelected ? 'is-selected' : ''}
                      onClick={() => handleChoose(sound)}
                      aria-pressed={isSelected}
                    >
                      <span className="layer-sound-browser__item-name">{sound.name}</span>
                      <span className="layer-sound-browser__item-bank">{sound.bank}</span>
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
