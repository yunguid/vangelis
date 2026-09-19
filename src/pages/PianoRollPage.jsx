import React from 'react';
import Sidebar from '../components/Sidebar';
import {
  MidiTransportContext,
  SoundControlsContext
} from '../context/SynthContexts.jsx';
import { useMidiPlayback } from '../hooks/useMidiPlayback.js';
import { useAudioEngineWarmup } from '../hooks/useAudioEngineWarmup.js';
import { audioEngine } from '../utils/audioEngine.js';
import {
  AUDIO_PARAM_DEFAULTS,
  DEFAULT_WAVEFORM,
  sanitizeAudioParams
} from '../utils/audioParams.js';
import { loadCloudPatternId, saveCloudPatternId } from '../utils/cloudPatternLink.js';
import {
  deleteCloudPattern,
  getSession,
  isCloudConfigured,
  listCloudPatterns,
  onAuthChange,
  signInWithEmail,
  signOut,
  upsertCloudPattern
} from '../utils/cloudPatternStore.js';
import { midiNoteToFrequency, midiNoteToName } from '../utils/math.js';
import {
  BAR_CHUNK,
  BEATS_PER_BAR,
  BPM_MAX,
  BPM_MIN,
  CHORD_TYPES,
  DEFAULT_VELOCITY,
  MAX_PATTERN_BARS,
  MIN_NOTE_BEATS,
  PITCH_MAX,
  PITCH_MIN,
  SCALES,
  SCALE_ROOTS,
  SNAP_OPTIONS,
  addNote,
  addTrack,
  applyNoteDelta,
  buildChords,
  cloneNotesInPlace,
  copyNotesPayload,
  createPattern,
  deleteNote,
  deleteNotes,
  deleteTrack,
  duplicateNotes,
  getSnapBeats,
  isInChord,
  isInScale,
  nudgeNotes,
  normalizePattern,
  pasteNotesPayload,
  patternBeats,
  resizeNotes,
  snapNotesToScale,
  patternToMidiData,
  quantizeBeats,
  quantizeBeatsFloor,
  setPatternBars,
  toggleLoopForSelection,
  updateTrack,
  updateNote
} from '../utils/pianoRollPattern.js';
import { loadEditorDraft, saveEditorDraft } from '../utils/patternDraft.js';
import {
  deleteSavedPattern,
  loadSavedPatterns,
  saveSavedPattern
} from '../utils/patternStorage.js';
import { setPendingMidi } from '../utils/pendingMidiHandoff.js';
import {
  confirmUnsavedNavigation,
  registerUnsavedNavigationGuard
} from '../utils/unsavedNavigationGuard.js';
import './PianoRollPage.css';

// Tall enough that a note can carry its name and read as the layer's colour.
const ROW_HEIGHT = 20;
const GRID_GROUND = '#14171a';
const GRID_BLACK_KEY_ROW = 'rgba(0, 0, 0, 0.13)';
const GRID_IN_KEY_ROW = 'rgba(89, 160, 177, 0.16)';
// Subdivision lines stay hidden until they are this far apart, then fade in.
const SUBDIVISION_MIN_PX = 12;
const SUBDIVISION_FADE_PX = 16;
const KEY_COLUMN_WIDTH = 64;
const RULER_HEIGHT = 30;
const RESIZE_HANDLE_PX = 7;
// A note shows its name once the name fits: ~6.7px per 11px monospace
// character plus the label's padding. "C5" fits a sixteenth at 100% zoom.
const noteNameFits = (name, widthPx) => widthPx >= name.length * 6.7 + 8;
// Longer than any OS double-click interval, so the second click of a
// double-click that switched layers is still recognised as part of it.
const LAYER_SWITCH_GUARD_MS = 600;
const AUDITION_MS = 260;
const ROW_COUNT = PITCH_MAX - PITCH_MIN + 1;
const GRID_HEIGHT = ROW_COUNT * ROW_HEIGHT;
const EDIT_RESCHEDULE_DEBOUNCE_MS = 120;
const DRAFT_SAVE_DEBOUNCE_MS = 400;
const CLOUD_SYNC_DEBOUNCE_MS = 2000;
const HISTORY_LIMIT = 100;
// 100% zoom: a sixteenth is 24px wide, room for a note to be seen and named.
const DEFAULT_PX_PER_BEAT = 96;
const ZOOM_MIN = 24;
const ZOOM_MAX = 336;
const ZOOM_STEP = 1.15;
const ZOOM_WHEEL_STEP = 1.08;
const MAX_GRID_BACKING_WIDTH = 16384;
const UNSAVED_WARNING = 'These edits are not in your saved patterns yet. They stay in the editor draft — leave anyway?';
const RECORDING_TAIL_MS = 160;

// Without Supabase env the editor never mentions the cloud at all.
const CLOUD_ENABLED = isCloudConfigured();
const NO_CLOUD_PATTERNS = Object.freeze([]);

const DEFAULT_CONTROL_SECTIONS = Object.freeze({
  essentials: true,
  delay: false,
  reverb: false,
  color: false,
  modulation: false
});

const rowForMidi = (midi) => PITCH_MAX - midi;
const midiForRow = (row) => PITCH_MAX - row;
const isBlackKey = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

const ICON_PLAY = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 5.5 18.5 12 8 18.5Z" />
  </svg>
);

const ICON_STOP = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6.5" y="6.5" width="11" height="11" rx="1" />
  </svg>
);

const ICON_RECORD = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5.5" />
  </svg>
);

const ICON_HELP = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.3a2.5 2.5 0 1 1 3.3 2.4c-.7.3-1 .9-1 1.6v.3" />
    <path d="M12 17.1h.01" />
  </svg>
);

const ICON_MORE = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" aria-hidden="true">
    <circle cx="5.6" cy="12" r="1.5" />
    <circle cx="12" cy="12" r="1.5" />
    <circle cx="18.4" cy="12" r="1.5" />
  </svg>
);

const ICON_CHEVRON = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6.5 9.5 12 15l5.5-5.5" />
  </svg>
);

const ICON_PLUS = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5.5v13M5.5 12h13" />
  </svg>
);

const PianoRollPlayhead = React.memo(({ getProgress, offsetX = 0, travelWidth }) => {
  const playheadRef = React.useRef(null);

  React.useEffect(() => {
    let frameId = null;
    const update = () => {
      const node = playheadRef.current;
      if (node) {
        node.style.transform = `translate3d(${offsetX + getProgress() * travelWidth}px, 0, 0)`;
      }
      frameId = requestAnimationFrame(update);
    };
    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
  }, [getProgress, offsetX, travelWidth]);

  return <div ref={playheadRef} className="piano-roll__playhead" aria-hidden="true" />;
});

PianoRollPlayhead.displayName = 'PianoRollPlayhead';

