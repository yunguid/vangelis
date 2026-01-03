import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initAudioContext, playNote, stopNote as audioStopNote } from '../utils/audio.js';
import { audioEngine } from '../utils/audioEngine.js';

const BASE_OCTAVE = 4;
const MIN_OFFSET = -5;
const MAX_OFFSET = 2;
const NOTE_DURATION = 1.0;

const WHITE_KEY_HEIGHT = 'clamp(72px, 18vh, 120px)';
const BLACK_KEY_WIDTH = 'clamp(24px, 4.2vw, 48px)';
const BLACK_KEY_HEIGHT = 'clamp(52px, 17vh, 100px)';
const BLACK_KEY_OFFSET_RATIO = 2 / 3;

const WHITE_KEYS = [
  { name: 'C', rel: 0 },
  { name: 'D', rel: 0 },
  { name: 'E', rel: 0 },
  { name: 'F', rel: 0 },
  { name: 'G', rel: 0 },
  { name: 'A', rel: 0 },
  { name: 'B', rel: 0 },
  { name: 'C', rel: 1 },
  { name: 'D', rel: 1 },
  { name: 'E', rel: 1 },
  { name: 'F', rel: 1 }
];

const BLACK_KEYS = [
  { name: 'C#', rel: 0 },
  { name: 'D#', rel: 0 },
  { name: 'F#', rel: 0 },
  { name: 'G#', rel: 0 },
  { name: 'A#', rel: 0 },
  { name: 'C#', rel: 1 },
  { name: 'D#', rel: 1 }
];

const BLACK_PLACEMENT = {
  'C#': 0,
  'D#': 1,
  'F#': 3,
  'G#': 4,
  'A#': 5
};

const KEYBOARD_MAP = {
  a: { name: 'C', delta: 0 },
  s: { name: 'D', delta: 0 },
  d: { name: 'E', delta: 0 },
  f: { name: 'F', delta: 0 },
  g: { name: 'G', delta: 0 },
  h: { name: 'A', delta: 0 },
  j: { name: 'B', delta: 0 },
  k: { name: 'C', delta: 1 },
  l: { name: 'D', delta: 1 },
  ';': { name: 'E', delta: 1 },
  "'": { name: 'F', delta: 1 },
  w: { name: 'C#', delta: 0 },
  e: { name: 'D#', delta: 0 },
  t: { name: 'F#', delta: 0 },
  y: { name: 'G#', delta: 0 },
  u: { name: 'A#', delta: 0 },
  o: { name: 'C#', delta: 1 },
  p: { name: 'D#', delta: 1 }
};

