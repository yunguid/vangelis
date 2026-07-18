import { useEffect } from 'react';
import { clamp } from '../constants';

export function usePointerInput({
  keyboardRef,
  pointerToNoteRef,
  startNote,
  stopNote,
  switchPointerNote,
  touchVelocityRef
}) {
  useEffect(() => {
    const container = keyboardRef.current;
    if (!container) return;
    const pendingMoves = new Map();
    let moveFrameId = null;

    // Touch screens rarely report pressure; the on-screen velocity selector
    // supplies the playing dynamic instead.
    const fallbackVelocity = () => touchVelocityRef?.current ?? 0.85;

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
      const velocity = event.pressure > 0 ? clamp(event.pressure, 0.05, 1) : fallbackVelocity();
      startNote(meta, { pointerId: event.pointerId, velocity });
    };

    const flushPointerMoves = () => {
      moveFrameId = null;
      for (const [pointerId, move] of pendingMoves) {
        pendingMoves.delete(pointerId);
        if (!pointerToNoteRef.current.has(pointerId)) continue;
        const element = document.elementFromPoint(move.clientX, move.clientY);
        const keyElement = element ? element.closest('[data-note]') : null;
        if (!keyElement) continue;
        if (keyElement.dataset.note === pointerToNoteRef.current.get(pointerId)) continue;
        const meta = getMetaFromElement(keyElement);
        const velocity = move.pressure > 0
          ? clamp(move.pressure, 0.05, 1)
          : fallbackVelocity();
        switchPointerNote(pointerId, meta, velocity);
      }
    };

    const pointerMove = (event) => {
      if (!pointerToNoteRef.current.has(event.pointerId)) return;
      const pendingMove = pendingMoves.get(event.pointerId);
      if (pendingMove) {
        pendingMove.clientX = event.clientX;
        pendingMove.clientY = event.clientY;
        pendingMove.pressure = event.pressure;
      } else {
        pendingMoves.set(event.pointerId, {
          clientX: event.clientX,
          clientY: event.clientY,
          pressure: event.pressure
        });
      }
      if (moveFrameId === null) {
        moveFrameId = requestAnimationFrame(flushPointerMoves);
      }
    };

    const discardPendingMove = (pointerId) => {
      pendingMoves.delete(pointerId);
      if (pendingMoves.size === 0 && moveFrameId !== null) {
        cancelAnimationFrame(moveFrameId);
        moveFrameId = null;
      }
    };

    const pointerUp = (event) => {
      discardPendingMove(event.pointerId);
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
      discardPendingMove(event.pointerId);
      const noteId = pointerToNoteRef.current.get(event.pointerId);
      if (noteId) {
        stopNote(noteId, event.pointerId);
      }
    };

    container.addEventListener('pointerdown', pointerDown, { passive: false });
    container.addEventListener('pointermove', pointerMove, { passive: true });
    container.addEventListener('pointerup', pointerUp, { passive: true });
    container.addEventListener('pointercancel', pointerUp, { passive: true });
    container.addEventListener('lostpointercapture', lostPointerCapture, true);

    return () => {
      if (moveFrameId !== null) cancelAnimationFrame(moveFrameId);
      pendingMoves.clear();
      container.removeEventListener('pointerdown', pointerDown);
      container.removeEventListener('pointermove', pointerMove);
      container.removeEventListener('pointerup', pointerUp);
      container.removeEventListener('pointercancel', pointerUp);
      container.removeEventListener('lostpointercapture', lostPointerCapture, true);
    };
  }, [keyboardRef, pointerToNoteRef, startNote, stopNote, switchPointerNote, touchVelocityRef]);
}
