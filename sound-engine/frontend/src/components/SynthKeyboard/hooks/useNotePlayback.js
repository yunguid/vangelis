import { useCallback, useEffect, useRef } from 'react';
import { audioEngine } from '../../../utils/audioEngine.js';
import { clamp } from '../constants';

export function useNotePlayback({
  waveformRef,
  audioParamsRef,
  wasmReadyRef,
  scheduleVisualUpdate,
  updateVelocityDisplay
}) {
  const activeNotesRef = useRef(new Map());
  const pendingNotesRef = useRef(new Map());
  const pointerToNoteRef = useRef(new Map());

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

  const startNote = useCallback((noteMeta, { pointerId = null, velocity = 0.85 } = {}) => {
    if (!noteMeta || !noteMeta.frequency) {
      return;
    }

    const status = audioEngine.getStatus();
    if (
      activeNotesRef.current.has(noteMeta.noteId)
      || pendingNotesRef.current.has(noteMeta.noteId)
    ) {
      return;
    }

    const velocityNormalized = clamp(velocity, 0.05, 1);
    const perfStart = typeof performance !== 'undefined' ? performance.now() : null;
    const playPreparedNote = () => {
      if (activeNotesRef.current.has(noteMeta.noteId)) return;
      const result = audioEngine.playFrequency({
        noteId: noteMeta.noteId,
        frequency: noteMeta.frequency,
        waveformType: waveformRef.current,
        params: audioParamsRef.current,
        velocity: velocityNormalized
      });

      if (!result) return;
      activeNotesRef.current.set(noteMeta.noteId, {
        voiceId: result.voiceId,
        pointerId
      });
      if (pointerId !== null) {
        pointerToNoteRef.current.set(pointerId, noteMeta.noteId);
      }
      scheduleVisualUpdate(noteMeta.noteId, true);
      updateVelocityDisplay(velocityNormalized);
      if (perfStart === null || typeof window === 'undefined') return;
      const latency = performance.now() - perfStart;
      const ctxTime = audioEngine.context ? audioEngine.context.currentTime : null;
      window.__vangelisMetrics = {
        ...(window.__vangelisMetrics || {}),
        lastNoteLatencyMs: latency,
        lastNoteFrequency: noteMeta.frequency,
        audioContextTime: ctxTime,
        lastUpdated: Date.now()
      };
    };

    const requiresWorklet = !status.hasCustomSample && !status.hasVoicePhrase;
    const workletReady = wasmReadyRef.current || status.wasmReady;
    if (audioEngine.context && (!requiresWorklet || workletReady)) {
      playPreparedNote();
      return;
    }

    const token = {};
    pendingNotesRef.current.set(noteMeta.noteId, token);
    if (pointerId !== null) {
      pointerToNoteRef.current.set(pointerId, noteMeta.noteId);
    }
    const clearFailedPendingNote = () => {
      pendingNotesRef.current.delete(noteMeta.noteId);
      if (pointerId !== null && pointerToNoteRef.current.get(pointerId) === noteMeta.noteId) {
        pointerToNoteRef.current.delete(pointerId);
      }
    };

    let preparation;
    try {
      preparation = requiresWorklet
        ? audioEngine.ensureWasm()
        : audioEngine.ensureAudioContext();
    } catch (_) {
      clearFailedPendingNote();
      return;
    }

    Promise.resolve(preparation).then(() => {
      if (pendingNotesRef.current.get(noteMeta.noteId) !== token) return;
      pendingNotesRef.current.delete(noteMeta.noteId);
      playPreparedNote();
    }).catch(() => {
      if (pendingNotesRef.current.get(noteMeta.noteId) === token) {
        clearFailedPendingNote();
      }
    });
  }, [waveformRef, audioParamsRef, wasmReadyRef, scheduleVisualUpdate, updateVelocityDisplay]);

  const stopNote = useCallback((noteId, pointerId = null) => {
    if (!noteId) return;
    pendingNotesRef.current.delete(noteId);
    const entry = activeNotesRef.current.get(noteId);
    if (pointerId !== null) {
      pointerToNoteRef.current.delete(pointerId);
    } else {
      for (const [id, mappedNote] of pointerToNoteRef.current) {
        if (mappedNote === noteId) {
          pointerToNoteRef.current.delete(id);
        }
      }
    }
    if (!entry) return;

    audioEngine.stopNote(noteId);
    activeNotesRef.current.delete(noteId);
    scheduleVisualUpdate(noteId, false);
  }, [scheduleVisualUpdate]);

  useEffect(() => {
    const releaseAll = () => {
      for (const [noteId] of activeNotesRef.current) {
        audioEngine.stopNote(noteId);
        scheduleVisualUpdate(noteId, false);
      }
      activeNotesRef.current.clear();
      pendingNotesRef.current.clear();
      pointerToNoteRef.current.clear();
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') {
        releaseAll();
      }
    };

    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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

  return {
    startNote,
    stopNote,
    switchPointerNote,
    activeNotesRef,
    pointerToNoteRef
  };
}
