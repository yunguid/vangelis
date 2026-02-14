import React, { useEffect, useMemo, useRef } from 'react';
import { clamp, midiNoteToName } from '../utils/math.js';

const DEFAULT_MIN_MIDI = 21;
const DEFAULT_MAX_MIDI = 108;
const LOOKAHEAD_SECONDS = 10;
const LOOKBEHIND_SECONDS = 1.5;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 24;
const SIDE_PADDING = 16;

const MidiBirdsEyeView = ({ currentMidi, progress, activeNotes, isPlaying }) => {
  const canvasRef = useRef(null);
  const propsRef = useRef({ currentMidi, progress, activeNotes, isPlaying });
  const noteIdCacheRef = useRef(new Map());

  propsRef.current = { currentMidi, progress, activeNotes, isPlaying };

  const midiRange = useMemo(() => {
    const notes = currentMidi?.notes || [];
    if (notes.length === 0) {
      return {
        min: DEFAULT_MIN_MIDI,
        max: DEFAULT_MAX_MIDI
      };
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

    const drawPerspectiveGrid = (width, height, trackTop, trackBottom, centerX, playfieldWidth) => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      for (let i = 0; i <= 8; i += 1) {
        const depth = i / 8;
        const y = trackTop + depth * (trackBottom - trackTop);
        const spanScale = 1 - depth * 0.5;
        const halfSpan = (playfieldWidth * spanScale) / 2;
        ctx.moveTo(centerX - halfSpan, y);
        ctx.lineTo(centerX + halfSpan, y);
      }

      for (let i = 0; i <= 10; i += 1) {
        const laneNorm = i / 10;
        const baseX = SIDE_PADDING + laneNorm * playfieldWidth;
        const topPull = (centerX - baseX) * 0.24;
        ctx.moveTo(baseX + topPull, trackTop);
        ctx.lineTo(baseX, trackBottom);
      }

      ctx.stroke();
    };

    const draw = () => {
      const { currentMidi: midi, progress: playbackProgress, activeNotes: activeNoteSet } = propsRef.current;
      const { width, height } = syncCanvasSize();

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(5, 9, 14, 0.92)';
      ctx.fillRect(0, 0, width, height);

      const trackTop = TOP_PADDING;
      const trackBottom = height - BOTTOM_PADDING;
      const trackHeight = Math.max(1, trackBottom - trackTop);
      const playfieldWidth = Math.max(120, width - SIDE_PADDING * 2);
      const centerX = SIDE_PADDING + playfieldWidth / 2;

      drawPerspectiveGrid(width, height, trackTop, trackBottom, centerX, playfieldWidth);

      ctx.strokeStyle = 'rgba(255, 152, 105, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(SIDE_PADDING, trackBottom - 1);
      ctx.lineTo(width - SIDE_PADDING, trackBottom - 1);
      ctx.stroke();

      if (!midi?.notes?.length || !midi.duration) {
        return;
      }

      const nowTime = clamp(playbackProgress, 0, 1) * midi.duration;
      const windowStart = nowTime - LOOKBEHIND_SECONDS;
      const windowEnd = nowTime + LOOKAHEAD_SECONDS;
      const midiSpan = Math.max(1, midiRange.max - midiRange.min);
      const laneBaseWidth = playfieldWidth / (midiSpan + 1);

      for (const note of midi.notes) {
        const noteEnd = note.time + note.duration;
        if (noteEnd < windowStart || note.time > windowEnd) continue;

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
          ctx.fillStyle = 'rgba(255, 154, 112, 0.98)';
          ctx.shadowColor = 'rgba(255, 126, 84, 0.9)';
          ctx.shadowBlur = 10;
        } else {
          ctx.fillStyle = 'rgba(120, 200, 255, 0.72)';
          ctx.shadowBlur = 0;
        }

        ctx.fillRect(x - noteWidth / 2, noteTop, noteWidth, noteHeight);
      }

      ctx.shadowBlur = 0;
    };

    let rafId;
    const loop = () => {
      draw();
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(rafId);
  }, [midiRange.max, midiRange.min]);

  return (
    <div className="birds-eye-view" role="img" aria-label="Bird's-eye MIDI note traffic view">
      <canvas ref={canvasRef} className="birds-eye-view__canvas" />
      <div className="birds-eye-view__hud">
        <span>{currentMidi ? currentMidi.name : 'No MIDI loaded'}</span>
        <span>{isPlaying ? 'Playing' : 'Idle'}</span>
      </div>
      {!currentMidi && (
        <div className="birds-eye-view__empty">
          Load a MIDI file to visualize incoming notes.
        </div>
      )}
    </div>
  );
};

export default MidiBirdsEyeView;
