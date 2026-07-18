import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../utils/audioEngine.js';
import {
  STEREO_VISUAL_SAMPLE_STRIDE,
  getGoniometerTraceStride,
  getScopeTraceStride
} from '../utils/audioAnalysisPolicy.js';
import { createCanvasSizeController } from '../utils/canvasPerformance.js';
import { clamp } from '../utils/math.js';
import { startVisibilityAwareRafLoop } from '../utils/visibilityRaf.js';
import {
  VerletChain,
  createLagrangeEnvelopePlan,
  sampleLagrangeEnvelope
} from '../utils/vizPhysics.js';
import { WAVE_CANDY_FRAME_INTERVAL_MS } from '../utils/visualFramePolicy.js';
import {
  createLogSpectrumBinRanges,
  sampleLogSpectrum
} from '../utils/spectrumAnalysis.js';
import {
  createSpectrogramColorLut,
  createSpectrogramRowRuns
} from '../utils/spectrogramRendering.js';
import { drawWaveCandyMeterGrid } from '../utils/waveCandyMeterGrid.js';

// Perceptual visualizer suite (Canvas 2D):
// - Spectrum: log-frequency, dB scale — the raw FFT is distilled through
//   barycentric Lagrange interpolation on Chebyshev nodes into a smooth
//   envelope, which then drives a Verlet-integrated elastic string
//   (spring + wave-equation tension), so transients pluck the curve and
//   ripples physically travel and settle along it
// - Spectrogram: log-frequency rows, scrolling
// - Oscilloscope: zero-crossing triggered to stabilize the trace
// - Goniometer: mid/side rotated with phosphor persistence
// - Meter: short-term loudness (400ms RMS, LUFS-style) + peak hold

const MIN_FREQ = 20;
const MAX_FREQ = 18000;
const FLOOR_DB = -70;

const createFloatBuffer = (length) => new Float32Array(length);
const createByteBuffer = (length) => new Uint8Array(length);

const readTimeDomain = (analyser, floatBuffer, byteBuffer) => {
  if (analyser.getFloatTimeDomainData) {
    analyser.getFloatTimeDomainData(floatBuffer);
    return floatBuffer;
  }
  analyser.getByteTimeDomainData(byteBuffer);
  for (let i = 0; i < byteBuffer.length; i++) {
    floatBuffer[i] = (byteBuffer[i] - 128) / 128;
  }
  return floatBuffer;
};

const dbToUnit = (db) => clamp((db - FLOOR_DB) / (0 - FLOOR_DB), 0, 1);
const SPECTRUM_GRID_FREQUENCIES = Object.freeze([100, 1000, 10000]);
const SPECTRUM_LOG_SPAN = Math.log(MAX_FREQ / MIN_FREQ);
const SPECTRUM_GRID_X_RATIOS = Float64Array.from(
  SPECTRUM_GRID_FREQUENCIES,
  (frequency) => Math.log(frequency / MIN_FREQ) / SPECTRUM_LOG_SPAN
);
const SPECTRUM_GRID_DB_RATIOS = Float64Array.from(
  [-60, -40, -20],
  dbToUnit
);

const traceSpectrumPath = (ctx, data, width, height) => {
  const cells = data.length;
  const xScale = cells > 1 ? width / (cells - 1) : 0;
  ctx.beginPath();
  for (let i = 0; i < cells; i++) {
    const x = i * xScale;
    const y = height - dbToUnit(data[i]) * height;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
};

const drawSpectrum = (ctx, rawDb, chainDb, width, height, resized, gradientCache) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(6, 10, 16, 0.9)';
  ctx.fillRect(0, 0, width, height);

  // Octave grid (100Hz, 1kHz, 10kHz) + dB lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < SPECTRUM_GRID_X_RATIOS.length; i++) {
    const x = SPECTRUM_GRID_X_RATIOS[i] * width;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }
  for (let i = 0; i < SPECTRUM_GRID_DB_RATIOS.length; i++) {
    const y = height - SPECTRUM_GRID_DB_RATIOS[i] * height;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Raw FFT (ground truth) as a faint bed under the physical envelope
  traceSpectrumPath(ctx, rawDb, width, height);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = 'rgba(140, 220, 255, 0.1)';
  ctx.fill();

  // Verlet/Lagrange envelope: gradient body + glowing string on top
  traceSpectrumPath(ctx, chainDb, width, height);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  if (resized || !gradientCache.current) {
    const fill = ctx.createLinearGradient(0, 0, 0, height);
    fill.addColorStop(0, 'rgba(140, 220, 255, 0.3)');
    fill.addColorStop(1, 'rgba(140, 220, 255, 0.03)');
    gradientCache.current = fill;
  }
  ctx.fillStyle = gradientCache.current;
  ctx.fill();

  ctx.save();
  ctx.shadowColor = 'rgba(140, 220, 255, 0.55)';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(170, 230, 255, 0.95)';
  ctx.lineWidth = 1.6;
  traceSpectrumPath(ctx, chainDb, width, height);
  ctx.stroke();
  ctx.restore();
};

