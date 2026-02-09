/**
 * MIDI Playback Hook for Vangelis
 * Handles scheduling and playback of MIDI files through the synth engine
 * @module hooks/useMidiPlayback
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import { midiNoteToFrequency, midiNoteToName } from '../utils/math.js';

/**
 * Map GM instrument families to appropriate waveforms
 * @type {Object.<string, string|null>}
 */
const FAMILY_WAVEFORMS = {
  piano: 'triangle',      // Soft attack, mellow
  'chromatic percussion': 'triangle',
  organ: 'sine',          // Clean, sustained
  guitar: 'triangle',     // Plucked, mellow
  bass: 'saw',            // Rich harmonics
  strings: 'saw',         // Rich, bowed
  ensemble: 'saw',        // Orchestral
  brass: 'square',        // Bright, punchy
  reed: 'saw',            // Clarinet, sax
  pipe: 'sine',           // Flute, recorder
  'synth lead': 'saw',    // Classic lead
  'synth pad': 'triangle', // Soft, ambient
  'synth effects': 'saw',
  ethnic: 'triangle',
  percussive: null,       // Skip or use sample
  'sound effects': null
};

/**
 * @typedef {Object} MidiPlaybackOptions
 * @property {string} waveformType - Current waveform type (sine, saw, square, etc.)
 * @property {Object} audioParams - Audio parameters (ADSR, filter, effects)
 */

/**
 * @typedef {Object} MidiPlaybackState
 * @property {boolean} isPlaying - Whether playback is currently active
 * @property {boolean} isPaused - Whether playback is paused
 * @property {number} progress - Playback progress (0-1)
 * @property {Set<string>} activeNotes - Currently playing note IDs
 * @property {Object|null} currentMidi - Current MIDI data being played
 * @property {number} tempoFactor - Playback speed multiplier (0.25-2.0, default 1.0)
 * @property {function} play - Start playing a MIDI file
 * @property {function} pause - Pause playback
 * @property {function} resume - Resume from pause
 * @property {function} stop - Stop playback completely
 * @property {function} setTempo - Set tempo multiplier (0.25-2.0)
 */

/**
 * Hook for MIDI playback control
 *
 * Schedules MIDI notes using setTimeout and plays them through the audio engine.
 * Provides play/pause/resume/stop controls and tracks active notes for visualization.
 *
 * @param {MidiPlaybackOptions} options - Playback configuration
 * @returns {MidiPlaybackState} Playback state and controls
 *
 * @example
 * const {
 *   isPlaying,
 *   progress,
 *   activeNotes,
 *   play,
 *   stop
 * } = useMidiPlayback({ waveformType: 'saw', audioParams });
 *
 * // Start playback
 * const midi = await parseMidiFile('/midi/song.mid');
 * play(midi);
 *
 * // Show active notes on keyboard
 * <SynthKeyboard externalActiveNotes={activeNotes} />
 */
