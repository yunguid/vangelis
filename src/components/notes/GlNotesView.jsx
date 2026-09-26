import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getCappedDevicePixelRatio } from '../../utils/canvasPerformance.js';
import { startVisibilityAwareRafLoop } from '../../utils/visibilityRaf.js';
import { resetGlState } from './glKit.js';
import { applyScore, createNoteFrame, prepareScore } from './noteFrame.js';
import '../../styles/birds-eye-radar.css';

const BirdsEyeRadar = React.lazy(() => import('../BirdsEyeRadar.jsx'));

// Every style is a chunk of its own, fetched when it is picked.
const STYLE_LOADERS = {
  paper: () => import('./styles/paperRoll.js'),
  stars: () => import('./styles/stars.js'),
  embers: () => import('./styles/embers.js'),
  rain: () => import('./styles/rain.js'),
  phosphor: () => import('./styles/phosphor.js')
};

// Smooth while the music moves; slower when only the ambience does.
const PLAYING_FRAME_MS = 1000 / 60;
const IDLE_FRAME_MS = 1000 / 30;
const EMPTY_FRAME_MS = 1000 / 20;
// rAF timestamps jitter by a millisecond or so either side of the display's beat.
const FRAME_SLACK_MS = 2;
const DPR_CAP = 1.5;

/**
 * The Notes panel drawn by one of the WebGL2 styles. One context lives as long
 * as the view; picking another style disposes the old one and starts the new
 * one on the same context. Without WebGL2, or when a style fails, the view
 * says so in the console and shows the Canvas 2D radar instead.
 */
