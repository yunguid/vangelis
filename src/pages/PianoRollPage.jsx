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
import { midiNoteToFrequency, midiNoteToName } from '../utils/math.js';
import {
  BAR_OPTIONS,
  BEATS_PER_BAR,
  BPM_MAX,
  BPM_MIN,
  DEFAULT_VELOCITY,
  MIN_NOTE_BEATS,
  PITCH_MAX,
  PITCH_MIN,
  SCALES,
  SCALE_ROOTS,
  SNAP_OPTIONS,
  addNote,
  applyNoteDelta,
  copyNotesPayload,
  createPattern,
  deleteNote,
  deleteNotes,
  duplicateNotes,
  getSnapBeats,
  isInScale,
  nudgeNotes,
  pasteNotesPayload,
  patternBeats,
  resizeNotes,
  patternToMidiData,
  quantizeBeats,
  quantizeBeatsFloor,
  setPatternBars,
  updateNote
} from '../utils/pianoRollPattern.js';
import {
  deleteSavedPattern,
  loadSavedPatterns,
  saveSavedPattern
} from '../utils/patternStorage.js';
import { setPendingMidi } from '../utils/pendingMidiHandoff.js';
import './PianoRollPage.css';

const ROW_HEIGHT = 14;
const KEY_COLUMN_WIDTH = 64;
const RULER_HEIGHT = 30;
const RESIZE_HANDLE_PX = 7;
const AUDITION_MS = 260;
const ROW_COUNT = PITCH_MAX - PITCH_MIN + 1;
const GRID_HEIGHT = ROW_COUNT * ROW_HEIGHT;
const EDIT_RESTART_DEBOUNCE_MS = 250;
const HISTORY_LIMIT = 100;
const ZOOM_MIN = 24;
const ZOOM_MAX = 160;
const ZOOM_STEP = 1.25;
const ZOOM_WHEEL_STEP = 1.08;

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

