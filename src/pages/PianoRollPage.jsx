import React from 'react';
import { startVisibilityAwareRafLoop } from '../utils/visibilityRaf.js';
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
import {
  deleteCloudPattern,
  getSession,
  isCloudConfigured,
  listCloudPatterns,
  onAuthChange,
  signInWithPassword,
  signOut,
  uploadPatternMidi,
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
  addMetronomeClicks,
  buildChords,
  cloneNotesInPlace,
  copyNotesPayload,
  createPattern,
  deleteNote,
  deleteNotes,
  deleteTrack,
  duplicateNotes,
  getSnapBeats,
  invertNotes,
  isInChord,
  isInScale,
  legatoNotes,
  nudgeNotes,
  normalizePattern,
  operationTargetIds,
  pasteNotesPayload,
  patternBeats,
  quantizeNotes,
  resizeNotes,
  reverseNotes,
  setNoteVelocities,
  sliceNotes,
  snapNotesToScale,
  stretchNotes,
  patternToMidiData,
  quantizeBeats,
  quantizeBeatsFloor,
  setPatternBars,
  toggleLoopForSelection,
  toggleNotesMuted,
  updateTrack,
  updateNote
} from '../utils/pianoRollPattern.js';
import { loadEditorDraft, saveEditorDraft } from '../utils/patternDraft.js';
import {
  deleteProject,
  findProject,
  loadProjects,
  markProjectSynced,
  newProjectId,
  nextUntitledName,
  saveProject,
  unsyncedProjects
} from '../utils/projectLibrary.js';
import { setPendingMidi } from '../utils/pendingMidiHandoff.js';
import VelocityLane, { VELOCITY_LANE_HEIGHT, midiVelocity } from '../components/editor/VelocityLane.jsx';
import {
  ICON_ACCOUNT,
  ICON_CHEVRON,
  ICON_DRAW,
  ICON_ERASE,
  ICON_HELP,
  ICON_MORE,
  ICON_PAINT,
  ICON_PLAY,
  ICON_PLUS,
  ICON_POWER,
  ICON_PROJECTS,
  ICON_RECORD,
  ICON_SELECT,
  ICON_SLICE,
  ICON_STOP,
  ICON_VELOCITY
} from '../components/editor/editorIcons.jsx';
import './PianoRollPage.css';

// Tall enough that a note can carry its name and read as the layer's colour.
const ROW_HEIGHT = 20;
// The grid is poured concrete: one ground, every other bar a shade lighter,
// and its lines are joints cut darker than the ground, never lighter.
const GRID_GROUND = '#252523';
const GRID_ALT_BAR = '#292927';
const GRID_BLACK_KEY_ROW = 'rgba(0, 0, 0, 0.16)';
const GRID_IN_KEY_ROW = 'rgba(228, 223, 212, 0.05)';
const GRID_ROW_LINE = 'rgba(0, 0, 0, 0.2)';
const GRID_OCTAVE_LINE = 'rgba(0, 0, 0, 0.62)';
const GRID_BEAT_LINE = 'rgba(0, 0, 0, 0.42)';
const GRID_BAR_LINE = 'rgba(8, 8, 7, 0.95)';
// Subdivision lines stay hidden until they are this far apart, then fade in.
const SUBDIVISION_MIN_PX = 12;
const SUBDIVISION_FADE_PX = 16;
const KEY_COLUMN_WIDTH = 64;
const RULER_HEIGHT = 26;
const RESIZE_HANDLE_PX = 6;
// A drag this far from where it started is a drag, not a click.
const DRAG_THRESHOLD_PX = 3;
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
const CLOUD_SYNC_DEBOUNCE_MS = 1500;
const HISTORY_LIMIT = 100;
// 100% zoom: a sixteenth is 24px wide, room for a note to be seen and named.
const DEFAULT_PX_PER_BEAT = 96;
const ZOOM_MIN = 24;
const ZOOM_MAX = 336;
const ZOOM_STEP = 1.15;
const ZOOM_WHEEL_STEP = 1.08;
const MAX_GRID_BACKING_WIDTH = 16384;
const RECORDING_TAIL_MS = 160;
// Beat numbers join the ruler once a beat has room for "12.4".
const RULER_BEAT_LABEL_MIN_PX = 44;

// Without Supabase env the editor never mentions an account at all.
const CLOUD_ENABLED = isCloudConfigured();
const NO_CLOUD_ROWS = Object.freeze([]);

const DEFAULT_CONTROL_SECTIONS = Object.freeze({
  essentials: true,
  delay: false,
  reverb: false,
  color: false,
  modulation: false
});

// FL Studio's tool set, on keys an Ableton hand already knows: B draws.
const TOOLS = [
  { id: 'select', key: 'v', label: 'Select', hint: 'Select: click, drag to move, edges resize, ⌥-drag copies (V)', icon: ICON_SELECT },
  { id: 'draw', key: 'b', label: 'Draw', hint: 'Draw: click for a note, drag right for its length (B)', icon: ICON_DRAW },
  { id: 'paint', key: 'p', label: 'Paint', hint: 'Paint: drag to lay a note on every grid step, ⇧ holds the pitch (P)', icon: ICON_PAINT },
  { id: 'slice', key: 'c', label: 'Slice', hint: 'Slice: click a note to cut it on the grid, drag down to cut a stack (C)', icon: ICON_SLICE },
  { id: 'erase', key: 'e', label: 'Erase', hint: 'Erase: click or drag across notes (E)', icon: ICON_ERASE }
];
const TOOL_BY_KEY = new Map(TOOLS.map((tool) => [tool.key, tool.id]));

const rowForMidi = (midi) => PITCH_MAX - midi;
const midiForRow = (row) => PITCH_MAX - row;
const isBlackKey = (midi) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);

// A note is as solid as it is loud: velocity sets how much of its colour
// covers the concrete, Ableton's way of showing it without a number.
const velocityFill = (color, velocity = DEFAULT_VELOCITY) => {
  const hex = String(color || '').replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((digit) => digit + digit).join('') : hex;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value) || full.length !== 6) return color;
  const alpha = (0.34 + 0.66 * Math.min(1, Math.max(0, velocity))).toFixed(3);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

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