const GlNotesView = ({
  styleId,
  styleName,
  currentMidi,
  progress = 0,
  activeNotes,
  isPlaying = false,
  getPlaybackProgress
}) => {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const styleRef = useRef(null);
  const frameRef = useRef(null);
  if (!frameRef.current) frameRef.current = createNoteFrame();
  // Counts context losses; a style built before one owns nothing on the restored context.
  const lossCountRef = useRef(0);
  // Bumped when a lost context comes back, so the style is built again.
  const [contextGeneration, setContextGeneration] = useState(0);
  const [glUnavailable, setGlUnavailable] = useState(false);
  const [failedStyle, setFailedStyle] = useState(null);

  const score = useMemo(() => prepareScore(currentMidi), [currentMidi]);
  const inputRef = useRef(null);
  if (!inputRef.current) inputRef.current = {};
  const input = inputRef.current;
  input.score = score;
  input.progress = progress;
  input.isPlaying = isPlaying;
  input.getPlaybackProgress = getPlaybackProgress;

  useEffect(() => {
    const canvas = canvasRef.current;
    let gl = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
        powerPreference: 'default'
      });
    } catch {
      gl = null;
    }
    if (!gl) {
      console.error('Notes: WebGL2 is unavailable, so the Radar view is shown instead.');
      setGlUnavailable(true);
      return undefined;
    }
    glRef.current = gl;
    const frame = frameRef.current;
    frame.reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

    const measure = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = getCappedDevicePixelRatio(DPR_CAP);
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const pixelWidth = Math.max(1, Math.round(width * dpr));
      const pixelHeight = Math.max(1, Math.round(height * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      if (
        frame.pixelWidth === pixelWidth && frame.pixelHeight === pixelHeight
        && frame.width === width && frame.height === height
      ) return;
      frame.width = width;
      frame.height = height;
      frame.pixelWidth = pixelWidth;
      frame.pixelHeight = pixelHeight;
      frame.dpr = dpr;
      styleRef.current?.instance.resize(frame);
    };
    measure();
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    resizeObserver?.observe(canvas);
    window.addEventListener('resize', measure, { passive: true });

    const startedAt = performance.now();
    let lastRender = Number.NEGATIVE_INFINITY;
    let lastScore = null;
    let lastStyle = null;
    let scoreId = 0;
    const loop = (now) => {
      const { score: currentScore, isPlaying: playing } = input;
      const interval = playing
        ? PLAYING_FRAME_MS
        : (currentScore.notes.length ? IDLE_FRAME_MS : EMPTY_FRAME_MS);
      if (now - lastRender < interval - FRAME_SLACK_MS) return;
      frame.dt = Math.min(0.1, Math.max(0, (now - lastRender) / 1000));
      lastRender = now;
      frame.time = (now - startedAt) / 1000;

      let jumped = false;
      if (currentScore !== lastScore) {
        lastScore = currentScore;
        scoreId += 1;
        applyScore(frame, currentScore, scoreId);
        jumped = true;
      }
      const read = input.getPlaybackProgress ? input.getPlaybackProgress() : input.progress;
      const songTime = Math.min(1, Math.max(0, Number(read) || 0)) * frame.duration;
      const moved = songTime - frame.songTime;
      if (moved < -0.05 || moved > Math.max(0.5, frame.dt * 4)) jumped = true;
      frame.songTime = songTime;
      frame.playing = Boolean(playing);

      const style = styleRef.current;
      if (!style) return;
      frame.jumped = jumped || style !== lastStyle;
      lastStyle = style;
      try {
        style.instance.render(frame);
      } catch (error) {
        console.error(`Notes: the ${style.id} style stopped drawing, so the Radar view is shown instead.`, error);
        styleRef.current = null;
        setFailedStyle(style.id);
      }
    };

    let stopLoop = startVisibilityAwareRafLoop(loop);
    const onLost = (event) => {
      event.preventDefault();
      stopLoop();
      lossCountRef.current += 1;
      styleRef.current = null;
    };
    const onRestored = () => {
      resetGlState(gl);
      setContextGeneration((generation) => generation + 1);
      stopLoop = startVisibilityAwareRafLoop(loop);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      stopLoop();
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measure);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      // The context is left to the garbage collector, never force-lost: under
      // StrictMode the same canvas mounts again and would get a dead context.
    };
  }, []);

  useEffect(() => {
    const gl = glRef.current;
    if (!gl || failedStyle === styleId) return undefined;
    const load = STYLE_LOADERS[styleId];
    if (!load) {
      console.error(`Notes: there is no "${styleId}" style, so the Radar view is shown instead.`);
      setFailedStyle(styleId);
      return undefined;
    }
    let cancelled = false;
    let started = null;
    load().then((module) => {
      if (cancelled || gl.isContextLost()) return;
      resetGlState(gl);
      const instance = module.default.create(gl);
      instance.resize(frameRef.current);
      started = { id: styleId, instance, losses: lossCountRef.current };
      styleRef.current = started;
    }).catch((error) => {
      if (cancelled) return;
      console.error(`Notes: the ${styleId} style could not start, so the Radar view is shown instead.`, error);
      setFailedStyle(styleId);
    });
    return () => {
      cancelled = true;
      if (!started) return;
      if (styleRef.current === started) styleRef.current = null;
      if (!gl.isContextLost() && started.losses === lossCountRef.current) started.instance.dispose();
    };
  }, [styleId, contextGeneration, failedStyle]);

  const showRadar = glUnavailable || failedStyle === styleId;
  return (
    <>
      {showRadar && (
        <BirdsEyeRadar
          currentMidi={currentMidi}
          progress={progress}
          activeNotes={activeNotes}
          isPlaying={isPlaying}
        />
      )}
      {/* Stays mounted behind the radar: its context serves the next style picked. */}
      <section className="birds-eye-radar notes-view" aria-label={`Notes: ${styleName}`} hidden={showRadar}>
        <div className="birds-eye-radar__stage">
          <canvas ref={canvasRef} className="birds-eye-radar__canvas" />
          {!currentMidi && (
            <div className="birds-eye-radar__empty">
              Play a MIDI file to see its notes.
            </div>
          )}
        </div>
      </section>
    </>
  );
};

export default React.memo(GlNotesView);