const KEY_LABELS = {
  C4: 'A',
  D4: 'S',
  E4: 'D',
  F4: 'F',
  G4: 'G',
  A4: 'H',
  B4: 'J',
  C5: 'K',
  D5: 'L',
  E5: ';',
  F5: "'",
  'C#4': 'W',
  'D#4': 'E',
  'F#4': 'T',
  'G#4': 'Y',
  'A#4': 'U',
  'C#5': 'O',
  'D#5': 'P'
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const SynthKeyboard = ({ waveformType = 'Sine', audioParams = {}, wasmLoaded = false }) => {
  const keyboardRef = useRef(null);
  const keyElementsRef = useRef(new Map());
  const activeNotesRef = useRef(new Map());
  const pointerToNoteRef = useRef(new Map());
  const keyToNoteRef = useRef(new Map());
  const keyboardVelocityRef = useRef(new Map());
  const preloadedNoteCacheRef = useRef(new Set());

  const audioParamsRef = useRef(audioParams);
  const waveformRef = useRef(waveformType);
  const wasmReadyRef = useRef(wasmLoaded);
  const octaveOffsetRef = useRef(0);

  const visualQueueRef = useRef(new Map());
  const visualRafRef = useRef(null);
  const velocityPendingRef = useRef(null);
  const velocityRafRef = useRef(null);

  const [octaveOffset, setOctaveOffset] = useState(0);
  const [velocityDisplay, setVelocityDisplay] = useState(100);

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

  useEffect(() => () => {
    if (visualRafRef.current) cancelAnimationFrame(visualRafRef.current);
    if (velocityRafRef.current) cancelAnimationFrame(velocityRafRef.current);
  }, []);

  useEffect(() => {
    if (typeof PerformanceObserver === 'undefined' || typeof window === 'undefined') {
      return () => undefined;
    }
    let observer;
    try {
      observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (!entries.length) return;
        const entry = entries[entries.length - 1];
        window.__vangelisMetrics = {
          ...(window.__vangelisMetrics || {}),
          lastLongTask: {
            duration: entry.duration,
            startTime: entry.startTime
          },
          lastUpdated: Date.now()
        };
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch (_) {
      if (observer) observer.disconnect();
      return () => undefined;
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  const scheduleVisualUpdate = useCallback((noteId, isActive) => {
    visualQueueRef.current.set(noteId, isActive);
    if (visualRafRef.current) return;
    visualRafRef.current = requestAnimationFrame(() => {
      visualRafRef.current = null;
      visualQueueRef.current.forEach((active, id) => {
        const element = keyElementsRef.current.get(id);
        if (element) {
          if (active) {
            element.dataset.active = 'true';
          } else {
            delete element.dataset.active;
          }
        }
      });
      visualQueueRef.current.clear();
    });
  }, []);

  const updateVelocityDisplay = useCallback((normalizedVelocity) => {
    const midiValue = Math.round(clamp(normalizedVelocity, 0, 1) * 126 + 1);
    velocityPendingRef.current = midiValue;
    if (velocityRafRef.current) return;
    velocityRafRef.current = requestAnimationFrame(() => {
      velocityRafRef.current = null;
      if (velocityPendingRef.current != null) {
        setVelocityDisplay(velocityPendingRef.current);
      }
    });
  }, []);

  const getNoteMeta = useCallback((noteName, relativeOctave) => {
    const octave = clamp(BASE_OCTAVE + octaveOffsetRef.current + relativeOctave, MIN_OFFSET + BASE_OCTAVE, MAX_OFFSET + BASE_OCTAVE + 1);
    const noteId = `${noteName}${octave}`;
    const frequency = audioEngine.getFrequency(noteName, octave);
    return {
      noteName,
      octave,
      noteId,
      frequency
    };
  }, []);

  const registerKey = useCallback((noteId, node) => {
    if (!noteId) return;
    if (!node) {
      keyElementsRef.current.delete(noteId);
      return;
    }
    keyElementsRef.current.set(noteId, node);
  }, []);

  const startNote = useCallback((noteMeta, { pointerId = null, velocity = 0.85 } = {}) => {
    if (!wasmReadyRef.current || !noteMeta || !noteMeta.frequency) {
      return;
    }
    if (activeNotesRef.current.has(noteMeta.noteId)) {
      return;
    }

    initAudioContext();
    const velocityNormalized = clamp(velocity, 0.05, 1);
    const perfStart = typeof performance !== 'undefined' ? performance.now() : null;

    const result = playNote(
      noteMeta.frequency,
      NOTE_DURATION,
      waveformRef.current,
      audioParamsRef.current,
      {
        noteId: noteMeta.noteId,
        velocity: velocityNormalized
      }
    );

    if (result) {
      activeNotesRef.current.set(noteMeta.noteId, {
        voiceId: result.voiceId,
        pointerId
      });
      if (pointerId !== null) {
        pointerToNoteRef.current.set(pointerId, noteMeta.noteId);
      }
      scheduleVisualUpdate(noteMeta.noteId, true);
      updateVelocityDisplay(velocityNormalized);
      if (perfStart !== null && typeof window !== 'undefined') {
        const latency = performance.now() - perfStart;
        const ctxTime = audioEngine.context ? audioEngine.context.currentTime : null;
        window.__vangelisMetrics = {
          ...(window.__vangelisMetrics || {}),
          lastNoteLatencyMs: latency,
          lastNoteFrequency: noteMeta.frequency,
          audioContextTime: ctxTime,
          lastUpdated: Date.now()
        };
      }
    }
  }, [scheduleVisualUpdate, updateVelocityDisplay]);

  const stopNote = useCallback((noteId, pointerId = null) => {
    if (!noteId) return;
    const entry = activeNotesRef.current.get(noteId);
    if (!entry) return;

    // Use the audio engine's stopNote for proper ADSR release
    audioStopNote(noteId);

    activeNotesRef.current.delete(noteId);
    if (pointerId !== null) {
      pointerToNoteRef.current.delete(pointerId);
    } else {
      for (const [id, mappedNote] of pointerToNoteRef.current) {
        if (mappedNote === noteId) {
          pointerToNoteRef.current.delete(id);
        }
      }
    }
    scheduleVisualUpdate(noteId, false);
  }, [scheduleVisualUpdate]);

  const switchPointerNote = useCallback((pointerId, nextMeta, velocityHint) => {
    if (!nextMeta) return;
    const currentNoteId = pointerToNoteRef.current.get(pointerId);
    if (currentNoteId === nextMeta.noteId) return;
    if (currentNoteId) {
      stopNote(currentNoteId, pointerId);
    }
    startNote(nextMeta, { pointerId, velocity: velocityHint });
  }, [startNote, stopNote]);

  const preloadNoteMeta = useCallback((noteMeta) => {
    // No preloading needed for oscillator-based synthesis
  }, []);

  const velocityFromKeyboard = useCallback((key) => {
    const now = performance.now();
    const last = keyboardVelocityRef.current.get(key) || 0;
    keyboardVelocityRef.current.set(key, now);
    if (!last) return 0.85;
    const delta = now - last;
    return clamp(1 - delta / 250, 0.3, 1);
  }, []);

  const handleKeyboardDown = useCallback((event) => {
    const key = event.key.toLowerCase();

    if (key === 'z') {
      event.preventDefault();
      setOctaveOffset((prev) => clamp(prev - 1, MIN_OFFSET, MAX_OFFSET));
      return;
    }
    if (key === 'x') {
      event.preventDefault();
      setOctaveOffset((prev) => clamp(prev + 1, MIN_OFFSET, MAX_OFFSET));
      return;
    }

    const mapping = KEYBOARD_MAP[key];
    if (!mapping) {
      return;
    }

    event.preventDefault();
    if (keyToNoteRef.current.has(key)) {
      return;
    }

    const meta = getNoteMeta(mapping.name, mapping.delta);
    if (!meta.frequency) {
      return;
    }

    const velocity = velocityFromKeyboard(key);
    keyToNoteRef.current.set(key, meta.noteId);
    startNote(meta, { velocity });
  }, [getNoteMeta, startNote, velocityFromKeyboard]);

  const handleKeyboardUp = useCallback((event) => {
    const key = event.key.toLowerCase();
    const noteId = keyToNoteRef.current.get(key);
    if (!noteId) return;
    event.preventDefault();
    keyToNoteRef.current.delete(key);
    stopNote(noteId);
  }, [stopNote]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardDown, { passive: false });
    window.addEventListener('keyup', handleKeyboardUp, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyboardDown);
      window.removeEventListener('keyup', handleKeyboardUp);
    };
  }, [handleKeyboardDown, handleKeyboardUp]);

  useEffect(() => {
    const container = keyboardRef.current;
    if (!container) return;

    const getMetaFromElement = (element) => {
      if (!element) return null;
      const noteId = element.dataset.note;
      const noteName = element.dataset.name;
      const octave = Number(element.dataset.octave);
      const frequency = Number(element.dataset.frequency);
      if (!noteId || !noteName || Number.isNaN(octave) || Number.isNaN(frequency)) return null;
      return {
        noteId,
        noteName,
        octave,
        frequency
      };
    };

    const pointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      const keyElement = event.target.closest('[data-note]');
      if (!keyElement) return;
      event.preventDefault();
      if (keyElement.setPointerCapture) {
        try {
          keyElement.setPointerCapture(event.pointerId);
        } catch (_) {
          /* capture might fail on some browsers */
        }
      }
      const meta = getMetaFromElement(keyElement);
      const velocity = event.pressure > 0 ? clamp(event.pressure, 0.05, 1) : 0.85;
      startNote(meta, { pointerId: event.pointerId, velocity });
    };

    const pointerMove = (event) => {
      if (!pointerToNoteRef.current.has(event.pointerId)) return;
      const element = document.elementFromPoint(event.clientX, event.clientY);
      const keyElement = element ? element.closest('[data-note]') : null;
      if (!keyElement) return;
      const meta = getMetaFromElement(keyElement);
      const velocity = event.pressure > 0 ? clamp(event.pressure, 0.05, 1) : 0.85;
      switchPointerNote(event.pointerId, meta, velocity);
    };

    const pointerUp = (event) => {
      const noteId = pointerToNoteRef.current.get(event.pointerId);
      if (noteId) {
        stopNote(noteId, event.pointerId);
      }
      const keyElement = event.target.closest('[data-note]');
      if (keyElement && keyElement.releasePointerCapture) {
        try {
          keyElement.releasePointerCapture(event.pointerId);
        } catch (_) {
          /* already released */
        }
      }
    };

    const lostPointerCapture = (event) => {
      const noteId = pointerToNoteRef.current.get(event.pointerId);
      if (noteId) {
        stopNote(noteId, event.pointerId);
      }
    };

    const pointerEnter = (event) => {
      const keyElement = event.target.closest('[data-note]');
      if (!keyElement) return;
      const meta = getMetaFromElement(keyElement);
      preloadNoteMeta(meta);
    };

    const focusIn = (event) => {
      const keyElement = event.target.closest('[data-note]');
      if (!keyElement) return;
      const meta = getMetaFromElement(keyElement);
      preloadNoteMeta(meta);
    };

    container.addEventListener('pointerdown', pointerDown, { passive: false });
    container.addEventListener('pointermove', pointerMove, { passive: false });
    container.addEventListener('pointerup', pointerUp, { passive: false });
    container.addEventListener('pointercancel', pointerUp, { passive: false });
    container.addEventListener('lostpointercapture', lostPointerCapture, true);
    container.addEventListener('pointerenter', pointerEnter, true);
    container.addEventListener('focusin', focusIn);

    return () => {
      container.removeEventListener('pointerdown', pointerDown);
      container.removeEventListener('pointermove', pointerMove);
      container.removeEventListener('pointerup', pointerUp);
      container.removeEventListener('pointercancel', pointerUp);
      container.removeEventListener('lostpointercapture', lostPointerCapture, true);
      container.removeEventListener('pointerenter', pointerEnter, true);
      container.removeEventListener('focusin', focusIn);
    };
  }, [preloadNoteMeta, startNote, stopNote, switchPointerNote]);

  const whiteKeyMetas = useMemo(() => {
    return WHITE_KEYS.map((definition, index) => {
      const meta = getNoteMeta(definition.name, definition.rel);
      return {
        ...meta,
        order: index
      };
    });
  }, [getNoteMeta]);

  const blackKeyMetas = useMemo(() => {
    return BLACK_KEYS.map((definition) => {
      const meta = getNoteMeta(definition.name, definition.rel);
      const placementIndex = BLACK_PLACEMENT[definition.name] + (definition.rel === 1 ? 7 : 0);
      const positionRatio = clamp(
        (placementIndex + BLACK_KEY_OFFSET_RATIO) / WHITE_KEYS.length,
        0,
        1
      );
      const leftOffset = `${positionRatio * 100}%`;
      return {
        ...meta,
        leftOffset
      };
    });
  }, [getNoteMeta]);

  return (
    <div className="keyboard-wrapper" ref={keyboardRef}>
      <div
        className="white-keys"
        style={{
          gridTemplateColumns: `repeat(${whiteKeyMetas.length}, minmax(0, 1fr))`
        }}
      >
        {whiteKeyMetas.map((meta) => (
          <div
            key={meta.noteId}
            ref={(node) => registerKey(meta.noteId, node)}
            className="key-white"
            data-note={meta.noteId}
            data-name={meta.noteName}
            data-octave={meta.octave}
            data-frequency={meta.frequency}
            tabIndex={0}
            style={{
              height: WHITE_KEY_HEIGHT
            }}
          >
            <span className="note-label">{meta.noteName}</span>
            <span className="key-label">{KEY_LABELS[meta.noteId] || ''}</span>
            <span className="key-active-indicator" aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className="black-keys-layer">
        {blackKeyMetas.map((meta) => (
          <div
            key={meta.noteId}
            ref={(node) => registerKey(meta.noteId, node)}
            className="key-black"
            data-note={meta.noteId}
            data-name={meta.noteName}
            data-octave={meta.octave}
            data-frequency={meta.frequency}
            tabIndex={0}
            style={{
              left: meta.leftOffset,
              width: BLACK_KEY_WIDTH,
              height: BLACK_KEY_HEIGHT
            }}
          >
            <span className="note-label">{meta.noteName}</span>
            <span className="key-label">{KEY_LABELS[meta.noteId] || ''}</span>
            <span className="key-active-indicator" aria-hidden="true" />
          </div>
        ))}
      </div>

      <div className="keyboard-meta">
        Keys A-; | Sharps W-P | Z/X octave ({octaveOffset}) | Velocity {velocityDisplay}
      </div>
    </div>
  );
};

export default SynthKeyboard;
