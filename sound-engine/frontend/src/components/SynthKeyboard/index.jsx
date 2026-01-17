import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  WHITE_KEYS,
  BLACK_KEYS,
  BLACK_PLACEMENT,
  BLACK_KEY_OFFSET_RATIO,
  clamp
} from './constants';
import { useVisualFeedback } from './hooks/useVisualFeedback';
import { useNotePlayback } from './hooks/useNotePlayback';
import { useKeyboardInput } from './hooks/useKeyboardInput';
import { usePointerInput } from './hooks/usePointerInput';
import Key from './components/Key';
import KeyboardMeta from './components/KeyboardMeta';
import { getNoteMeta } from './utils/noteMeta';

const SynthKeyboard = ({ waveformType = 'Sine', audioParams = {}, wasmLoaded = false }) => {
  const keyboardRef = useRef(null);
  const keyElementsRef = useRef(new Map());

  const audioParamsRef = useRef(audioParams);
  const waveformRef = useRef(waveformType);
  const wasmReadyRef = useRef(wasmLoaded);
  const octaveOffsetRef = useRef(0);

  const [octaveOffset, setOctaveOffset] = useState(0);

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
  const { scheduleVisualUpdate, updateVelocityDisplay, velocityDisplay } = useVisualFeedback(keyElementsRef);

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
    switchPointerNote
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

  // Compute key metadata based on current octave
  const whiteKeyMetas = useMemo(() => {
    return WHITE_KEYS.map((definition, index) => {
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
  }, [octaveOffset]);

  const blackKeyMetas = useMemo(() => {
    return BLACK_KEYS.map((definition) => {
      const { octave, noteId, frequency } = getNoteMeta(
        definition.name,
        definition.rel,
        octaveOffset
      );
      const placementIndex = BLACK_PLACEMENT[definition.name] + (definition.rel === 1 ? 7 : 0);
      const positionRatio = clamp(
        (placementIndex + BLACK_KEY_OFFSET_RATIO) / WHITE_KEYS.length,
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
  }, [octaveOffset]);

  return (
    <div className="keyboard-wrapper" ref={keyboardRef}>
      <div
        className="white-keys"
        style={{ gridTemplateColumns: `repeat(${whiteKeyMetas.length}, minmax(0, 1fr))` }}
      >
        {whiteKeyMetas.map((meta) => (
          <Key key={meta.noteId} meta={meta} registerKey={registerKey} variant="white" />
        ))}
      </div>

      <div className="black-keys-layer">
        {blackKeyMetas.map((meta) => (
          <Key key={meta.noteId} meta={meta} registerKey={registerKey} variant="black" />
        ))}
      </div>

      <KeyboardMeta octaveOffset={octaveOffset} velocityDisplay={velocityDisplay} />
    </div>
  );
};

export default SynthKeyboard;
