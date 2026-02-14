/**
 * MIDI Playback Hook for Vangelis
 * Handles scheduling and playback of MIDI files through the synth engine
 * @module hooks/useMidiPlayback
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import { midiNoteToFrequency, midiNoteToName } from '../utils/math.js';
import { ensureSoundSetLoaded } from '../utils/instrumentSamples.js';

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

function toLayerToken(value, fallback = 'layer') {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function resolveMidiDuration(midiData) {
  const declaredDuration = Number(midiData?.duration);
  const hasDeclaredDuration = Number.isFinite(declaredDuration) && declaredDuration > 0;
  if (hasDeclaredDuration) {
    return declaredDuration;
  }

  const notes = Array.isArray(midiData?.notes) ? midiData.notes : [];
  let derivedDuration = 0;
  notes.forEach((note) => {
    const noteStart = Number(note?.time);
    const noteDuration = Number(note?.duration);
    if (!Number.isFinite(noteStart) || !Number.isFinite(noteDuration)) return;
    const noteEnd = noteStart + Math.max(0, noteDuration);
    if (noteEnd > derivedDuration) {
      derivedDuration = noteEnd;
    }
  });

  return derivedDuration > 0 ? derivedDuration : 1;
}

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
  const [activeSoundSetName, setActiveSoundSetName] = useState(null);
  const [layeringMode, setLayeringMode] = useState('waveform');

  // Use refs to avoid stale closures in setTimeout callbacks
  const waveformRef = useRef(waveformType);
  const audioParamsRef = useRef(audioParams);
  const tempoFactorRef = useRef(1.0);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const activeNoteCountsRef = useRef(new Map());
  const activeVoiceIdsRef = useRef(new Set());
  const scheduledVoiceMapRef = useRef(new Map());
  const soundSetRef = useRef(null);
  const layerFamiliesRef = useRef([]);
  const timeoutsRef = useRef([]);
  const rafRef = useRef(null);
  const playRequestSeqRef = useRef(0);
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
      playRequestSeqRef.current += 1;
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

  const registerActiveVoices = useCallback((noteId, voiceIds) => {
    if (!Array.isArray(voiceIds) || voiceIds.length === 0) return;

    const counts = activeNoteCountsRef.current;
    counts.set(noteId, (counts.get(noteId) || 0) + voiceIds.length);
    voiceIds.forEach((id) => activeVoiceIdsRef.current.add(id));
    setActiveNotes(new Set(counts.keys()));
  }, []);

  /**
   * Trigger a note on event
   * @param {string} noteId - Unique note identifier (e.g., 'C4')
   * @param {string} voiceId - Internal voice id used by the audio engine
   * @param {number} frequency - Note frequency in Hz
   * @param {number} velocity - Note velocity (0-1)
   * @param {Object} [noteMeta] - Note metadata (instrument family/name/channel)
   * @returns {string[]} Voice ids actually started
   * @private
   */
  const triggerNoteOn = useCallback((noteId, voiceId, frequency, velocity, noteMeta = {}) => {
    const startedVoiceIds = [];
    const params = audioParamsRef.current;
    const soundSet = soundSetRef.current;

    if (soundSet?.pickInstruments) {
      const pickedInstruments = soundSet.pickInstruments(noteMeta);
      pickedInstruments?.forEach((instrument, layerIndex) => {
        if (!instrument?.buffer || !instrument?.baseFrequency) return;
        const layerToken = toLayerToken(instrument.id, `sample-${layerIndex}`);
        const layerVoiceId = `${voiceId}-${layerToken}-${layerIndex}`;
        const started = audioEngine.playBufferedSample({
          noteId: layerVoiceId,
          buffer: instrument.buffer,
          frequency,
          baseFrequency: instrument.baseFrequency,
          params,
          velocity,
          loop: instrument.loop
        });
        if (started?.voiceId) {
          startedVoiceIds.push(started.voiceId);
        }
      });

      if (startedVoiceIds.length > 0) {
        registerActiveVoices(noteId, startedVoiceIds);
        return startedVoiceIds;
      }
    }

    const stackedFamilies = layerFamiliesRef.current;
    if (stackedFamilies.length > 0) {
      stackedFamilies.forEach((family, layerIndex) => {
        const familyWaveform = FAMILY_WAVEFORMS[family];
        if (familyWaveform === null) return;
        const waveform = familyWaveform || waveformRef.current;
        const layerToken = toLayerToken(family, `wave-${layerIndex}`);
        const layerVoiceId = `${voiceId}-${layerToken}-${layerIndex}`;
        const started = audioEngine.playFrequency({
          noteId: layerVoiceId,
          frequency,
          waveformType: waveform,
          params,
          velocity
        });
        if (started?.voiceId) {
          startedVoiceIds.push(started.voiceId);
        }
      });

      if (startedVoiceIds.length > 0) {
        registerActiveVoices(noteId, startedVoiceIds);
        return startedVoiceIds;
      }
    }

    // Use instrument-specific waveform if available, otherwise fall back to global
    let waveform = waveformRef.current;
    if (noteMeta.instrumentFamily) {
      const familyWaveform = FAMILY_WAVEFORMS[noteMeta.instrumentFamily];
      if (familyWaveform) {
        waveform = familyWaveform;
      }
      // If familyWaveform is null (percussion), skip the note
      if (familyWaveform === null) {
        return startedVoiceIds;
      }
    }

    const started = audioEngine.playFrequency({
      noteId: voiceId,
      frequency,
      waveformType: waveform,
      params,
      velocity
    });
    if (started?.voiceId) {
      startedVoiceIds.push(started.voiceId);
      registerActiveVoices(noteId, startedVoiceIds);
    }

    return startedVoiceIds;
  }, [registerActiveVoices]);

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
    scheduledVoiceMapRef.current.clear();
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
    soundSetRef.current = null;
    layerFamiliesRef.current = [];
    scheduledVoiceMapRef.current.clear();
    setActiveSoundSetName(null);
    setLayeringMode('waveform');

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

      // Schedule note on
      const startDelay = Math.max(0, (scheduledStart - now) * 1000);
      const startId = setTimeout(() => {
        const startedVoiceIds = triggerNoteOn(noteId, voiceId, frequency, note.velocity, note);
        if (startedVoiceIds.length > 0) {
          scheduledVoiceMapRef.current.set(voiceId, startedVoiceIds);
        }
      }, startDelay);
      timeoutsRef.current.push(startId);

      // Schedule note off
      const endDelay = Math.max(0, (scheduledEnd - now) * 1000);
      const endId = setTimeout(() => {
        const startedVoiceIds = scheduledVoiceMapRef.current.get(voiceId);
        scheduledVoiceMapRef.current.delete(voiceId);
        if (!startedVoiceIds?.length) return;
        startedVoiceIds.forEach((activeVoiceId) => {
          triggerNoteOff(noteId, activeVoiceId);
        });
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

    const playRequestSeq = playRequestSeqRef.current + 1;
    playRequestSeqRef.current = playRequestSeq;

    // Ensure audio context is ready
    audioEngine.ensureAudioContext().then(async () => {
      if (playRequestSeq !== playRequestSeqRef.current) return;

      // Stop any existing playback
      stopInternal();

      let loadedSoundSet = null;
      if (midiData.soundSetId) {
        try {
          loadedSoundSet = await ensureSoundSetLoaded(midiData.soundSetId);
        } catch (error) {
          console.warn(`Failed to load sound set "${midiData.soundSetId}":`, error);
        }
      }
      if (playRequestSeq !== playRequestSeqRef.current) return;

      soundSetRef.current = loadedSoundSet;
      setActiveSoundSetName(loadedSoundSet?.name || null);
      const requestedLayerFamilies = Array.isArray(midiData.layerFamilies)
        ? midiData.layerFamilies.filter(Boolean)
        : [];
      const soundSetLayerFamilies = Array.isArray(loadedSoundSet?.layerFamilies)
        ? loadedSoundSet.layerFamilies.filter(Boolean)
        : [];
      layerFamiliesRef.current = requestedLayerFamilies.length > 0
        ? requestedLayerFamilies
        : soundSetLayerFamilies;
      const resolvedLayerCount = layerFamiliesRef.current.length;
      const hasSampleLayers = Array.isArray(loadedSoundSet?.instruments) && loadedSoundSet.instruments.length > 0;
      if (hasSampleLayers && resolvedLayerCount > 0) {
        setLayeringMode('sample-layered');
      } else if (resolvedLayerCount > 0) {
        setLayeringMode('wave-layered');
      } else {
        setLayeringMode('waveform');
      }

      const ctx = audioEngine.context;
      const startTime = ctx?.currentTime || 0;

      playbackRef.current.midiData = midiData;
      playbackRef.current.startTime = startTime;
      playbackRef.current.pauseOriginalTime = 0;
      playbackRef.current.elapsedOriginalAtStart = 0;
      const midiDuration = resolveMidiDuration(midiData);

      setCurrentMidi(midiData);
      setIsPlaying(true);
      setIsPaused(false);
      setProgress(0);

      // Schedule all notes
      scheduleNotes(midiData.notes, 0, startTime);

      // Start progress update loop
      startProgressLoop(midiDuration);
    }).catch((error) => {
      if (playRequestSeq !== playRequestSeqRef.current) return;
      console.warn('Failed to start MIDI playback:', error);
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
    const resumeRequestSeq = playRequestSeqRef.current;

    audioEngine.ensureAudioContext().then(() => {
      if (resumeRequestSeq !== playRequestSeqRef.current) return;

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
      startProgressLoop(resolveMidiDuration(pb.midiData));
    }).catch((error) => {
      console.warn('Failed to resume MIDI playback:', error);
    });
  }, [isPaused, scheduleNotes, startProgressLoop]);

  /**
   * Stop playback completely and reset state
   */
  const stop = useCallback(() => {
    playRequestSeqRef.current += 1;
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
    activeSoundSetName,
    layeringMode,
    play,
    pause,
    resume,
    stop,
    setTempo
  };
}
