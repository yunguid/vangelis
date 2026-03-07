import React, { useEffect, useMemo, useRef } from 'react';
import { clamp, midiNoteToName } from '../utils/math.js';
import { buildNoteRenderWindow, getVisibleNoteRange } from './midiBirdsEyeMath.js';

const DEFAULT_MIN_MIDI = 21;
const DEFAULT_MAX_MIDI = 108;
const LOOKAHEAD_SECONDS = 14;
const LOOKBEHIND_SECONDS = 1.8;
const PLAYING_FRAME_INTERVAL_MS = 40;
const IDLE_FRAME_INTERVAL_MS = 120;
const EMPTY_FRAME_INTERVAL_MS = 220;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 26;
const SIDE_PADDING = 18;
const EMPTY_ACTIVE_NOTES = new Set();

const createParticles = (count) => Array.from({ length: count }, () => ({
  lane: Math.random(),
  depth: Math.random(),
  speed: 0.04 + Math.random() * 0.09,
  phase: Math.random(),
  size: 0.8 + Math.random() * 1.5
}));

const interpolateChannel = (start, end, mix) => Math.round(start + (end - start) * mix);

const colorForMidi = (midi, isActive) => {
  const mix = clamp((midi - DEFAULT_MIN_MIDI) / (DEFAULT_MAX_MIDI - DEFAULT_MIN_MIDI), 0, 1);
  const blue = [108, 168, 232];
  const orange = [255, 164, 112];
  const r = interpolateChannel(blue[0], orange[0], mix);
  const g = interpolateChannel(blue[1], orange[1], mix * 0.8);
  const b = interpolateChannel(blue[2], orange[2], mix);

  return {
    glow: `rgba(${r}, ${g}, ${b}, ${isActive ? 0.28 : 0.12})`,
    trail: `rgba(${r}, ${g}, ${b}, ${isActive ? 0.12 : 0.08})`,
    core: `rgba(${Math.min(255, r + 18)}, ${Math.min(255, g + 16)}, ${Math.min(255, b + 14)}, ${isActive ? 0.9 : 0.72})`,
    edge: `rgba(245, 248, 252, ${isActive ? 0.86 : 0.46})`
  };
};

