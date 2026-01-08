import { useEffect } from 'react';
import { clamp } from '../constants';

export function usePointerInput({
  keyboardRef,
  pointerToNoteRef,
  startNote,
  stopNote,
  switchPointerNote
}) {
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

    container.addEventListener('pointerdown', pointerDown, { passive: false });
    container.addEventListener('pointermove', pointerMove, { passive: false });
    container.addEventListener('pointerup', pointerUp, { passive: false });
    container.addEventListener('pointercancel', pointerUp, { passive: false });
    container.addEventListener('lostpointercapture', lostPointerCapture, true);

    return () => {
      container.removeEventListener('pointerdown', pointerDown);
      container.removeEventListener('pointermove', pointerMove);
      container.removeEventListener('pointerup', pointerUp);
      container.removeEventListener('pointercancel', pointerUp);
      container.removeEventListener('lostpointercapture', lostPointerCapture, true);
    };
  }, [keyboardRef, pointerToNoteRef, startNote, stopNote, switchPointerNote]);
}
