import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WHITE_KEYS,
  BLACK_KEYS,
  BLACK_PLACEMENT,
  BLACK_KEY_OFFSET_RATIO,
  BASE_OCTAVE,
  MIN_OFFSET,
  MAX_OFFSET,
  clamp
} from './constants';
import { useVisualFeedback } from './hooks/useVisualFeedback';
import { useNotePlayback } from './hooks/useNotePlayback';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { usePointerInput } from './hooks/usePointerInput';
import Key from './components/Key';
import { getNoteMeta } from './utils/noteMeta';
import '../../styles/keyboard.css';

const COMPACT_QUERY = '(max-width: 900px)';

const matchesCompact = () => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia(COMPACT_QUERY).matches
);

const TOUCH_VELOCITIES = [
  { label: 'Soft', value: 0.55 },
  { label: 'Med', value: 0.85 },
  { label: 'Hard', value: 1 }
];

const SynthKeyboard = ({ waveformType = 'Sine', audioParams = {}, wasmLoaded = false, externalActiveNotes = new Set() }) => {
  const keyboardRef = useRef(null);
  const keyElementsRef = useRef(new Map());

  const audioParamsRef = useRef(audioParams);
  const waveformRef = useRef(waveformType);
  const wasmReadyRef = useRef(wasmLoaded);
  const octaveOffsetRef = useRef(0);

  const [octaveOffset, setOctaveOffset] = useState(0);

  // Compact mode: fewer, fatter keys plus an on-screen octave/velocity bar,
  // because Z/X and C/V don't exist on a touch screen.
  const [isCompact, setIsCompact] = useState(matchesCompact);
  const [touchVelocity, setTouchVelocity] = useState(0.85);
  const touchVelocityRef = useRef(touchVelocity);

  useEffect(() => {
    touchVelocityRef.current = touchVelocity;
  }, [touchVelocity]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(COMPACT_QUERY);
    const onChange = (event) => setIsCompact(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // Sync refs with props/state
  useEffect(() => {
    audioParamsRef.current = audioParams;
  }, [audioParams]);

  useEffect(() => {
    waveformRef.current = waveformType;
  }, [waveformType]);

  useEffect(() => {
    wasmReadyRef.current = wasmLoaded;
  }, [wasmLoaded]);

  useEffect(() => {
    octaveOffsetRef.current = octaveOffset;
  }, [octaveOffset]);

  // Visual feedback (RAF-batched updates)
  const { scheduleVisualUpdate, updateVelocityDisplay } = useVisualFeedback(keyElementsRef);

  // Audio playback
  const { startNote, stopNote, switchPointerNote, pointerToNoteRef } = useNotePlayback({
    waveformRef,
    audioParamsRef,
    wasmReadyRef,
    scheduleVisualUpdate,
    updateVelocityDisplay
  });

  // Keyboard input (Z/X for octave, A-L for notes)
  useKeyboardInput({
    octaveOffsetRef,
    setOctaveOffset,
    startNote,
    stopNote
  });

  // Pointer/touch input
  usePointerInput({
    keyboardRef,
    pointerToNoteRef,
    startNote,
    stopNote,
    switchPointerNote,
    touchVelocityRef
  });

  // Register key elements for visual feedback
  const registerKey = useCallback((noteId, node) => {
    if (!noteId) return;
    if (!node) {
      keyElementsRef.current.delete(noteId);
      return;
    }
    keyElementsRef.current.set(noteId, node);
  }, []);

  // Compact keyboards show one octave plus the next C: fewer keys means each
  // one is wide enough for a thumb.
  const activeWhiteKeys = useMemo(
    () => (isCompact ? WHITE_KEYS.slice(0, 8) : WHITE_KEYS),
    [isCompact]
  );
  const activeBlackKeys = useMemo(
    () => (isCompact ? BLACK_KEYS.filter((key) => key.rel === 0) : BLACK_KEYS),
    [isCompact]
  );

  // Compute key metadata based on current octave
  const whiteKeyMetas = useMemo(() => {
    return activeWhiteKeys.map((definition, index) => {
      const { octave, noteId, frequency } = getNoteMeta(
        definition.name,
        definition.rel,
        octaveOffset
      );
      return {
        noteName: definition.name,
        octave,
        noteId,
        frequency,
        order: index
      };
    });
  }, [octaveOffset, activeWhiteKeys]);

  const blackKeyMetas = useMemo(() => {
    return activeBlackKeys.map((definition) => {
      const { octave, noteId, frequency } = getNoteMeta(
        definition.name,
        definition.rel,
        octaveOffset
      );
      const placementIndex = BLACK_PLACEMENT[definition.name] + (definition.rel === 1 ? 7 : 0);
      const positionRatio = clamp(
        (placementIndex + BLACK_KEY_OFFSET_RATIO) / activeWhiteKeys.length,
        0,
        1
      );
      const leftOffset = `${positionRatio * 100}%`;
      return {
        noteName: definition.name,
        octave,
        noteId,
        frequency,
        leftOffset
      };
    });
  }, [octaveOffset, activeBlackKeys, activeWhiteKeys]);

  const shiftOctave = useCallback((delta) => {
    setOctaveOffset((prev) => clamp(prev + delta, MIN_OFFSET, MAX_OFFSET));
  }, []);

  return (
    <>
    <div className="keyboard-wrapper" ref={keyboardRef}>
      <div
        className="white-keys"
        style={{ gridTemplateColumns: `repeat(${whiteKeyMetas.length}, minmax(0, 1fr))` }}
      >
        {whiteKeyMetas.map((meta) => (
          <Key
            key={meta.noteId}
            meta={meta}
            registerKey={registerKey}
            variant="white"
            isExternalActive={externalActiveNotes.has(meta.noteId)}
          />
        ))}
      </div>

      <div className="black-keys-layer">
        {blackKeyMetas.map((meta) => (
          <Key
            key={meta.noteId}
            meta={meta}
            registerKey={registerKey}
            variant="black"
            isExternalActive={externalActiveNotes.has(meta.noteId)}
          />
        ))}
      </div>
    </div>

    {isCompact && (
      <div className="keyboard-touch-bar">
        <div className="keyboard-touch-bar__octave" role="group" aria-label="Octave">
          <button
            type="button"
            className="keyboard-touch-bar__btn"
            onClick={() => shiftOctave(-1)}
            disabled={octaveOffset <= MIN_OFFSET}
            aria-label="Octave down"
          >
            &minus;
          </button>
          <span className="keyboard-touch-bar__readout" aria-live="polite">
            C{BASE_OCTAVE + octaveOffset}
          </span>
          <button
            type="button"
            className="keyboard-touch-bar__btn"
            onClick={() => shiftOctave(1)}
            disabled={octaveOffset >= MAX_OFFSET}
            aria-label="Octave up"
          >
            +
          </button>
        </div>
        <div className="keyboard-touch-bar__velocity" role="group" aria-label="Touch velocity">
          {TOUCH_VELOCITIES.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              className={`keyboard-touch-bar__vel ${touchVelocity === value ? 'keyboard-touch-bar__vel--active' : ''}`}
              onClick={() => setTouchVelocity(value)}
              aria-pressed={touchVelocity === value}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    )}
    </>
  );
};

export default React.memo(SynthKeyboard);
