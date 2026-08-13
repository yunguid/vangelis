import React, { useEffect, useMemo, useRef } from 'react';
import { createCanvasSizeController } from '../utils/canvasPerformance.js';
import { clamp, midiNoteToName } from '../utils/math.js';
import { startVisibilityAwareRafLoop } from '../utils/visibilityRaf.js';
import {
  RADAR_MAX_MIDI,
  RADAR_MIN_MIDI,
  getRadarMidiPalette
} from '../utils/radarPalette.js';
import {
  createRadarStaticGradientCache,
  getRadarStaticGradients
} from '../utils/radarGradientCache.js';
import {
  RADAR_PARTICLE_ALPHA_BUCKET_COUNT,
  getRadarParticleAlphaBucket,
  getRadarParticleBatchColor
} from '../utils/radarParticleColor.js';
import { buildNoteRenderWindow, getVisibleNoteRange } from './midiBirdsEyeMath.js';
import '../styles/birds-eye-radar.css';

const LOOKAHEAD_SECONDS = 14;
const LOOKBEHIND_SECONDS = 1.8;
const PLAYING_FRAME_INTERVAL_MS = 40;
const IDLE_FRAME_INTERVAL_MS = 120;
const EMPTY_FRAME_INTERVAL_MS = 220;
const TOP_PADDING = 18;
const BOTTOM_PADDING = 26;
const SIDE_PADDING = 18;
const EMPTY_ACTIVE_NOTES = new Set();
const PARTICLE_COUNT = 32;

const createParticles = (count) => Array.from({ length: count }, () => ({
  lane: Math.random(),
  depth: Math.random(),
  speed: 0.04 + Math.random() * 0.09,
  phase: Math.random(),
  size: 0.8 + Math.random() * 1.5
}));

const createParticlePathBuckets = () => ({
  counts: new Uint8Array(RADAR_PARTICLE_ALPHA_BUCKET_COUNT),
  geometry: Array.from(
    { length: RADAR_PARTICLE_ALPHA_BUCKET_COUNT },
    () => new Float64Array(PARTICLE_COUNT * 3)
  )
});