const BirdsEyeRadar = ({
  currentMidi,
  progress,
  activeNotes = EMPTY_ACTIVE_NOTES,
  isPlaying = false
}) => {
  const canvasRef = useRef(null);
  const noteIdCacheRef = useRef(new Map());
  const particlesRef = useRef(createParticles(32));
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

    const drawBackdrop = ({ width, height, nowSeconds, playbackProgress }) => {
      const base = ctx.createLinearGradient(0, 0, 0, height);
      base.addColorStop(0, 'rgba(5, 10, 18, 0.98)');
      base.addColorStop(0.45, 'rgba(8, 14, 25, 0.98)');
      base.addColorStop(1, 'rgba(3, 7, 13, 1)');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      const horizon = ctx.createRadialGradient(
        width * 0.5,
        height * 0.78,
        24,
        width * 0.5,
        height * 0.78,
        width * 0.66
      );
      horizon.addColorStop(0, 'rgba(255, 146, 86, 0.24)');
      horizon.addColorStop(0.38, 'rgba(255, 112, 58, 0.08)');
      horizon.addColorStop(1, 'rgba(255, 112, 58, 0)');
      ctx.fillStyle = horizon;
      ctx.fillRect(0, 0, width, height);

      const canopy = ctx.createRadialGradient(width * 0.5, height * 0.08, 10, width * 0.5, height * 0.08, width * 0.7);
      canopy.addColorStop(0, 'rgba(105, 190, 255, 0.1)');
      canopy.addColorStop(0.42, 'rgba(40, 112, 174, 0.04)');
      canopy.addColorStop(1, 'rgba(40, 112, 174, 0)');
      ctx.fillStyle = canopy;
      ctx.fillRect(0, 0, width, height);

      const sweepX = (playbackProgress * width * 1.15 + nowSeconds * 22) % (width * 1.15);
      const sweep = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 60, 0);
      sweep.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sweep.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
      sweep.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, width, height);
    };

    const drawGrid = ({ trackTop, trackBottom, centerX, playfieldWidth, vanishY }) => {
      const depthSpan = trackBottom - trackTop;
      ctx.strokeStyle = 'rgba(129, 164, 196, 0.17)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let i = 0; i <= 12; i += 1) {
        const t = i / 12;
        const y = trackTop + depthSpan * t;
        const spread = 0.08 + t * 0.92;
        const halfSpan = (playfieldWidth * spread) * 0.5;
        ctx.moveTo(centerX - halfSpan, y);
        ctx.lineTo(centerX + halfSpan, y);
      }
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i <= 20; i += 1) {
        const laneNorm = i / 20;
        const xBottom = SIDE_PADDING + laneNorm * playfieldWidth;
        const xTop = centerX + (xBottom - centerX) * 0.14;
        ctx.moveTo(xTop, vanishY);
        ctx.lineTo(xBottom, trackBottom);
      }
      ctx.stroke();

      const horizon = ctx.createLinearGradient(0, trackBottom - 2, 0, trackBottom + 8);
      horizon.addColorStop(0, 'rgba(255, 168, 104, 0.96)');
      horizon.addColorStop(1, 'rgba(255, 110, 56, 0.24)');
      ctx.strokeStyle = horizon;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(SIDE_PADDING, trackBottom);
      ctx.lineTo(SIDE_PADDING + playfieldWidth, trackBottom);
      ctx.stroke();
    };

    const drawParticles = ({ nowSeconds, trackTop, trackBottom, centerX, playfieldWidth }) => {
      const depthSpan = trackBottom - trackTop;
      for (const particle of particlesRef.current) {
        const flow = (particle.depth + nowSeconds * particle.speed + particle.phase) % 1;
        const y = trackTop + flow * depthSpan;
        const spread = 0.12 + flow * 0.88;
        const laneX = SIDE_PADDING + particle.lane * playfieldWidth;
        const x = centerX + (laneX - centerX) * spread;
        const alpha = 0.015 + (1 - flow) * 0.12;
        ctx.fillStyle = `rgba(255, 176, 110, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawNotes = ({
      midi,
      playbackProgress,
      activeNoteSet,
      renderWindow,
      trackTop,
      trackBottom,
      centerX,
      playfieldWidth
    }) => {
      if (!midi?.duration || !renderWindow.notes.length) return;

      const trackHeight = Math.max(1, trackBottom - trackTop);
      const midiSpan = Math.max(1, midiRange.max - midiRange.min);
      const laneWidth = playfieldWidth / (midiSpan + 1);
      const nowTime = clamp(playbackProgress, 0, 1) * midi.duration;
      const activeLabels = [];
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
        const perspectiveSpread = 0.14 + nearRatio * 0.86;
        const x = centerX + (laneX - centerX) * perspectiveSpread;

        const noteWidth = Math.max(2.6, laneWidth * (0.14 + nearRatio * 0.68));
        const bodyLen = clamp(
          12 + note.duration * 74 * (0.34 + nearRatio * 0.7),
          12,
          trackHeight * 0.58
        );
        const tailLen = clamp(bodyLen * (0.24 + nearRatio * 0.88), 12, trackHeight * 0.56);
        const bodyTop = yHead - bodyLen;
        const tailTop = bodyTop - tailLen;

        const noteId = getNoteId(note.midi);
        const isActive = activeNoteSet?.has(noteId);
        const palette = colorForMidi(note.midi, isActive);

        const trail = ctx.createLinearGradient(x, tailTop, x, yHead + 2);
        trail.addColorStop(0, 'rgba(255, 255, 255, 0)');
        trail.addColorStop(0.46, palette.trail);
        trail.addColorStop(1, isActive ? palette.glow : palette.trail);
        ctx.fillStyle = trail;
        ctx.fillRect(x - noteWidth * 0.72, tailTop, noteWidth * 1.44, yHead - tailTop + 2);

        ctx.shadowColor = palette.glow;
        ctx.shadowBlur = isActive ? 7 : 2;

        const body = ctx.createLinearGradient(x, bodyTop, x, yHead);
        body.addColorStop(0, palette.trail);
        body.addColorStop(0.58, palette.core);
        body.addColorStop(1, palette.edge);
        ctx.fillStyle = body;
        ctx.fillRect(x - noteWidth * 0.5, bodyTop, noteWidth, bodyLen);

        ctx.strokeStyle = isActive ? 'rgba(255, 252, 240, 0.92)' : 'rgba(255, 240, 228, 0.34)';
        ctx.lineWidth = isActive ? 1.4 : 0.85;
        ctx.strokeRect(x - noteWidth * 0.5, bodyTop, noteWidth, bodyLen);

        if (isActive) {
          ctx.fillStyle = 'rgba(255, 244, 220, 0.94)';
          ctx.beginPath();
          ctx.arc(x, trackBottom - 1.4, 2.5, 0, Math.PI * 2);
          ctx.fill();

          const canPlaceLabel = activeLabels.every((placedX) => Math.abs(placedX - x) > 28);
          if (canPlaceLabel) {
            activeLabels.push(x);
            const labelY = trackBottom - 10;
            ctx.font = '600 10px "IBM Plex Mono", monospace';
            const labelW = ctx.measureText(noteId).width;
            const chipX = x - labelW * 0.5 - 6;
            const chipY = labelY - 12;

            ctx.fillStyle = 'rgba(6, 11, 18, 0.82)';
            ctx.fillRect(chipX, chipY, labelW + 12, 13);
            ctx.strokeStyle = 'rgba(255, 194, 132, 0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(chipX + 0.5, chipY + 0.5, labelW + 11, 12);
            ctx.fillStyle = 'rgba(255, 238, 212, 0.98)';
            ctx.fillText(noteId, x - labelW * 0.5, labelY - 2);
          }
        }
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
      drawBackdrop({ width, height, nowSeconds, playbackProgress });

      const trackTop = TOP_PADDING;
      const trackBottom = height - BOTTOM_PADDING;
      const playfieldWidth = Math.max(160, width - SIDE_PADDING * 2);
      const centerX = SIDE_PADDING + playfieldWidth * 0.5;
      const vanishY = trackTop - height * 0.28;

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