const drawSpectrogram = (
  ctx,
  canvas,
  smoothedDb,
  width,
  height,
  resized,
  dpr,
  renderCache
) => {
  if (resized) {
    ctx.fillStyle = 'rgb(8, 8, 8)';
    ctx.fillRect(0, 0, width, height);
  }
  // Scroll left by exactly 1 CSS pixel: blit the canvas onto itself in
  // device-pixel space (identity transform) to avoid DPR rescaling smear.
  const shift = Math.max(1, Math.round(dpr));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(canvas, -shift, 0);
  ctx.restore();
  const columnX = width - 1;
  const cells = smoothedDb.length;
  if (!renderCache.colorLut) {
    renderCache.colorLut = createSpectrogramColorLut();
  }
  if (
    resized
    || !renderCache.rowRuns
    || renderCache.height !== height
    || renderCache.cells !== cells
  ) {
    renderCache.rowRuns = createSpectrogramRowRuns({ height, cells });
    renderCache.height = height;
    renderCache.cells = cells;
  }
  const maxColorIndex = renderCache.colorLut.length - 1;
  for (let cell = 0; cell < cells; cell += 1) {
    const canvasY = renderCache.rowRuns[cell * 2];
    const runHeight = renderCache.rowRuns[cell * 2 + 1];
    if (runHeight === 0) continue;
    const unit = dbToUnit(smoothedDb[cell]);
    ctx.fillStyle = renderCache.colorLut[Math.round(unit * maxColorIndex)];
    ctx.fillRect(columnX, canvasY, 1, runHeight);
  }
};

// Find a rising zero-crossing in the first half to trigger the scope on.
const findTrigger = (data) => {
  const half = data.length >> 1;
  for (let i = 1; i < half; i++) {
    if (data[i - 1] < 0 && data[i] >= 0) return i;
  }
  return 0;
};

const drawWaveform = (ctx, data, width, height) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(6, 10, 16, 0.9)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const mid = height / 2;
  ctx.moveTo(0, mid);
  ctx.lineTo(width, mid);
  ctx.stroke();

  const start = findTrigger(data);
  const span = data.length - start;
  const xScale = span > 1 ? width / (span - 1) : 0;
  const sampleStride = getScopeTraceStride(span, width);
  ctx.strokeStyle = 'rgba(252, 214, 142, 0.9)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let i = 0; i < span; i += sampleStride) {
    const x = i * xScale;
    const y = mid - data[start + i] * mid * 0.85;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  if ((span - 1) % sampleStride !== 0) {
    ctx.lineTo(width, mid - data[data.length - 1] * mid * 0.85);
  }
  ctx.stroke();
};

