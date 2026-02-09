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
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const activeNoteCountsRef = useRef(new Map());
  const activeVoiceIdsRef = useRef(new Set());
  const timeoutsRef = useRef([]);
  const rafRef = useRef(null);
  const playbackRef = useRef({
    startTime: 0,
    pauseOriginalTime: 0,
    elapsedOriginalAtStart: 0,
    midiData: null
  });

  // Keep refs in sync with props
  useEffect(() => {
    waveformRef.current = waveformType;
  }, [waveformType]);

  useEffect(() => {
    audioParamsRef.current = audioParams;
  }, [audioParams]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

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
   * @param {string} voiceId - Internal voice id used by the audio engine
   * @param {number} frequency - Note frequency in Hz
   * @param {number} velocity - Note velocity (0-1)
   * @param {string} [instrumentFamily] - GM instrument family for waveform selection
   * @private
   */
  const triggerNoteOn = useCallback((noteId, voiceId, frequency, velocity, instrumentFamily) => {
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
      noteId: voiceId,
      frequency,
      waveformType: waveform,
      params: audioParamsRef.current,
      velocity
    });

    activeVoiceIdsRef.current.add(voiceId);
    const counts = activeNoteCountsRef.current;
    counts.set(noteId, (counts.get(noteId) || 0) + 1);
    setActiveNotes(new Set(counts.keys()));
  }, []);

  /**
   * Trigger a note off event
   * @param {string} noteId - Display note identifier to clear from visualization
   * @param {string} voiceId - Internal voice id to release in audio engine
   * @private
   */
  const triggerNoteOff = useCallback((noteId, voiceId) => {
    audioEngine.stopNote(voiceId);
    activeVoiceIdsRef.current.delete(voiceId);

    const counts = activeNoteCountsRef.current;
    const nextCount = (counts.get(noteId) || 0) - 1;
    if (nextCount > 0) {
      counts.set(noteId, nextCount);
    } else {
      counts.delete(noteId);
    }
    setActiveNotes(new Set(counts.keys()));
  }, []);

  /**
   * Stop all currently playing notes
   * @private
   */
  const stopAllNotes = useCallback(() => {
    activeVoiceIdsRef.current.forEach(voiceId => {
      audioEngine.stopNote(voiceId);
    });
    activeVoiceIdsRef.current.clear();
    activeNoteCountsRef.current.clear();
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
    playbackRef.current.pauseOriginalTime = 0;
    playbackRef.current.elapsedOriginalAtStart = 0;

    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
  }, [clearAllTimeouts, stopAllNotes]);

  /**
   * Compute elapsed time in original MIDI seconds.
   * @param {number} contextTime - Current AudioContext time
   * @returns {number}
   * @private
   */
  const getElapsedOriginalTime = useCallback((contextTime) => {
    const pb = playbackRef.current;
    const elapsedScaled = Math.max(0, contextTime - pb.startTime);
    return pb.elapsedOriginalAtStart + elapsedScaled * tempoFactorRef.current;
  }, []);

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

    notes.forEach((note, index) => {
      const noteEnd = note.time + note.duration;
      if (noteEnd <= offset) return;

      const noteLead = Math.max(0, note.time - offset);
      const remainingOriginalDuration = Math.max(0, noteEnd - Math.max(offset, note.time));
      if (remainingOriginalDuration <= 0) return;

      // Scale note timings by tempo factor (higher tempo = shorter times)
      const noteTime = noteLead / tempo;
      const noteDuration = remainingOriginalDuration / tempo;
      const scheduledStart = startTime + noteTime;
      const scheduledEnd = scheduledStart + noteDuration;

      const { noteId } = midiNoteToName(note.midi);
      const frequency = midiNoteToFrequency(note.midi);
      const voiceId = `midi-${note.midi}-${Math.round(note.time * 1000)}-${index}-${Math.round(offset * 1000)}`;

      // Schedule note on (pass instrument family for waveform selection)
      const startDelay = Math.max(0, (scheduledStart - now) * 1000);
      const startId = setTimeout(() => {
        triggerNoteOn(noteId, voiceId, frequency, note.velocity, note.instrumentFamily);
      }, startDelay);
      timeoutsRef.current.push(startId);

      // Schedule note off
      const endDelay = Math.max(0, (scheduledEnd - now) * 1000);
      const endId = setTimeout(() => {
        triggerNoteOff(noteId, voiceId);
      }, endDelay);
      timeoutsRef.current.push(endId);
    });
  }, [triggerNoteOn, triggerNoteOff]);

  // Tempo factor setter with clamping. Re-schedules remaining notes if tempo changes mid-playback.
  const setTempo = useCallback((factor) => {
    const clamped = Math.max(0.25, Math.min(2.0, factor));
    const previousTempo = tempoFactorRef.current;

    if (Math.abs(clamped - previousTempo) < 0.001) {
      return;
    }

    const pb = playbackRef.current;
    const hasMidi = Boolean(pb.midiData);
    const isPausedPlayback = isPausedRef.current && hasMidi;
    const isActivePlayback = isPlayingRef.current && !isPausedRef.current && hasMidi;
    const ctx = audioEngine.context;
    const currentTime = ctx?.currentTime || pb.startTime;
    const elapsedOriginal = isPausedPlayback
      ? pb.pauseOriginalTime
      : getElapsedOriginalTime(currentTime);

    tempoFactorRef.current = clamped;
    setTempoFactorState(clamped);

    if (!isActivePlayback || !ctx) {
      if (isPausedPlayback) {
        pb.pauseOriginalTime = elapsedOriginal;
      }
      return;
    }

    clearAllTimeouts();
    stopAllNotes();

    pb.startTime = currentTime;
    pb.elapsedOriginalAtStart = elapsedOriginal;

    scheduleNotes(pb.midiData.notes, elapsedOriginal, currentTime);
  }, [clearAllTimeouts, getElapsedOriginalTime, scheduleNotes, stopAllNotes]);

  /**
   * Start the progress update animation loop
   * @param {number} duration - Total duration in seconds (unscaled)
   * @private
   */
  const startProgressLoop = useCallback((duration) => {
    const updateProgress = () => {
      const ctx = audioEngine.context;
      if (!ctx) return;

      const elapsedOriginal = getElapsedOriginalTime(ctx.currentTime);
      const progressValue = Math.min(elapsedOriginal / duration, 1);

      setProgress(progressValue);

      if (progressValue >= 1) {
        stopInternal();
        return;
      }

      rafRef.current = requestAnimationFrame(updateProgress);
    };

    rafRef.current = requestAnimationFrame(updateProgress);
  }, [getElapsedOriginalTime, stopInternal]);

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
      playbackRef.current.pauseOriginalTime = 0;
      playbackRef.current.elapsedOriginalAtStart = 0;

      setCurrentMidi(midiData);
      setIsPlaying(true);
      setIsPaused(false);
      setProgress(0);

      // Schedule all notes
      scheduleNotes(midiData.notes, 0, startTime);

      // Start progress update loop
      startProgressLoop(midiData.duration);
    });
  }, [stopInternal, scheduleNotes, startProgressLoop]);

  /**
   * Pause playback at current position
   */
  const pause = useCallback(() => {
    if (!isPlaying || isPaused) return;

    const ctx = audioEngine.context;
    const currentTime = ctx?.currentTime || 0;
    const elapsedOriginal = getElapsedOriginalTime(currentTime);
    playbackRef.current.pauseOriginalTime = elapsedOriginal;

    clearAllTimeouts();
    stopAllNotes();

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setIsPaused(true);
    setIsPlaying(false);
  }, [isPlaying, isPaused, clearAllTimeouts, getElapsedOriginalTime, stopAllNotes]);

  /**
   * Resume playback from paused position
   */
  const resume = useCallback(() => {
    const pb = playbackRef.current;
    if (!pb.midiData || !isPaused) return;

    audioEngine.ensureAudioContext().then(() => {
      const ctx = audioEngine.context;
      const elapsedOriginal = pb.pauseOriginalTime;
      const newStartTime = ctx?.currentTime || 0;

      pb.startTime = newStartTime;
      pb.pauseOriginalTime = 0;
      pb.elapsedOriginalAtStart = elapsedOriginal;

      setIsPaused(false);
      setIsPlaying(true);

      // Schedule from original timeline offset; includes notes sustaining through resume point.
      scheduleNotes(pb.midiData.notes, elapsedOriginal, newStartTime);

      // Restart progress loop
      startProgressLoop(pb.midiData.duration);
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
