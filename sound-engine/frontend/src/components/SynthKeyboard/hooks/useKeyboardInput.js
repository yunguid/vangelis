import { useCallback, useEffect, useRef } from 'react';
import { KEYBOARD_MAP, MIN_OFFSET, MAX_OFFSET, clamp } from '../constants';
import { getNoteMeta } from '../utils/noteMeta';

export function useKeyboardInput({
  octaveOffsetRef,
  setOctaveOffset,
  startNote,
  stopNote
}) {
  const keyToNoteRef = useRef(new Map());
  const keyboardVelocityRef = useRef(new Map());

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

    const meta = getNote(mapping.name, mapping.delta);
    if (!meta.frequency) {
      return;
    }

    const velocity = velocityFromKeyboard(key);
    keyToNoteRef.current.set(key, meta.noteId);
    startNote(meta, { velocity });
  }, [getNoteMeta, setOctaveOffset, startNote, velocityFromKeyboard]);

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
}
