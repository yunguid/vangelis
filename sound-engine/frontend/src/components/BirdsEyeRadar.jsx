import React, { useEffect, useMemo, useRef } from 'react';
import { clamp, midiNoteToName } from '../utils/math.js';
import { buildNoteRenderWindow, getVisibleNoteRange } from './midiBirdsEyeMath.js';

const DEFAULT_MIN_MIDI = 21;
const DEFAULT_MAX_MIDI = 108;
const LOOKAHEAD_SECONDS = 12;
const LOOKBEHIND_SECONDS = 1.6;
const PLAYING_FRAME_INTERVAL_MS = 50;
const IDLE_FRAME_INTERVAL_MS = 170;
const EMPTY_FRAME_INTERVAL_MS = 260;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 22;
const SIDE_PADDING = 18;
const EMPTY_ACTIVE_NOTES = new Set();

const createParticles = (count) => Array.from({ length: count }, () => ({
  lane: Math.random(),
  depth: Math.random(),
  speed: 0.05 + Math.random() * 0.11,
  phase: Math.random(),
  size: 0.5 + Math.random() * 1.6
}));

const BirdsEyeRadar = ({ currentMidi, progress, activeNotes = EMPTY_ACTIVE_NOTES, isPlaying = false }) => {
  const canvasRef = useRef(null);
  const noteIdCacheRef = useRef(new Map());
  const particlesRef = useRef(createParticles(20));
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

    const drawBackdrop = (width, height) => {
      const base = ctx.createLinearGradient(0, 0, 0, height);
      base.addColorStop(0, 'rgba(2, 7, 13, 0.98)');
      base.addColorStop(0.46, 'rgba(4, 11, 20, 0.96)');
      base.addColorStop(1, 'rgba(2, 7, 12, 0.99)');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      const warmBloom = ctx.createRadialGradient(width * 0.5, height * 0.88, 20, width * 0.5, height * 0.88, width * 0.72);
      warmBloom.addColorStop(0, 'rgba(255, 126, 52, 0.17)');
      warmBloom.addColorStop(0.45, 'rgba(255, 118, 46, 0.05)');
      warmBloom.addColorStop(1, 'rgba(255, 118, 46, 0)');
      ctx.fillStyle = warmBloom;
      ctx.fillRect(0, 0, width, height);

      const vignette = ctx.createRadialGradient(width * 0.5, height * 0.58, width * 0.2, width * 0.5, height * 0.58, width * 0.82);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    };

    const drawGrid = ({ trackTop, trackBottom, centerX, playfieldWidth, vanishY }) => {
      const depthSpan = trackBottom - trackTop;
      ctx.strokeStyle = 'rgba(120, 150, 182, 0.16)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let i = 0; i <= 11; i += 1) {
        const t = i / 11;
        const y = trackTop + depthSpan * t;
        const spread = 0.14 + t * 0.86;
        const halfSpan = (playfieldWidth * spread) * 0.5;
        ctx.moveTo(centerX - halfSpan, y);
        ctx.lineTo(centerX + halfSpan, y);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i <= 18; i += 1) {
        const laneNorm = i / 18;
        const xBottom = SIDE_PADDING + laneNorm * playfieldWidth;
        const xTop = centerX + (xBottom - centerX) * 0.18;
        ctx.moveTo(xTop, vanishY);
        ctx.lineTo(xBottom, trackBottom);
      }
      ctx.stroke();

      const runway = ctx.createLinearGradient(0, trackBottom - 1, 0, trackBottom + 10);
      runway.addColorStop(0, 'rgba(255, 144, 74, 0.96)');
      runway.addColorStop(1, 'rgba(255, 116, 48, 0.34)');
      ctx.strokeStyle = runway;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(SIDE_PADDING, trackBottom);
      ctx.lineTo(SIDE_PADDING + playfieldWidth, trackBottom);
      ctx.stroke();
    };

    const drawParticles = ({ nowSeconds, trackTop, trackBottom, centerX, playfieldWidth }) => {
      const depthSpan = trackBottom - trackTop;
      for (const p of particlesRef.current) {
        const flow = (p.depth + nowSeconds * p.speed + p.phase) % 1;
        const y = trackTop + flow * depthSpan;
        const spread = 0.16 + flow * 0.84;
        const laneX = SIDE_PADDING + p.lane * playfieldWidth;
        const x = centerX + (laneX - centerX) * spread;
        const alpha = 0.06 + (1 - flow) * 0.28;
        ctx.fillStyle = `rgba(255, 164, 88, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawNotes = ({ midi, playbackProgress, activeNoteSet, renderWindow, trackTop, trackBottom, centerX, playfieldWidth }) => {
      if (!midi?.duration || !renderWindow.notes.length) return;

      const trackHeight = Math.max(1, trackBottom - trackTop);
      const midiSpan = Math.max(1, midiRange.max - midiRange.min);
      const laneWidth = playfieldWidth / (midiSpan + 1);
      const nowTime = clamp(playbackProgress, 0, 1) * midi.duration;
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

        const yHead = trackBottom - depthNorm * trackHeight;
        const farRatio = clamp((trackBottom - yHead) / trackHeight, 0, 1);
        const nearRatio = 1 - farRatio;

        const laneNorm = (note.midi - midiRange.min) / midiSpan;
        const laneX = SIDE_PADDING + laneNorm * playfieldWidth;
        const perspectiveSpread = 0.18 + nearRatio * 0.82;
        const x = centerX + (laneX - centerX) * perspectiveSpread;

        const noteWidth = Math.max(2.5, laneWidth * (0.18 + nearRatio * 0.64));
        const bodyLen = clamp(12 + note.duration * 78 * (0.44 + nearRatio * 0.82), 10, trackHeight * 0.72);
        const tailLen = clamp(bodyLen * (0.9 + nearRatio * 2.3), 12, trackHeight * 0.92);
        const bodyTop = yHead - bodyLen;
        const tailTop = bodyTop - tailLen;

        const noteId = getNoteId(note.midi);
        const isActive = activeNoteSet?.has(noteId);
        const glowColor = isActive ? 'rgba(255, 195, 132, 0.86)' : 'rgba(255, 150, 86, 0.58)';
        const coreColor = isActive ? 'rgba(255, 226, 168, 0.97)' : 'rgba(255, 172, 108, 0.92)';
        const edgeColor = isActive ? 'rgba(255, 246, 222, 0.96)' : 'rgba(255, 214, 166, 0.78)';

        const trail = ctx.createLinearGradient(x, tailTop, x, yHead + 2);
        trail.addColorStop(0, 'rgba(255, 138, 72, 0)');
        trail.addColorStop(0.38, isActive ? 'rgba(255, 184, 124, 0.2)' : 'rgba(255, 146, 88, 0.16)');
        trail.addColorStop(1, isActive ? 'rgba(255, 206, 152, 0.48)' : 'rgba(255, 164, 102, 0.34)');
        ctx.fillStyle = trail;
        ctx.fillRect(x - noteWidth, tailTop, noteWidth * 2, yHead - tailTop + 2);

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isActive ? 24 : 14;

        const body = ctx.createLinearGradient(x, bodyTop, x, yHead);
        body.addColorStop(0, 'rgba(255, 154, 92, 0.38)');
        body.addColorStop(0.7, coreColor);
        body.addColorStop(1, edgeColor);
        ctx.fillStyle = body;
        ctx.fillRect(x - noteWidth * 0.5, bodyTop, noteWidth, bodyLen);

        ctx.strokeStyle = isActive ? 'rgba(255, 244, 214, 0.8)' : 'rgba(255, 220, 182, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - noteWidth * 0.5, bodyTop, noteWidth, bodyLen);
      }

      ctx.shadowBlur = 0;
    };

    let rafId;
    let lastFrame = 0;
    const loop = (time) => {
      const {
        currentMidi: midi,
        progress: playbackProgress,
        activeNotes: activeNoteSet,
        isPlaying: nowPlaying,
        noteRenderWindow: renderWindow
      } = propsRef.current;
      if (document.visibilityState !== 'visible') {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const frameInterval = nowPlaying
        ? PLAYING_FRAME_INTERVAL_MS
        : (midi ? IDLE_FRAME_INTERVAL_MS : EMPTY_FRAME_INTERVAL_MS);
      if (time - lastFrame < frameInterval) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      lastFrame = time;

      const { width, height } = syncCanvasSize();
      const nowSeconds = time * 0.001;

      ctx.clearRect(0, 0, width, height);
      drawBackdrop(width, height);

      const trackTop = TOP_PADDING;
      const trackBottom = height - BOTTOM_PADDING;
      const playfieldWidth = Math.max(120, width - SIDE_PADDING * 2);
      const centerX = SIDE_PADDING + playfieldWidth * 0.5;
      const vanishY = trackTop - height * 0.24;

      drawGrid({ trackTop, trackBottom, centerX, playfieldWidth, vanishY });
      drawParticles({ nowSeconds, trackTop, trackBottom, centerX, playfieldWidth });
      drawNotes({
        midi,
        playbackProgress,
        activeNoteSet,
        renderWindow,
        trackTop,
        trackBottom,
        centerX,
        playfieldWidth
      });

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [midiRange.max, midiRange.min]);

  return (
    <section className="birds-eye-radar panel elevated" aria-label="Bird's-eye MIDI radar">
      <div className="birds-eye-radar__stage">
        <canvas ref={canvasRef} className="birds-eye-radar__canvas" />
        {!currentMidi && (
          <div className="birds-eye-radar__empty">
            Load a MIDI file to start the radar.
          </div>
        )}
      </div>
    </section>
  );
};

export default BirdsEyeRadar;
