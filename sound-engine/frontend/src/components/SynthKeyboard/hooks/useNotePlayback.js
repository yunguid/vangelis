import { useCallback, useEffect, useRef } from 'react';
import { audioEngine } from '../../../utils/audioEngine.js';
import { clamp } from '../constants';

export function useNotePlayback({
  waveformRef,
  audioParamsRef,
  wasmReadyRef,
  scheduleVisualUpdate
}) {
  const activeNotesRef = useRef(null);
  if (!activeNotesRef.current) activeNotesRef.current = new Map();
  const pendingNotesRef = useRef(null);
  if (!pendingNotesRef.current) pendingNotesRef.current = new Map();
  const pointerToNoteRef = useRef(null);
  if (!pointerToNoteRef.current) pointerToNoteRef.current = new Map();

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
    const requiresWorklet = !status.hasCustomSample && !status.hasVoicePhrase;
    const workletReady = wasmReadyRef.current || status.wasmReady;
    const inputSource = pointerId === null ? 'keyboard' : 'pointer';
    const contextWasReady = !!audioEngine.context;
    const startedCold = !contextWasReady || (requiresWorklet && !workletReady);
    const performanceProbe = typeof window !== 'undefined'
      ? window.__vangelisPerf
      : null;
    const perfStart = (
      performanceProbe
      && typeof performance !== 'undefined'
    ) ? performance.now() : null;
    const paintInteraction = performanceProbe?.beginInteractionPaint?.(
      `input.${inputSource}.note-on.paint`,
      { cold: startedCold }
    );
    const playPreparedNote = () => {
      if (activeNotesRef.current.has(noteMeta.noteId)) {
        paintInteraction?.cancel();
        return;
      }
      const result = audioEngine.playFrequency({
        noteId: noteMeta.noteId,
        frequency: noteMeta.frequency,
        waveformType: waveformRef.current,
        params: audioParamsRef.current,
        velocity: velocityNormalized
      });

      if (!result) {
        paintInteraction?.cancel();
        return;
      }
      activeNotesRef.current.set(noteMeta.noteId, {
        voiceId: result.voiceId,
        pointerId
      });
      if (pointerId !== null) {
        pointerToNoteRef.current.set(pointerId, noteMeta.noteId);
      }
      scheduleVisualUpdate(noteMeta.noteId, true);
      paintInteraction?.complete();
      if (perfStart === null || typeof window === 'undefined') return;
      const latency = performance.now() - perfStart;
      const ctxTime = audioEngine.context ? audioEngine.context.currentTime : null;
      performanceProbe?.recordInteraction?.(
        `audio.note-on.${startedCold ? 'cold' : 'warm'}.${inputSource}`,
        latency,
        {
          frequency: noteMeta.frequency,
          contextWasReady,
          workletWasReady: workletReady,
          audioContextTime: ctxTime
        }
      );
      window.__vangelisMetrics = {
        ...(window.__vangelisMetrics || {}),
        lastNoteLatencyMs: latency,
        lastNoteFrequency: noteMeta.frequency,
        audioContextTime: ctxTime,
        lastUpdated: Date.now()
      };
    };

    if (audioEngine.context && (!requiresWorklet || workletReady)) {
      playPreparedNote();
      return;
    }

    const token = { paintInteraction };
    pendingNotesRef.current.set(noteMeta.noteId, token);
    if (pointerId !== null) {
      pointerToNoteRef.current.set(pointerId, noteMeta.noteId);
    }
    const clearFailedPendingNote = () => {
      paintInteraction?.cancel();
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
      const requestIsPending = pendingNotesRef.current.get(noteMeta.noteId) === token;
      if (perfStart !== null) {
        performanceProbe?.recordInteraction?.(
          `audio.note-ready.${startedCold ? 'cold' : 'warm'}.${inputSource}`,
          performance.now() - perfStart,
          {
            frequency: noteMeta.frequency,
            cancelledBeforeReady: !requestIsPending
          }
        );
      }
      if (!requestIsPending) {
        paintInteraction?.cancel();
        return;
      }
      pendingNotesRef.current.delete(noteMeta.noteId);
      playPreparedNote();
    }).catch(() => {
      if (pendingNotesRef.current.get(noteMeta.noteId) === token) {
        clearFailedPendingNote();
      }
    });
  }, [waveformRef, audioParamsRef, wasmReadyRef, scheduleVisualUpdate]);

  const stopNote = useCallback((noteId, pointerId = null) => {
    if (!noteId) return;
    const pendingEntry = pendingNotesRef.current.get(noteId);
    pendingEntry?.paintInteraction?.cancel();
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

    const inputSource = pointerId === null ? 'keyboard' : 'pointer';
    const performanceProbe = typeof window !== 'undefined'
      ? window.__vangelisPerf
      : null;
    const perfStart = performanceProbe && typeof performance !== 'undefined'
      ? performance.now()
      : null;
    const paintInteraction = performanceProbe?.beginInteractionPaint?.(
      `input.${inputSource}.note-off.paint`
    );
    audioEngine.stopNote(noteId);
    activeNotesRef.current.delete(noteId);
    scheduleVisualUpdate(noteId, false);
    paintInteraction?.complete();
    if (perfStart !== null) {
      performanceProbe?.recordInteraction?.(
        `audio.note-off.${inputSource}`,
        performance.now() - perfStart
      );
    }
  }, [scheduleVisualUpdate]);

  useEffect(() => {
    const releaseAll = () => {
      for (const [noteId] of activeNotesRef.current) {
        audioEngine.stopNote(noteId);
        scheduleVisualUpdate(noteId, false);
      }
      activeNotesRef.current.clear();
      for (const pendingEntry of pendingNotesRef.current.values()) {
        pendingEntry.paintInteraction?.cancel();
      }
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
