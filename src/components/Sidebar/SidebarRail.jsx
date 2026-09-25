import React, { useEffect, useRef, useState } from 'react';
import { PIANO_ROLL_HREF } from '../../utils/routes.js';
import './Sidebar.css';

let pianoRollRoutePromise;

const preloadPianoRollRoute = () => {
  pianoRollRoutePromise ||= import('../../pages/PianoRollPage.jsx');
  pianoRollRoutePromise.catch(() => undefined);
};

// The wave behind the controls is desktop decoration: it is fetched off the
// route's critical path, and never on a phone, where the dock is a bottom bar.
const DockWave = React.lazy(() => import('./DockWave.jsx'));

const HIDE_DELAY_MS = 320;

const TABS = [
  { id: 'sound', label: 'Sound', noun: 'controls', title: 'Sound controls' },
  { id: 'midi', label: 'MIDI', noun: 'browser', title: 'MIDI library' }
];

const SidebarRail = ({
  isOpen = false,
  activeTab = 'sound',
  disabled = false,
  currentView = 'keyboard',
  isMidiPlaying = false,
  onTabSelect = () => {},
  onPanelPreload = () => {}
}) => {
  const rootRef = useRef(null);
  const hideTimerRef = useRef(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [waveWanted, setWaveWanted] = useState(false);
  const shown = hovered || focused || pinned || isOpen;

  const reveal = () => {
    clearTimeout(hideTimerRef.current);
    setHovered(true);
  };
  const release = () => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setHovered(false), HIDE_DELAY_MS);
  };

  // At desktop widths, mount the wave once the page is idle, or at once if the
  // dock comes out first.
  useEffect(() => {
    if (waveWanted || !window.matchMedia?.('(min-width: 901px)').matches) return undefined;
    if (shown || !window.requestIdleCallback) {
      setWaveWanted(true);
      return undefined;
    }
    const idleId = window.requestIdleCallback(() => setWaveWanted(true), { timeout: 1000 });
    return () => window.cancelIdleCallback(idleId);
  }, [waveWanted, shown]);

  useEffect(() => {
    if (!shown) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      clearTimeout(hideTimerRef.current);
      setHovered(false);
      setPinned(false);
      if (rootRef.current.contains(document.activeElement)) document.activeElement.blur();
    };
    const onPointerDown = (event) => {
      if (!rootRef.current.contains(event.target)) setPinned(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      // A hide is only ever pending while the dock is shown, so this also
      // clears it on unmount.
      clearTimeout(hideTimerRef.current);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [shown]);

  return (
    // onFocus/onBlur bubble here as focusin/focusout (React does this itself,
    // preact/compat maps them). Only keyboard focus holds the dock out: a mouse
    // click that focuses a control must not keep it out once the pointer leaves.
    <div
      className="sidebar-rail"
      ref={rootRef}
      data-dock={shown ? 'shown' : 'hidden'}
      onFocus={(event) => setFocused(event.target.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
    >
      <div className="dock__edge" onPointerEnter={reveal} onPointerLeave={release} />
      <div className="dock__body" onPointerEnter={reveal} onPointerLeave={release}>
        {waveWanted && (
          <React.Suspense fallback={null}>
            <DockWave currentView={currentView} />
          </React.Suspense>
        )}
        <div className="sidebar-rail__nav">
          {TABS.map((tab) => {
            const expanded = !disabled && isOpen && activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={tab.id === 'midi' && !disabled && isMidiPlaying
                  ? 'sidebar-rail__btn sidebar-rail__btn--playing'
                  : 'sidebar-rail__btn'}
                data-icon={tab.id}
                onClick={() => onTabSelect(tab.id)}
                onPointerEnter={() => onPanelPreload(tab.id)}
                onFocus={() => onPanelPreload(tab.id)}
                disabled={disabled}
                aria-label={disabled
                  ? `${tab.label} panel unavailable on this page`
                  : `${expanded ? 'Close' : 'Open'} ${tab.label} ${tab.noun}`}
                aria-expanded={expanded}
                title={tab.title}
              />
            );
          })}
          <a
            className="sidebar-rail__btn"
            data-icon="keys"
            href="#/"
            title="Keyboard"
            aria-label="Open the keyboard player"
            aria-current={currentView === 'keyboard' ? 'page' : undefined}
          />
          <a
            className="sidebar-rail__btn"
            data-icon="roll"
            href={PIANO_ROLL_HREF}
            title="Editor"
            aria-label="Open the pattern editor"
            aria-current={currentView === 'editor' ? 'page' : undefined}
            onPointerEnter={preloadPianoRollRoute}
            onFocus={preloadPianoRollRoute}
          />
        </div>
      </div>
      <div className="dock__notch" onClick={() => setPinned((value) => !value)} />
    </div>
  );
};

export default React.memo(SidebarRail);