const drawGrid = (canvas, {
  bars,
  chordTypeId,
  snapBeats,
  scaleId,
  scaleRoot,
  pxPerBeat
}) => {
  const width = bars * BEATS_PER_BAR * pxPerBeat;
  const dpr = window.devicePixelRatio || 1;
  const backingWidth = Math.min(Math.ceil(width * dpr), MAX_GRID_BACKING_WIDTH);
  canvas.width = backingWidth;
  canvas.height = GRID_HEIGHT * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${GRID_HEIGHT}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(backingWidth / width, dpr);

  // The grid is a quiet stage for the notes: one ground colour, black-key rows
  // a shade darker, and lines only where they carry rhythm or register.
  ctx.fillStyle = GRID_GROUND;
  ctx.fillRect(0, 0, width, GRID_HEIGHT);
  const hasScale = Boolean(scaleId);
  for (let row = 0; row < ROW_COUNT; row += 1) {
    const midi = midiForRow(row);
    const y = row * ROW_HEIGHT;
    if (isBlackKey(midi)) {
      ctx.fillStyle = GRID_BLACK_KEY_ROW;
      ctx.fillRect(0, y, width, ROW_HEIGHT);
    }
    if (hasScale && (isInScale(midi, scaleRoot, scaleId) || isInChord(midi, scaleRoot, chordTypeId))) {
      ctx.fillStyle = GRID_IN_KEY_ROW;
      ctx.fillRect(0, y, width, ROW_HEIGHT);
    }
  }

  // Only octave boundaries (B->C) get a horizontal line.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  for (let row = 0; row <= ROW_COUNT; row += 1) {
    if ((((midiForRow(row) % 12) + 12) % 12) !== 11) continue;
    const y = row * ROW_HEIGHT + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Bars strongest, beats faint. Subdivisions (thirds when a triplet snap is
  // active) only appear once zoom gives them room, and fade in as it grows, so
  // an empty grid never reads as a lattice.
  const subdivision = snapBeats || 0.25;
  const subdivisionPx = subdivision * pxPerBeat;
  const subdivisionAlpha = Math.min(
    Math.max((subdivisionPx - SUBDIVISION_MIN_PX) / SUBDIVISION_FADE_PX, 0),
    1
  ) * 0.06;
  const totalBeats = bars * BEATS_PER_BAR;
  for (let beat = 0; beat <= totalBeats + 1e-6; beat += subdivision) {
    const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
    const onBar = onBeat && Math.round(beat) % BEATS_PER_BAR === 0;
    if (!onBeat && subdivisionAlpha === 0) continue;
    const x = Math.round(beat * pxPerBeat) + 0.5;
    ctx.strokeStyle = onBar
      ? 'rgba(255, 255, 255, 0.22)'
      : onBeat
        ? 'rgba(255, 255, 255, 0.08)'
        : `rgba(255, 255, 255, ${subdivisionAlpha})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GRID_HEIGHT);
    ctx.stroke();
  }
};

// Only needed once a track's sound button is pressed, so it stays out of the
// editor's upfront JavaScript.
const LayerSoundBrowser = React.lazy(() => import('../components/LayerSoundBrowser.jsx'));

const PianoRollPage = () => {
  useAudioEngineWarmup();

  // The draft is the working document: whatever was on screen when the editor
  // was last left comes back, so navigating away never costs a pattern.
  const [draft] = React.useState(loadEditorDraft);

  const [pattern, setPattern] = React.useState(() => (
    draft ? normalizePattern(draft.pattern) : createPattern()
  ));
  const [snapId, setSnapId] = React.useState(() => (
    SNAP_OPTIONS.some((option) => option.id === draft?.snapId) ? draft.snapId : '1/16'
  ));
  const [scaleId, setScaleId] = React.useState(() => (
    SCALES.some((scale) => scale.id === draft?.scaleId) ? draft.scaleId : ''
  ));
  const [scaleRoot, setScaleRoot] = React.useState(() => (
    SCALE_ROOTS[draft?.scaleRoot] ? draft.scaleRoot : 0
  ));
  const [chordTypeId, setChordTypeId] = React.useState(() => (
    CHORD_TYPES.some((chord) => chord.id === draft?.chordTypeId) ? draft.chordTypeId : 'major'
  ));
  const [pxPerBeat, setPxPerBeat] = React.useState(() => (
    Number.isFinite(draft?.pxPerBeat)
      ? Math.min(Math.max(draft.pxPerBeat, ZOOM_MIN), ZOOM_MAX)
      : DEFAULT_PX_PER_BEAT
  ));
  const [savedPatterns, setSavedPatterns] = React.useState(() => loadSavedPatterns());
  const [drag, setDrag] = React.useState(null);
  const [selectedIds, setSelectedIds] = React.useState(() => new Set());
  const [activeTrackId, setActiveTrackId] = React.useState(() => (
    draft?.activeTrackId || 'track-1'
  ));
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isRecordingLoop, setIsRecordingLoop] = React.useState(false);
  const [cloudSession, setCloudSession] = React.useState(null);
  const [cloudPatterns, setCloudPatterns] = React.useState(NO_CLOUD_PATTERNS);
  const [cloudEmail, setCloudEmail] = React.useState('');
  const [cloudAuthStatus, setCloudAuthStatus] = React.useState('idle');
  const [cloudSyncPending, setCloudSyncPending] = React.useState(false);

  const activeTrack = pattern.tracks.find((track) => track.id === activeTrackId)
    || pattern.tracks[0];

  const [waveformType, setWaveformType] = React.useState(() => (
    activeTrack?.instrument || DEFAULT_WAVEFORM
  ));
  const [audioParams, setAudioParams] = React.useState(() => (
    sanitizeAudioParams(activeTrack?.audioParams || AUDIO_PARAM_DEFAULTS)
  ));
  const [activePresetName, setActivePresetName] = React.useState(() => (
    activeTrack?.soundName || null
  ));
  const [controlSections, setControlSections] = React.useState(DEFAULT_CONTROL_SECTIONS);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarTab, setSidebarTab] = React.useState('sound');
  const [soundBrowserTrackId, setSoundBrowserTrackId] = React.useState(null);
  // { trackId, value } while a deck's name is being edited in place.
  const [rename, setRename] = React.useState(null);
  const soundPopoverRef = React.useRef(null);
  const decksRef = React.useRef(null);
  const layerSwitchAtRef = React.useRef(-Infinity);

  const playback = useMidiPlayback({
    waveformType,
    audioParams,
    // The playhead reads the audio clock directly; this slower publication is
    // only for secondary sidebar UI and keeps large patterns cheap to render.
    progressUpdateIntervalMs: 120
  });

  const scrollRef = React.useRef(null);
  const topbarRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const lastLengthRef = React.useRef(getSnapBeats('1/16'));
  const auditionRef = React.useRef(null);
  const auditionTimeoutRef = React.useRef(null);
  const editRestartTimeoutRef = React.useRef(null);
  const recordingTimeoutRef = React.useRef(null);
  const recordingActiveRef = React.useRef(false);
  const draftRef = React.useRef(null);
  const draftSaveTimeoutRef = React.useRef(null);
  const cloudSyncTimeoutRef = React.useRef(null);
  const cloudPatternIdRef = React.useRef(null);
  const patternRef = React.useRef(pattern);
  const cleanPatternRef = React.useRef(pattern);
  const cloudSyncedPatternRef = React.useRef(pattern);
  const hasUnsavedChangesRef = React.useRef(false);
  const historyRef = React.useRef(null);
  if (!historyRef.current) historyRef.current = { undo: [], redo: [] };
  const gestureSnapshotRef = React.useRef(null);
  const clipboardRef = React.useRef(null);
  const timelinePrimedRef = React.useRef(false);

  const snapBeats = getSnapBeats(snapId);
  const totalBeats = patternBeats(pattern);
  const gridWidth = totalBeats * pxPerBeat;
  const soundBrowserTrack = pattern.tracks.find((track) => track.id === soundBrowserTrackId)
    || null;
  const activeTrackNotes = pattern.notes.filter((note) => note.trackId === activeTrack?.id);
  const loopRange = pattern.loopRange?.enabled ? pattern.loopRange : null;
  const playheadOffsetX = (loopRange?.start || 0) * pxPerBeat;
  const playheadTravelWidth = loopRange
    ? (loopRange.end - loopRange.start) * pxPerBeat
    : gridWidth;

  React.useEffect(() => {
    patternRef.current = pattern;
    const isDirty = pattern !== cleanPatternRef.current;
    hasUnsavedChangesRef.current = isDirty;
    setHasUnsavedChanges(isDirty);
  }, [pattern]);

  const flushDraft = React.useCallback(() => {
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }
    if (draftRef.current) saveEditorDraft(draftRef.current);
  }, []);

  React.useEffect(() => {
    draftRef.current = {
      pattern,
      snapId,
      scaleId,
      scaleRoot,
      chordTypeId,
      activeTrackId,
      pxPerBeat
    };
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => {
      draftSaveTimeoutRef.current = null;
      saveEditorDraft(draftRef.current);
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }, [pattern, snapId, scaleId, scaleRoot, chordTypeId, activeTrackId, pxPerBeat]);

  // The draft outlives the page on purpose: leaving flushes it, nothing clears it.
  React.useEffect(() => {
    window.addEventListener('pagehide', flushDraft);
    return () => {
      window.removeEventListener('pagehide', flushDraft);
      flushDraft();
    };
  }, [flushDraft]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    return registerUnsavedNavigationGuard(() => {
      if (!hasUnsavedChangesRef.current) return true;
      const shouldLeave = window.confirm(UNSAVED_WARNING);
      if (shouldLeave) {
        hasUnsavedChangesRef.current = false;
        setHasUnsavedChanges(false);
      }
      return shouldLeave;
    });
  }, [hasUnsavedChanges]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges]);

  React.useEffect(() => {
    if (pattern.tracks.some((track) => track.id === activeTrackId)) return;
    const fallback = pattern.tracks[0];
    if (fallback) {
      setActiveTrackId(fallback.id);
      setWaveformType(fallback.instrument);
      setAudioParams(sanitizeAudioParams(fallback.audioParams || AUDIO_PARAM_DEFAULTS));
      setActivePresetName(fallback.soundName || null);
    }
  }, [activeTrackId, pattern.tracks]);

  React.useEffect(() => {
    audioEngine.setSanitizedGlobalParams(audioParams);
  }, [audioParams]);

  React.useEffect(() => audioEngine.subscribeRecording((recording) => {
    recordingActiveRef.current = recording;
    setIsRecordingLoop(recording);
  }), []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawGrid(canvas, {
        bars: pattern.bars,
        chordTypeId,
        snapBeats,
        scaleId,
        scaleRoot,
        pxPerBeat
      });
    }
  }, [pattern.bars, chordTypeId, snapBeats, scaleId, scaleRoot, pxPerBeat]);

  // Open on the music: the middle of the pattern's notes sits mid-screen, and
  // an empty pattern opens around C5.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pitches = pattern.notes.map((note) => note.midi);
    const centerMidi = pitches.length > 0
      ? (Math.min(...pitches) + Math.max(...pitches)) / 2
      : 72;
    const centerY = (rowForMidi(Math.round(centerMidi)) + 0.5) * ROW_HEIGHT + RULER_HEIGHT;
    el.scrollTop = Math.max(0, centerY - el.clientHeight / 2);
    // Mount only: later edits must never move the grid under the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => () => {
    if (auditionTimeoutRef.current) clearTimeout(auditionTimeoutRef.current);
    if (auditionRef.current) audioEngine.stopNote(auditionRef.current);
    if (editRestartTimeoutRef.current) clearTimeout(editRestartTimeoutRef.current);
    if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
    if (recordingTimeoutRef.current) clearTimeout(recordingTimeoutRef.current);
    if (recordingActiveRef.current) audioEngine.stopRecording();
  }, []);

  const pushHistory = React.useCallback((snapshot) => {
    const history = historyRef.current;
    history.undo.push(snapshot);
    if (history.undo.length > HISTORY_LIMIT) history.undo.shift();
    history.redo = [];
  }, []);

  /** Apply a discrete, undoable pattern edit. */
  const commitPattern = React.useCallback((updater) => {
    pushHistory(patternRef.current);
    setPattern(updater);
  }, [pushHistory]);

  const handleUndo = React.useCallback(() => {
    const history = historyRef.current;
    const previous = history.undo.pop();
    if (!previous) return;
    history.redo.push(patternRef.current);
    setPattern(previous);
    setSelectedIds(new Set());
  }, []);

  const handleRedo = React.useCallback(() => {
    const history = historyRef.current;
    const next = history.redo.pop();
    if (!next) return;
    history.undo.push(patternRef.current);
    setPattern(next);
    setSelectedIds(new Set());
  }, []);

  // `sound` lets a caller audition a patch it is about to apply, before the
  // state holding that patch has been committed.
  const audition = React.useCallback((midi, sound) => {
    if (auditionTimeoutRef.current) clearTimeout(auditionTimeoutRef.current);
    if (auditionRef.current) audioEngine.stopNote(auditionRef.current);

    const started = audioEngine.playFrequency({
      noteId: `roll-audition-${midi}`,
      frequency: midiNoteToFrequency(midi),
      waveformType: sound?.waveformType || waveformType,
      params: sound?.params || audioParams,
      velocity: DEFAULT_VELOCITY
    });
    if (!started?.voiceId) return;

    auditionRef.current = started.voiceId;
    auditionTimeoutRef.current = setTimeout(() => {
      audioEngine.stopNote(started.voiceId);
      if (auditionRef.current === started.voiceId) auditionRef.current = null;
    }, AUDITION_MS);
  }, [waveformType, audioParams]);

  const handlePlayToggle = React.useCallback(() => {
    if (playback.isPlaying && !playback.isPaused) {
      playback.stop();
      return;
    }
    const midiData = patternToMidiData(patternRef.current, { useLoopRange: true });
    if (midiData.notes.length === 0) return;
    playback.play(midiData, { loop: true });
  }, [playback.isPlaying, playback.isPaused, playback.play, playback.stop]);

  // Live edits replace the scheduled score at the exact audio-clock position.
  // This keeps a debounced edit from seeking back to an older React frame.
  React.useEffect(() => {
    if (!playback.isPlaying || playback.isPaused) return undefined;
    if (editRestartTimeoutRef.current) clearTimeout(editRestartTimeoutRef.current);
    editRestartTimeoutRef.current = setTimeout(() => {
      editRestartTimeoutRef.current = null;
      const midiData = patternToMidiData(patternRef.current, { useLoopRange: true });
      if (midiData.notes.length === 0) {
        playback.stop();
        return;
      }
      playback.replaceMidi(midiData);
    }, EDIT_RESCHEDULE_DEBOUNCE_MS);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern]);

  const handleCopy = React.useCallback(() => {
    const payload = copyNotesPayload(patternRef.current, selectedIds);
    if (payload.length > 0) clipboardRef.current = payload;
  }, [selectedIds]);

  const handleCut = React.useCallback(() => {
    const payload = copyNotesPayload(patternRef.current, selectedIds);
    if (payload.length === 0) return;
    clipboardRef.current = payload;
    commitPattern((prev) => deleteNotes(prev, selectedIds));
    setSelectedIds(new Set());
  }, [selectedIds, commitPattern]);

  const handlePaste = React.useCallback(() => {
    const payload = clipboardRef.current;
    if (!payload || payload.length === 0) return;
    pushHistory(patternRef.current);
    const { pattern: next, noteIds } = pasteNotesPayload(
      patternRef.current,
      payload,
      0,
      activeTrackId
    );
    setPattern(next);
    setSelectedIds(new Set(noteIds));
  }, [activeTrackId, pushHistory]);

  const handleDuplicate = React.useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory(patternRef.current);
    const { pattern: next, noteIds } = duplicateNotes(
      patternRef.current,
      selectedIds,
      snapBeats
    );
    if (noteIds.length === 0) {
      historyRef.current.undo.pop();
      return;
    }
    setPattern(next);
    setSelectedIds(new Set(noteIds));
  }, [selectedIds, snapBeats, pushHistory]);

  const handleCloneInPlace = React.useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory(patternRef.current);
    const { pattern: next, noteIds } = cloneNotesInPlace(
      patternRef.current,
      selectedIds
    );
    if (noteIds.length === 0) {
      historyRef.current.undo.pop();
      return;
    }
    setPattern(next);
    setSelectedIds(new Set(noteIds));
  }, [selectedIds, pushHistory]);

  const handleNudge = React.useCallback((deltaBeats, deltaMidi) => {
    if (selectedIds.size === 0) return;
    commitPattern((prev) => nudgeNotes(prev, selectedIds, deltaBeats, deltaMidi));
  }, [selectedIds, commitPattern]);

  const handleResizeSelection = React.useCallback((deltaBeats, edge) => {
    if (selectedIds.size === 0) return;
    commitPattern((prev) => {
      const next = resizeNotes(prev, selectedIds, deltaBeats, edge);
      if (edge === 'right' && selectedIds.size === 1) {
        const [onlyId] = selectedIds;
        const note = next.notes.find((entry) => entry.id === onlyId);
        if (note) lastLengthRef.current = note.duration;
      }
      return next;
    });
  }, [selectedIds, commitPattern]);

  const handleLoopSelection = React.useCallback(() => {
    const next = toggleLoopForSelection(patternRef.current, selectedIds);
    if (next === patternRef.current) return;
    pushHistory(patternRef.current);
    setPattern(next);
  }, [pushHistory, selectedIds]);

  const handleSnapSelectionToScale = React.useCallback(() => {
    if (!scaleId || selectedIds.size === 0) return;
    commitPattern((prev) => snapNotesToScale(prev, selectedIds, scaleRoot, scaleId));
  }, [commitPattern, scaleId, scaleRoot, selectedIds]);

  const handleBuildChord = React.useCallback(() => {
    if (selectedIds.size === 0) return;
    pushHistory(patternRef.current);
    const { pattern: next, noteIds } = buildChords(
      patternRef.current,
      selectedIds,
      chordTypeId
    );
    if (noteIds.length === 0) {
      historyRef.current.undo.pop();
      return;
    }
    setPattern(next);
    setSelectedIds(new Set([...selectedIds, ...noteIds]));
  }, [chordTypeId, pushHistory, selectedIds]);

  const zoomTouchedRef = React.useRef(false);

  const applyZoom = React.useCallback((factor, anchorClientX = null) => {
    zoomTouchedRef.current = true;
    setPxPerBeat((current) => {
      const next = Math.min(Math.max(current * factor, ZOOM_MIN), ZOOM_MAX);
      if (Math.abs(next - current) < 0.01) return current;

      const el = scrollRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const anchor = anchorClientX === null
          ? rect.width / 2
          : anchorClientX - rect.left;
        const contentX = el.scrollLeft + anchor - KEY_COLUMN_WIDTH;
        const ratio = next / current;
        requestAnimationFrame(() => {
          el.scrollLeft = Math.max(0, contentX * ratio - anchor + KEY_COLUMN_WIDTH);
        });
      }
      return next;
    });
  }, []);

  // Fit is explicit: the default 100% zoom preserves a horizontally
  // scrollable canvas so reaching the right edge can reveal more bars.
  const fitZoom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const available = el.clientWidth - KEY_COLUMN_WIDTH;
    if (available <= 0) return;
    const beats = patternBeats(patternRef.current);
    zoomTouchedRef.current = false;
    setPxPerBeat(Math.min(Math.max(available / beats, ZOOM_MIN), ZOOM_MAX));
  }, []);

  // A native <details> only closes when its own summary is clicked again, so
  // the two topbar menus need a popover's dismissal manners. Closing means
  // clearing the `open` attribute — never unmounting — so the menu's contents
  // stay in the accessibility tree and reachable for assistive tech.
  const closeTopbarMenus = React.useCallback(() => {
    const open = topbarRef.current?.querySelectorAll('details[open]');
    if (!open || open.length === 0) return false;
    open.forEach((node) => { node.open = false; });
    return true;
  }, []);

  const runMenuAction = React.useCallback((action) => () => {
    closeTopbarMenus();
    action();
  }, [closeTopbarMenus]);

  React.useEffect(() => {
    const onPointerDown = (event) => {
      const open = topbarRef.current?.querySelectorAll('details[open]');
      if (!open) return;
      // Clicks inside a menu keep it open, so the cloud sign-in form can be
      // filled in and its "Link sent" status read.
      open.forEach((node) => {
        if (!node.contains(event.target)) node.open = false;
      });
    };
    // Capture, so an Escape that closes a menu is consumed here and does not
    // also reach the editor's own Escape (which clears the note selection).
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (closeTopbarMenus()) event.stopPropagation();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [closeTopbarMenus]);

  // Prime enough bars for the timeline to scroll on wide screens. Further
  // chunks are appended by handleTimelineScroll as the right edge nears.
  React.useEffect(() => {
    if (timelinePrimedRef.current) return;
    const el = scrollRef.current;
    if (!el || el.clientWidth <= KEY_COLUMN_WIDTH) return;
    timelinePrimedRef.current = true;
    const visibleBeats = (el.clientWidth - KEY_COLUMN_WIDTH) / pxPerBeat;
    const wantedBars = Math.ceil((visibleBeats / BEATS_PER_BAR) + BAR_CHUNK);
    const chunkedBars = Math.ceil(wantedBars / BAR_CHUNK) * BAR_CHUNK;
    setPattern((prev) => {
      if (chunkedBars <= prev.bars) return prev;
      const next = setPatternBars(prev, Math.min(MAX_PATTERN_BARS, chunkedBars));
      if (cleanPatternRef.current === prev) cleanPatternRef.current = next;
      return next;
    });
  }, [pxPerBeat]);

  const handleTimelineScroll = React.useCallback((event) => {
    const el = event.currentTarget;
    if (patternRef.current.bars >= MAX_PATTERN_BARS) return;
    const threshold = BEATS_PER_BAR * pxPerBeat * 2;
    if (el.scrollLeft + el.clientWidth < el.scrollWidth - threshold) return;
    setPattern((prev) => setPatternBars(
      prev,
      Math.min(MAX_PATTERN_BARS, prev.bars + BAR_CHUNK)
    ));
  }, [pxPerBeat]);

  // Ctrl/Cmd + wheel zoom needs a non-passive native listener.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      applyZoom(event.deltaY < 0 ? ZOOM_WHEEL_STEP : 1 / ZOOM_WHEEL_STEP, event.clientX);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const nodeName = event.target?.tagName;
      if (nodeName === 'INPUT' || nodeName === 'SELECT' || nodeName === 'TEXTAREA') return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.code === 'Space') {
        event.preventDefault();
        handlePlayToggle();
        return;
      }

      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (mod && key === 'y') {
        event.preventDefault();
        handleRedo();
        return;
      }
      if (mod && key === 'a') {
        event.preventDefault();
        setSelectedIds(new Set(
          patternRef.current.notes
            .filter((note) => note.trackId === activeTrackId)
            .map((note) => note.id)
        ));
        return;
      }
      if (mod && event.shiftKey && key === 'l') {
        event.preventDefault();
        handleLoopSelection();
        return;
      }
      if (mod && key === 'c') {
        event.preventDefault();
        handleCopy();
        return;
      }
      if (mod && key === 'x') {
        event.preventDefault();
        handleCut();
        return;
      }
      if (mod && key === 'v') {
        event.preventDefault();
        handlePaste();
        return;
      }
      if (mod && key === 'd') {
        event.preventDefault();
        if (event.shiftKey) handleCloneInPlace();
        else handleDuplicate();
        return;
      }

      if (event.key.startsWith('Arrow') && selectedIds.size > 0) {
        event.preventDefault();
        const step = snapBeats || MIN_NOTE_BEATS;
        const horizontal = event.key === 'ArrowRight' ? step
          : event.key === 'ArrowLeft' ? -step
            : 0;
        if (horizontal !== 0) {
          if (event.altKey) handleResizeSelection(horizontal, 'left');
          else if (event.shiftKey) handleResizeSelection(horizontal, 'right');
          else handleNudge(horizontal, 0);
          return;
        }
        if (event.key === 'ArrowUp') handleNudge(0, event.shiftKey ? 12 : 1);
        else if (event.key === 'ArrowDown') handleNudge(0, event.shiftKey ? -12 : -1);
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        setSelectedIds((prev) => {
          if (prev.size > 0) commitPattern((current) => deleteNotes(current, prev));
          return new Set();
        });
        return;
      }

      if (event.key === 'Escape') {
        setSelectedIds(new Set());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handlePlayToggle,
    handleUndo,
    handleRedo,
    handleCopy,
    handleCut,
    handlePaste,
    handleDuplicate,
    handleCloneInPlace,
    handleNudge,
    handleLoopSelection,
    handleResizeSelection,
    activeTrackId,
    selectedIds,
    snapBeats,
    commitPattern
  ]);

  const pointerToGrid = React.useCallback((event) => {
    const layer = event.currentTarget;
    const rect = layer.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height - 1);
    const beat = Math.min(x / pxPerBeat, patternBeats(patternRef.current));
    const row = Math.min(Math.max(Math.floor(y / ROW_HEIGHT), 0), ROW_COUNT - 1);
    return { beat, midi: midiForRow(row), x, y };
  }, [pxPerBeat]);

  const handleSelectTrack = React.useCallback((trackId) => {
    const track = patternRef.current.tracks.find((entry) => entry.id === trackId);
    if (!track) return;
    setActiveTrackId(trackId);
    setWaveformType(track.instrument);
    setAudioParams(sanitizeAudioParams(track.audioParams || AUDIO_PARAM_DEFAULTS));
    setActivePresetName(track.soundName || null);
    setSelectedIds(new Set());
  }, []);

  // Number keys jump straight to a layer; the activators show the same numbers.
  React.useEffect(() => {
    const onKeyDown = (event) => {
      const nodeName = event.target?.nodeName;
      if (nodeName === 'INPUT' || nodeName === 'SELECT' || nodeName === 'TEXTAREA') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (!/^[1-9]$/.test(event.key)) return;
      const track = patternRef.current.tracks[Number(event.key) - 1];
      if (track) handleSelectTrack(track.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSelectTrack]);

  // With many layers the deck column scrolls; keep the active one in view.
  React.useEffect(() => {
    decksRef.current?.querySelector('.is-active')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeTrackId]);

  const findNoteAt = React.useCallback((beat, midi) => (
    patternRef.current.notes.find((note) => (
      note.trackId === activeTrackId
      && note.midi === midi
      && beat >= note.start
      && beat < note.start + note.duration
    ))
  ), [activeTrackId]);

  const notesInMarquee = React.useCallback((rect) => {
    const [left, right] = [Math.min(rect.x0, rect.x1), Math.max(rect.x0, rect.x1)];
    const [top, bottom] = [Math.min(rect.y0, rect.y1), Math.max(rect.y0, rect.y1)];
    return patternRef.current.notes.filter((note) => {
      if (note.trackId !== activeTrackId) return false;
      const noteLeft = note.start * pxPerBeat;
      const noteRight = noteLeft + note.duration * pxPerBeat;
      const noteTop = rowForMidi(note.midi) * ROW_HEIGHT;
      return noteLeft < right && noteRight > left
        && noteTop < bottom && noteTop + ROW_HEIGHT > top;
    }).map((note) => note.id);
  }, [activeTrackId, pxPerBeat]);

  const beginMove = React.useCallback((anchorNote, beat, midi, selection) => {
    const ids = selection.has(anchorNote.id) ? selection : new Set([anchorNote.id]);
    const origins = new Map();
    patternRef.current.notes.forEach((note) => {
      if (note.trackId !== activeTrackId) return;
      if (ids.has(note.id)) origins.set(note.id, { start: note.start, midi: note.midi });
    });
    setDrag({
      mode: 'move',
      anchorId: anchorNote.id,
      grabBeats: beat - anchorNote.start,
      grabMidi: midi,
      origins,
      lastDeltaMidi: 0
    });
  }, [activeTrackId]);

  const handleLayerPointerDown = React.useCallback((event) => {
    const { beat, midi, x, y } = pointerToGrid(event);
    const noteId = event.target.dataset?.noteId || null;
    const hitNote = noteId
      ? patternRef.current.notes.find((note) => note.id === noteId)
      : findNoteAt(beat, midi);

    const onOtherLayer = Boolean(hitNote) && hitNote.trackId !== activeTrackId;

    if (event.button === 2) {
      gestureSnapshotRef.current = patternRef.current;
      // Erasing stays on the layer being edited.
      if (hitNote && !onOtherLayer) {
        setPattern((prev) => deleteNote(prev, hitNote.id));
        setSelectedIds((prev) => {
          if (!prev.has(hitNote.id)) return prev;
          const next = new Set(prev);
          next.delete(hitNote.id);
          return next;
        });
      }
      setDrag({ mode: 'delete-sweep' });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    if (onOtherLayer) {
      // Clicking any note brings its layer to the front with that note
      // selected. No move starts: this press only changes what is being edited.
      handleSelectTrack(hitNote.trackId);
      setSelectedIds(new Set([hitNote.id]));
      layerSwitchAtRef.current = performance.now();
      return;
    }

    if (hitNote) {
      gestureSnapshotRef.current = patternRef.current;
      const noteEndX = (hitNote.start + hitNote.duration) * pxPerBeat;
      const onResizeHandle = noteEndX - x <= RESIZE_HANDLE_PX;
      if (onResizeHandle) {
        setSelectedIds((prev) => (prev.has(hitNote.id) ? prev : new Set([hitNote.id])));
        setDrag({ mode: 'resize', noteId: hitNote.id });
        return;
      }

      let selection;
      if (event.shiftKey) {
        selection = new Set(selectedIds);
        if (selection.has(hitNote.id)) selection.delete(hitNote.id);
        else selection.add(hitNote.id);
        setSelectedIds(selection);
        if (!selection.has(hitNote.id)) return;
      } else {
        selection = selectedIds.has(hitNote.id) ? selectedIds : new Set([hitNote.id]);
        setSelectedIds(selection);
      }
      beginMove(hitNote, beat, midi, selection);
      return;
    }

    // Empty grid: start a marquee selection. Insertion is double-click.
    const baseSelection = event.shiftKey ? new Set(selectedIds) : new Set();
    if (!event.shiftKey) setSelectedIds(new Set());
    setDrag({ mode: 'marquee', x0: x, y0: y, x1: x, y1: y, baseSelection });
  }, [pointerToGrid, findNoteAt, selectedIds, beginMove, pxPerBeat, activeTrackId, handleSelectTrack]);

  const handleLayerDoubleClick = React.useCallback((event) => {
    const { beat, midi } = pointerToGrid(event);
    const noteId = event.target.dataset?.noteId || null;
    const hitNote = noteId
      ? patternRef.current.notes.find((note) => note.id === noteId)
      : findNoteAt(beat, midi);

    // The double-click's own pointerdown gestures may have stashed a
    // snapshot; the discrete commit below supersedes it.
    gestureSnapshotRef.current = null;

    if (hitNote) {
      // A double-click whose first press switched layers was aimed at the
      // layer, not at deleting the note it landed on.
      if (performance.now() - layerSwitchAtRef.current < LAYER_SWITCH_GUARD_MS) return;
      commitPattern((prev) => deleteNote(prev, hitNote.id));
      setSelectedIds(new Set());
      return;
    }

    const start = quantizeBeatsFloor(beat, snapBeats);
    const duration = lastLengthRef.current || snapBeats || 0.25;
    pushHistory(patternRef.current);
    const { pattern: nextPattern, note } = addNote(patternRef.current, {
      midi,
      start,
      duration,
      trackId: activeTrackId
    });
    setPattern(nextPattern);
    setSelectedIds(new Set([note.id]));
    audition(midi);
  }, [
    activeTrackId,
    audition,
    commitPattern,
    findNoteAt,
    pointerToGrid,
    pushHistory,
    snapBeats
  ]);

  const handleLayerPointerMove = React.useCallback((event) => {
    if (!drag) return;
    const { beat, midi, x, y } = pointerToGrid(event);

    if (drag.mode === 'delete-sweep') {
      const hit = findNoteAt(beat, midi);
      if (hit) setPattern((prev) => deleteNote(prev, hit.id));
      return;
    }

    if (drag.mode === 'marquee') {
      const rect = { ...drag, x1: x, y1: y };
      setDrag(rect);
      const inside = notesInMarquee(rect);
      setSelectedIds(new Set([...drag.baseSelection, ...inside]));
      return;
    }

    if (drag.mode === 'move') {
      const anchorOrigin = drag.origins.get(drag.anchorId);
      if (!anchorOrigin) return;
      const anchorStart = quantizeBeats(beat - drag.grabBeats, snapBeats);
      const deltaBeats = anchorStart - anchorOrigin.start;
      const deltaMidi = midi - drag.grabMidi;
      setPattern((prev) => applyNoteDelta(prev, drag.origins, deltaBeats, deltaMidi));
      if (deltaMidi !== drag.lastDeltaMidi) {
        audition(anchorOrigin.midi + deltaMidi);
        setDrag({ ...drag, lastDeltaMidi: deltaMidi });
      }
      return;
    }

    if (drag.mode === 'resize') {
      const note = patternRef.current.notes.find((entry) => entry.id === drag.noteId);
      if (!note) return;
      const minEnd = note.start + (snapBeats || MIN_NOTE_BEATS);
      const end = Math.max(quantizeBeats(beat, snapBeats), minEnd);
      setPattern((prev) => updateNote(prev, drag.noteId, { duration: end - note.start }));
    }
  }, [drag, pointerToGrid, findNoteAt, notesInMarquee, snapBeats, audition]);

  const handleLayerPointerUp = React.useCallback(() => {
    if (drag?.mode === 'resize') {
      const note = patternRef.current.notes.find((entry) => entry.id === drag.noteId);
      if (note) lastLengthRef.current = note.duration;
    }
    // One undo step per completed gesture, and only if it changed anything.
    const snapshot = gestureSnapshotRef.current;
    gestureSnapshotRef.current = null;
    if (snapshot && snapshot !== patternRef.current) pushHistory(snapshot);
    setDrag(null);
  }, [drag, pushHistory]);

  const handleKeyAudition = React.useCallback((midi) => {
    audition(midi);
  }, [audition]);

  const handleAddTrack = React.useCallback(() => {
    pushHistory(patternRef.current);
    const { pattern: next, track } = addTrack(patternRef.current);
    setPattern(next);
    setActiveTrackId(track.id);
    setWaveformType(track.instrument);
    setAudioParams(sanitizeAudioParams(track.audioParams || AUDIO_PARAM_DEFAULTS));
    setActivePresetName(track.soundName || null);
    setSelectedIds(new Set());
  }, [pushHistory]);

  const handleDeleteTrack = React.useCallback((trackId) => {
    if (patternRef.current.tracks.length <= 1) return;
    const next = deleteTrack(patternRef.current, trackId);
    pushHistory(patternRef.current);
    setPattern(next);
    if (trackId === activeTrackId) {
      const fallback = next.tracks[0];
      setActiveTrackId(fallback.id);
      setWaveformType(fallback.instrument);
      setAudioParams(sanitizeAudioParams(fallback.audioParams || AUDIO_PARAM_DEFAULTS));
      setActivePresetName(fallback.soundName || null);
      setSelectedIds(new Set());
    }
    setSoundBrowserTrackId((current) => (current === trackId ? null : current));
  }, [activeTrackId, pushHistory]);

  const handleTrackPatch = React.useCallback((trackId, patch) => {
    setPattern((prev) => updateTrack(prev, trackId, patch));
  }, []);

  const handleRenameStart = React.useCallback((track) => {
    setRename({ trackId: track.id, value: track.name });
  }, []);

  // Focus by hand: Preact, the production renderer, leaves an inserted
  // autoFocus input unfocused. The name starts selected, ready to be replaced.
  const renameInputRef = React.useRef(null);
  const renamingTrackId = rename?.trackId;
  React.useEffect(() => {
    if (renamingTrackId == null) return;
    renameInputRef.current?.focus();
    renameInputRef.current?.select();
  }, [renamingTrackId]);

  // Nothing is written until the edit is committed, so cancelling just drops it
  // — and a rename that changed nothing must not leave the pattern dirty.
  const handleRenameCommit = React.useCallback(() => {
    if (!rename) return;
    const name = rename.value.slice(0, 32);
    const track = patternRef.current.tracks.find((entry) => entry.id === rename.trackId);
    if (track && track.name !== name) handleTrackPatch(rename.trackId, { name });
    setRename(null);
  }, [handleTrackPatch, rename]);

  const handleRenameKeyDown = React.useCallback((event) => {
    if (event.key === 'Enter') handleRenameCommit();
    else if (event.key === 'Escape') setRename(null);
  }, [handleRenameCommit]);

  const handleSoundBrowserToggle = React.useCallback((trackId) => {
    handleSelectTrack(trackId);
    setSoundBrowserTrackId((current) => (current === trackId ? null : trackId));
  }, [handleSelectTrack]);

  const handleSoundChoose = React.useCallback((trackId, sound) => {
    const nextParams = sanitizeAudioParams(sound.audioParams || AUDIO_PARAM_DEFAULTS);
    handleTrackPatch(trackId, {
      instrument: sound.waveformType,
      soundId: sound.id,
      soundName: sound.name,
      soundCategory: sound.category,
      soundBank: sound.bank,
      audioParams: nextParams
    });
    if (trackId === activeTrackId) {
      setWaveformType(sound.waveformType);
      setAudioParams(nextParams);
      setActivePresetName(sound.name);
    }
    // The browser stays open so sounds can be compared; each pick plays itself.
    audition(60, { waveformType: sound.waveformType, params: nextParams });
  }, [activeTrackId, audition, handleTrackPatch]);

  const handleSoundBrowserClose = React.useCallback(() => {
    setSoundBrowserTrackId(null);
  }, []);

  React.useEffect(() => {
    if (!soundBrowserTrackId) return undefined;
    const onPointerDown = (event) => {
      if (soundPopoverRef.current?.contains(event.target)) return;
      // A deck's own sound button toggles the bank itself.
      if (event.target.closest?.('.piano-roll-deck__sound')) return;
      setSoundBrowserTrackId(null);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [soundBrowserTrackId]);

  React.useEffect(() => {
    if (!CLOUD_ENABLED) return undefined;
    let active = true;
    getSession().then((session) => {
      if (active) setCloudSession(session);
    });
    const unsubscribe = onAuthChange((session) => {
      if (active) setCloudSession(session);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!cloudSession) return undefined;
    if (!cloudPatternIdRef.current) cloudPatternIdRef.current = loadCloudPatternId();
    let active = true;
    listCloudPatterns().then((entries) => {
      if (!active) return;
      setCloudPatterns(entries);
      // An empty list also means "the query failed", so only a populated
      // library is allowed to retire a link to a row that is really gone.
      const linkedId = cloudPatternIdRef.current;
      if (entries.length > 0 && linkedId && !entries.some((entry) => entry.id === linkedId)) {
        cloudPatternIdRef.current = null;
        saveCloudPatternId(null);
      }
    });
    return () => {
      active = false;
    };
  }, [cloudSession]);

  const pushPatternToCloud = React.useCallback(async (target) => {
    const saved = await upsertCloudPattern({
      id: cloudPatternIdRef.current,
      name: target.name.trim().slice(0, 48) || 'Untitled loop',
      pattern: target
    });
    if (!saved) {
      setCloudSyncPending(true);
      return;
    }
    cloudPatternIdRef.current = saved.id;
    saveCloudPatternId(saved.id);
    cloudSyncedPatternRef.current = target;
    setCloudSyncPending(false);
    setCloudPatterns((prev) => [saved, ...prev.filter((entry) => entry.id !== saved.id)]);
  }, []);

  // Once a pattern has a cloud row, later edits follow it there quietly. A
  // failed push only leaves the row behind the local draft, which still holds
  // every edit, so the next edit simply tries again.
  React.useEffect(() => {
    if (!cloudSession || !cloudPatternIdRef.current) return undefined;
    if (pattern === cloudSyncedPatternRef.current) return undefined;
    if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
    cloudSyncTimeoutRef.current = setTimeout(() => {
      cloudSyncTimeoutRef.current = null;
      pushPatternToCloud(patternRef.current);
    }, CLOUD_SYNC_DEBOUNCE_MS);
    return undefined;
  }, [cloudSession, pattern, pushPatternToCloud]);

  const handleCloudEmailChange = React.useCallback((event) => {
    setCloudEmail(event.target.value);
    setCloudAuthStatus('idle');
  }, []);

  const handleSendSignInLink = React.useCallback(async (event) => {
    event.preventDefault();
    const email = cloudEmail.trim();
    if (!email) return;
    setCloudAuthStatus('sending');
    const { error } = await signInWithEmail(email);
    setCloudAuthStatus(error ? 'error' : 'sent');
  }, [cloudEmail]);

  const handleSignOut = React.useCallback(async () => {
    if (cloudSyncTimeoutRef.current) {
      clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
    }
    cloudPatternIdRef.current = null;
    saveCloudPatternId(null);
    await signOut();
    setCloudSession(null);
    setCloudPatterns(NO_CLOUD_PATTERNS);
    setCloudSyncPending(false);
    setCloudAuthStatus('idle');
  }, []);

  const handleSave = React.useCallback(() => {
    saveSavedPattern(patternRef.current);
    cleanPatternRef.current = patternRef.current;
    hasUnsavedChangesRef.current = false;
    setHasUnsavedChanges(false);
    setSavedPatterns(loadSavedPatterns());
    if (cloudSession) pushPatternToCloud(patternRef.current);
  }, [cloudSession, pushPatternToCloud]);

  const handleLoad = React.useCallback((entry) => {
    playback.stop();
    pushHistory(patternRef.current);
    const next = normalizePattern({ ...entry.pattern, name: entry.name });
    const cloudId = entry.source === 'cloud' ? entry.id : null;
    cloudPatternIdRef.current = cloudId;
    saveCloudPatternId(cloudId);
    cloudSyncedPatternRef.current = next;
    cleanPatternRef.current = next;
    hasUnsavedChangesRef.current = false;
    setPattern(next);
    setHasUnsavedChanges(false);
    setActiveTrackId(next.tracks[0].id);
    setWaveformType(next.tracks[0].instrument);
    setAudioParams(sanitizeAudioParams(next.tracks[0].audioParams || AUDIO_PARAM_DEFAULTS));
    setActivePresetName(next.tracks[0].soundName || null);
    setSoundBrowserTrackId(null);
    setSelectedIds(new Set());
  }, [playback.stop, pushHistory]);

  const handleDeleteSaved = React.useCallback((entry) => {
    if (entry.source !== 'cloud') {
      setSavedPatterns(deleteSavedPattern(entry.id));
      return;
    }
    if (entry.id === cloudPatternIdRef.current) {
      cloudPatternIdRef.current = null;
      saveCloudPatternId(null);
    }
    setCloudPatterns((prev) => prev.filter((item) => item.id !== entry.id));
    deleteCloudPattern(entry.id);
  }, []);

  const libraryEntries = React.useMemo(() => {
    const local = savedPatterns.map((entry) => ({ ...entry, source: 'local' }));
    if (cloudPatterns.length === 0) return local;
    return [
      ...cloudPatterns
        .filter((entry) => Array.isArray(entry.pattern?.notes))
        .map((entry) => ({ ...entry, source: 'cloud' })),
      ...local
    ];
  }, [cloudPatterns, savedPatterns]);

  const handleClear = React.useCallback(() => {
    playback.stop();
    commitPattern((prev) => ({
      ...prev,
      notes: prev.notes.filter((note) => note.trackId !== activeTrackId)
    }));
    setSelectedIds(new Set());
  }, [activeTrackId, playback.stop, commitPattern]);

  const handleBarsChange = React.useCallback((bars) => {
    const chunked = Math.round(bars / BAR_CHUNK) * BAR_CHUNK;
    commitPattern((prev) => setPatternBars(
      prev,
      Math.min(MAX_PATTERN_BARS, Math.max(BAR_CHUNK, chunked))
    ));
  }, [commitPattern]);

  const handleOpenInPlayer = React.useCallback(() => {
    const midiData = patternToMidiData(patternRef.current);
    if (midiData.notes.length === 0) return;
    if (!confirmUnsavedNavigation()) return;
    playback.stop();
    setPendingMidi(midiData);
    window.location.hash = '#/';
  }, [playback.stop]);

  const handleRecordLoop = React.useCallback(async () => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (isRecordingLoop) {
      playback.stop();
      audioEngine.stopRecording();
      return;
    }

    const midiData = patternToMidiData(patternRef.current, { useLoopRange: true });
    if (midiData.notes.length === 0) return;
    playback.stop();
    await audioEngine.startRecording();
    playback.play(midiData, { loop: false });
    recordingTimeoutRef.current = setTimeout(() => {
      recordingTimeoutRef.current = null;
      playback.stop();
      audioEngine.stopRecording();
    }, Math.max(0, midiData.duration * 1000) + RECORDING_TAIL_MS);
  }, [isRecordingLoop, playback.play, playback.stop]);

  const handleParamChange = React.useCallback((paramName, value) => {
    const nextParams = sanitizeAudioParams({ ...audioParams, [paramName]: value });
    setAudioParams(nextParams);
    setPattern((prev) => updateTrack(prev, activeTrackId, {
      audioParams: nextParams,
      soundId: null
    }));
  }, [activeTrackId, audioParams]);

  const handleParamsChange = React.useCallback((nextParams) => {
    const mergedParams = sanitizeAudioParams({ ...audioParams, ...nextParams });
    setAudioParams(mergedParams);
    setPattern((prev) => updateTrack(prev, activeTrackId, {
      audioParams: mergedParams,
      soundId: null
    }));
  }, [activeTrackId, audioParams]);

  const handleWaveformChange = React.useCallback((instrument) => {
    setWaveformType(instrument);
    setPattern((prev) => updateTrack(prev, activeTrackId, {
      instrument,
      soundId: null,
      soundName: instrument,
      soundCategory: 'Basic waveforms',
      soundBank: 'Waveforms'
    }));
    setActivePresetName(instrument);
  }, [activeTrackId]);

  const handleControlSectionToggle = React.useCallback((section) => {
    setControlSections((prev) => (
      Object.prototype.hasOwnProperty.call(prev, section)
        ? { ...prev, [section]: !prev[section] }
        : prev
    ));
  }, []);

  const handleSidebarOpen = React.useCallback(() => setSidebarOpen(true), []);
  const handleSidebarClose = React.useCallback(() => setSidebarOpen(false), []);

  const soundControlsValue = React.useMemo(() => ({
    waveformType,
    onWaveformChange: handleWaveformChange,
    audioParams,
    onParamChange: handleParamChange,
    onParamsChange: handleParamsChange,
    transportBpm: pattern.bpm,
    controlSections,
    onControlSectionToggle: handleControlSectionToggle
  }), [
    waveformType,
    handleWaveformChange,
    audioParams,
    pattern.bpm,
    controlSections,
    handleParamChange,
    handleParamsChange,
    handleControlSectionToggle
  ]);

  const handleMidiHandoff = React.useCallback((midiData) => {
    if (!confirmUnsavedNavigation()) return;
    setPendingMidi(midiData);
    window.location.hash = '#/';
  }, []);

  const midiTransportValue = React.useMemo(() => ({
    isPlaying: playback.isPlaying,
    isPaused: playback.isPaused,
    progress: playback.progress,
    currentMidi: playback.currentMidi,
    tempoFactor: playback.tempoFactor,
    onPlay: handleMidiHandoff,
    onPause: playback.pause,
    onResume: playback.resume,
    onStop: playback.stop,
    onTempoChange: playback.setTempo
  }), [
    playback.isPlaying,
    playback.isPaused,
    playback.progress,
    playback.currentMidi,
    playback.tempoFactor,
    handleMidiHandoff,
    playback.pause,
    playback.resume,
    playback.stop,
    playback.setTempo
  ]);

  const isRolling = playback.isPlaying && !playback.isPaused;

  const activeScale = React.useMemo(
    () => SCALES.find((scale) => scale.id === scaleId) || null,
    [scaleId]
  );
  const scalePitchClasses = React.useMemo(() => {
    if (!activeScale) return null;
    return new Set(activeScale.intervals.map((interval) => (scaleRoot + interval) % 12));
  }, [activeScale, scaleRoot]);
  const isScaleMidi = React.useCallback((midi) => (
    scalePitchClasses?.has(((midi % 12) + 12) % 12) || false
  ), [scalePitchClasses]);
  const isChordMidi = React.useCallback((midi) => (
    Boolean(activeScale) && isInChord(midi, scaleRoot, chordTypeId)
  ), [activeScale, chordTypeId, scaleRoot]);
  const keyRows = React.useMemo(() => {
    const rows = [];
    for (let row = 0; row < ROW_COUNT; row += 1) {
      const midi = midiForRow(row);
      const { noteName, octave, noteId } = midiNoteToName(midi);
      const inScale = isScaleMidi(midi);
      const inChord = isChordMidi(midi);
      rows.push({
        midi,
        noteId,
        label: activeScale && (inScale || inChord) ? noteId : (noteName === 'C' ? `C${octave}` : ''),
        black: isBlackKey(midi),
        inScale,
        inChord
      });
    }
    return rows;
  }, [activeScale, isChordMidi, isScaleMidi]);

  const barMarkers = React.useMemo(() => (
    Array.from({ length: pattern.bars }, (_, index) => index)
  ), [pattern.bars]);

  const outOfScaleCount = React.useMemo(() => (
    activeScale ? activeTrackNotes.filter((note) => !isScaleMidi(note.midi)).length : 0
  ), [activeScale, activeTrackNotes, isScaleMidi]);

  const ghostNoteElements = React.useMemo(() => pattern.notes
    .filter((note) => note.trackId !== activeTrack?.id)
    .map((note) => {
      const track = pattern.tracks.find((entry) => entry.id === note.trackId);
      return (
        <div
          key={`ghost-${note.id}`}
          data-note-id={note.id}
          className={`piano-roll__ghost-note ${track?.muted ? 'is-muted' : ''}`}
          title={`${track?.name || 'Layer'} · ${midiNoteToName(note.midi).noteId} — click to edit this layer`}
          style={{
            '--track-color': track?.color,
            left: note.start * pxPerBeat,
            top: rowForMidi(note.midi) * ROW_HEIGHT + 1,
            width: Math.max(note.duration * pxPerBeat - 1, 4),
            height: ROW_HEIGHT - 2
          }}
        >
          {noteNameFits(midiNoteToName(note.midi).noteId, note.duration * pxPerBeat) && (
            <span className="piano-roll__note-name">{midiNoteToName(note.midi).noteId}</span>
          )}
        </div>
      );
    }), [activeTrack?.id, pattern.notes, pattern.tracks, pxPerBeat]);

  const noteElements = React.useMemo(() => activeTrackNotes.map((note) => {
    const outOfScale = Boolean(activeScale) && !isScaleMidi(note.midi);
    const classNames = [
      'piano-roll__note',
      selectedIds.has(note.id) ? 'is-selected' : '',
      outOfScale ? 'is-out-of-scale' : ''
    ].filter(Boolean).join(' ');
    return (
      <div
        key={note.id}
        data-note-id={note.id}
        className={classNames}
        title={outOfScale ? `${midiNoteToName(note.midi).noteId} is outside ${SCALE_ROOTS[scaleRoot]} ${activeScale.label}` : undefined}
        style={{
          '--track-color': activeTrack?.color,
          left: note.start * pxPerBeat,
          top: rowForMidi(note.midi) * ROW_HEIGHT + 1,
          width: Math.max(note.duration * pxPerBeat - 1, 4),
          height: ROW_HEIGHT - 2
        }}
      >
        {noteNameFits(midiNoteToName(note.midi).noteId, note.duration * pxPerBeat) && (
          <span className="piano-roll__note-name">{midiNoteToName(note.midi).noteId}</span>
        )}
      </div>
    );
  }), [activeScale, activeTrack?.color, activeTrackNotes, isScaleMidi, pxPerBeat, scaleRoot, selectedIds]);

  return (
    <div className="piano-roll-page">
      <div className="piano-roll-topbar" ref={topbarRef}>
        <button
          type="button"
          className="btn btn--accent piano-roll-topbar__play"
          onClick={handlePlayToggle}
          aria-label={isRolling ? 'Stop the loop' : 'Play the loop'}
          title={isRolling ? 'Stop the loop (Space)' : 'Play the loop (Space)'}
        >
          {isRolling ? ICON_STOP : ICON_PLAY}
          <span>{isRolling ? 'Stop' : 'Play'}</span>
        </button>
        <button
          type="button"
          className={`btn btn--icon piano-roll-topbar__record ${isRecordingLoop ? 'is-recording' : ''}`}
          onClick={handleRecordLoop}
          disabled={!isRecordingLoop && pattern.notes.length === 0}
          aria-label={isRecordingLoop ? 'Stop recording' : 'Record loop'}
          title={isRecordingLoop
            ? 'Stop recording'
            : (pattern.notes.length === 0
              ? 'Add notes first'
              : 'Record one pass of the loop to a WAV file')}
        >
          {ICON_RECORD}
        </button>
        <input
          className="piano-roll-topbar__name"
          value={pattern.name}
          onChange={(event) => setPattern((prev) => ({ ...prev, name: event.target.value }))}
          aria-label="Pattern name"
        />
        {hasUnsavedChanges && (
          <span
            className="piano-roll-topbar__dirty"
            role="status"
            aria-label="Unsaved changes"
            title="Unsaved changes"
          />
        )}
        {/* Tempo, length, snap and key live in the bar as quiet inline controls:
            a row of their own cost the grid 50px for values that rarely change. */}
        <div className="piano-roll-topbar__settings" role="group" aria-label="Pattern settings">
          <label className="piano-roll-setting">
            <span>BPM</span>
            <input
              type="number"
              min={BPM_MIN}
              max={BPM_MAX}
              value={pattern.bpm}
              onChange={(event) => {
                const bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Number(event.target.value) || 120));
                setPattern((prev) => ({ ...prev, bpm }));
              }}
            />
          </label>

          <div className="piano-roll-setting">
            <div className="piano-roll-stepper" role="group" aria-label="Timeline bars">
              <button
                type="button"
                onClick={() => handleBarsChange(pattern.bars - BAR_CHUNK)}
                disabled={pattern.bars <= BAR_CHUNK}
                aria-label={`Remove ${BAR_CHUNK} bars`}
                title={`Remove ${BAR_CHUNK} bars`}
              >
                −
              </button>
              <output>{pattern.bars} bars</output>
              <button
                type="button"
                onClick={() => handleBarsChange(pattern.bars + BAR_CHUNK)}
                disabled={pattern.bars >= MAX_PATTERN_BARS}
                aria-label={`Add ${BAR_CHUNK} bars`}
                title={`Add ${BAR_CHUNK} bars`}
              >
                +
              </button>
            </div>
          </div>

          <label className="piano-roll-setting">
            <span>Snap</span>
            <select value={snapId} onChange={(event) => setSnapId(event.target.value)}>
              {SNAP_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="piano-roll-setting">
            <span>Scale</span>
            <select value={scaleId} onChange={(event) => setScaleId(event.target.value)}>
              <option value="">Off</option>
              {SCALES.map((scale) => (
                <option key={scale.id} value={scale.id}>{scale.label}</option>
              ))}
            </select>
          </label>

          {scaleId && (
            <label className="piano-roll-setting">
              <span>Key</span>
              <select
                value={scaleRoot}
                onChange={(event) => setScaleRoot(Number(event.target.value))}
              >
                {SCALE_ROOTS.map((root, index) => (
                  <option key={root} value={index}>{root}</option>
                ))}
              </select>
            </label>
          )}

          {activeScale && outOfScaleCount > 0 && (
            <span className="piano-roll-setting__outside">{outOfScaleCount} outside</span>
          )}
        </div>
        <div className="piano-roll-topbar__zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            onClick={() => applyZoom(1 / ZOOM_STEP)}
            disabled={pxPerBeat <= ZOOM_MIN + 0.01}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className="piano-roll-topbar__zoom-fit"
            onClick={fitZoom}
            aria-label="Fit pattern to view"
            title="Fit the whole pattern on screen"
          >
            {Math.round((pxPerBeat / DEFAULT_PX_PER_BEAT) * 100)}%
          </button>
          <button
            type="button"
            onClick={() => applyZoom(ZOOM_STEP)}
            disabled={pxPerBeat >= ZOOM_MAX - 0.01}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
        </div>
        <details className="piano-roll-topbar__help">
          <summary
            className="btn btn--icon"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
          >
            {ICON_HELP}
          </summary>
          <div className="piano-roll-topbar__help-panel">
            <h2>Shortcuts</h2>
            <dl>
              <dt>Double-click</dt><dd>Add / remove note</dd>
              <dt>Click · drag</dt><dd>Select · multi-select</dd>
              <dt>1–9 · click a note</dt><dd>Switch layer</dd>
              <dt>Drag note</dt><dd>Move selection</dd>
              <dt>Drag right edge</dt><dd>Resize</dd>
              <dt>Arrows · ⇧↑↓</dt><dd>Nudge · octave</dd>
              <dt>⇧← ⇧→</dt><dd>Shrink · grow (right edge)</dd>
              <dt>⌥← ⌥→</dt><dd>Trim start (left edge)</dd>
              <dt>⌘Z · ⇧⌘Z</dt><dd>Undo · redo</dd>
              <dt>⌘C ⌘X ⌘V</dt><dd>Copy · cut · paste</dd>
              <dt>⌘D</dt><dd>Duplicate right</dd>
              <dt>⇧⌘D</dt><dd>Clone in place, then nudge</dd>
              <dt>⇧⌘L</dt><dd>Loop selected bars</dd>
              <dt>⌘A · Esc</dt><dd>Select all · none</dd>
              <dt>Del</dt><dd>Delete selection</dd>
              <dt>Right-click</dt><dd>Erase</dd>
              <dt>⌘ + scroll</dt><dd>Zoom</dd>
              <dt>Space</dt><dd>Play / stop</dd>
            </dl>
          </div>
        </details>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleSave}
          title="Save this pattern to your library"
        >
          Save
        </button>
        <details className="piano-roll-topbar__more">
          <summary
            className="btn btn--icon"
            aria-label="More editor actions"
            title="More: open a pattern, layer actions, account"
          >
            {ICON_MORE}
          </summary>
          <div className="piano-roll-menu">
            {libraryEntries.length > 0 && (
              <>
                <h2 className="piano-roll-menu__heading">Open pattern</h2>
                <ul className="piano-roll-menu__list">
                  {libraryEntries.map((entry) => (
                    <li key={`${entry.source}-${entry.id}`} className="piano-roll-menu__entry">
                      <button
                        type="button"
                        className="btn piano-roll-menu__load"
                        onClick={runMenuAction(() => handleLoad(entry))}
                        title={`Open ${entry.name} in the editor`}
                      >
                        {entry.name}
                      </button>
                      <button
                        type="button"
                        className="btn piano-roll-menu__delete"
                        onClick={() => handleDeleteSaved(entry)}
                        aria-label={`Delete saved pattern ${entry.name}`}
                      >
                        Delete
                      </button>
                      <span className="piano-roll-menu__meta">
                        {entry.source === 'cloud' ? 'Cloud · ' : ''}
                        {entry.pattern.bars} bars · {entry.pattern.bpm} BPM · {entry.pattern.notes.length} notes
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <button
              type="button"
              className="btn piano-roll-menu__item"
              onClick={runMenuAction(handleClear)}
              title={`Delete every note on ${activeTrack?.name || 'this layer'}`}
            >
              Clear layer
            </button>
            {pattern.tracks.length > 1 && (
              <button
                type="button"
                className="btn piano-roll-menu__item"
                onClick={runMenuAction(() => handleDeleteTrack(activeTrack?.id))}
                title={`Remove ${activeTrack?.name || 'this layer'} and its notes`}
              >
                Delete layer
              </button>
            )}
            <button
              type="button"
              className="btn piano-roll-menu__item"
              onClick={runMenuAction(handleOpenInPlayer)}
              title="Load this pattern in the main player"
            >
              Send to player
            </button>

            {CLOUD_ENABLED && (
              <div className="piano-roll-cloud">
                {cloudSession ? (
                  <>
                    <span className="piano-roll-cloud__status">
                      Signed in · {cloudSession.user?.email}
                    </span>
                    {cloudSyncPending && (
                      <i className="piano-roll-cloud__pending" title="Cloud sync pending" />
                    )}
                    <button type="button" className="btn btn--secondary" onClick={handleSignOut}>
                      Sign out
                    </button>
                  </>
                ) : (
                  <form className="piano-roll-cloud__form" onSubmit={handleSendSignInLink}>
                    <input
                      type="email"
                      value={cloudEmail}
                      onChange={handleCloudEmailChange}
                      placeholder="you@email.com"
                      aria-label="Email address for the sign-in link"
                    />
                    <button
                      type="submit"
                      className="btn btn--secondary"
                      disabled={!cloudEmail.trim() || cloudAuthStatus === 'sending'}
                    >
                      {cloudAuthStatus === 'sending' ? 'Sending…' : 'Send sign-in link'}
                    </button>
                    {cloudAuthStatus === 'sent' && (
                      <span className="piano-roll-cloud__note" role="status">
                        Link sent — check your email
                      </span>
                    )}
                    {cloudAuthStatus === 'error' && (
                      <span className="piano-roll-cloud__note" role="status">
                        Could not send the link
                      </span>
                    )}
                  </form>
                )}
              </div>
            )}
          </div>
        </details>
      </div>

      <div className="piano-roll-stage">
        <div
          className="piano-roll"
          ref={scrollRef}
          onScroll={handleTimelineScroll}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            className="piano-roll__content"
            style={{
              gridTemplateColumns: `${KEY_COLUMN_WIDTH}px ${gridWidth}px`,
              gridTemplateRows: `${RULER_HEIGHT}px ${GRID_HEIGHT}px`
            }}
          >
            <div className="piano-roll__corner" />

            <div className="piano-roll__ruler" aria-hidden="true">
              {barMarkers.map((bar) => (
                <span
                  key={bar}
                  className="piano-roll__bar-marker"
                  style={{ left: bar * BEATS_PER_BAR * pxPerBeat }}
                >
                  {bar + 1}
                </span>
              ))}
            </div>

            <div className="piano-roll__keys" style={{ '--track-color': activeTrack?.color }}>
              {keyRows.map((key) => (
                <button
                  key={key.midi}
                  type="button"
                  className={[
                    'piano-roll__key',
                    key.black ? 'piano-roll__key--black' : '',
                    activeScale && !key.inScale ? 'is-out-of-scale' : '',
                    key.inScale ? 'is-in-scale' : '',
                    key.inChord ? 'is-in-chord' : '',
                  ].filter(Boolean).join(' ')}
                  style={{ height: ROW_HEIGHT }}
                  onPointerDown={() => handleKeyAudition(key.midi)}
                  aria-label={`Audition ${key.noteId}`}
                >
                  {key.label}
                </button>
              ))}
            </div>

            <div className="piano-roll__grid">
              <canvas ref={canvasRef} className="piano-roll__grid-canvas" />
              <div
                className="piano-roll__notes"
                role="application"
                aria-label="Note grid: double-click to add, drag to select, click to select, Delete to remove, right-click to erase"
                onPointerDown={handleLayerPointerDown}
                onPointerMove={handleLayerPointerMove}
                onPointerUp={handleLayerPointerUp}
                onPointerCancel={handleLayerPointerUp}
                onDoubleClick={handleLayerDoubleClick}
              >
                {loopRange && (
                  <div
                    className="piano-roll__loop-region"
                    style={{
                      left: loopRange.start * pxPerBeat,
                      width: (loopRange.end - loopRange.start) * pxPerBeat
                    }}
                  >
                    <span>Loop · bars {Math.floor(loopRange.start / BEATS_PER_BAR) + 1}–{Math.ceil(loopRange.end / BEATS_PER_BAR)}</span>
                  </div>
                )}
                {ghostNoteElements}
                {noteElements}
                {drag?.mode === 'marquee' && (
                  <div
                    className="piano-roll__marquee"
                    style={{
                      left: Math.min(drag.x0, drag.x1),
                      top: Math.min(drag.y0, drag.y1),
                      width: Math.abs(drag.x1 - drag.x0),
                      height: Math.abs(drag.y1 - drag.y0)
                    }}
                  />
                )}
                {isRolling && (
                  <PianoRollPlayhead
                    getProgress={playback.getPlaybackProgress}
                    offsetX={playheadOffsetX}
                    travelWidth={playheadTravelWidth}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="piano-roll-decks" aria-label="Tracks" ref={decksRef}>
          <div className="piano-roll-decks__list">
            {pattern.tracks.map((track, trackIndex) => {
              const isActive = track.id === activeTrack?.id;
              const noteCount = pattern.notes.filter((note) => note.trackId === track.id).length;
              const muteLabel = track.muted ? `Turn ${track.name} on` : `Turn ${track.name} off`;
              return (
                <div
                  key={track.id}
                  className={`piano-roll-deck ${isActive ? 'is-active' : ''}`}
                  style={{ '--track-color': track.color }}
                >
                  <button
                    type="button"
                    className="piano-roll-deck__power"
                    onClick={() => handleTrackPatch(track.id, { muted: !track.muted })}
                    aria-pressed={!track.muted}
                    aria-label={muteLabel}
                    title={muteLabel}
                  >
                    {trackIndex + 1}
                  </button>
                  {rename?.trackId === track.id ? (
                    <input
                      ref={renameInputRef}
                      className="piano-roll-deck__rename"
                      value={rename.value}
                      onChange={(event) => setRename({ trackId: track.id, value: event.target.value })}
                      onBlur={handleRenameCommit}
                      onKeyDown={handleRenameKeyDown}
                      aria-label={`Rename ${track.name}`}
                    />
                  ) : (
                    <button
                      type="button"
                      className="piano-roll-deck__select"
                      onClick={() => handleSelectTrack(track.id)}
                      onDoubleClick={() => handleRenameStart(track)}
                      aria-pressed={isActive}
                      aria-label={`Edit ${track.name}: ${noteCount} notes`}
                      title={`Edit ${track.name}: ${noteCount} notes${trackIndex < 9 ? ` (press ${trackIndex + 1})` : ''} — double-click to rename`}
                    >
                      <span>{track.name}</span>
                    </button>
                  )}
                  {pattern.tracks.length > 1 && (
                    <button
                      type="button"
                      className="btn btn--toggle piano-roll-deck__solo"
                      onClick={() => handleTrackPatch(track.id, { solo: !track.solo })}
                      aria-pressed={track.solo}
                      aria-label={`${track.solo ? 'Unsolo' : 'Solo'} ${track.name}`}
                      title={`${track.solo ? 'Unsolo' : 'Solo'} ${track.name}`}
                    >
                      S
                    </button>
                  )}
                  {/* Every track can change its sound in one click. The track being
                      edited shows the sound by name on a second row; the others
                      keep to one row and show only the chevron. */}
                  <button
                    type="button"
                    className="piano-roll-deck__sound"
                    onClick={() => handleSoundBrowserToggle(track.id)}
                    aria-expanded={soundBrowserTrackId === track.id}
                    aria-label={`Choose sound for ${track.name}. Current sound: ${track.soundName || track.instrument}`}
                    title={`Choose sound for ${track.name}`}
                  >
                    <span>{track.soundName || track.instrument}</span>
                    {ICON_CHEVRON}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="btn piano-roll-decks__add"
            onClick={handleAddTrack}
            aria-label="Add track"
            title="Add track"
          >
            {ICON_PLUS}
          </button>

          {soundBrowserTrack && (
            <div className="piano-roll-sound-popover" ref={soundPopoverRef}>
              <React.Suspense fallback={null}>
                <LayerSoundBrowser
                  track={soundBrowserTrack}
                  onChoose={handleSoundChoose}
                  onClose={handleSoundBrowserClose}
                />
              </React.Suspense>
            </div>
          )}
        </aside>
      </div>

      {/* Selection actions float over the bottom of the grid. Inside the tray they
          wrapped onto a line of their own on narrower windows, which shoved the
          grid down the instant a note was selected. */}
      {(selectedIds.size > 0 || loopRange) && (
        <div className="piano-roll-selection" aria-live="polite">
          {selectedIds.size > 0 && (
            <>
              <span className="piano-roll-selection__count">{selectedIds.size} selected</span>
              <select
                value={chordTypeId}
                onChange={(event) => setChordTypeId(event.target.value)}
                aria-label="Chord type"
              >
                {CHORD_TYPES.map((chord) => (
                  <option key={chord.id} value={chord.id}>{chord.label}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={handleBuildChord}
                title="Turn each selected note into a chord"
              >
                Add chord
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleLoopSelection}
            disabled={selectedIds.size === 0 && !loopRange}
            title={loopRange
              ? 'Go back to playing the whole timeline (⇧⌘L)'
              : 'Play only the bars you selected, over and over (⇧⌘L)'}
          >
            {loopRange ? 'Unloop' : 'Loop these bars'}
          </button>
          {activeScale && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleSnapSelectionToScale}
              disabled={selectedIds.size === 0}
              title={`Move the selected notes onto the nearest ${SCALE_ROOTS[scaleRoot]} ${activeScale.label} note`}
            >
              Snap to key
            </button>
          )}
        </div>
      )}

      <SoundControlsContext.Provider value={soundControlsValue}>
        <MidiTransportContext.Provider value={midiTransportValue}>
          <Sidebar
            isOpen={sidebarOpen}
            onOpen={handleSidebarOpen}
            onClose={handleSidebarClose}
            activeTab={sidebarTab}
            onTabChange={setSidebarTab}
            currentView="editor"
            isMidiPlaying={isRolling}
            midiName={pattern.name}
            soundLabel={activePresetName || waveformType}
          />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    </div>
  );
};

export default PianoRollPage;
