import React from 'react';
import LayerSoundBrowser from '../components/LayerSoundBrowser.jsx';
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

const ROW_HEIGHT = 14;
const KEY_COLUMN_WIDTH = 64;
const RULER_HEIGHT = 30;
const RESIZE_HANDLE_PX = 7;
const AUDITION_MS = 260;
const ROW_COUNT = PITCH_MAX - PITCH_MIN + 1;
const GRID_HEIGHT = ROW_COUNT * ROW_HEIGHT;
const EDIT_RESCHEDULE_DEBOUNCE_MS = 120;
const DRAFT_SAVE_DEBOUNCE_MS = 400;
const CLOUD_SYNC_DEBOUNCE_MS = 2000;
const HISTORY_LIMIT = 100;
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

  for (let row = 0; row < ROW_COUNT; row += 1) {
    const midi = midiForRow(row);
    const y = row * ROW_HEIGHT;
    const hasScale = Boolean(scaleId);
    ctx.fillStyle = hasScale
      ? (isBlackKey(midi) ? 'rgba(6, 9, 14, 0.99)' : 'rgba(10, 14, 20, 0.99)')
      : (isBlackKey(midi) ? 'rgba(10, 14, 21, 0.98)' : 'rgba(17, 23, 33, 0.98)');
    ctx.fillRect(0, y, width, ROW_HEIGHT);

    if (hasScale) {
      const isScaleTone = isInScale(midi, scaleRoot, scaleId);
      const isChordTone = isInChord(midi, scaleRoot, chordTypeId);
      if (!isScaleTone && !isChordTone) continue;
      ctx.fillStyle = 'rgba(89, 160, 177, 0.38)';
      ctx.fillRect(0, y, width, ROW_HEIGHT);
      ctx.fillStyle = 'rgba(173, 223, 232, 0.42)';
      ctx.fillRect(0, y, width, 1);
    }
  }

  // Horizontal row lines; octave boundaries (B->C) brighter.
  for (let row = 0; row <= ROW_COUNT; row += 1) {
    const midi = midiForRow(row);
    const y = row * ROW_HEIGHT + 0.5;
    ctx.strokeStyle = (((midi % 12) + 12) % 12) === 11
      ? 'rgba(255, 255, 255, 0.2)'
      : 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Vertical lines with FL-style hierarchy: subdivisions faint (thirds when
  // a triplet snap is active), beats medium, bars strongest.
  const subdivision = snapBeats || 0.25;
  const totalBeats = bars * BEATS_PER_BAR;
  for (let beat = 0; beat <= totalBeats + 1e-6; beat += subdivision) {
    const x = Math.round(beat * pxPerBeat) + 0.5;
    const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
    const onBar = onBeat && Math.round(beat) % BEATS_PER_BAR === 0;
    ctx.strokeStyle = onBar
      ? 'rgba(255, 255, 255, 0.3)'
      : onBeat
        ? 'rgba(255, 255, 255, 0.13)'
        : 'rgba(255, 255, 255, 0.055)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GRID_HEIGHT);
    ctx.stroke();
  }
};

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
      : 56
  ));
  const [trayOpen, setTrayOpen] = React.useState(true);
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

  const playback = useMidiPlayback({
    waveformType,
    audioParams,
    // The playhead reads the audio clock directly; this slower publication is
    // only for secondary sidebar UI and keeps large patterns cheap to render.
    progressUpdateIntervalMs: 120
  });

  const scrollRef = React.useRef(null);
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

  // Boot the viewport around C5 so melodies land mid-screen.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = rowForMidi(84) * ROW_HEIGHT;
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

  const audition = React.useCallback((midi) => {
    if (auditionTimeoutRef.current) clearTimeout(auditionTimeoutRef.current);
    if (auditionRef.current) audioEngine.stopNote(auditionRef.current);

    const started = audioEngine.playFrequency({
      noteId: `roll-audition-${midi}`,
      frequency: midiNoteToFrequency(midi),
      waveformType,
      params: audioParams,
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
      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
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

    if (event.button === 2) {
      gestureSnapshotRef.current = patternRef.current;
      if (hitNote) {
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
  }, [pointerToGrid, findNoteAt, selectedIds, beginMove, pxPerBeat]);

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

  const handleSelectTrack = React.useCallback((trackId) => {
    const track = patternRef.current.tracks.find((entry) => entry.id === trackId);
    if (!track) return;
    setActiveTrackId(trackId);
    setWaveformType(track.instrument);
    setAudioParams(sanitizeAudioParams(track.audioParams || AUDIO_PARAM_DEFAULTS));
    setActivePresetName(track.soundName || null);
    setSelectedIds(new Set());
  }, []);

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
    setSoundBrowserTrackId(null);
  }, [activeTrackId, handleTrackPatch]);

  const handleSoundBrowserClose = React.useCallback(() => {
    setSoundBrowserTrackId(null);
  }, []);

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

  const handlePresetApplied = React.useCallback((presetName) => {
    const soundName = presetName || null;
    setActivePresetName(soundName);
    setPattern((prev) => updateTrack(prev, activeTrackId, {
      soundId: null,
      soundName,
      soundCategory: null,
      soundBank: soundName ? 'Sound workspace' : null
    }));
  }, [activeTrackId]);

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
    onControlSectionToggle: handleControlSectionToggle,
    activePresetName,
    onPresetApplied: handlePresetApplied
  }), [
    waveformType,
    handleWaveformChange,
    audioParams,
    pattern.bpm,
    controlSections,
    handleParamChange,
    handleParamsChange,
    handleControlSectionToggle,
    activePresetName,
    handlePresetApplied
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
  const activeChord = React.useMemo(
    () => CHORD_TYPES.find((chord) => chord.id === chordTypeId) || CHORD_TYPES[0],
    [chordTypeId]
  );

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
          className="piano-roll__ghost-note"
          title={`${track?.name || 'Layer'} · ${midiNoteToName(note.midi).noteId}`}
          style={{
            '--track-color': track?.color,
            left: note.start * pxPerBeat,
            top: rowForMidi(note.midi) * ROW_HEIGHT + 2,
            width: Math.max(note.duration * pxPerBeat - 1, 3),
            height: ROW_HEIGHT - 4
          }}
        />
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
      />
    );
  }), [activeScale, activeTrack?.color, activeTrackNotes, isScaleMidi, pxPerBeat, scaleRoot, selectedIds]);

  return (
    <div className="piano-roll-page">
      <div className="piano-roll-topbar">
        <div className="piano-roll-topbar__cluster">
          <button
            type="button"
            className="piano-roll-topbar__collapse"
            onClick={() => setTrayOpen((open) => !open)}
            aria-expanded={trayOpen}
            aria-label={trayOpen ? 'Collapse editor controls' : 'Expand editor controls'}
          >
            <span aria-hidden="true">{trayOpen ? '▾' : '▸'}</span>
          </button>
          <span className="piano-roll-topbar__brand">Vangelis</span>
        </div>
        <span className="piano-roll-topbar__divider" aria-hidden="true" />
        <input
          className="piano-roll-topbar__name"
          value={pattern.name}
          onChange={(event) => setPattern((prev) => ({ ...prev, name: event.target.value }))}
          aria-label="Pattern name"
        />
        {hasUnsavedChanges && (
          <span className="piano-roll-topbar__dirty" role="status">Unsaved</span>
        )}
        <div className="piano-roll-topbar__cluster piano-roll-topbar__cluster--right">
          <div className="piano-roll-topbar__zoom" role="group" aria-label="Zoom">
            <button
              type="button"
              onClick={() => applyZoom(1 / ZOOM_STEP)}
              disabled={pxPerBeat <= ZOOM_MIN + 0.01}
              aria-label="Zoom out"
            >
              −
            </button>
            <span aria-hidden="true">{Math.round((pxPerBeat / 56) * 100)}%</span>
            <button
              type="button"
              onClick={() => applyZoom(ZOOM_STEP)}
              disabled={pxPerBeat >= ZOOM_MAX - 0.01}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="piano-roll-topbar__fit"
              onClick={fitZoom}
              aria-label="Fit pattern to view"
            >
              Fit
            </button>
          </div>
          <span className="piano-roll-topbar__divider" aria-hidden="true" />
          <details className="piano-roll-topbar__help">
          <summary aria-label="Keyboard shortcuts">?</summary>
          <div className="piano-roll-topbar__help-panel">
            <h2>Shortcuts</h2>
            <dl>
              <dt>Double-click</dt><dd>Add / remove note</dd>
              <dt>Click · drag</dt><dd>Select · multi-select</dd>
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
          <span className="piano-roll-topbar__divider" aria-hidden="true" />
          <button
            type="button"
            className={`piano-roll-topbar__play ${isRolling ? 'is-playing' : ''}`}
            onClick={handlePlayToggle}
            aria-label={isRolling ? 'Stop the loop' : 'Play the loop'}
          >
            {isRolling ? '■ Stop' : '▶ Play'}
          </button>
        </div>
      </div>

      {trayOpen && (
        <div className="piano-roll-tray">
          <div className="piano-roll-tray__control-row">
            <div className="piano-roll-tray__fields">
              <label className="piano-roll-tray__field">
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

              <div className="piano-roll-tray__field">
                <span>Timeline</span>
                <div className="piano-roll-bar-stepper" role="group" aria-label="Timeline bars">
                  <button
                    type="button"
                    onClick={() => handleBarsChange(pattern.bars - BAR_CHUNK)}
                    disabled={pattern.bars <= BAR_CHUNK}
                    aria-label={`Remove ${BAR_CHUNK} bars`}
                  >
                    −
                  </button>
                  <output>{pattern.bars} / {MAX_PATTERN_BARS}</output>
                  <button
                    type="button"
                    onClick={() => handleBarsChange(pattern.bars + BAR_CHUNK)}
                    disabled={pattern.bars >= MAX_PATTERN_BARS}
                    aria-label={`Add ${BAR_CHUNK} bars`}
                  >
                    +
                  </button>
                </div>
              </div>

              <label className="piano-roll-tray__field">
                <span>Snap</span>
                <select value={snapId} onChange={(event) => setSnapId(event.target.value)}>
                  {SNAP_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="piano-roll-tray__field">
                <span>Key</span>
                <select
                  value={scaleRoot}
                  onChange={(event) => setScaleRoot(Number(event.target.value))}
                  disabled={!scaleId}
                >
                  {SCALE_ROOTS.map((root, index) => (
                    <option key={root} value={index}>{root}</option>
                  ))}
                </select>
              </label>

              <label className="piano-roll-tray__field">
                <span>Scale</span>
                <select value={scaleId} onChange={(event) => setScaleId(event.target.value)}>
                  <option value="">Off</option>
                  {SCALES.map((scale) => (
                    <option key={scale.id} value={scale.id}>{scale.label}</option>
                  ))}
                </select>
              </label>

              <label className="piano-roll-tray__field">
                <span>Chord</span>
                <span className="piano-roll-chord-tool">
                  <select value={chordTypeId} onChange={(event) => setChordTypeId(event.target.value)}>
                    {CHORD_TYPES.map((chord) => (
                      <option key={chord.id} value={chord.id}>{chord.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleBuildChord} disabled={selectedIds.size === 0}>
                    Build
                  </button>
                </span>
              </label>
            </div>

            <div className="piano-roll-tray__actions">
              <button type="button" onClick={handleSave}>Save</button>
              <button type="button" onClick={handleLoopSelection} disabled={selectedIds.size === 0 && !loopRange}>
                {loopRange ? 'Unloop ⇧⌘L' : 'Loop selection ⇧⌘L'}
              </button>
              <button type="button" onClick={handleClear}>Clear layer</button>
              <button
                type="button"
                className={isRecordingLoop ? 'is-recording' : ''}
                onClick={handleRecordLoop}
                disabled={!isRecordingLoop && pattern.notes.length === 0}
              >
                {isRecordingLoop ? '■ Stop recording' : '● Record loop'}
              </button>
              <button type="button" onClick={handleOpenInPlayer}>Open in player</button>
            </div>
          </div>

          {activeScale && (
            <div className="piano-roll-scale-guide" aria-live="polite">
              <strong>{SCALE_ROOTS[scaleRoot]} {activeScale.label} · {activeChord.label} chord</strong>
              <span className="piano-roll-scale-guide__item">
                <i className="piano-roll-scale-guide__swatch piano-roll-scale-guide__swatch--tone" />
                Highlighted notes
              </span>
              {outOfScaleCount > 0 && (
                <span className="piano-roll-scale-guide__warning">
                  {outOfScaleCount} outside
                </span>
              )}
              <button
                type="button"
                onClick={handleSnapSelectionToScale}
                disabled={selectedIds.size === 0}
              >
                Snap selected
              </button>
            </div>
          )}

          <div className="piano-roll-tracks" aria-label="Instrument layers">
            <div className="piano-roll-tracks__heading">
              <strong>Layers</strong>
            </div>
            <div className="piano-roll-tracks__list">
              {pattern.tracks.map((track) => {
                const isActive = track.id === activeTrack?.id;
                const noteCount = pattern.notes.filter((note) => note.trackId === track.id).length;
                return (
                  <div
                    key={track.id}
                    className={`piano-roll-track ${isActive ? 'is-active' : ''}`}
                    style={{ '--track-color': track.color }}
                  >
                    <button
                      type="button"
                      className="piano-roll-track__select"
                      onClick={() => handleSelectTrack(track.id)}
                      aria-pressed={isActive}
                    >
                      <i aria-hidden="true" />
                      <span>{noteCount}</span>
                    </button>
                    <input
                      value={track.name}
                      onFocus={() => handleSelectTrack(track.id)}
                      onChange={(event) => handleTrackPatch(track.id, { name: event.target.value.slice(0, 32) })}
                      aria-label={`Layer name: ${track.name}`}
                    />
                    <button
                      type="button"
                      className="piano-roll-track__sound"
                      onClick={() => handleSoundBrowserToggle(track.id)}
                      aria-expanded={soundBrowserTrackId === track.id}
                      aria-label={`Choose sound for ${track.name}. Current sound: ${track.soundName || track.instrument}`}
                    >
                      <span>{track.soundName || track.instrument}</span>
                      <i aria-hidden="true">⌄</i>
                    </button>
                    <button
                      type="button"
                      className={track.muted ? 'is-on' : ''}
                      onClick={() => handleTrackPatch(track.id, { muted: !track.muted })}
                      aria-pressed={track.muted}
                      aria-label={`${track.muted ? 'Unmute' : 'Mute'} ${track.name}`}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      className={track.solo ? 'is-on' : ''}
                      onClick={() => handleTrackPatch(track.id, { solo: !track.solo })}
                      aria-pressed={track.solo}
                      aria-label={`${track.solo ? 'Unsolo' : 'Solo'} ${track.name}`}
                    >
                      S
                    </button>
                    <button
                      type="button"
                      className="piano-roll-track__delete"
                      onClick={() => handleDeleteTrack(track.id)}
                      disabled={pattern.tracks.length <= 1}
                      aria-label={`Delete ${track.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              <button type="button" className="piano-roll-tracks__add" onClick={handleAddTrack}>
                + Add layer
              </button>
            </div>
          </div>

          {soundBrowserTrack && (
            <LayerSoundBrowser
              track={soundBrowserTrack}
              onChoose={handleSoundChoose}
              onClose={handleSoundBrowserClose}
            />
          )}

          {libraryEntries.length > 0 && (
            <details className="piano-roll-tray__library">
              <summary>Saved patterns ({libraryEntries.length})</summary>
              <ul>
                {libraryEntries.map((entry) => (
                  <li key={`${entry.source}-${entry.id}`}>
                    <button type="button" className="piano-roll-tray__load" onClick={() => handleLoad(entry)}>
                      {entry.name}
                    </button>
                    <span className="piano-roll-tray__library-meta">
                      {entry.source === 'cloud' ? 'Cloud · ' : ''}
                      {entry.pattern.bars} bars · {entry.pattern.bpm} BPM · {entry.pattern.notes.length} notes
                    </span>
                    <button
                      type="button"
                      className="piano-roll-tray__delete"
                      onClick={() => handleDeleteSaved(entry)}
                      aria-label={`Delete saved pattern ${entry.name}`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

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
                  <button type="button" onClick={handleSignOut}>Sign out</button>
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
                  <button type="submit" disabled={!cloudEmail.trim() || cloudAuthStatus === 'sending'}>
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
      )}

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

          <div className="piano-roll__keys">
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