// The metronome's face and its switch in one: four cells, the current beat lit
// while the loop runs. It reads the transport clock each frame, like the
// playhead, so it never drifts from what is heard.
const BeatCounter = React.memo(({ on, running, getProgress, shapeRef, onToggle }) => {
  const cellsRef = React.useRef(null);

  React.useEffect(() => {
    const cells = cellsRef.current ? [...cellsRef.current.children] : [];
    const light = (index) => cells.forEach((cell, cellIndex) => {
      cell.toggleAttribute('data-lit', cellIndex === index);
    });
    if (!running) {
      light(-1);
      return undefined;
    }
    // The shared loop sleeps while the tab is hidden and wakes with it.
    return startVisibilityAwareRafLoop(() => {
      const shape = shapeRef.current;
      if (!shape) return;
      const beat = shape.offsetBeats + getProgress() * shape.beats;
      light(((Math.floor(beat + 1e-6) % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR);
    });
  }, [running, getProgress, shapeRef]);

  return (
    <button
      type="button"
      className="piano-roll-beats"
      onClick={onToggle}
      aria-pressed={on}
      aria-label="Metronome"
      title={on ? 'Metronome on: a click on every beat while the loop plays' : 'Metronome off'}
    >
      <span className="piano-roll-beats__cells" ref={cellsRef} aria-hidden="true">
        {Array.from({ length: BEATS_PER_BAR }, (_, index) => <i key={index} />)}
      </span>
    </button>
  );
});

BeatCounter.displayName = 'BeatCounter';

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

  // Ground, then every other bar a shade lighter, so bars read at a glance.
  ctx.fillStyle = GRID_GROUND;
  ctx.fillRect(0, 0, width, GRID_HEIGHT);
  const barPx = BEATS_PER_BAR * pxPerBeat;
  ctx.fillStyle = GRID_ALT_BAR;
  for (let bar = 1; bar < bars; bar += 2) {
    ctx.fillRect(bar * barPx, 0, barPx, GRID_HEIGHT);
  }

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

  // A joint under every row, cut deeper at each octave (B->C).
  for (let row = 1; row < ROW_COUNT; row += 1) {
    const octave = (((midiForRow(row - 1) % 12) + 12) % 12) === 0;
    ctx.strokeStyle = octave ? GRID_OCTAVE_LINE : GRID_ROW_LINE;
    const y = row * ROW_HEIGHT + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Bars cut deepest, beats less so. Subdivisions (thirds when a triplet snap
  // is active) only appear once zoom gives them room, and fade in as it
  // grows, so an empty grid never reads as a lattice.
  const subdivision = snapBeats || 0.25;
  const subdivisionPx = subdivision * pxPerBeat;
  const subdivisionAlpha = Math.min(
    Math.max((subdivisionPx - SUBDIVISION_MIN_PX) / SUBDIVISION_FADE_PX, 0),
    1
  ) * 0.22;
  const totalBeats = bars * BEATS_PER_BAR;
  for (let beat = 0; beat <= totalBeats + 1e-6; beat += subdivision) {
    const onBeat = Math.abs(beat - Math.round(beat)) < 1e-6;
    const onBar = onBeat && Math.round(beat) % BEATS_PER_BAR === 0;
    if (!onBeat && subdivisionAlpha === 0) continue;
    const x = Math.round(beat * pxPerBeat) + 0.5;
    ctx.strokeStyle = onBar
      ? GRID_BAR_LINE
      : onBeat
        ? GRID_BEAT_LINE
        : `rgba(0, 0, 0, ${subdivisionAlpha})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, GRID_HEIGHT);
    ctx.stroke();
  }
};

// Only needed once they are opened, so they stay out of the editor's
// upfront JavaScript. None of them may import the editor's own modules (see
// CLAUDE.md: an import back into the page chunk breaks the route guard).
const LayerSoundBrowser = React.lazy(() => import('../components/LayerSoundBrowser.jsx'));
const ProjectBrowser = React.lazy(() => import('../components/editor/ProjectBrowser.jsx'));
const AccountPanel = React.lazy(() => import('../components/editor/AccountPanel.jsx'));
const loadMidiExport = () => import('../utils/midiExport.js');

const PianoRollPage = () => {
  useAudioEngineWarmup();

  // The draft is the working document: whatever was on screen when the editor
  // was last left comes back, so navigating away never costs a pattern.
  const [draft] = React.useState(loadEditorDraft);

  const [pattern, setPattern] = React.useState(() => (
    draft ? normalizePattern(draft.pattern) : createPattern({ name: nextUntitledName() })
  ));
  // A draft from before projects gets a project of its own on first save.
  const [projectId, setProjectId] = React.useState(() => draft?.projectId || newProjectId());
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
  const [metronomeOn, setMetronomeOn] = React.useState(() => draft?.metronome === true);
  const metronomeOnRef = React.useRef(metronomeOn);
  metronomeOnRef.current = metronomeOn;
  const [velocityLaneOpen, setVelocityLaneOpen] = React.useState(() => draft?.velocityLane !== false);
  const [laneReadout, setLaneReadout] = React.useState(null);
  const [tool, setTool] = React.useState('select');
  // What the transport is looping right now, for the beat counter.
  const playbackShapeRef = React.useRef(null);
  const [drag, setDrag] = React.useState(null);
  const [selectedIds, setSelectedIds] = React.useState(() => new Set());
  const [activeTrackId, setActiveTrackId] = React.useState(() => (
    draft?.activeTrackId || 'track-1'
  ));
  const [isRecordingLoop, setIsRecordingLoop] = React.useState(false);
  const [projectsOpen, setProjectsOpen] = React.useState(false);
  const [accountOpen, setAccountOpen] = React.useState(false);
  // Bumped whenever the project list changes under an open browser.
  const [libraryVersion, setLibraryVersion] = React.useState(0);
  // Bumped when a project is opened, to re-centre the view on its notes.
  const [viewEpoch, setViewEpoch] = React.useState(0);
  const [deviceSaveFailed, setDeviceSaveFailed] = React.useState(false);
  const [cloudSession, setCloudSession] = React.useState(null);
  const [cloudRows, setCloudRows] = React.useState(NO_CLOUD_ROWS);
  // 'idle' | 'saving' | 'saved' | 'error' ('midi' when only the file failed).
  const [syncState, setSyncState] = React.useState('idle');

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
  const projectsPopoverRef = React.useRef(null);
  const accountPopoverRef = React.useRef(null);
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
  const chromeRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const lastLengthRef = React.useRef(getSnapBeats('1/16'));
  const auditionRef = React.useRef(null);
  const auditionTimeoutRef = React.useRef(null);
  const editRestartTimeoutRef = React.useRef(null);
  const recordingTimeoutRef = React.useRef(null);
  const recordingActiveRef = React.useRef(false);
  const draftRef = React.useRef(null);
  const draftSaveTimeoutRef = React.useRef(null);
  const patternRef = React.useRef(pattern);
  const projectIdRef = React.useRef(projectId);
  // The pattern last written to the project library; the same object means
  // there is nothing new to save. A draft that matches its library copy has
  // nothing new either; one from before projects, or one that got ahead of
  // its copy (another tab, a failed write), is saved on the first pass.
  const savedPatternRef = React.useRef(undefined);
  if (savedPatternRef.current === undefined) {
    const stored = draft ? findProject(draft.projectId) : null;
    const unchanged = !draft
      || (stored && JSON.stringify(stored.pattern) === JSON.stringify(draft.pattern));
    savedPatternRef.current = unchanged ? pattern : null;
  }
  const cloudSessionRef = React.useRef(null);
  const cloudSyncTimeoutRef = React.useRef(null);
  const cloudSyncRunningRef = React.useRef(false);
  const cloudSyncAgainRef = React.useRef(false);
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
  const activeTrackNotes = React.useMemo(
    () => pattern.notes.filter((note) => note.trackId === activeTrack?.id),
    [activeTrack?.id, pattern.notes]
  );
  const loopRange = pattern.loopRange?.enabled ? pattern.loopRange : null;
  const playheadOffsetX = (loopRange?.start || 0) * pxPerBeat;
  const playheadTravelWidth = loopRange
    ? (loopRange.end - loopRange.start) * pxPerBeat
    : gridWidth;

  React.useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  // Gestures read their own edits back before React has rendered them.
  const setPatternNow = React.useCallback((next) => {
    patternRef.current = next;
    setPattern(next);
  }, []);

  // ── Saving ───────────────────────────────────────────────────────────────
  // Every edit lands in the draft and the project library on this device; a
  // signed-in account then receives it. Nothing waits on a Save button.

  const runCloudSync = React.useCallback(async () => {
    if (!cloudSessionRef.current) return;
    if (cloudSyncRunningRef.current) {
      cloudSyncAgainRef.current = true;
      return;
    }
    cloudSyncRunningRef.current = true;
    setSyncState('saving');
    let outcome = 'saved';
    try {
      const pending = unsyncedProjects();
      for (const entry of pending) {
        if (!cloudSessionRef.current) break;
        const saved = await upsertCloudPattern({
          id: entry.cloudId,
          name: entry.name,
          pattern: entry.pattern
        });
        if (!saved) {
          outcome = 'error';
          continue;
        }
        const { patternToMidiBytes } = await loadMidiExport();
        const stored = await uploadPatternMidi(saved.id, patternToMidiBytes(entry.pattern));
        if (!stored && outcome === 'saved') outcome = 'midi';
        // Without its file the project stays unsynced, so the next pass
        // sends both again to the same row.
        markProjectSynced(entry.id, {
          cloudId: saved.id,
          syncedAt: stored ? entry.updatedAt : entry.syncedAt
        });
        setCloudRows((prev) => [saved, ...prev.filter((row) => row.id !== saved.id)]);
      }
    } catch (error) {
      // The MIDI writer could not load (offline); edits wait on this device.
      console.error('[vangelis] could not sync projects', error);
      outcome = 'error';
    } finally {
      cloudSyncRunningRef.current = false;
    }
    setSyncState(outcome);
    setLibraryVersion((version) => version + 1);
    if (cloudSyncAgainRef.current) {
      cloudSyncAgainRef.current = false;
      runCloudSync();
    }
  }, []);

  const scheduleCloudSync = React.useCallback((delay = CLOUD_SYNC_DEBOUNCE_MS) => {
    if (!CLOUD_ENABLED || !cloudSessionRef.current) return;
    if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
    cloudSyncTimeoutRef.current = setTimeout(() => {
      cloudSyncTimeoutRef.current = null;
      runCloudSync();
    }, delay);
  }, [runCloudSync]);

  // An untouched blank project is not worth a place in the list; anything
  // with notes is, and so is a project that is already there.
  const persistProject = React.useCallback(() => {
    const current = patternRef.current;
    if (current === savedPatternRef.current) return;
    const id = projectIdRef.current;
    if (current.notes.length === 0 && !findProject(id)) return;
    const entry = saveProject({ id, pattern: current });
    if (!entry) {
      setDeviceSaveFailed(true);
      return;
    }
    savedPatternRef.current = current;
    setDeviceSaveFailed(false);
    scheduleCloudSync();
  }, [scheduleCloudSync]);

  const flushDraft = React.useCallback(() => {
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }
    if (draftRef.current) saveEditorDraft(draftRef.current);
    persistProject();
  }, [persistProject]);

  React.useEffect(() => {
    draftRef.current = {
      pattern,
      projectId,
      snapId,
      scaleId,
      scaleRoot,
      chordTypeId,
      activeTrackId,
      pxPerBeat,
      metronome: metronomeOn,
      velocityLane: velocityLaneOpen
    };
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => {
      draftSaveTimeoutRef.current = null;
      saveEditorDraft(draftRef.current);
      persistProject();
    }, DRAFT_SAVE_DEBOUNCE_MS);
  }, [
    pattern,
    projectId,
    snapId,
    scaleId,
    scaleRoot,
    chordTypeId,
    activeTrackId,
    pxPerBeat,
    metronomeOn,
    velocityLaneOpen,
    persistProject
  ]);

  // The draft outlives the page on purpose: leaving flushes it, nothing clears it.
  React.useEffect(() => {
    window.addEventListener('pagehide', flushDraft);
    return () => {
      window.removeEventListener('pagehide', flushDraft);
      flushDraft();
    };
  }, [flushDraft]);

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
  // an empty pattern opens around C5. Runs when a project opens, never after
  // an edit, so the grid never moves under the cursor.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pitches = patternRef.current.notes.map((note) => note.midi);
    const centerMidi = pitches.length > 0
      ? (Math.min(...pitches) + Math.max(...pitches)) / 2
      : 72;
    const centerY = (rowForMidi(Math.round(centerMidi)) + 0.5) * ROW_HEIGHT + RULER_HEIGHT;
    el.scrollTop = Math.max(0, centerY - el.clientHeight / 2);
    el.scrollLeft = 0;
  }, [viewEpoch]);

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
    setPatternNow(previous);
    setSelectedIds(new Set());
  }, [setPatternNow]);

  const handleRedo = React.useCallback(() => {
    const history = historyRef.current;
    const next = history.redo.pop();
    if (!next) return;
    history.undo.push(patternRef.current);
    setPatternNow(next);
    setSelectedIds(new Set());
  }, [setPatternNow]);

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

  // The loop as the transport should play it: the pattern's notes, plus clicks
  // when the metronome is on. Emptiness is judged on the notes alone, and the
  // recording path never comes through here, so a WAV never carries clicks.
  const buildLoopPlayback = React.useCallback(() => {
    const midiData = patternToMidiData(patternRef.current, { useLoopRange: true });
    if (midiData.notes.length === 0) return null;
    playbackShapeRef.current = {
      offsetBeats: midiData.timelineOffsetBeats || 0,
      beats: midiData.duration / (60 / midiData.bpm)
    };
    return metronomeOnRef.current ? addMetronomeClicks(midiData) : midiData;
  }, []);

  const handlePlayToggle = React.useCallback(() => {
    if (playback.isPlaying && !playback.isPaused) {
      playback.stop();
      return;
    }
    const midiData = buildLoopPlayback();
    if (!midiData) return;
    playback.play(midiData, { loop: true });
  }, [buildLoopPlayback, playback.isPlaying, playback.isPaused, playback.play, playback.stop]);

  // Live edits replace the scheduled score at the exact audio-clock position.
  // This keeps a debounced edit from seeking back to an older React frame.
  React.useEffect(() => {
    if (!playback.isPlaying || playback.isPaused) return undefined;
    if (editRestartTimeoutRef.current) clearTimeout(editRestartTimeoutRef.current);
    editRestartTimeoutRef.current = setTimeout(() => {
      editRestartTimeoutRef.current = null;
      const midiData = buildLoopPlayback();
      if (!midiData) {
        playback.stop();
        return;
      }
      playback.replaceMidi(midiData);
    }, EDIT_RESCHEDULE_DEBOUNCE_MS);
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, metronomeOn]);

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
    setPatternNow(next);
    setSelectedIds(new Set(noteIds));
  }, [activeTrackId, pushHistory, setPatternNow]);

  const handleDuplicate = React.useCallback(() => {
    if (selectedIds.size === 0) return;
    const { pattern: next, noteIds } = duplicateNotes(
      patternRef.current,
      selectedIds,
      snapBeats
    );
    if (noteIds.length === 0) return;
    pushHistory(patternRef.current);
    setPatternNow(next);
    setSelectedIds(new Set(noteIds));
  }, [selectedIds, snapBeats, pushHistory, setPatternNow]);

  const handleCloneInPlace = React.useCallback(() => {
    if (selectedIds.size === 0) return;
    const { pattern: next, noteIds } = cloneNotesInPlace(
      patternRef.current,
      selectedIds
    );
    if (noteIds.length === 0) return;
    pushHistory(patternRef.current);
    setPatternNow(next);
    setSelectedIds(new Set(noteIds));
  }, [selectedIds, pushHistory, setPatternNow]);

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
    setPatternNow(next);
  }, [pushHistory, selectedIds, setPatternNow]);

  const handleSnapSelectionToScale = React.useCallback(() => {
    if (!scaleId || selectedIds.size === 0) return;
    commitPattern((prev) => snapNotesToScale(prev, selectedIds, scaleRoot, scaleId));
  }, [commitPattern, scaleId, scaleRoot, selectedIds]);

  const handleBuildChord = React.useCallback(() => {
    if (selectedIds.size === 0) return;
    const { pattern: next, noteIds } = buildChords(
      patternRef.current,
      selectedIds,
      chordTypeId
    );
    if (noteIds.length === 0) return;
    pushHistory(patternRef.current);
    setPatternNow(next);
    setSelectedIds(new Set([...selectedIds, ...noteIds]));
  }, [chordTypeId, pushHistory, selectedIds, setPatternNow]);

  // Ableton's Notes panel: every transform acts on the selection, or on the
  // whole track being edited when nothing is selected.
  const handleTransform = React.useCallback((kind) => {
    const current = patternRef.current;
    const targets = operationTargetIds(current, selectedIds, activeTrackId);
    if (targets.size === 0) return;
    let next = current;
    if (kind === 'quantize') next = quantizeNotes(current, targets, snapBeats || 0.25);
    else if (kind === 'legato') next = legatoNotes(current, targets);
    else if (kind === 'reverse') next = reverseNotes(current, targets);
    else if (kind === 'invert') next = invertNotes(current, targets);
    else if (kind === 'double') next = stretchNotes(current, targets, 2);
    else if (kind === 'halve') next = stretchNotes(current, targets, 0.5);
    else if (kind === 'mute') next = toggleNotesMuted(current, targets);
    if (next === current) return;
    pushHistory(current);
    setPatternNow(next);
  }, [activeTrackId, pushHistory, selectedIds, setPatternNow, snapBeats]);

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
  // the bar's menus need a popover's dismissal manners. Closing means clearing
  // the `open` attribute — never unmounting — so the menu's contents stay in
  // the accessibility tree and reachable for assistive tech.
  const closeChromeMenus = React.useCallback(() => {
    const open = chromeRef.current?.querySelectorAll('details[open]');
    if (!open || open.length === 0) return false;
    open.forEach((node) => { node.open = false; });
    return true;
  }, []);

  const runMenuAction = React.useCallback((action) => () => {
    closeChromeMenus();
    action();
  }, [closeChromeMenus]);

  React.useEffect(() => {
    const onPointerDown = (event) => {
      const open = chromeRef.current?.querySelectorAll('details[open]');
      open?.forEach((node) => {
        if (!node.contains(event.target)) node.open = false;
      });
      // The projects and account panels close on any press outside them and
      // outside the button that toggles them.
      if (event.target.closest?.('[data-popover-toggle]')) return;
      if (!projectsPopoverRef.current?.contains(event.target)) setProjectsOpen(false);
      if (!accountPopoverRef.current?.contains(event.target)) setAccountOpen(false);
    };
    // Capture, so an Escape that closes a menu is consumed here and does not
    // also reach the editor's own Escape (which clears the note selection).
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      let closed = closeChromeMenus();
      if (projectsPopoverRef.current || accountPopoverRef.current) {
        setProjectsOpen(false);
        setAccountOpen(false);
        closed = true;
      }
      if (closed) event.stopPropagation();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [closeChromeMenus]);

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
      // Room to scroll is not an edit: it must not count as one to save.
      if (savedPatternRef.current === prev) savedPatternRef.current = next;
      return next;
    });
  }, [pxPerBeat, viewEpoch]);

  const handleTimelineScroll = React.useCallback((event) => {
    const el = event.currentTarget;
    if (patternRef.current.bars >= MAX_PATTERN_BARS) return;
    const threshold = BEATS_PER_BAR * pxPerBeat * 2;
    if (el.scrollLeft + el.clientWidth < el.scrollWidth - threshold) return;
    setPattern((prev) => {
      const next = setPatternBars(prev, Math.min(MAX_PATTERN_BARS, prev.bars + BAR_CHUNK));
      if (savedPatternRef.current === prev) savedPatternRef.current = next;
      return next;
    });
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

  const handleSaveNow = React.useCallback(() => {
    flushDraft();
    if (cloudSessionRef.current) {
      if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
      runCloudSync();
    }
  }, [flushDraft, runCloudSync]);

  React.useEffect(() => {
    const onKeyDown = (event) => {
      const nodeName = event.target?.nodeName;
      if (nodeName === 'INPUT' || nodeName === 'SELECT' || nodeName === 'TEXTAREA') return;
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (event.code === 'Space') {
        event.preventDefault();
        handlePlayToggle();
        return;
      }

      if (mod && key === 's') {
        event.preventDefault();
        handleSaveNow();
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
      if (mod && key === 'u') {
        event.preventDefault();
        handleTransform('quantize');
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

      if (!mod && !event.altKey && TOOL_BY_KEY.has(key)) {
        const next = TOOL_BY_KEY.get(key);
        // B toggles drawing on and off, as it does in Ableton.
        setTool((current) => (next === 'draw' && current === 'draw' ? 'select' : next));
        return;
      }
      if (!mod && key === '0') {
        if (selectedIds.size > 0) handleTransform('mute');
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
    handleSaveNow,
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
    handleTransform,
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

  // ⌘ held while drawing or dragging steps off the grid (Ableton's bypass).
  const snapFor = React.useCallback((event) => (
    event.metaKey || event.ctrlKey ? null : snapBeats
  ), [snapBeats]);

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

  // Grab a note (and the selection with it). ⌥ leaves the originals where
  // they are and drags copies, as in Ableton.
  const beginMove = React.useCallback((anchorNote, beat, midi, selection, copy) => {
    const ids = selection.has(anchorNote.id) ? selection : new Set([anchorNote.id]);
    const sources = patternRef.current.notes.filter((note) => (
      note.trackId === activeTrackId && ids.has(note.id)
    ));
    let anchorId = anchorNote.id;
    const origins = new Map();
    if (copy) {
      const { pattern: next, noteIds } = cloneNotesInPlace(
        patternRef.current,
        new Set(sources.map((note) => note.id))
      );
      // Clones come back in the order of their sources.
      sources.forEach((source, index) => {
        origins.set(noteIds[index], { start: source.start, midi: source.midi });
        if (source.id === anchorNote.id) anchorId = noteIds[index];
      });
      setPatternNow(next);
      setSelectedIds(new Set(noteIds));
    } else {
      sources.forEach((note) => origins.set(note.id, { start: note.start, midi: note.midi }));
    }
    setDrag({
      mode: 'move',
      anchorId,
      grabBeats: beat - anchorNote.start,
      grabMidi: midi,
      origins,
      lastDeltaMidi: 0
    });
  }, [activeTrackId, setPatternNow]);

  // Press on a note with Select or Draw: an edge resizes (the selection with
  // it), the body moves.
  const pressNote = React.useCallback((event, hitNote, { beat, midi, x }) => {
    gestureSnapshotRef.current = patternRef.current;
    const noteLeftX = hitNote.start * pxPerBeat;
    const noteWidth = hitNote.duration * pxPerBeat;
    const edgeRoom = Math.min(RESIZE_HANDLE_PX, noteWidth / 3);
    const edge = noteLeftX + noteWidth - x <= edgeRoom
      ? 'right'
      : (x - noteLeftX <= edgeRoom ? 'left' : null);
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
    if (edge) {
      setDrag({ mode: 'resize', edge, anchorId: hitNote.id, ids: selection });
      return;
    }
    beginMove(hitNote, beat, midi, selection, event.altKey);
  }, [beginMove, pxPerBeat, selectedIds]);

  // Paint lays one note per grid step along the drag; moving up or down
  // inside a step moves that step's note, so a line can be drawn like a pen.
  const paintCell = React.useCallback((paint, cell, midi) => {
    const start = cell * paint.step;
    const current = patternRef.current;
    if (start >= patternBeats(current) - 1e-6 || start < 0) return;
    const existing = paint.cells.get(cell);
    if (existing) {
      const note = current.notes.find((entry) => entry.id === existing);
      if (note && note.midi !== midi) {
        setPatternNow(updateNote(current, existing, { midi }));
        audition(midi);
      }
      return;
    }
    const { pattern: next, note } = addNote(current, {
      midi,
      start,
      duration: paint.step,
      trackId: activeTrackId
    });
    paint.cells.set(cell, note.id);
    setPatternNow(next);
    audition(midi);
  }, [activeTrackId, audition, setPatternNow]);

  const handleLayerPointerDown = React.useCallback((event) => {
    const point = pointerToGrid(event);
    const { beat, midi, x, y } = point;
    const noteId = event.target.dataset?.noteId || null;
    const hitNote = noteId
      ? patternRef.current.notes.find((note) => note.id === noteId)
      : findNoteAt(beat, midi);

    const onOtherLayer = Boolean(hitNote) && hitNote.trackId !== activeTrackId;
    const erasing = event.button === 2 || (event.button === 0 && tool === 'erase');

    if (erasing) {
      gestureSnapshotRef.current = patternRef.current;
      // Erasing stays on the layer being edited.
      if (hitNote && !onOtherLayer) {
        setPatternNow(deleteNote(patternRef.current, hitNote.id));
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

    const snap = snapFor(event);

    if (tool === 'slice') {
      gestureSnapshotRef.current = null;
      const at = snap ? quantizeBeats(beat, snap) : beat;
      setDrag({ mode: 'slice', at, y0: y, y1: y, hitId: hitNote?.id || null });
      return;
    }

    if (tool === 'paint') {
      gestureSnapshotRef.current = patternRef.current;
      const step = snap || snapBeats || 0.25;
      const cell = Math.floor(beat / step + 1e-6);
      const paint = {
        mode: 'paint',
        step,
        cells: new Map(),
        lastCell: cell,
        lastMidi: midi,
        lockMidi: event.shiftKey ? midi : null
      };
      paintCell(paint, cell, midi);
      setSelectedIds(new Set());
      setDrag(paint);
      return;
    }

    if (hitNote) {
      pressNote(event, hitNote, point);
      return;
    }

    if (tool === 'draw') {
      gestureSnapshotRef.current = patternRef.current;
      const start = quantizeBeatsFloor(beat, snap);
      const { pattern: next, note } = addNote(patternRef.current, {
        midi,
        start,
        duration: lastLengthRef.current || snap || 0.25,
        trackId: activeTrackId
      });
      setPatternNow(next);
      setSelectedIds(new Set([note.id]));
      audition(midi);
      setDrag({ mode: 'draw', noteId: note.id, start, x0: x, stretched: false });
      return;
    }

    // Select on empty grid: start a marquee. Insertion is double-click.
    const baseSelection = event.shiftKey ? new Set(selectedIds) : new Set();
    if (!event.shiftKey) setSelectedIds(new Set());
    setDrag({ mode: 'marquee', x0: x, y0: y, x1: x, y1: y, baseSelection });
  }, [
    activeTrackId,
    audition,
    findNoteAt,
    handleSelectTrack,
    paintCell,
    pointerToGrid,
    pressNote,
    selectedIds,
    setPatternNow,
    snapBeats,
    snapFor,
    tool
  ]);

  const handleLayerDoubleClick = React.useCallback((event) => {
    // Only Select adds and removes by double-click; the other tools act on
    // the press itself, and a second press must not undo the first.
    if (tool !== 'select') return;
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

    const start = quantizeBeatsFloor(beat, snapFor(event));
    const duration = lastLengthRef.current || snapBeats || 0.25;
    pushHistory(patternRef.current);
    const { pattern: nextPattern, note } = addNote(patternRef.current, {
      midi,
      start,
      duration,
      trackId: activeTrackId
    });
    setPatternNow(nextPattern);
    setSelectedIds(new Set([note.id]));
    audition(midi);
  }, [
    activeTrackId,
    audition,
    commitPattern,
    findNoteAt,
    pointerToGrid,
    pushHistory,
    setPatternNow,
    snapBeats,
    snapFor,
    tool
  ]);

  const handleLayerPointerMove = React.useCallback((event) => {
    if (!drag) return;
    const { beat, midi, x, y } = pointerToGrid(event);
    const snap = snapFor(event);

    if (drag.mode === 'delete-sweep') {
      const hit = findNoteAt(beat, midi);
      if (hit) setPatternNow(deleteNote(patternRef.current, hit.id));
      return;
    }

    if (drag.mode === 'marquee') {
      const rect = { ...drag, x1: x, y1: y };
      setDrag(rect);
      const inside = notesInMarquee(rect);
      setSelectedIds(new Set([...drag.baseSelection, ...inside]));
      return;
    }

    if (drag.mode === 'slice') {
      setDrag({ ...drag, y1: y });
      return;
    }

    if (drag.mode === 'paint') {
      const cell = Math.floor(beat / drag.step + 1e-6);
      const targetMidi = drag.lockMidi ?? midi;
      if (cell === drag.lastCell) {
        paintCell(drag, cell, targetMidi);
      } else {
        // Fill every step the pointer skipped, on the line between the two.
        const direction = cell > drag.lastCell ? 1 : -1;
        const span = Math.abs(cell - drag.lastCell);
        for (let offset = 1; offset <= span; offset += 1) {
          const stepCell = drag.lastCell + offset * direction;
          const stepMidi = drag.lockMidi ?? Math.round(
            drag.lastMidi + (targetMidi - drag.lastMidi) * (offset / span)
          );
          paintCell(drag, stepCell, stepMidi);
        }
      }
      drag.lastCell = cell;
      drag.lastMidi = targetMidi;
      return;
    }

    if (drag.mode === 'draw') {
      if (!drag.stretched && Math.abs(x - drag.x0) < DRAG_THRESHOLD_PX) return;
      const minLength = snap || MIN_NOTE_BEATS;
      const end = snap
        ? Math.ceil(beat / snap - 1e-6) * snap
        : beat;
      const duration = Math.max(end - drag.start, minLength);
      setPatternNow(updateNote(patternRef.current, drag.noteId, { duration }));
      if (!drag.stretched) setDrag({ ...drag, stretched: true });
      return;
    }

    if (drag.mode === 'move') {
      const anchorOrigin = drag.origins.get(drag.anchorId);
      if (!anchorOrigin) return;
      const anchorStart = quantizeBeats(beat - drag.grabBeats, snap);
      const deltaBeats = anchorStart - anchorOrigin.start;
      const deltaMidi = midi - drag.grabMidi;
      setPatternNow(applyNoteDelta(patternRef.current, drag.origins, deltaBeats, deltaMidi));
      if (deltaMidi !== drag.lastDeltaMidi) {
        audition(anchorOrigin.midi + deltaMidi);
        setDrag({ ...drag, lastDeltaMidi: deltaMidi });
      }
      return;
    }

    if (drag.mode === 'resize') {
      // Resize from the pattern as it was when the edge was grabbed, so the
      // whole selection keeps the same change and nothing accumulates.
      const origin = gestureSnapshotRef.current || patternRef.current;
      const anchor = origin.notes.find((entry) => entry.id === drag.anchorId);
      if (!anchor) return;
      const edgeBeat = snap ? quantizeBeats(beat, snap) : beat;
      const delta = drag.edge === 'right'
        ? edgeBeat - (anchor.start + anchor.duration)
        : edgeBeat - anchor.start;
      setPatternNow(resizeNotes(origin, drag.ids, delta, drag.edge));
    }
  }, [drag, audition, findNoteAt, notesInMarquee, paintCell, pointerToGrid, setPatternNow, snapFor]);

  const handleLayerPointerUp = React.useCallback(() => {
    if (drag?.mode === 'resize' || drag?.mode === 'draw') {
      const id = drag.mode === 'draw' ? drag.noteId : drag.anchorId;
      const note = patternRef.current.notes.find((entry) => entry.id === id);
      // A drawn note that was stretched sets the length for the next ones.
      if (note && (drag.mode === 'resize' || drag.stretched)) lastLengthRef.current = note.duration;
    }
    if (drag?.mode === 'slice') {
      const top = Math.min(drag.y0, drag.y1);
      const bottom = Math.max(drag.y0, drag.y1);
      const highest = midiForRow(Math.floor(top / ROW_HEIGHT));
      const lowest = midiForRow(Math.floor(bottom / ROW_HEIGHT));
      const ids = new Set(patternRef.current.notes
        .filter((note) => (
          note.trackId === activeTrackId
          && note.midi <= highest
          && note.midi >= lowest
        ))
        .map((note) => note.id));
      if (drag.hitId) ids.add(drag.hitId);
      const { pattern: next, noteIds } = sliceNotes(patternRef.current, ids, drag.at);
      if (noteIds.length > 0) {
        pushHistory(patternRef.current);
        setPatternNow(next);
      }
      setDrag(null);
      return;
    }
    // One undo step per completed gesture, and only if it changed anything.
    const snapshot = gestureSnapshotRef.current;
    gestureSnapshotRef.current = null;
    if (snapshot && snapshot !== patternRef.current) pushHistory(snapshot);
    setDrag(null);
  }, [activeTrackId, drag, pushHistory, setPatternNow]);

  const handleKeyAudition = React.useCallback((midi) => {
    audition(midi);
  }, [audition]);

  // ── Velocity lane ─────────────────────────────────────────────────────────

  const handleLaneGestureStart = React.useCallback(() => {
    gestureSnapshotRef.current = patternRef.current;
  }, []);

  const handleLaneVelocities = React.useCallback((velocityById) => {
    setPatternNow(setNoteVelocities(patternRef.current, velocityById));
  }, [setPatternNow]);

  const handleLaneGestureEnd = React.useCallback(() => {
    const snapshot = gestureSnapshotRef.current;
    gestureSnapshotRef.current = null;
    if (snapshot && snapshot !== patternRef.current) pushHistory(snapshot);
  }, [pushHistory]);

  // ── Tracks ────────────────────────────────────────────────────────────────

  const handleAddTrack = React.useCallback(() => {
    pushHistory(patternRef.current);
    const { pattern: next, track } = addTrack(patternRef.current);
    setPatternNow(next);
    setActiveTrackId(track.id);
    setWaveformType(track.instrument);
    setAudioParams(sanitizeAudioParams(track.audioParams || AUDIO_PARAM_DEFAULTS));
    setActivePresetName(track.soundName || null);
    setSelectedIds(new Set());
  }, [pushHistory, setPatternNow]);

  const handleDeleteTrack = React.useCallback((trackId) => {
    if (patternRef.current.tracks.length <= 1) return;
    const next = deleteTrack(patternRef.current, trackId);
    pushHistory(patternRef.current);
    setPatternNow(next);
    if (trackId === activeTrackId) {
      const fallback = next.tracks[0];
      setActiveTrackId(fallback.id);
      setWaveformType(fallback.instrument);
      setAudioParams(sanitizeAudioParams(fallback.audioParams || AUDIO_PARAM_DEFAULTS));
      setActivePresetName(fallback.soundName || null);
      setSelectedIds(new Set());
    }
    setSoundBrowserTrackId((current) => (current === trackId ? null : current));
  }, [activeTrackId, pushHistory, setPatternNow]);

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

  // ── Projects and the account ─────────────────────────────────────────────

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

  // A token refresh hands over a new session object for the same person; only
  // a different person (or none) is a change worth reloading for.
  const cloudUserId = cloudSession?.user?.id || null;
  React.useEffect(() => {
    cloudSessionRef.current = cloudSession;
  }, [cloudSession]);

  React.useEffect(() => {
    if (!cloudUserId) {
      if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
      cloudSyncTimeoutRef.current = null;
      setCloudRows(NO_CLOUD_ROWS);
      setSyncState('idle');
      return undefined;
    }
    let active = true;
    listCloudPatterns().then((rows) => {
      if (!active) return;
      setCloudRows(rows.filter((row) => Array.isArray(row.pattern?.notes)));
    });
    // Whatever this device made while signed out goes to the account now.
    scheduleCloudSync(0);
    return () => {
      active = false;
    };
  }, [cloudUserId, scheduleCloudSync]);

  const loadProjectIntoEditor = React.useCallback((id, rawPattern) => {
    playback.stop();
    const next = normalizePattern(rawPattern);
    historyRef.current = { undo: [], redo: [] };
    gestureSnapshotRef.current = null;
    savedPatternRef.current = next;
    projectIdRef.current = id;
    setProjectId(id);
    setPatternNow(next);
    const first = next.tracks[0];
    setActiveTrackId(first.id);
    setWaveformType(first.instrument);
    setAudioParams(sanitizeAudioParams(first.audioParams || AUDIO_PARAM_DEFAULTS));
    setActivePresetName(first.soundName || null);
    setSelectedIds(new Set());
    setSoundBrowserTrackId(null);
    setRename(null);
    setDrag(null);
    timelinePrimedRef.current = false;
    setViewEpoch((epoch) => epoch + 1);
  }, [playback.stop, setPatternNow]);

  // New starts from nothing at once; the project being left is saved first.
  const handleNewProject = React.useCallback(() => {
    flushDraft();
    loadProjectIntoEditor(newProjectId(), createPattern({ name: nextUntitledName() }));
    setProjectsOpen(false);
  }, [flushDraft, loadProjectIntoEditor]);

  const handleOpenProject = React.useCallback((entry) => {
    setProjectsOpen(false);
    if (entry.localId && entry.localId === projectIdRef.current) return;
    flushDraft();
    const opened = { ...entry.pattern, name: entry.name };
    let id = entry.localId;
    if (!id) {
      // A project from the account this device has not had before.
      id = newProjectId();
      const now = Date.now();
      saveProject({
        id,
        pattern: normalizePattern(opened),
        cloudId: entry.cloudId,
        syncedAt: now,
        updatedAt: now
      });
    }
    loadProjectIntoEditor(id, opened);
  }, [flushDraft, loadProjectIntoEditor]);

  const handleDuplicateProject = React.useCallback((entry) => {
    const copy = normalizePattern({ ...entry.pattern, name: `${entry.name} copy`.slice(0, 48) });
    if (!saveProject({ id: newProjectId(), pattern: copy })) setDeviceSaveFailed(true);
    setLibraryVersion((version) => version + 1);
    scheduleCloudSync();
  }, [scheduleCloudSync]);

  const handleDeleteProject = React.useCallback((entry) => {
    if (entry.localId) deleteProject(entry.localId);
    if (entry.cloudId && cloudSessionRef.current) {
      setCloudRows((prev) => prev.filter((row) => row.id !== entry.cloudId));
      deleteCloudPattern(entry.cloudId);
    }
    if (entry.localId && entry.localId === projectIdRef.current) {
      // The open project is gone: start a clean one without saving it back.
      if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
      loadProjectIntoEditor(newProjectId(), createPattern({ name: nextUntitledName() }));
    }
    setLibraryVersion((version) => version + 1);
  }, [loadProjectIntoEditor]);

  const handleSignIn = React.useCallback(async (email, password) => {
    const result = await signInWithPassword(email, password);
    if (!result.error) setCloudSession(await getSession());
    return result;
  }, []);

  const handleSignOut = React.useCallback(async () => {
    if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
    cloudSyncTimeoutRef.current = null;
    await signOut();
    setCloudSession(null);
    setAccountOpen(false);
  }, []);

  const browserEntries = React.useMemo(() => {
    if (!projectsOpen) return [];
    const signedIn = Boolean(cloudUserId);
    const local = loadProjects();
    const linked = new Set(local.map((entry) => entry.cloudId).filter(Boolean));
    const describe = (pattern) => ({
      bars: pattern.bars,
      bpm: pattern.bpm,
      noteCount: pattern.notes.length
    });
    const entries = local.map((entry) => {
      const synced = Boolean(entry.cloudId && entry.syncedAt && entry.updatedAt <= entry.syncedAt);
      let where = entry.cloudId ? 'account' : 'device';
      if (signedIn && !synced) where = 'pending';
      return {
        key: entry.id,
        localId: entry.id,
        cloudId: entry.cloudId,
        name: entry.name,
        pattern: entry.pattern,
        updatedAt: entry.updatedAt,
        where,
        ...describe(entry.pattern)
      };
    });
    cloudRows.filter((row) => !linked.has(row.id)).forEach((row) => {
      entries.push({
        key: `account-${row.id}`,
        localId: null,
        cloudId: row.id,
        name: row.name,
        pattern: row.pattern,
        updatedAt: Date.parse(row.updatedAt) || 0,
        where: 'account',
        ...describe(row.pattern)
      });
    });
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
    // libraryVersion re-reads the device's list after it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectsOpen, cloudRows, cloudUserId, libraryVersion]);

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
    playback.stop();
    setPendingMidi(midiData);
    window.location.hash = '#/';
  }, [playback.stop]);

  const handleExportMidi = React.useCallback(() => {
    loadMidiExport().then(({ downloadPatternMidi }) => downloadPatternMidi(patternRef.current));
  }, []);

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
      const pitchClass = ((midi % 12) + 12) % 12;
      rows.push({
        midi,
        noteId,
        label: activeScale && (inScale || inChord) ? noteId : (noteName === 'C' ? `C${octave}` : ''),
        black: isBlackKey(midi),
        // C and F sit on B and E with no black key between: a seam.
        seam: pitchClass === 0 || pitchClass === 5,
        inScale,
        inChord
      });
    }
    return rows;
  }, [activeScale, isChordMidi, isScaleMidi]);

  const rulerMarks = React.useMemo(() => {
    const showBeats = pxPerBeat >= RULER_BEAT_LABEL_MIN_PX;
    const marks = [];
    for (let bar = 0; bar < pattern.bars; bar += 1) {
      marks.push({ key: `bar-${bar}`, beat: bar * BEATS_PER_BAR, label: String(bar + 1), bar: true });
      if (!showBeats) continue;
      for (let beat = 1; beat < BEATS_PER_BAR; beat += 1) {
        marks.push({ key: `beat-${bar}-${beat}`, beat: bar * BEATS_PER_BAR + beat, label: `${bar + 1}.${beat + 1}`, bar: false });
      }
    }
    return marks;
  }, [pattern.bars, pxPerBeat]);

  const outOfScaleCount = React.useMemo(() => (
    activeScale ? activeTrackNotes.filter((note) => !isScaleMidi(note.midi)).length : 0
  ), [activeScale, activeTrackNotes, isScaleMidi]);

  const ghostNoteElements = React.useMemo(() => pattern.notes
    .filter((note) => note.trackId !== activeTrack?.id)
    .map((note) => {
      const track = pattern.tracks.find((entry) => entry.id === note.trackId);
      const name = midiNoteToName(note.midi).noteId;
      return (
        <div
          key={`ghost-${note.id}`}
          data-note-id={note.id}
          className={`piano-roll__ghost-note${track?.muted || note.muted ? ' is-muted' : ''}`}
          title={`${track?.name || 'Layer'} · ${name} — click to edit this layer`}
          style={{
            '--track-color': track?.color,
            left: note.start * pxPerBeat,
            top: rowForMidi(note.midi) * ROW_HEIGHT + 1,
            width: Math.max(note.duration * pxPerBeat - 1, 4),
            height: ROW_HEIGHT - 2
          }}
        >
          {noteNameFits(name, note.duration * pxPerBeat) && (
            <span className="piano-roll__note-name">{name}</span>
          )}
        </div>
      );
    }), [activeTrack?.id, pattern.notes, pattern.tracks, pxPerBeat]);

  const noteElements = React.useMemo(() => activeTrackNotes.map((note) => {
    const outOfScale = Boolean(activeScale) && !isScaleMidi(note.midi);
    const name = midiNoteToName(note.midi).noteId;
    const classNames = [
      'piano-roll__note',
      selectedIds.has(note.id) ? 'is-selected' : '',
      outOfScale ? 'is-out-of-scale' : '',
      note.muted ? 'is-muted' : ''
    ].filter(Boolean).join(' ');
    const velocityLabel = `velocity ${midiVelocity(note.velocity ?? DEFAULT_VELOCITY)}`;
    return (
      <div
        key={note.id}
        data-note-id={note.id}
        className={classNames}
        title={outOfScale
          ? `${name} · ${velocityLabel} · outside ${SCALE_ROOTS[scaleRoot]} ${activeScale.label}`
          : `${name} · ${velocityLabel}${note.muted ? ' · muted (0)' : ''}`}
        style={{
          '--track-color': activeTrack?.color,
          '--note-fill': velocityFill(activeTrack?.color, note.velocity),
          left: note.start * pxPerBeat,
          top: rowForMidi(note.midi) * ROW_HEIGHT + 1,
          width: Math.max(note.duration * pxPerBeat - 1, 4),
          height: ROW_HEIGHT - 2
        }}
      >
        {noteNameFits(name, note.duration * pxPerBeat) && (
          <span className="piano-roll__note-name">{name}</span>
        )}
      </div>
    );
  }), [activeScale, activeTrack?.color, activeTrackNotes, isScaleMidi, pxPerBeat, scaleRoot, selectedIds]);

  const signedIn = Boolean(cloudUserId);
  let saveStatus;
  if (deviceSaveFailed) {
    saveStatus = {
      state: 'error',
      label: 'Not saved',
      title: 'This device refused the save (its storage is full). Export the project as MIDI to keep it.'
    };
  } else if (signedIn && syncState === 'saving') {
    saveStatus = { state: 'busy', label: 'Saving', title: 'Sending to your account' };
  } else if (signedIn && syncState === 'error') {
    saveStatus = {
      state: 'error',
      label: 'Retry save',
      title: 'Saved on this device, but your account did not take it. Click to try again (⌘S).'
    };
  } else if (signedIn && syncState === 'midi') {
    saveStatus = {
      state: 'error',
      label: 'Retry save',
      title: 'The project is in your account, but its MIDI file was not stored. Click to try again (⌘S).'
    };
  } else if (signedIn) {
    saveStatus = { state: 'ok', label: 'Saved', title: 'Saved to your account as you work (⌘S saves now)' };
  } else {
    saveStatus = {
      state: 'ok',
      label: 'On this device',
      title: CLOUD_ENABLED
        ? 'Saved on this device as you work. Sign in to keep projects in your account.'
        : 'Saved on this device as you work (⌘S saves now)'
    };
  }

  const syncNote = signedIn
    ? (syncState === 'error' || syncState === 'midi'
      ? 'The last save to your account failed. Edits wait on this device.'
      : 'Projects save to your account as you work.')
    : null;

  const transformTargetLabel = selectedIds.size > 0
    ? `${selectedIds.size} selected`
    : `all of ${activeTrack?.name || 'this track'}`;
  const gridRows = `${RULER_HEIGHT}px ${GRID_HEIGHT}px${velocityLaneOpen ? ` ${VELOCITY_LANE_HEIGHT}px` : ''}`;

  return (
    <div className="piano-roll-page">
      <div className="piano-roll-chrome" ref={chromeRef}>
        <header className="piano-roll-bar">
          <div className="piano-roll-bar__group">
            <button
              type="button"
              className="piano-roll-button piano-roll-button--icon"
              onClick={() => setProjectsOpen((open) => !open)}
              aria-expanded={projectsOpen}
              aria-label="Projects"
              title="Projects"
              data-popover-toggle=""
            >
              {ICON_PROJECTS}
            </button>
            <input
              className="piano-roll-bar__name"
              value={pattern.name}
              onChange={(event) => {
                const name = event.target.value;
                setPattern((prev) => ({ ...prev, name }));
              }}
              aria-label="Project name"
              spellCheck={false}
            />
            <button
              type="button"
              className={`piano-roll-bar__status${saveStatus.state === 'error' ? ' is-error' : ''}${saveStatus.state === 'busy' ? ' is-busy' : ''}`}
              onClick={handleSaveNow}
              title={saveStatus.title}
            >
              {saveStatus.label}
            </button>
            <button
              type="button"
              className="piano-roll-button"
              onClick={handleNewProject}
              title="Start a new project (this one is already saved)"
            >
              {ICON_PLUS}
              <span>New</span>
            </button>
          </div>

          <div className="piano-roll-bar__group piano-roll-bar__group--transport">
            <button
              type="button"
              className="piano-roll-button piano-roll-button--icon piano-roll-button--transport"
              onClick={handlePlayToggle}
              aria-pressed={isRolling}
              aria-label={isRolling ? 'Stop the loop' : 'Play the loop'}
              title={isRolling ? 'Stop (Space)' : 'Play the loop (Space)'}
            >
              {isRolling ? ICON_STOP : ICON_PLAY}
            </button>
            <button
              type="button"
              className={`piano-roll-button piano-roll-button--icon piano-roll-button--record${isRecordingLoop ? ' is-recording' : ''}`}
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
            <label className="piano-roll-field">
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
            <BeatCounter
              on={metronomeOn}
              running={isRolling}
              getProgress={playback.getPlaybackProgress}
              shapeRef={playbackShapeRef}
              onToggle={() => setMetronomeOn((current) => !current)}
            />
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

          <div className="piano-roll-bar__group piano-roll-bar__group--end">
            <details className="piano-roll-menu-anchor">
              <summary
                className="piano-roll-button piano-roll-button--icon"
                aria-label="More project actions"
                title="More: export MIDI, send to the player, track actions"
              >
                {ICON_MORE}
              </summary>
              <div className="piano-roll-menu piano-roll-menu--end">
                <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(handleExportMidi)}>
                  Export MIDI file
                </button>
                <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(handleOpenInPlayer)}>
                  Send to player
                </button>
                <button
                  type="button"
                  className="piano-roll-menu__item"
                  onClick={runMenuAction(handleClear)}
                  title={`Delete every note on ${activeTrack?.name || 'this track'}`}
                >
                  Clear track
                </button>
                {pattern.tracks.length > 1 && (
                  <button
                    type="button"
                    className="piano-roll-menu__item"
                    onClick={runMenuAction(() => handleDeleteTrack(activeTrack?.id))}
                    title={`Remove ${activeTrack?.name || 'this track'} and its notes`}
                  >
                    Delete track
                  </button>
                )}
              </div>
            </details>
            {CLOUD_ENABLED && (
              <button
                type="button"
                className={`piano-roll-button piano-roll-button--icon piano-roll-button--account${signedIn ? ' is-signed-in' : ''}`}
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-label={signedIn ? 'Account: signed in' : 'Account: sign in'}
                title={signedIn ? `Signed in as ${cloudSession.user?.email || 'you'}` : 'Sign in'}
                data-popover-toggle=""
              >
                {ICON_ACCOUNT}
              </button>
            )}
          </div>
        </header>

        <div className="piano-roll-tools">
          <div className="piano-roll-tools__set" role="radiogroup" aria-label="Tools">
            {TOOLS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                className="piano-roll-tool"
                aria-checked={tool === entry.id}
                aria-label={entry.label}
                title={entry.hint}
                onClick={() => setTool(entry.id)}
              >
                {entry.icon}
              </button>
            ))}
          </div>

          <label className="piano-roll-field">
            <span>Grid</span>
            <select value={snapId} onChange={(event) => setSnapId(event.target.value)}>
              {SNAP_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="piano-roll-field">
            <span>Scale</span>
            <select value={scaleId} onChange={(event) => setScaleId(event.target.value)}>
              <option value="">Off</option>
              {SCALES.map((scale) => (
                <option key={scale.id} value={scale.id}>{scale.label}</option>
              ))}
            </select>
          </label>

          {scaleId && (
            <label className="piano-roll-field">
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
            <span className="piano-roll-tools__outside">{outOfScaleCount} outside</span>
          )}

          <details className="piano-roll-menu-anchor">
            <summary className="piano-roll-button" title="Transform notes: the selection, or the whole track">
              <span>Transform</span>
              {ICON_CHEVRON}
            </summary>
            <div className="piano-roll-menu">
              <p className="piano-roll-menu__heading">Acts on {transformTargetLabel}</p>
              <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(() => handleTransform('quantize'))}>
                <span>Quantize</span><kbd>⌘U</kbd>
              </button>
              <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(() => handleTransform('legato'))}>
                <span>Legato</span>
              </button>
              <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(() => handleTransform('reverse'))}>
                <span>Reverse</span>
              </button>
              <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(() => handleTransform('invert'))}>
                <span>Invert</span>
              </button>
              <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(() => handleTransform('double'))}>
                <span>Stretch ×2</span>
              </button>
              <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(() => handleTransform('halve'))}>
                <span>Squeeze ÷2</span>
              </button>
              {selectedIds.size > 0 && (
                <button type="button" className="piano-roll-menu__item" onClick={runMenuAction(() => handleTransform('mute'))}>
                  <span>Mute / unmute</span><kbd>0</kbd>
                </button>
              )}
            </div>
          </details>

          <button
            type="button"
            className="piano-roll-button piano-roll-button--icon"
            onClick={() => setVelocityLaneOpen((open) => !open)}
            aria-pressed={velocityLaneOpen}
            aria-label="Velocity lane"
            title={velocityLaneOpen ? 'Hide the velocity lane' : 'Show the velocity lane'}
          >
            {ICON_VELOCITY}
          </button>

          <div className="piano-roll-tools__zoom" role="group" aria-label="Zoom">
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
              className="piano-roll-tools__zoom-fit"
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

          <details className="piano-roll-menu-anchor">
            <summary
              className="piano-roll-button piano-roll-button--icon"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts"
            >
              {ICON_HELP}
            </summary>
            <div className="piano-roll-menu piano-roll-menu--end piano-roll-help">
              <h2 className="piano-roll-menu__heading">Shortcuts</h2>
              <dl>
                <dt>V B P C E</dt><dd>Select · draw · paint · slice · erase</dd>
                <dt>Double-click</dt><dd>Add / remove a note (Select)</dd>
                <dt>⌥-drag · ⌘-drag</dt><dd>Copy notes · ignore the grid</dd>
                <dt>Drag an edge</dt><dd>Resize the selection</dd>
                <dt>1–9 · click a note</dt><dd>Switch track</dd>
                <dt>Arrows · ⇧↑↓</dt><dd>Nudge · octave</dd>
                <dt>⇧← ⇧→ · ⌥← ⌥→</dt><dd>Resize end · trim start</dd>
                <dt>⌘U · 0</dt><dd>Quantize · mute notes</dd>
                <dt>⌘Z · ⇧⌘Z</dt><dd>Undo · redo</dd>
                <dt>⌘C ⌘X ⌘V</dt><dd>Copy · cut · paste</dd>
                <dt>⌘D · ⇧⌘D</dt><dd>Duplicate right · clone in place</dd>
                <dt>⇧⌘L</dt><dd>Loop selected bars</dd>
                <dt>⌘A · Esc</dt><dd>Select all · none</dd>
                <dt>Del · right-click</dt><dd>Delete · erase</dd>
                <dt>⌘ + scroll</dt><dd>Zoom</dd>
                <dt>Space · ⌘S</dt><dd>Play / stop · save now</dd>
              </dl>
            </div>
          </details>
        </div>
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
              gridTemplateRows: gridRows
            }}
          >
            <div className="piano-roll__corner" />

            <div className="piano-roll__ruler" aria-hidden="true">
              {loopRange && (
                <span
                  className="piano-roll__loop-brace"
                  style={{
                    left: loopRange.start * pxPerBeat,
                    width: (loopRange.end - loopRange.start) * pxPerBeat
                  }}
                />
              )}
              {rulerMarks.map((mark) => (
                <span
                  key={mark.key}
                  className={mark.bar ? 'piano-roll__bar-marker' : 'piano-roll__bar-marker piano-roll__bar-marker--beat'}
                  style={{ left: mark.beat * pxPerBeat }}
                >
                  {mark.label}
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
                    key.seam ? 'piano-roll__key--seam' : '',
                    activeScale && !key.inScale ? 'is-out-of-scale' : '',
                    key.inChord ? 'is-in-chord' : ''
                  ].filter(Boolean).join(' ')}
                  style={{ height: ROW_HEIGHT }}
                  onPointerDown={() => handleKeyAudition(key.midi)}
                  aria-label={`Audition ${key.noteId}`}
                >
                  {key.label && <span className="piano-roll__key-label">{key.label}</span>}
                </button>
              ))}
            </div>

            <div className="piano-roll__grid">
              <canvas ref={canvasRef} className="piano-roll__grid-canvas" />
              <div
                className="piano-roll__notes"
                data-tool={tool}
                role="application"
                aria-label="Note grid: draw, paint, slice or erase with the tools above; double-click adds a note when selecting"
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
                  />
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
                {drag?.mode === 'slice' && (
                  <div
                    className="piano-roll__knife"
                    style={{
                      left: drag.at * pxPerBeat,
                      top: Math.floor(Math.min(drag.y0, drag.y1) / ROW_HEIGHT) * ROW_HEIGHT,
                      height: (Math.floor(Math.max(drag.y0, drag.y1) / ROW_HEIGHT)
                        - Math.floor(Math.min(drag.y0, drag.y1) / ROW_HEIGHT) + 1) * ROW_HEIGHT
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

            {velocityLaneOpen && (
              <>
                <div className="piano-roll__lane-label" aria-live="polite">
                  {laneReadout ?? 'VEL'}
                </div>
                <div className="piano-roll__lane" style={{ '--track-color': activeTrack?.color }}>
                  <VelocityLane
                    notes={activeTrackNotes}
                    selectedIds={selectedIds}
                    pxPerBeat={pxPerBeat}
                    onSelect={setSelectedIds}
                    onGestureStart={handleLaneGestureStart}
                    onVelocities={handleLaneVelocities}
                    onGestureEnd={handleLaneGestureEnd}
                    onReadout={setLaneReadout}
                  />
                </div>
              </>
            )}
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
                    {/* At rest it names the track; under the pointer it shows
                        what a press does. */}
                    <span className="piano-roll-deck__power-number">{trackIndex + 1}</span>
                    {ICON_POWER}
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
                      className="piano-roll-deck__solo"
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
            className="piano-roll-decks__add"
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

      {/* Selection actions float over the bottom of the grid. Inside the bars they
          wrapped onto a line of their own on narrower windows, which shoved the
          grid down the instant a note was selected. */}
      {(selectedIds.size > 0 || loopRange) && (
        <div
          className={`piano-roll-selection${velocityLaneOpen ? ' piano-roll-selection--over-lane' : ''}`}
          aria-live="polite"
        >
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
                className="piano-roll-button"
                onClick={handleBuildChord}
                title="Turn each selected note into a chord"
              >
                Add chord
              </button>
            </>
          )}
          <button
            type="button"
            className="piano-roll-button"
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
              className="piano-roll-button"
              onClick={handleSnapSelectionToScale}
              disabled={selectedIds.size === 0}
              title={`Move the selected notes onto the nearest ${SCALE_ROOTS[scaleRoot]} ${activeScale.label} note`}
            >
              Snap to key
            </button>
          )}
        </div>
      )}

      {projectsOpen && (
        <div className="piano-roll-popover piano-roll-popover--projects" ref={projectsPopoverRef}>
          <React.Suspense fallback={null}>
            <ProjectBrowser
              entries={browserEntries}
              currentId={projectId}
              footnote={CLOUD_ENABLED && !signedIn
                ? 'These live on this device. Sign in to keep them in your account.'
                : null}
              onOpen={handleOpenProject}
              onDuplicate={handleDuplicateProject}
              onDelete={handleDeleteProject}
              onNew={handleNewProject}
              onClose={() => setProjectsOpen(false)}
            />
          </React.Suspense>
        </div>
      )}

      {CLOUD_ENABLED && accountOpen && (
        <div className="piano-roll-popover piano-roll-popover--account" ref={accountPopoverRef}>
          <React.Suspense fallback={null}>
            <AccountPanel
              session={cloudSession}
              syncNote={syncNote}
              onSignIn={handleSignIn}
              onSignOut={handleSignOut}
            />
          </React.Suspense>
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