const BirdsEyeRadar = ({
  currentMidi,
  progress,
  activeNotes = EMPTY_ACTIVE_NOTES,
  isPlaying = false,
  noteRenderWindow: suppliedNoteRenderWindow
}) => {
  const canvasRef = useRef(null);
  const noteIdCacheRef = useRef(null);
  if (!noteIdCacheRef.current) noteIdCacheRef.current = new Map();
  const particlesRef = useRef(null);
  if (!particlesRef.current) particlesRef.current = createParticles(PARTICLE_COUNT);
  const particlePathBucketsRef = useRef(null);
  if (!particlePathBucketsRef.current) {
    particlePathBucketsRef.current = createParticlePathBuckets();
  }
  const noteRenderWindow = useMemo(
    () => suppliedNoteRenderWindow || buildNoteRenderWindow(currentMidi?.notes || []),
    [currentMidi, suppliedNoteRenderWindow]
  );
  const propsRef = useRef(null);
  if (!propsRef.current) propsRef.current = {};
  propsRef.current.currentMidi = currentMidi;
  propsRef.current.progress = progress;
  propsRef.current.activeNotes = activeNotes;
  propsRef.current.isPlaying = isPlaying;
  propsRef.current.noteRenderWindow = noteRenderWindow;

  const midiRange = useMemo(() => {
    const notes = currentMidi?.notes || [];
    if (notes.length === 0) {
      return { min: RADAR_MIN_MIDI, max: RADAR_MAX_MIDI };
    }

    let min = RADAR_MAX_MIDI;
    let max = RADAR_MIN_MIDI;
    for (const note of notes) {
      if (note.midi < min) min = note.midi;
      if (note.midi > max) max = note.midi;
    }

    return {
      min: Math.min(min, RADAR_MIN_MIDI),
      max: Math.max(max, RADAR_MAX_MIDI)
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

    const sizeController = createCanvasSizeController(canvas, ctx);
    const staticGradientCache = createRadarStaticGradientCache();
    const visibleNoteRange = { startIndex: 0, endIndex: 0, windowStart: 0, windowEnd: 0 };
    const activeLabelPositions = [];

    const drawBackdrop = (width, height, nowSeconds, playbackProgress, gradients) => {
      ctx.fillStyle = gradients.base;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = gradients.horizon;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = gradients.canopy;
      ctx.fillRect(0, 0, width, height);

      const sweepX = (playbackProgress * width * 1.15 + nowSeconds * 22) % (width * 1.15);
      const sweep = ctx.createLinearGradient(sweepX - 80, 0, sweepX + 60, 0);
      sweep.addColorStop(0, 'rgba(255, 255, 255, 0)');
      sweep.addColorStop(0.5, 'rgba(255, 255, 255, 0.04)');
      sweep.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(0, 0, width, height);
    };

    const drawGrid = (
      trackTop,
      trackBottom,
      centerX,
      playfieldWidth,
      vanishY,
      horizonGradient
    ) => {
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

      ctx.strokeStyle = horizonGradient;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(SIDE_PADDING, trackBottom);
      ctx.lineTo(SIDE_PADDING + playfieldWidth, trackBottom);
      ctx.stroke();
    };

    const drawParticles = (nowSeconds, trackTop, trackBottom, centerX, playfieldWidth) => {
      const depthSpan = trackBottom - trackTop;
      const pathBuckets = particlePathBucketsRef.current;
      pathBuckets.counts.fill(0);
      for (const particle of particlesRef.current) {
        const flow = (particle.depth + nowSeconds * particle.speed + particle.phase) % 1;
        const y = trackTop + flow * depthSpan;
        const spread = 0.12 + flow * 0.88;
        const laneX = SIDE_PADDING + particle.lane * playfieldWidth;
        const x = centerX + (laneX - centerX) * spread;
        const alpha = 0.015 + (1 - flow) * 0.12;
        const bucket = getRadarParticleAlphaBucket(alpha);
        const geometry = pathBuckets.geometry[bucket];
        const offset = pathBuckets.counts[bucket] * 3;
        geometry[offset] = x;
        geometry[offset + 1] = y;
        geometry[offset + 2] = particle.size;
        pathBuckets.counts[bucket] += 1;
      }

      for (let bucket = 0; bucket < pathBuckets.counts.length; bucket += 1) {
        const count = pathBuckets.counts[bucket];
        if (count === 0) continue;
        const geometry = pathBuckets.geometry[bucket];
        ctx.fillStyle = getRadarParticleBatchColor(bucket);
        ctx.beginPath();
        for (let particleIndex = 0; particleIndex < count; particleIndex += 1) {
          const offset = particleIndex * 3;
          const x = geometry[offset];
          const y = geometry[offset + 1];
          const size = geometry[offset + 2];
          ctx.moveTo(x + size, y);
          ctx.arc(x, y, size, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    };

    const drawNotes = (
      midi,
      playbackProgress,
      activeNoteSet,
      renderWindow,
      trackTop,
      trackBottom,
      centerX,
      playfieldWidth
    ) => {
      if (!midi?.duration || !renderWindow.notes.length) return;

      const trackHeight = Math.max(1, trackBottom - trackTop);
      const midiSpan = Math.max(1, midiRange.max - midiRange.min);
      const laneWidth = playfieldWidth / (midiSpan + 1);
      const nowTime = clamp(playbackProgress, 0, 1) * midi.duration;
      activeLabelPositions.length = 0;
      const { startIndex, endIndex, windowStart, windowEnd } = getVisibleNoteRange(
        renderWindow.startTimes,
        nowTime,
        LOOKBEHIND_SECONDS,
        LOOKAHEAD_SECONDS,
        renderWindow.maxDuration,
        visibleNoteRange
      );

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
        const palette = getRadarMidiPalette(note.midi, isActive);

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

          let canPlaceLabel = true;
          for (let labelIndex = 0; labelIndex < activeLabelPositions.length; labelIndex += 1) {
            if (Math.abs(activeLabelPositions[labelIndex] - x) <= 28) {
              canPlaceLabel = false;
              break;
            }
          }
          if (canPlaceLabel) {
            activeLabelPositions.push(x);
            const labelY = trackBottom - 10;
            ctx.font = '600 10px ui-monospace, Menlo, Monaco, monospace';
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

    let lastFrame = 0;
    const loop = (time) => {
      const {
        currentMidi: midi,
        progress: playbackProgress,
        activeNotes: activeNoteSet,
        isPlaying: nowPlaying,
        noteRenderWindow: renderWindow
      } = propsRef.current;
      const frameInterval = nowPlaying
        ? PLAYING_FRAME_INTERVAL_MS
        : (midi ? IDLE_FRAME_INTERVAL_MS : EMPTY_FRAME_INTERVAL_MS);
      if (time - lastFrame < frameInterval) {
        return;
      }
      lastFrame = time;

      const { width, height } = sizeController.size;
      const nowSeconds = time * 0.001;
      const staticGradients = getRadarStaticGradients(
        ctx,
        staticGradientCache,
        width,
        height,
        BOTTOM_PADDING
      );

      ctx.clearRect(0, 0, width, height);
      drawBackdrop(
        width,
        height,
        nowSeconds,
        playbackProgress,
        staticGradients
      );

      const trackTop = TOP_PADDING;
      const trackBottom = height - BOTTOM_PADDING;
      const playfieldWidth = Math.max(160, width - SIDE_PADDING * 2);
      const centerX = SIDE_PADDING + playfieldWidth * 0.5;
      const vanishY = trackTop - height * 0.28;

      drawGrid(
        trackTop,
        trackBottom,
        centerX,
        playfieldWidth,
        vanishY,
        staticGradients.gridHorizon
      );
      drawParticles(nowSeconds, trackTop, trackBottom, centerX, playfieldWidth);
      drawNotes(
        midi,
        playbackProgress,
        activeNoteSet,
        renderWindow,
        trackTop,
        trackBottom,
        centerX,
        playfieldWidth
      );
      sizeController.acknowledgeResize();

    };

    const stopFrameLoop = startVisibilityAwareRafLoop(loop);
    return () => {
      stopFrameLoop();
      sizeController.disconnect();
    };
  }, [midiRange.max, midiRange.min]);

  return (
    <section className="birds-eye-radar" aria-label="Bird's-eye MIDI radar">
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

export default React.memo(BirdsEyeRadar);