const drawGoniometer = (ctx, left, right, width, height, resized, stats) => {
  if (resized) {
    ctx.fillStyle = 'rgb(6, 10, 16)';
    ctx.fillRect(0, 0, width, height);
  }
  // Phosphor persistence: fade the previous frame instead of clearing
  ctx.fillStyle = 'rgba(6, 10, 16, 0.22)';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  // 45-degree L/R axes
  ctx.moveTo(0, height);
  ctx.lineTo(width, 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(width, height);
  ctx.stroke();

  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height) * 0.62;
  const len = Math.min(left.length, right.length);
  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 128, 92, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const INV_SQRT2 = Math.SQRT1_2;
  let sum = 0;
  let peak = 0;
  let sampleCount = 0;
  const evaluatedPointCount = Math.ceil(len / STEREO_VISUAL_SAMPLE_STRIDE);
  const traceStride = getGoniometerTraceStride(
    evaluatedPointCount,
    width,
    height
  );
  let lastDrawnIndex = -1;
  let lastEvaluatedIndex = -1;
  let nextDrawSample = 0;
  for (let i = 0; i < len; i += STEREO_VISUAL_SAMPLE_STRIDE) {
    const l = left[i];
    const r = right[i];
    if (sampleCount === nextDrawSample) {
      // Rotate 45 degrees: x = side, y = mid (up = in-phase)
      const side = (l - r) * INV_SQRT2;
      const m = (l + r) * INV_SQRT2;
      const x = cx + side * scale;
      const y = cy - m * scale;
      if (sampleCount === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      lastDrawnIndex = i;
      nextDrawSample += traceStride;
    }
    sum += (l * l + r * r) * 0.5;
    const amplitude = Math.max(Math.abs(l), Math.abs(r));
    if (amplitude > peak) peak = amplitude;
    lastEvaluatedIndex = i;
    sampleCount += 1;
  }
  if (lastEvaluatedIndex >= 0 && lastDrawnIndex !== lastEvaluatedIndex) {
    const l = left[lastEvaluatedIndex];
    const r = right[lastEvaluatedIndex];
    ctx.lineTo(
      cx + (l - r) * INV_SQRT2 * scale,
      cy - (l + r) * INV_SQRT2 * scale
    );
  }
  ctx.stroke();
  ctx.globalCompositeOperation = prevOp;
  stats.meanSquare = sum / Math.max(1, sampleCount);
  stats.peak = peak;
};

const drawMeter = (ctx, state, width, height, resized, gradientCache) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(6, 10, 16, 0.9)';
  ctx.fillRect(0, 0, width, height);

  // dB ticks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '9px "TX-02-Regular", ui-sans-serif';
  ctx.lineWidth = 1;
  drawWaveCandyMeterGrid(ctx, width, height);

  const stHeight = clamp((state.shortTermDb + 60) / 60, 0, 1) * height;
  if (resized || !gradientCache.current) {
    const gradient = ctx.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, 'rgba(142, 192, 124, 0.85)');
    gradient.addColorStop(0.7, 'rgba(250, 189, 47, 0.85)');
    gradient.addColorStop(1, 'rgba(251, 73, 52, 0.9)');
    gradientCache.current = gradient;
  }
  ctx.fillStyle = gradientCache.current;
  ctx.fillRect(width * 0.3, height - stHeight, width * 0.4, stHeight);

  // Peak hold line
  const peakHeight = clamp((state.peakHoldDb + 60) / 60, 0, 1) * height;
  ctx.strokeStyle = 'rgba(255, 245, 210, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(width * 0.22, height - peakHeight);
  ctx.lineTo(width * 0.78, height - peakHeight);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = '10px "TX-02-Regular", ui-sans-serif';
  ctx.fillText(`${state.shortTermDb.toFixed(1)}`, 4, 12);
};

const SPECTRUM_CELLS = 96;

