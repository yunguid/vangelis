import React, { useEffect, useMemo, useRef } from 'react';
import RaylibWaveCandy from './RaylibWaveCandy.jsx';
import { clamp, midiNoteToName } from '../utils/math.js';
import { buildNoteRenderWindow, getVisibleNoteRange } from './midiBirdsEyeMath.js';

const DEFAULT_MIN_MIDI = 21;
const DEFAULT_MAX_MIDI = 108;
const LOOKAHEAD_SECONDS = 12;
const LOOKBEHIND_SECONDS = 1.8;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 26;
const SIDE_PADDING = 18;
const EMPTY_ACTIVE_NOTES = new Set();

const BirdsEyeRadar = ({ currentMidi, progress, activeNotes = EMPTY_ACTIVE_NOTES, isPlaying }) => {
  const canvasRef = useRef(null);
  const noteIdCacheRef = useRef(new Map());
  const noteRenderWindow = useMemo(
    () => buildNoteRenderWindow(currentMidi?.notes || []),
    [currentMidi]
  );
  const propsRef = useRef({
    currentMidi,
    progress,
    activeNotes,
    isPlaying,
    noteRenderWindow
  });

  propsRef.current = {
    currentMidi,
    progress,
    activeNotes,
    isPlaying,
    noteRenderWindow
  };

  const midiRange = useMemo(() => {
    const notes = currentMidi?.notes || [];
    if (notes.length === 0) {
      return { min: DEFAULT_MIN_MIDI, max: DEFAULT_MAX_MIDI };
    }

    let min = DEFAULT_MAX_MIDI;
    let max = DEFAULT_MIN_MIDI;
    for (const note of notes) {
      if (note.midi < min) min = note.midi;
      if (note.midi > max) max = note.midi;
    }

    return {
      min: Math.min(min, DEFAULT_MIN_MIDI),
      max: Math.max(max, DEFAULT_MAX_MIDI)
    };
  }, [currentMidi]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === 'undefined') return undefined;

    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const getNoteId = (midiNote) => {
      if (noteIdCacheRef.current.has(midiNote)) {
        return noteIdCacheRef.current.get(midiNote);
      }
      const noteId = midiNoteToName(midiNote).noteId;
      noteIdCacheRef.current.set(midiNote, noteId);
      return noteId;
    };

    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const displayWidth = Math.floor(width * dpr);
      const displayHeight = Math.floor(height * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width, height };
    };

    const drawGrid = (width, trackTop, trackBottom, centerX, playfieldWidth, nowSeconds) => {
      ctx.strokeStyle = 'rgba(120, 176, 220, 0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      const drift = (Math.sin(nowSeconds * 0.8) * 0.5 + 0.5) * 0.08;

      for (let i = 0; i <= 8; i += 1) {
        const depth = i / 8;
        const y = trackTop + depth * (trackBottom - trackTop);
        const pulse = 1 - depth * (0.52 + drift * 0.08);
        const halfSpan = (playfieldWidth * pulse) / 2;
        ctx.moveTo(centerX - halfSpan, y);
        ctx.lineTo(centerX + halfSpan, y);
      }

      for (let i = 0; i <= 10; i += 1) {
        const laneNorm = i / 10;
        const baseX = SIDE_PADDING + laneNorm * playfieldWidth;
        const pull = (centerX - baseX) * 0.24;
        ctx.moveTo(baseX + pull, trackTop);
        ctx.lineTo(baseX, trackBottom);
      }

      ctx.stroke();
    };

    const draw = (now) => {
      const {
        currentMidi: midi,
        progress: playbackProgress,
        activeNotes: activeNoteSet,
        noteRenderWindow: renderWindow
      } = propsRef.current;
      const { width, height } = syncCanvasSize();

      ctx.clearRect(0, 0, width, height);

      const nowSeconds = now * 0.001;
      const wash = ctx.createLinearGradient(0, 0, width, height);
      wash.addColorStop(0, 'rgba(6, 11, 18, 0.40)');
      wash.addColorStop(0.5, 'rgba(3, 8, 14, 0.26)');
      wash.addColorStop(1, 'rgba(4, 10, 16, 0.56)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, width, height);

      const trackTop = TOP_PADDING;
      const trackBottom = height - BOTTOM_PADDING;
      const trackHeight = Math.max(1, trackBottom - trackTop);
      const playfieldWidth = Math.max(120, width - SIDE_PADDING * 2);
      const centerX = SIDE_PADDING + playfieldWidth / 2;

      drawGrid(width, trackTop, trackBottom, centerX, playfieldWidth, nowSeconds);

      const runway = ctx.createLinearGradient(0, trackBottom - 2, 0, trackBottom + 8);
      runway.addColorStop(0, 'rgba(255, 166, 122, 0.98)');
      runway.addColorStop(1, 'rgba(255, 120, 72, 0.30)');
      ctx.strokeStyle = runway;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SIDE_PADDING, trackBottom - 1);
      ctx.lineTo(width - SIDE_PADDING, trackBottom - 1);
      ctx.stroke();

      if (!midi?.duration || !renderWindow.notes.length) {
        return;
      }

      const nowTime = clamp(playbackProgress, 0, 1) * midi.duration;
      const midiSpan = Math.max(1, midiRange.max - midiRange.min);
      const laneBaseWidth = playfieldWidth / (midiSpan + 1);
      const { startIndex, endIndex, windowStart, windowEnd } = getVisibleNoteRange({
        startTimes: renderWindow.startTimes,
        nowTime,
        lookBehindSeconds: LOOKBEHIND_SECONDS,
        lookAheadSeconds: LOOKAHEAD_SECONDS,
        maxDuration: renderWindow.maxDuration
      });

      for (let noteIndex = startIndex; noteIndex < endIndex; noteIndex += 1) {
        const note = renderWindow.notes[noteIndex];
        if (note.endTime < windowStart || note.time > windowEnd) continue;

        const leadSeconds = note.time - nowTime;
        const depthNorm = clamp(
          (leadSeconds + LOOKBEHIND_SECONDS) / (LOOKAHEAD_SECONDS + LOOKBEHIND_SECONDS),
          0,
          1
        );

        const y = trackBottom - depthNorm * trackHeight;
        const viewerDepth = clamp((trackBottom - y) / trackHeight, 0, 1);
        const perspectiveScale = 1 - viewerDepth * 0.5;

        const laneNorm = (note.midi - midiRange.min) / midiSpan;
        const laneX = SIDE_PADDING + laneNorm * playfieldWidth;
        const perspectivePull = (centerX - laneX) * (viewerDepth * 0.24);
        const x = laneX + perspectivePull;

        const noteWidth = Math.max(2.5, laneBaseWidth * perspectiveScale * 0.9);
        const durationScale = clamp(note.duration / 1.8, 0.06, 0.45);
        const noteHeight = Math.max(4, durationScale * trackHeight * (1 - viewerDepth * 0.42));
        const noteTop = y - noteHeight;

        const noteId = getNoteId(note.midi);
        const isActive = activeNoteSet?.has(noteId);

        if (isActive) {
          ctx.fillStyle = 'rgba(255, 174, 132, 0.98)';
          ctx.shadowColor = 'rgba(255, 132, 78, 0.94)';
          ctx.shadowBlur = 14;
        } else {
          ctx.fillStyle = 'rgba(132, 214, 255, 0.74)';
          ctx.shadowColor = 'rgba(92, 182, 248, 0.35)';
          ctx.shadowBlur = 6;
        }

        ctx.fillRect(x - noteWidth / 2, noteTop, noteWidth, noteHeight);
      }

      ctx.shadowBlur = 0;
    };

    let rafId;
    const loop = (time) => {
      draw(time);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [midiRange.max, midiRange.min]);

  const progressPct = Number.isFinite(progress) ? Math.round(clamp(progress, 0, 1) * 100) : 0;

  return (
    <section className="birds-eye-radar panel elevated" aria-label="Bird's-eye MIDI radar">
      <div className="birds-eye-radar__header">
        <span className="birds-eye-radar__title">Bird&apos;s-Eye Radar</span>
        <span className={`birds-eye-radar__status ${isPlaying ? 'is-live' : ''}`}>
          {isPlaying ? 'Playing' : 'Idle'}
        </span>
      </div>

      <div className="birds-eye-radar__stage">
        <RaylibWaveCandy
          className="birds-eye-radar__raylib"
          viewportClassName="birds-eye-radar__raylib-viewport"
          canvasClassName="birds-eye-radar__raylib-canvas"
          canvasId="raylib-birds-eye"
          showToggle={false}
          ariaLabel="Bird's-eye radar background"
        />
        <canvas ref={canvasRef} className="birds-eye-radar__overlay" />

        <div className="birds-eye-radar__hud">
          <span className="birds-eye-radar__midi" title={currentMidi ? currentMidi.name : 'No MIDI loaded'}>
            {currentMidi ? currentMidi.name : 'No MIDI loaded'}
          </span>
          <span className="birds-eye-radar__progress">{progressPct}%</span>
        </div>

        {!currentMidi && (
          <div className="birds-eye-radar__empty">
            Load a MIDI file to preview note traffic.
          </div>
        )}
      </div>
    </section>
  );
};

export default BirdsEyeRadar;
