import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadSoundCatalog } from '../utils/soundCatalog.js';
import { deleteUserPreset, subscribeUserPresets } from '../utils/userPresetStorage.js';
import '../styles/sound-dial.css';

// The face is the top of a wheel whose hub lies below the page: a 960 x 288
// window onto a circle of radius 544 (256-480-544 is a right triangle, so the
// window's bottom corners sit exactly on the rim). CSS scales it.
const VIEW_W = 960;
const VIEW_H = 288;
const RADIUS = 544;
const CX = VIEW_W / 2;
const CY = RADIUS;
const RIM = RADIUS - 8;
const BAND = RADIUS - 38;
const BAND_LETTER = 7.6; // drawing units per letter of a band label
const SETTLE_MS = 160; // turning past a sound does not load it; resting on it does
const WHEEL_STEP = 48;

const onArc = (radius, degrees) => {
  const radians = (degrees * Math.PI) / 180;
  return [CX + radius * Math.sin(radians), CY - radius * Math.cos(radians)];
};

const arcPath = (radius, from, to) => {
  const [x0, y0] = onArc(radius, from);
  const [x1, y1] = onArc(radius, to);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

const wrap = (value, count) => ((value % count) + count) % count;

// The wheel position counts ticks and never rewinds: the nearest turn that
// brings `index` under the needle.
const turnedTo = (position, index, count) => {
  const delta = wrap(index - Math.round(position), count);
  return Math.round(position) + (delta > count / 2 ? delta - count : delta);
};

// A performance's waveform, fetched once per piece: { seconds, peak: [...], rms: [...] }.
const artifactRequests = new Map();
const loadArtifact = (src) => {
  if (!artifactRequests.has(src)) {
    const request = fetch(src).then((response) => {
      if (!response.ok) throw new Error(`Waveform ${src}: HTTP ${response.status}`);
      return response.json();
    });
    request.catch(() => artifactRequests.delete(src)); // a failed load may be retried
    artifactRequests.set(src, request);
  }
  return artifactRequests.get(src);
};

// The waveform as one closed shape, mirrored about the middle of a 0-100 box.
const mirroredPath = (values) => {
  const top = values.map((value, index) => `${index},${(50 - value * 48).toFixed(1)}`);
  const bottom = values.map((value, index) => `${index},${(50 + value * 48).toFixed(1)}`).reverse();
  return `M${top.join('L')}L${bottom.join('L')}Z`;
};

/**
 * SoundDial - the sound selector: a wide dial rising from the bottom edge.
 * Every sound is a tick on a wheel that turns under a fixed needle, grouped
 * into category bands. Turn it (drag, scroll, arrows, the side steppers), pick
 * from the list of the category under the needle, or type to find a sound.
 * Resting on a sound loads it, so browsing is auditioning. `artifact`
 * ({ src, title, caption }) is the piece whose sound is loaded, when it brings a
 * still picture of its waveform: the open dial shows it on top.
 */
const SoundDial = ({ activeSoundName, onChoose, artifact = null }) => {
  const [catalog, setCatalog] = useState(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Unbounded so the wheel can keep turning the same way past the last sound.
  const [position, setPosition] = useState(0);
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const loadingRef = useRef(null);
  const dragRef = useRef(null);
  const wheelRef = useRef(0);
  const chosenRef = useRef(null);
  const needleRef = useRef(null);
  const focusSearchRef = useRef(false);
  // Taken when the dial opens and kept until it closes, so browsing never moves the list.
  const [shownArtifact, setShownArtifact] = useState(null);
  const [artifactWave, setArtifactWave] = useState(null);

  const ensureCatalog = useCallback(() => {
    loadingRef.current ||= loadSoundCatalog()
      .then((sounds) => {
        // A saved or removed sound changes the tick count; stay on the same sound.
        const at = sounds.findIndex((sound) => sound.id === needleRef.current);
        if (at >= 0) setPosition((current) => turnedTo(current, at, sounds.length));
        setCatalog(sounds);
        setFailed(false);
        return sounds;
      })
      .catch(() => {
        loadingRef.current = null;
        setFailed(true);
        return null;
      });
    return loadingRef.current;
  }, []);

  // The closed cap already shows the scale, so fetch the bank once the page is idle.
  useEffect(() => {
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(ensureCatalog, { timeout: 2500 })
      : window.setTimeout(ensureCatalog, 1200);
    return () => (window.cancelIdleCallback ? window.cancelIdleCallback(idle) : window.clearTimeout(idle));
  }, [ensureCatalog]);

  // A sound saved or removed elsewhere (the Sound tab) shows up here at once.
  useEffect(() => subscribeUserPresets(() => {
    if (!loadingRef.current) return;
    loadingRef.current = null;
    ensureCatalog();
  }), [ensureCatalog]);

  const count = catalog?.length || 0;
  const spacing = count ? 360 / count : 0;
  const focusIndex = count ? wrap(Math.round(position), count) : -1;
  const focused = count ? catalog[focusIndex] : null;
  if (focused) needleRef.current = focused.id;

  // Point the needle at whatever is loaded (on first load, or after a paste).
  useEffect(() => {
    if (!catalog || !activeSoundName || chosenRef.current === activeSoundName) return;
    const index = catalog.findIndex((sound) => sound.name === activeSoundName);
    if (index < 0) return;
    chosenRef.current = activeSoundName;
    setPosition((current) => turnedTo(current, index, catalog.length));
  }, [activeSoundName, catalog]);

  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!catalog || !text) return null;
    return catalog
      .map((sound, index) => ({ sound, index }))
      .filter(({ sound }) => `${sound.name} ${sound.category} ${sound.description || ''}`.toLowerCase().includes(text));
  }, [catalog, query]);

  const bands = useMemo(() => {
    if (!catalog) return [];
    const runs = [];
    catalog.forEach((sound, index) => {
      const last = runs[runs.length - 1];
      if (last && last.category === sound.category) last.to = index;
      else runs.push({ category: sound.category, from: index, to: index });
    });
    return runs;
  }, [catalog]);

  // The list under the needle: search results, or the focused sound's category.
  const listed = useMemo(() => {
    if (!catalog) return [];
    if (matches) return matches;
    return catalog
      .map((sound, index) => ({ sound, index }))
      .filter(({ sound }) => sound.category === focused?.category);
  }, [catalog, focused?.category, matches]);

  const turnTo = useCallback((index) => {
    setPosition((current) => turnedTo(current, index, count));
  }, [count]);

  const step = useCallback(async (direction) => {
    const sounds = catalog || await ensureCatalog();
    if (!sounds?.length) return;
    if (!matches?.length) {
      setPosition((current) => Math.round(current) + direction);
      return;
    }
    const at = matches.findIndex(({ index }) => index === wrap(Math.round(position), sounds.length));
    const next = matches[wrap((at < 0 ? (direction > 0 ? -1 : 0) : at) + direction, matches.length)];
    turnTo(next.index);
  }, [catalog, ensureCatalog, matches, position, turnTo]);

  // Typing jumps the needle to the best match.
  useEffect(() => {
    if (matches?.length) turnTo(matches[0].index);
  }, [matches, turnTo]);

  // Resting on a sound loads it.
  useEffect(() => {
    if (!focused || dragging || focused.name === chosenRef.current) return undefined;
    const timer = setTimeout(() => {
      chosenRef.current = focused.name;
      onChoose?.(focused);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [dragging, focused, onChoose]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    searchRef.current?.blur();
  }, []);

  const openDial = useCallback(() => {
    setOpen(true);
    setShownArtifact(artifact);
    ensureCatalog();
  }, [artifact, ensureCatalog]);

  useEffect(() => {
    setArtifactWave(null);
    if (!shownArtifact) return undefined;
    let current = true;
    loadArtifact(shownArtifact.src)
      .then((wave) => { if (current) setArtifactWave(wave); })
      .catch((error) => console.error('Sound dial: the piece\u2019s waveform did not load', error));
    return () => { current = false; };
  }, [shownArtifact]);

  // The hub is inert while closed, so the search can only take focus once open.
  useEffect(() => {
    if (!open || !focusSearchRef.current) return;
    focusSearchRef.current = false;
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) close();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [close, open]);

  // "/" finds a sound from anywhere on the page; letters there play notes.
  useEffect(() => {
    const onKeyDown = (event) => {
      const typing = event.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.nodeName);
      if (event.key !== '/' || typing || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      focusSearchRef.current = true;
      openDial();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openDial]);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (query) setQuery('');
      else close();
    } else if (event.key === 'Enter') {
      close();
    } else if (event.key === 'ArrowDown' || (event.key === 'ArrowRight' && event.target !== searchRef.current)) {
      event.preventDefault();
      step(1);
    } else if (event.key === 'ArrowUp' || (event.key === 'ArrowLeft' && event.target !== searchRef.current)) {
      event.preventDefault();
      step(-1);
    }
  };

  // Dragging the scale turns the wheel; a plain click jumps to the tick under it.
  const handleScalePointerDown = (event) => {
    if (!count) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const box = event.currentTarget.getBoundingClientRect();
    dragRef.current = { x: event.clientX, position, radius: RIM * (box.width / VIEW_W), moved: false, box };
  };

  const handleScalePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const travelled = event.clientX - drag.x;
    if (!drag.moved && Math.abs(travelled) < 4) return;
    drag.moved = true;
    setDragging(true);
    setPosition(drag.position - ((travelled / drag.radius) * 180) / Math.PI / spacing);
  };

  const handleScalePointerUp = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    setDragging(false);
    if (drag.moved) {
      setPosition((current) => Math.round(current));
      return;
    }
    const scale = drag.box.width / VIEW_W;
    const x = event.clientX - (drag.box.left + drag.box.width / 2);
    const y = drag.box.top + CY * scale - event.clientY;
    // Only the scale itself is a jump target; the blank face is for dragging.
    if (Math.hypot(x, y) < (BAND - 34) * scale) return;
    const degrees = (Math.atan2(x, y) * 180) / Math.PI;
    setPosition((current) => Math.round(current) + Math.round(degrees / spacing));
  };

  const handleWheel = (event) => {
    // Over the list the wheel scrolls the list; anywhere else it turns the dial.
    if (!count || event.target.closest?.('.sound-dial__list')) return;
    wheelRef.current += Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const steps = Math.trunc(wheelRef.current / WHEEL_STEP);
    if (!steps) return;
    wheelRef.current -= steps * WHEEL_STEP;
    setPosition((current) => Math.round(current) + steps);
  };

  const handleRemove = () => {
    needleRef.current = catalog[wrap(focusIndex - 1, count)].id;
    deleteUserPreset(focused.id);
    step(-1);
  };

  const matched = matches && new Set(matches.map(({ index }) => index));
  const label = focused?.name || activeSoundName || 'Sound';

  return (
    <div className="sound-dial-dock">
      <section
        ref={rootRef}
        className={`sound-dial ${open ? 'sound-dial--open' : ''}`}
        aria-label="Sound selector"
        onKeyDown={handleKeyDown}
        onWheel={open ? handleWheel : undefined}
      >
        <svg className="sound-dial__face" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden="true">
          <path className="sound-dial__disc" d={`M0 ${VIEW_H}A${RADIUS} ${RADIUS} 0 0 1 ${VIEW_W} ${VIEW_H}Z`} />
          <g
            className={`sound-dial__wheel ${dragging ? 'sound-dial__wheel--held' : ''}`}
            style={{ transform: `rotate(${-position * spacing}deg)`, transformOrigin: `${CX}px ${CY}px` }}
          >
            {bands.map((band) => {
              const from = (band.from - 0.5) * spacing + 0.8;
              const to = (band.to + 0.5) * spacing - 0.8;
              const id = `sound-dial-band-${band.from}`;
              // A label lives inside its own band: tightened a little if it
              // nearly fits, left off if it does not (the hub names the category).
              const room = ((to - from) * Math.PI * (BAND - 18)) / 180 - 6;
              const natural = band.category.length * BAND_LETTER;
              return (
                <g key={id}>
                  <path className="sound-dial__band" d={arcPath(BAND, from, to)} />
                  {natural <= room * 1.15 && (
                    <>
                      <path id={id} d={arcPath(BAND - 18, from, to)} fill="none" />
                      <text className="sound-dial__band-name">
                        <textPath href={`#${id}`} startOffset="3" textLength={Math.min(natural, room)}>
                          {band.category.toUpperCase()}
                        </textPath>
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            {catalog?.map((sound, index) => {
              const first = index === 0 || catalog[index - 1].category !== sound.category;
              const state = index === focusIndex
                ? 'sound-dial__tick--current'
                : matched && !matched.has(index) ? 'sound-dial__tick--muted' : '';
              return (
                <line
                  key={sound.id}
                  className={`sound-dial__tick ${state}`}
                  x1={CX}
                  x2={CX}
                  y1={CY - RIM + 6}
                  y2={CY - RIM + (index === focusIndex ? 30 : first ? 22 : 14)}
                  transform={`rotate(${index * spacing} ${CX} ${CY})`}
                />
              );
            })}
          </g>
          <path className="sound-dial__needle" d={`M${CX - 9} 0h18l-9 13z`} />
        </svg>

        <div
          className="sound-dial__scale"
          onPointerDown={handleScalePointerDown}
          onPointerMove={handleScalePointerMove}
          onPointerUp={handleScalePointerUp}
          onPointerCancel={handleScalePointerUp}
        />

        <button
          type="button"
          className="sound-dial__name"
          onClick={() => (open ? close() : openDial())}
          aria-expanded={open}
          aria-label={open ? `Close the sound selector (${label})` : `Choose a sound (${label})`}
        >
          {label}
        </button>

        <div className="sound-dial__hub" inert={open ? undefined : ''}>
          {shownArtifact && (
            <figure className="sound-dial__artifact">
              <svg
                className="sound-dial__wave"
                viewBox={`0 0 ${Math.max(1, (artifactWave?.peak.length || 1) - 1)} 100`}
                preserveAspectRatio="none"
                role="img"
                aria-label={`The waveform of ${shownArtifact.title}`}
              >
                {artifactWave && (
                  <>
                    <path className="sound-dial__wave-peak" d={mirroredPath(artifactWave.peak)} />
                    <path className="sound-dial__wave-body" d={mirroredPath(artifactWave.rms)} />
                  </>
                )}
              </svg>
              <figcaption className="sound-dial__artifact-caption">
                {[shownArtifact.title, shownArtifact.caption].filter(Boolean).join(' · ')}
              </figcaption>
            </figure>
          )}
          {/* The steppers sit here, inside the scale, so the whole ring stays draggable. */}
          <div className="sound-dial__finder">
            <button type="button" className="sound-dial__step" onClick={() => step(-1)} aria-label="Previous sound">
              <span aria-hidden="true">‹</span>
            </button>
            <input
              ref={searchRef}
              type="search"
              className="sound-dial__search"
              placeholder="Find a sound"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              role="combobox"
              aria-label="Find a sound"
              aria-expanded={open}
              aria-controls="sound-dial-list"
              aria-activedescendant={focused ? `sound-dial-option-${focusIndex}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="sound-dial__step" onClick={() => step(1)} aria-label="Next sound">
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <ul id="sound-dial-list" className="sound-dial__list" role="listbox" aria-label={matches ? 'Matching sounds' : focused?.category}>
            {listed.map(({ sound, index }) => (
              <li
                key={sound.id}
                id={`sound-dial-option-${index}`}
                role="option"
                aria-selected={index === focusIndex}
                className={`sound-dial__option ${index === focusIndex ? 'sound-dial__option--current' : ''}`}
                onClick={() => turnTo(index)}
              >
                {sound.name}
              </li>
            ))}
            {matches?.length === 0 && <li className="sound-dial__empty">Nothing matches “{query.trim()}”.</li>}
          </ul>
          {/* Last, where the dial is widest: a description runs to a hundred characters. */}
          <p className="sound-dial__about" title={focused?.description}>
            {failed
              ? 'The sounds could not be loaded.'
              : focused ? focused.description || focused.category : 'Loading sounds'}
            {focused?.removable && (
              <button type="button" className="sound-dial__remove" onClick={handleRemove}>
                Remove
              </button>
            )}
          </p>
        </div>
      </section>
    </div>
  );
};

export default React.memo(SoundDial);
