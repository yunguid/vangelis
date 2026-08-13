import { useCallback, useEffect, useRef } from 'react';
import { KEYBOARD_MAP, MIN_OFFSET, MAX_OFFSET, clamp } from '../constants';
import { getNoteMeta } from '../utils/noteMeta';

const isTextEntryTarget = (target) => {
  const tagName = target?.tagName;
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  return !!target?.isContentEditable;
};

export function useKeyboardInput({
  octaveOffsetRef,
  setOctaveOffset,
  startNote,
  stopNote
}) {
  const keyToNoteRef = useRef(null);
  if (!keyToNoteRef.current) keyToNoteRef.current = new Map();
  const keyboardVelocityRef = useRef(null);
  if (!keyboardVelocityRef.current) keyboardVelocityRef.current = new Map();

  const velocityFromKeyboard = useCallback((key) => {
    const now = performance.now();
    const last = keyboardVelocityRef.current.get(key) || 0;
    keyboardVelocityRef.current.set(key, now);
    if (!last) return 0.85;
    const delta = now - last;
    return clamp(1 - delta / 250, 0.3, 1);
  }, []);

  const getNote = useCallback((noteName, relativeOctave) => {
    return getNoteMeta(noteName, relativeOctave, octaveOffsetRef.current);
  }, [octaveOffsetRef]);

  const handleKeyboardDown = useCallback((event) => {
    if (isTextEntryTarget(event.target)) {
      return;
    }
    // Modifier chords (Cmd+Z, Ctrl+A, ...) belong to the browser/OS — never
    // swallow them into notes or octave changes. Keyup stays unguarded so a
    // release still reaches the held-note map even if a modifier went down
    // after the note started.
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const key = event.key.toLowerCase();
    // Held notes are keyed by the physical key (event.code) so Shift changing
    // event.key between press and release (';' -> ':') cannot orphan a note.
    const physicalKey = event.code || key;

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
    if (keyToNoteRef.current.has(physicalKey)) {
      return;
    }

    const meta = getNote(mapping.name, mapping.delta);
    if (!meta.frequency) {
      return;
    }

    const performanceProbe = typeof window !== 'undefined'
      ? window.__vangelisPerf
      : null;
    const handlerStart = performanceProbe && typeof performance !== 'undefined'
      ? performance.now()
      : null;
    try {
      const velocity = velocityFromKeyboard(physicalKey);
      // Register ownership only when startNote accepts the request — if the
      // note is already held by another input (e.g. a pointer), this keyup
      // must not be able to kill that voice.
      if (startNote(meta, { velocity }) !== false) {
        keyToNoteRef.current.set(physicalKey, meta.noteId);
      }
    } finally {
      if (handlerStart !== null) {
        performanceProbe?.recordInteraction?.(
          'input.keyboard.keydown.handler',
          performance.now() - handlerStart,
          { key }
        );
      }
    }
  }, [getNote, setOctaveOffset, startNote, velocityFromKeyboard]);

  const handleKeyboardUp = useCallback((event) => {
    const physicalKey = event.code || event.key.toLowerCase();
    const noteId = keyToNoteRef.current.get(physicalKey);
    if (!noteId) return;
    event.preventDefault();
    keyToNoteRef.current.delete(physicalKey);
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
}