export function useMidiPlayback({ waveformType, audioParams }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeNotes, setActiveNotes] = useState(new Set());
  const [currentMidi, setCurrentMidi] = useState(null);
  const [tempoFactor, setTempoFactorState] = useState(1.0);

  // Use refs to avoid stale closures in setTimeout callbacks
  const waveformRef = useRef(waveformType);
  const audioParamsRef = useRef(audioParams);
  const tempoFactorRef = useRef(1.0);
  const activeNotesRef = useRef(new Set());
  const timeoutsRef = useRef([]);
  const rafRef = useRef(null);
  const playbackRef = useRef({ startTime: 0, pauseTime: 0, midiData: null });

  // Keep refs in sync with props
  useEffect(() => {
    waveformRef.current = waveformType;
  }, [waveformType]);

  useEffect(() => {
    audioParamsRef.current = audioParams;
  }, [audioParams]);

  // Tempo factor setter with clamping
  const setTempo = useCallback((factor) => {
    const clamped = Math.max(0.25, Math.min(2.0, factor));
    tempoFactorRef.current = clamped;
    setTempoFactorState(clamped);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimeouts();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  /**
   * Clear all scheduled note timeouts
   * @private
   */
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  }, []);

  /**
   * Trigger a note on event
   * @param {string} noteId - Unique note identifier (e.g., 'C4')
   * @param {number} frequency - Note frequency in Hz
   * @param {number} velocity - Note velocity (0-1)
   * @param {string} [instrumentFamily] - GM instrument family for waveform selection
   * @private
   */
  const triggerNoteOn = useCallback((noteId, frequency, velocity, instrumentFamily) => {
    // Use instrument-specific waveform if available, otherwise fall back to global
    let waveform = waveformRef.current;
    if (instrumentFamily) {
      const familyWaveform = FAMILY_WAVEFORMS[instrumentFamily];
      if (familyWaveform) {
        waveform = familyWaveform;
      }
      // If familyWaveform is null (percussion), skip the note
      if (familyWaveform === null) {
        return;
      }
    }

    audioEngine.playFrequency({
      noteId,
      frequency,
      waveformType: waveform,
      params: audioParamsRef.current,
      velocity
    });

    activeNotesRef.current.add(noteId);
    setActiveNotes(new Set(activeNotesRef.current));
  }, []);

  /**
   * Trigger a note off event
   * @param {string} noteId - Note identifier to stop
   * @private
   */
  const triggerNoteOff = useCallback((noteId) => {
    audioEngine.stopNote(noteId);
    activeNotesRef.current.delete(noteId);
    setActiveNotes(new Set(activeNotesRef.current));
  }, []);

  /**
   * Stop all currently playing notes
   * @private
   */
  const stopAllNotes = useCallback(() => {
    activeNotesRef.current.forEach(noteId => {
      audioEngine.stopNote(noteId);
    });
    activeNotesRef.current.clear();
    setActiveNotes(new Set());
  }, []);

  /**
   * Internal stop handler - clears state and stops playback
   * @private
   */
  const stopInternal = useCallback(() => {
    clearAllTimeouts();
    stopAllNotes();

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    playbackRef.current.startTime = 0;
    playbackRef.current.pauseTime = 0;

    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
  }, [clearAllTimeouts, stopAllNotes]);

  /**
   * Schedule notes for playback using setTimeout
   * @param {Array} notes - Array of MIDI notes to schedule
   * @param {number} offset - Time offset for resuming (0 for new playback)
   * @param {number} startTime - Audio context start time
   * @private
   */
  const scheduleNotes = useCallback((notes, offset, startTime) => {
    const ctx = audioEngine.context;
    if (!ctx) return;

    const now = ctx.currentTime;
    const tempo = tempoFactorRef.current;

    notes.forEach(note => {
      // Scale note time by tempo factor (higher tempo = shorter times)
      const noteTime = (note.time - offset) / tempo;
      if (noteTime < 0) return;

      const noteDuration = note.duration / tempo;
      const scheduledStart = startTime + noteTime;
      const scheduledEnd = scheduledStart + noteDuration;

      const { noteId } = midiNoteToName(note.midi);
      const frequency = midiNoteToFrequency(note.midi);

      // Schedule note on (pass instrument family for waveform selection)
      const startDelay = Math.max(0, (scheduledStart - now) * 1000);
      const startId = setTimeout(() => {
        triggerNoteOn(noteId, frequency, note.velocity, note.instrumentFamily);
      }, startDelay);
      timeoutsRef.current.push(startId);

      // Schedule note off
      const endDelay = Math.max(0, (scheduledEnd - now) * 1000);
      const endId = setTimeout(() => {
        triggerNoteOff(noteId);
      }, endDelay);
      timeoutsRef.current.push(endId);
    });
  }, [triggerNoteOn, triggerNoteOff]);

  /**
   * Start the progress update animation loop
   * @param {number} duration - Total duration in seconds (unscaled)
   * @param {number} startTime - Audio context start time
   * @private
   */
  const startProgressLoop = useCallback((duration, startTime) => {
    const updateProgress = () => {
      const ctx = audioEngine.context;
      if (!ctx) return;

      const elapsed = ctx.currentTime - startTime;
      // Scale duration by tempo factor for progress calculation
      const scaledDuration = duration / tempoFactorRef.current;
      const progressValue = Math.min(elapsed / scaledDuration, 1);

      setProgress(progressValue);

      if (progressValue >= 1) {
        stopInternal();
        return;
      }

      rafRef.current = requestAnimationFrame(updateProgress);
    };

    rafRef.current = requestAnimationFrame(updateProgress);
  }, [stopInternal]);

  /**
   * Start playing a MIDI file
   * @param {Object} midiData - Parsed MIDI data from parseMidiFile()
   */
  const play = useCallback((midiData) => {
    if (!midiData || !midiData.notes || midiData.notes.length === 0) {
      console.warn('No MIDI data to play');
      return;
    }

    // Ensure audio context is ready
    audioEngine.ensureAudioContext().then(() => {
      // Stop any existing playback
      stopInternal();

      const ctx = audioEngine.context;
      const startTime = ctx?.currentTime || 0;

      playbackRef.current.midiData = midiData;
      playbackRef.current.startTime = startTime;
      playbackRef.current.pauseTime = 0;

      setCurrentMidi(midiData);
      setIsPlaying(true);
      setIsPaused(false);
      setProgress(0);

      // Schedule all notes
      scheduleNotes(midiData.notes, 0, startTime);

      // Start progress update loop
      startProgressLoop(midiData.duration, startTime);
    });
  }, [stopInternal, scheduleNotes, startProgressLoop]);

  /**
   * Pause playback at current position
   */
  const pause = useCallback(() => {
    if (!isPlaying || isPaused) return;

    const ctx = audioEngine.context;
    const currentTime = ctx?.currentTime || 0;
    playbackRef.current.pauseTime = currentTime - playbackRef.current.startTime;

    clearAllTimeouts();
    stopAllNotes();

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setIsPaused(true);
    setIsPlaying(false);
  }, [isPlaying, isPaused, clearAllTimeouts, stopAllNotes]);

  /**
   * Resume playback from paused position
   */
  const resume = useCallback(() => {
    const pb = playbackRef.current;
    if (!pb.midiData || !isPaused) return;

    audioEngine.ensureAudioContext().then(() => {
      const ctx = audioEngine.context;
      // Convert elapsed scaled time back to original time
      const elapsedScaled = pb.pauseTime;
      const tempo = tempoFactorRef.current;
      const elapsedOriginal = elapsedScaled * tempo;
      const newStartTime = (ctx?.currentTime || 0) - elapsedScaled;

      pb.startTime = newStartTime;
      pb.pauseTime = 0;

      setIsPaused(false);
      setIsPlaying(true);

      // Filter notes based on original (unscaled) time
      const remainingNotes = pb.midiData.notes.filter(note => note.time >= elapsedOriginal);
      scheduleNotes(remainingNotes, elapsedOriginal, newStartTime);

      // Restart progress loop
      startProgressLoop(pb.midiData.duration, newStartTime);
    });
  }, [isPaused, scheduleNotes, startProgressLoop]);

  /**
   * Stop playback completely and reset state
   */
  const stop = useCallback(() => {
    stopInternal();
    setCurrentMidi(null);
  }, [stopInternal]);

  return {
    isPlaying,
    isPaused,
    progress,
    activeNotes,
    currentMidi,
    tempoFactor,
    play,
    pause,
    resume,
    stop,
    setTempo
  };
}