const WaveCandyCanvas = () => {
  const spectrogramRef = useRef(null);
  const scopeRef = useRef(null);
  const spectrumRef = useRef(null);
  const goniometerRef = useRef(null);
  const meterRef = useRef(null);
  const spectrumGradientRef = useRef(null);
  const meterGradientRef = useRef(null);
  const spectrogramRenderCacheRef = useRef({
    colorLut: null,
    rowRuns: null,
    height: 0,
    cells: 0
  });

  const buffersRef = useRef({
    freq: null,
    time: null,
    timeByte: null,
    left: null,
    leftByte: null,
    right: null,
    rightByte: null,
    specDb: new Float32Array(SPECTRUM_CELLS).fill(FLOOR_DB),
    specSmoothed: new Float32Array(SPECTRUM_CELLS).fill(FLOOR_DB),
    specEnvelope: new Float32Array(SPECTRUM_CELLS).fill(FLOOR_DB),
    specBinRanges: null,
    specBinSampleRate: 0,
    specBinFftSize: 0,
    specBinCount: 0
  });

  // The spectrum's physical string: Lagrange-envelope targets pull it via
  // springs while wave-equation tension lets transients ripple outward.
  const spectrumChainRef = useRef(
    new VerletChain(SPECTRUM_CELLS, {
      stiffness: 130,
      tension: 300,
      damping: 0.9,
      initial: FLOOR_DB
    })
  );
  const spectrumEnvelopePlanRef = useRef(null);
  if (!spectrumEnvelopePlanRef.current) {
    spectrumEnvelopePlanRef.current = createLagrangeEnvelopePlan({
      sourceLength: SPECTRUM_CELLS,
      outputLength: SPECTRUM_CELLS,
      controlCount: 21
    });
  }

  // Loudness state: 400ms exponentially-weighted mean square + peak hold
  const meterStateRef = useRef({
    meanSquare: 0,
    shortTermDb: -60,
    peakHoldDb: -60,
    peakHeldAt: 0
  });
  const stereoStatsRef = useRef({ meanSquare: 0, peak: 0 });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
      return () => undefined;
    }
    const canvases = {
      spectrogram: spectrogramRef.current,
      scope: scopeRef.current,
      spectrum: spectrumRef.current,
      goniometer: goniometerRef.current,
      meter: meterRef.current
    };
    if (Object.values(canvases).some((canvas) => !canvas)) return () => undefined;

    let contexts = null;
    let sizeControllers = null;
    let lastFrame = 0;

    const render = (time) => {
      if (time - lastFrame < WAVE_CANDY_FRAME_INTERVAL_MS) return;
      const frameDt = Math.min(0.2, (time - lastFrame) / 1000)
        || WAVE_CANDY_FRAME_INTERVAL_MS / 1000;
      lastFrame = time;

      const nodes = audioEngine.getAnalysisNodes();
      if (!nodes || !nodes.analyser) return;

      const analyser = nodes.analyser;
      const leftAnalyser = nodes.leftAnalyser || analyser;
      const rightAnalyser = nodes.rightAnalyser || analyser;

      const buffers = buffersRef.current;
      if (!buffers.freq || buffers.freq.length !== analyser.frequencyBinCount) {
        buffers.freq = createByteBuffer(analyser.frequencyBinCount);
      }
      if (!buffers.time || buffers.time.length !== analyser.fftSize) {
        buffers.time = createFloatBuffer(analyser.fftSize);
        buffers.timeByte = createByteBuffer(analyser.fftSize);
      }
      if (!buffers.left || buffers.left.length !== leftAnalyser.fftSize) {
        buffers.left = createFloatBuffer(leftAnalyser.fftSize);
        buffers.leftByte = createByteBuffer(leftAnalyser.fftSize);
      }
      if (!buffers.right || buffers.right.length !== rightAnalyser.fftSize) {
        buffers.right = createFloatBuffer(rightAnalyser.fftSize);
        buffers.rightByte = createByteBuffer(rightAnalyser.fftSize);
      }

      analyser.getByteFrequencyData(buffers.freq);
      const timeData = readTimeDomain(analyser, buffers.time, buffers.timeByte);
      const leftData = readTimeDomain(leftAnalyser, buffers.left, buffers.leftByte);
      const rightData = readTimeDomain(rightAnalyser, buffers.right, buffers.rightByte);

      const sampleRate = audioEngine.context?.sampleRate || 48000;
      if (
        !buffers.specBinRanges
        || buffers.specBinSampleRate !== sampleRate
        || buffers.specBinFftSize !== analyser.fftSize
        || buffers.specBinCount !== buffers.freq.length
      ) {
        buffers.specBinRanges = createLogSpectrumBinRanges({
          cells: SPECTRUM_CELLS,
          sampleRate,
          fftSize: analyser.fftSize,
          binCount: buffers.freq.length,
          minFrequency: MIN_FREQ,
          maxFrequency: MAX_FREQ
        });
        buffers.specBinSampleRate = sampleRate;
        buffers.specBinFftSize = analyser.fftSize;
        buffers.specBinCount = buffers.freq.length;
      }

      sampleLogSpectrum({
        freqData: buffers.freq,
        minDb: analyser.minDecibels,
        maxDb: analyser.maxDecibels,
        out: buffers.specDb,
        smoothed: buffers.specSmoothed,
        binRanges: buffers.specBinRanges
      });

      // Chebyshev/Lagrange envelope of the FFT -> targets for the Verlet
      // string, which supplies the motion (attack pluck, travelling ripple).
      sampleLagrangeEnvelope(
        buffers.specSmoothed,
        buffers.specEnvelope,
        spectrumEnvelopePlanRef.current
      );
      spectrumChainRef.current.step(buffers.specEnvelope, frameDt);

      const spectroSize = sizeControllers.spectrogram.size;
      const scopeSize = sizeControllers.scope.size;
      const spectrumSize = sizeControllers.spectrum.size;
      const goniometerSize = sizeControllers.goniometer.size;
      const meterSize = sizeControllers.meter.size;

      // The goniometer and loudness meter consume the same sampled stereo
      // traversal instead of independently walking overlapping channel data.
      const stereoFrame = stereoStatsRef.current;
      drawGoniometer(
        contexts.goniometer,
        leftData,
        rightData,
        goniometerSize.width,
        goniometerSize.height,
        goniometerSize.resized,
        stereoFrame
      );

      // Loudness: stereo mean square smoothed over ~400ms, peak with 1.5s hold
      const meter = meterStateRef.current;
      const k = 1 - Math.exp(-frameDt / 0.4);
      meter.meanSquare += (stereoFrame.meanSquare - meter.meanSquare) * k;
      meter.shortTermDb = 10 * Math.log10(meter.meanSquare + 1e-9);
      const peakDb = 20 * Math.log10(stereoFrame.peak + 1e-6);
      if (peakDb >= meter.peakHoldDb) {
        meter.peakHoldDb = peakDb;
        meter.peakHeldAt = time;
      } else if (time - meter.peakHeldAt > 1500) {
        meter.peakHoldDb -= 12 * frameDt; // 12 dB/s decay after hold
      }

      drawSpectrogram(
        contexts.spectrogram,
        canvases.spectrogram,
        buffers.specSmoothed,
        spectroSize.width,
        spectroSize.height,
        spectroSize.resized,
        spectroSize.dpr,
        spectrogramRenderCacheRef.current
      );
      drawWaveform(contexts.scope, timeData, scopeSize.width, scopeSize.height);
      drawSpectrum(
        contexts.spectrum,
        buffers.specSmoothed,
        spectrumChainRef.current.positions,
        spectrumSize.width,
        spectrumSize.height,
        spectrumSize.resized,
        spectrumGradientRef
      );
      drawMeter(
        contexts.meter,
        meterStateRef.current,
        meterSize.width,
        meterSize.height,
        meterSize.resized,
        meterGradientRef
      );
      sizeControllers.spectrogram.acknowledgeResize();
      sizeControllers.scope.acknowledgeResize();
      sizeControllers.spectrum.acknowledgeResize();
      sizeControllers.goniometer.acknowledgeResize();
      sizeControllers.meter.acknowledgeResize();
    };

    let stopFrameLoop = null;
    const startFrameLoopIfReady = () => {
      if (stopFrameLoop || !audioEngine.getAnalysisNodes()?.analyser) return;

      contexts = Object.fromEntries(
        Object.entries(canvases).map(([key, canvas]) => [key, canvas.getContext('2d')])
      );
      if (Object.values(contexts).some((context) => !context)) return;

      sizeControllers = Object.fromEntries(
        Object.entries(canvases).map(([key, canvas]) => [
          key,
          createCanvasSizeController(canvas, contexts[key])
        ])
      );
      lastFrame = 0;
      stopFrameLoop = startVisibilityAwareRafLoop(render);
    };
    const unsubscribeStatus = audioEngine.subscribe(startFrameLoopIfReady);
    startFrameLoopIfReady();

    return () => {
      unsubscribeStatus();
      stopFrameLoop?.();
      if (sizeControllers) {
        Object.values(sizeControllers).forEach((controller) => controller.disconnect());
      }
    };
  }, []);

  return (
    <section className="wave-candy" aria-label="Wave Candy visualizer">
      <div className="wave-candy-grid">
        <div className="candy-tile candy-tile--spectrogram">
          <span className="candy-label">Spectrogram</span>
          <canvas ref={spectrogramRef} className="candy-canvas" />
        </div>
        <div className="candy-tile candy-tile--scope">
          <span className="candy-label">Oscilloscope</span>
          <canvas ref={scopeRef} className="candy-canvas" />
        </div>
        <div className="candy-tile candy-meter">
          <span className="candy-label">Loudness</span>
          <canvas ref={meterRef} className="candy-canvas" />
        </div>
        <div className="candy-tile candy-tile--gonio">
          <span className="candy-label">Goniometer</span>
          <canvas ref={goniometerRef} className="candy-canvas" />
        </div>
        <div className="candy-tile candy-tile--spectrum">
          <span className="candy-label">Spectrum</span>
          <canvas ref={spectrumRef} className="candy-canvas" />
        </div>
      </div>
    </section>
  );
};

export default WaveCandyCanvas;