const drawGrid = (canvas, { bars, snapBeats, scaleId, scaleRoot, pxPerBeat }) => {
  const width = bars * BEATS_PER_BAR * pxPerBeat;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = GRID_HEIGHT * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${GRID_HEIGHT}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  for (let row = 0; row < ROW_COUNT; row += 1) {
    const midi = midiForRow(row);
    const y = row * ROW_HEIGHT;
    ctx.fillStyle = isBlackKey(midi) ? 'rgba(10, 14, 21, 0.98)' : 'rgba(17, 23, 33, 0.98)';
    ctx.fillRect(0, y, width, ROW_HEIGHT);

    if (scaleId && isInScale(midi, scaleRoot, scaleId)) {
      const isRoot = (((midi - scaleRoot) % 12) + 12) % 12 === 0;
      ctx.fillStyle = isRoot ? 'rgba(255, 164, 112, 0.13)' : 'rgba(255, 164, 112, 0.055)';
      ctx.fillRect(0, y, width, ROW_HEIGHT);
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

  const [pattern, setPattern] = React.useState(() => createPattern());
  const [snapId, setSnapId] = React.useState('1/16');
  const [scaleId, setScaleId] = React.useState('');
  const [scaleRoot, setScaleRoot] = React.useState(0);
  const [pxPerBeat, setPxPerBeat] = React.useState(56);
  const [trayOpen, setTrayOpen] = React.useState(true);
  const [savedPatterns, setSavedPatterns] = React.useState(() => loadSavedPatterns());
  const [drag, setDrag] = React.useState(null);
  const [selectedIds, setSelectedIds] = React.useState(() => new Set());

  const [waveformType, setWaveformType] = React.useState(() => DEFAULT_WAVEFORM);
  const [audioParams, setAudioParams] = React.useState(() => (
    sanitizeAudioParams(AUDIO_PARAM_DEFAULTS)
  ));
  const [activePresetName, setActivePresetName] = React.useState(null);
  const [controlSections, setControlSections] = React.useState(DEFAULT_CONTROL_SECTIONS);
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [sidebarTab, setSidebarTab] = React.useState('sound');

  const playback = useMidiPlayback({ waveformType, audioParams });

  const scrollRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const lastLengthRef = React.useRef(getSnapBeats('1/16'));
  const auditionRef = React.useRef(null);
  const auditionTimeoutRef = React.useRef(null);
  const editRestartTimeoutRef = React.useRef(null);
  const patternRef = React.useRef(pattern);
  const historyRef = React.useRef({ undo: [], redo: [] });
  const gestureSnapshotRef = React.useRef(null);
  const clipboardRef = React.useRef(null);

  const snapBeats = getSnapBeats(snapId);
  const totalBeats = patternBeats(pattern);
  const gridWidth = totalBeats * pxPerBeat;

  React.useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  React.useEffect(() => {
    audioEngine.setSanitizedGlobalParams(audioParams);
  }, [audioParams]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawGrid(canvas, { bars: pattern.bars, snapBeats, scaleId, scaleRoot, pxPerBeat });
    }
  }, [pattern.bars, snapBeats, scaleId, scaleRoot, pxPerBeat]);

  // Boot the viewport around C5 so melodies land mid-screen.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = rowForMidi(84) * ROW_HEIGHT;
  }, []);

  React.useEffect(() => () => {
    if (auditionTimeoutRef.current) clearTimeout(auditionTimeoutRef.current);
    if (auditionRef.current) audioEngine.stopNote(auditionRef.current);
    if (editRestartTimeoutRef.current) clearTimeout(editRestartTimeoutRef.current);
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
    const midiData = patternToMidiData(patternRef.current);
    if (midiData.notes.length === 0) return;
    playback.play(midiData, { loop: true });
  }, [playback.isPlaying, playback.isPaused, playback.play, playback.stop]);

  // Live edits during loop playback restart the loop in place (debounced)
  // so what you hear tracks what you see.
  React.useEffect(() => {
    if (!playback.isPlaying || playback.isPaused) return undefined;
    if (editRestartTimeoutRef.current) clearTimeout(editRestartTimeoutRef.current);
    editRestartTimeoutRef.current = setTimeout(() => {
      editRestartTimeoutRef.current = null;
      const midiData = patternToMidiData(patternRef.current);
      if (midiData.notes.length === 0) {
        playback.stop();
        return;
      }
      const startAt = (playback.progress || 0) * midiData.duration;
      playback.play(midiData, { startAt: Math.min(startAt, midiData.duration - 0.01), loop: true });
    }, EDIT_RESTART_DEBOUNCE_MS);
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
    const { pattern: next, noteIds } = pasteNotesPayload(patternRef.current, payload);
    setPattern(next);
    setSelectedIds(new Set(noteIds));
  }, [pushHistory]);

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

  // Fit the whole pattern to the viewport width — the default view, and
  // re-applied on bar-count and window-size changes until the user zooms
  // manually.
  const fitZoom = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const available = el.clientWidth - KEY_COLUMN_WIDTH;
    if (available <= 0) return;
    const beats = patternBeats(patternRef.current);
    zoomTouchedRef.current = false;
    setPxPerBeat(Math.min(Math.max(available / beats, ZOOM_MIN), ZOOM_MAX));
  }, []);

  React.useEffect(() => {
    if (!zoomTouchedRef.current) fitZoom();
  }, [pattern.bars, fitZoom]);

  React.useEffect(() => {
    const onResize = () => {
      if (!zoomTouchedRef.current) fitZoom();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitZoom]);

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
        setSelectedIds(new Set(patternRef.current.notes.map((note) => note.id)));
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
        handleDuplicate();
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
    handleNudge,
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
      note.midi === midi && beat >= note.start && beat < note.start + note.duration
    ))
  ), []);

  const notesInMarquee = React.useCallback((rect) => {
    const [left, right] = [Math.min(rect.x0, rect.x1), Math.max(rect.x0, rect.x1)];
    const [top, bottom] = [Math.min(rect.y0, rect.y1), Math.max(rect.y0, rect.y1)];
    return patternRef.current.notes.filter((note) => {
      const noteLeft = note.start * pxPerBeat;
      const noteRight = noteLeft + note.duration * pxPerBeat;
      const noteTop = rowForMidi(note.midi) * ROW_HEIGHT;
      return noteLeft < right && noteRight > left
        && noteTop < bottom && noteTop + ROW_HEIGHT > top;
    }).map((note) => note.id);
  }, [pxPerBeat]);

  const beginMove = React.useCallback((anchorNote, beat, midi, selection) => {
    const ids = selection.has(anchorNote.id) ? selection : new Set([anchorNote.id]);
    const origins = new Map();
    patternRef.current.notes.forEach((note) => {
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
  }, []);

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
    const { pattern: nextPattern, note } = addNote(patternRef.current, { midi, start, duration });
    setPattern(nextPattern);
    setSelectedIds(new Set([note.id]));
    audition(midi);
  }, [pointerToGrid, findNoteAt, snapBeats, audition, commitPattern, pushHistory]);

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

  const handleSave = React.useCallback(() => {
    saveSavedPattern(patternRef.current);
    setSavedPatterns(loadSavedPatterns());
  }, []);

  const handleLoad = React.useCallback((entry) => {
    playback.stop();
    pushHistory(patternRef.current);
    setPattern({ ...entry.pattern, name: entry.name });
    setSelectedIds(new Set());
  }, [playback.stop, pushHistory]);

  const handleDeleteSaved = React.useCallback((id) => {
    setSavedPatterns(deleteSavedPattern(id));
  }, []);

  const handleClear = React.useCallback(() => {
    playback.stop();
    commitPattern((prev) => ({ ...prev, notes: [] }));
    setSelectedIds(new Set());
  }, [playback.stop, commitPattern]);

  const handleBarsChange = React.useCallback((bars) => {
    commitPattern((prev) => setPatternBars(prev, bars));
  }, [commitPattern]);

  const handleOpenInPlayer = React.useCallback(() => {
    const midiData = patternToMidiData(patternRef.current);
    if (midiData.notes.length === 0) return;
    playback.stop();
    setPendingMidi(midiData);
    window.location.hash = '#/';
  }, [playback.stop]);

  const handleExportMidi = React.useCallback(async () => {
    const source = patternRef.current;
    const midiData = patternToMidiData(source);
    if (midiData.notes.length === 0) return;

    const { Midi } = await import('@tonejs/midi');
    const midi = new Midi();
    midi.header.setTempo(source.bpm);
    midi.header.name = midiData.name;
    const track = midi.addTrack();
    track.name = midiData.name;
    midiData.notes.forEach((note) => {
      track.addNote({
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: note.velocity
      });
    });

    const safeName = (midiData.name || 'pattern').trim().replace(/[^\w-]+/g, '-') || 'pattern';
    const blob = new Blob([midi.toArray()], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeName}.mid`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleParamChange = React.useCallback((paramName, value) => {
    setAudioParams((prev) => sanitizeAudioParams({ ...prev, [paramName]: value }));
  }, []);

  const handleParamsChange = React.useCallback((nextParams) => {
    setAudioParams((prev) => sanitizeAudioParams({ ...prev, ...nextParams }));
  }, []);

  const handlePresetApplied = React.useCallback((presetName) => {
    setActivePresetName(presetName || null);
  }, []);

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
    onWaveformChange: setWaveformType,
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
  const playheadX = (playback.progress || 0) * gridWidth;

  const keyRows = React.useMemo(() => {
    const rows = [];
    for (let row = 0; row < ROW_COUNT; row += 1) {
      const midi = midiForRow(row);
      const { noteName, octave, noteId } = midiNoteToName(midi);
      rows.push({ midi, noteId, label: noteName === 'C' ? `C${octave}` : '', black: isBlackKey(midi) });
    }
    return rows;
  }, []);

  const barMarkers = React.useMemo(() => (
    Array.from({ length: pattern.bars }, (_, index) => index)
  ), [pattern.bars]);

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

            <label className="piano-roll-tray__field">
              <span>Bars</span>
              <select
                value={pattern.bars}
                onChange={(event) => handleBarsChange(Number(event.target.value))}
              >
                {BAR_OPTIONS.map((bars) => (
                  <option key={bars} value={bars}>{bars}</option>
                ))}
              </select>
            </label>

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

            <div className="piano-roll-tray__actions">
              <button type="button" onClick={handleSave}>Save</button>
              <button type="button" onClick={handleClear}>Clear</button>
              <button type="button" onClick={handleExportMidi}>Export .mid</button>
              <button type="button" onClick={handleOpenInPlayer}>Open in player</button>
            </div>
          </div>

          {savedPatterns.length > 0 && (
            <details className="piano-roll-tray__library">
              <summary>Saved patterns ({savedPatterns.length})</summary>
              <ul>
                {savedPatterns.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" className="piano-roll-tray__load" onClick={() => handleLoad(entry)}>
                      {entry.name}
                    </button>
                    <span className="piano-roll-tray__library-meta">
                      {entry.pattern.bars} bars · {entry.pattern.bpm} BPM · {entry.pattern.notes.length} notes
                    </span>
                    <button
                      type="button"
                      className="piano-roll-tray__delete"
                      onClick={() => handleDeleteSaved(entry.id)}
                      aria-label={`Delete saved pattern ${entry.name}`}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}

        </div>
      )}

      <div
        className="piano-roll"
        ref={scrollRef}
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
                className={`piano-roll__key ${key.black ? 'piano-roll__key--black' : ''}`}
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
              {pattern.notes.map((note) => (
                <div
                  key={note.id}
                  data-note-id={note.id}
                  className={`piano-roll__note ${selectedIds.has(note.id) ? 'is-selected' : ''}`}
                  style={{
                    left: note.start * pxPerBeat,
                    top: rowForMidi(note.midi) * ROW_HEIGHT + 1,
                    width: Math.max(note.duration * pxPerBeat - 1, 4),
                    height: ROW_HEIGHT - 2
                  }}
                />
              ))}
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
                <div className="piano-roll__playhead" style={{ transform: `translateX(${playheadX}px)` }} />
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
