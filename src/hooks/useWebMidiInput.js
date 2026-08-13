/**
 * Web MIDI input hook for Vangelis
 * Routes hardware MIDI keyboards into the synth engine:
 * - note on/off with velocity
 * - pitch bend wheel -> audioEngine.setPitchBend (+/-2 semitones)
 * - CC1 (mod wheel) -> audioEngine.setModWheel
 *
 * Degrades silently when the Web MIDI API is unavailable (e.g. Safari).
 * @module hooks/useWebMidiInput
 */

import { useEffect, useRef, useState } from 'react';
import { useVisibleSnapshotPublisher } from './useVisibleSnapshotPublisher.js';

const ACTIVE_NOTES_UPDATE_INTERVAL_MS = 40;

export function useWebMidiInput({ waveformType, audioParams, enabled = true }) {
  const [deviceName, setDeviceName] = useState(null);
  const [activeNotes, setActiveNotes] = useState(() => new Set());

  const waveformRef = useRef(waveformType);
  const audioParamsRef = useRef(audioParams);
  const heldRef = useRef(null); // midi number -> display noteId
  if (!heldRef.current) heldRef.current = new Map();
  const publishActiveNotes = useVisibleSnapshotPublisher({
    getSnapshot: () => new Set(heldRef.current.values()),
    publishSnapshot: setActiveNotes,
    intervalMs: ACTIVE_NOTES_UPDATE_INTERVAL_MS
  });

  useEffect(() => {
    waveformRef.current = waveformType;
  }, [waveformType]);

  useEffect(() => {
    audioParamsRef.current = audioParams;
  }, [audioParams]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      return undefined;
    }

    let cancelled = false;
    let stopController = null;

    import('../utils/webMidiController.js')
      .then(({ startWebMidiInput }) => {
        if (cancelled) return;
        stopController = startWebMidiInput({
          getWaveformType: () => waveformRef.current,
          getAudioParams: () => audioParamsRef.current,
          onDeviceName: setDeviceName,
          onNoteOn: (midi, noteId) => {
            heldRef.current.set(midi, noteId);
            publishActiveNotes();
          },
          onNoteOff: (midi) => {
            if (heldRef.current.delete(midi)) publishActiveNotes();
          },
          onAllNotesOff: () => {
            heldRef.current.clear();
            publishActiveNotes(true);
          }
        });
      })
      .catch(() => {
        // A deferred controller failure must not affect the synth UI.
      });

    return () => {
      cancelled = true;
      stopController?.();
      heldRef.current.clear();
    };
  }, [enabled, publishActiveNotes]);

  return { deviceName, activeNotes };
}
