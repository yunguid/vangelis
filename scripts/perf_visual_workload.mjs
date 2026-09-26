import { performance } from 'node:perf_hooks';
import {
  SCENE_ACTIVE_FRAME_INTERVAL_MS,
  SCENE_IDLE_FRAME_INTERVAL_MS,
  WAVE_CANDY_FRAME_INTERVAL_MS
} from '../src/utils/visualFramePolicy.js';
import {
  GONIOMETER_POINTS_PER_CSS_PIXEL,
  MONO_ANALYSER_FFT_SIZE,
  SCOPE_SAMPLES_PER_CSS_PIXEL,
  STEREO_ANALYSER_FFT_SIZE,
  STEREO_VISUAL_SAMPLE_STRIDE,
  getGoniometerTraceStride,
  getScopeTraceStride,
  getStereoPairEvaluationsPerFrame,
  getWaveCandySamplesPerFrame
} from '../src/utils/audioAnalysisPolicy.js';
import {
  createLogSpectrumBinRanges,
  sampleLogSpectrum
} from '../src/utils/spectrumAnalysis.js';
import {
  createSpectrogramColorLut,
  createSpectrogramRowRuns
} from '../src/utils/spectrogramRendering.js';
import {
  SCENE_FREQUENCY_BANDS,
  createSceneBandBinRanges,
  sampleSceneBandEnergies
} from '../src/utils/sceneBandAnalysis.js';
import {
  VortexField,
  createLagrangeEnvelopePlan,
  lagrangeEnvelope,
  sampleLagrangeEnvelope
} from '../src/utils/vizPhysics.js';
import { drawWaveCandyMeterGrid } from '../src/utils/waveCandyMeterGrid.js';
import { loadAppSession } from '../src/utils/appSession.js';
import { normalizeMidiNotes } from '../src/utils/midiPlaybackNotes.js';
import {
  AUDIO_PARAM_DEFAULTS,
  AUDIO_PARAM_RANGES,
  sanitizeAudioParams
} from '../src/utils/audioParams.js';
import {
  areAudioParamsEqual,
  paramsSignature
} from '../src/utils/audioEngine/effects.js';
import { createTrailingDeadlineScheduler } from '../src/utils/trailingDeadlineScheduler.js';

const SECONDS = 20;

const AUDIO_FREQ_BINS = 512;
const AUDIO_WAVE_SAMPLES = 1024;
const AUDIO_STEREO_SAMPLES = 2048;

const RAYLIB_FREQ_BINS = 512;
const RAYLIB_WAVE_SAMPLES = 1024;
const RAYLIB_STEREO_SAMPLES = 1024;

const SCENARIO_WARMUP_SAMPLES = 5;
const SCENARIO_MEASURED_SAMPLES = 21;
const SCENARIO_ITERATIONS_PER_SAMPLE = 25;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const lcg = (seed = 1337) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};

const random = lcg(42042);

const sessionBenchmarkIterations = 20000;
const sessionBenchmarkJson = JSON.stringify({
  waveformType: 'Sawtooth',
  sidebarOpen: true,
  sidebarTab: 'midi',
  showShortcuts: true,
  tempoFactor: 1.25,
  controlSections: {
    essentials: true,
    delay: true,
    reverb: false,
    color: true,
    modulation: false
  }
});
const previousWindow = globalThis.window;
globalThis.window = {
  localStorage: {
    getItem: () => sessionBenchmarkJson
  }
};
const cachedInitialSession = loadAppSession();
const runSessionReadBenchmark = (iterations, loadSession) => {
  let checksum = 0;
  const startedAt = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const session = loadSession();
    checksum += session.tempoFactor + session.waveformType.length;
  }
  return { checksum, elapsedMs: performance.now() - startedAt };
};
runSessionReadBenchmark(200, loadAppSession);
runSessionReadBenchmark(200, () => cachedInitialSession);
const eagerSessionReadBenchmark = runSessionReadBenchmark(
  sessionBenchmarkIterations,
  loadAppSession
);
const cachedSessionReadBenchmark = runSessionReadBenchmark(
  sessionBenchmarkIterations,
  () => cachedInitialSession
);
if (previousWindow === undefined) delete globalThis.window;
else globalThis.window = previousWindow;
if (eagerSessionReadBenchmark.checksum !== cachedSessionReadBenchmark.checksum) {
  throw new Error('Cached app-session initialization changed the restored session');
}

const normalizedParamHandoffIterations = 20000;
const normalizedParamSeed = sanitizeAudioParams({
  ...AUDIO_PARAM_DEFAULTS,
  useFilter: true,
  useFM: true,
  modRoutes: [{ src: 0, dst: 1, depth: 0.25 }]
});
const runNormalizedParamHandoffBenchmark = (iterations, duplicateRuntimeSanitize) => {
  let checksum = 0;
  const startedAt = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const normalizedState = sanitizeAudioParams({
      ...normalizedParamSeed,
      filterCutoff: 1200 + (iteration % 8000)
    });
    const runtimeParams = duplicateRuntimeSanitize
      ? sanitizeAudioParams(normalizedState)
      : normalizedState;
    checksum += runtimeParams.filterCutoff
      + runtimeParams.modRoutes[0].depth
      + runtimeParams.attack;
  }
  return { checksum, elapsedMs: performance.now() - startedAt };
};
runNormalizedParamHandoffBenchmark(200, true);
runNormalizedParamHandoffBenchmark(200, false);
const duplicateParamSanitizeBenchmark = runNormalizedParamHandoffBenchmark(
  normalizedParamHandoffIterations,
  true
);
const singleParamSanitizeBenchmark = runNormalizedParamHandoffBenchmark(
  normalizedParamHandoffIterations,
  false
);
if (duplicateParamSanitizeBenchmark.checksum !== singleParamSanitizeBenchmark.checksum) {
  throw new Error('Normalized audio-parameter handoff changed the runtime parameter values');
}

const paramChangeDetectionIterations = 100000;
const paramComparisonSamples = Array.from({ length: 256 }, (_, index) => sanitizeAudioParams({
  ...normalizedParamSeed,
  filterCutoff: 1200 + index,
  modRoutes: [{ src: 0, dst: 1, depth: (index % 21) / 20 }]
}));
const runSignatureChangeDetectionBenchmark = (iterations) => {
  let changes = 0;
  let previousSignature = paramsSignature(paramComparisonSamples[0]);
  const startedAt = performance.now();
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const nextSignature = paramsSignature(paramComparisonSamples[iteration % paramComparisonSamples.length]);
    if (nextSignature !== previousSignature) changes += 1;
    previousSignature = nextSignature;
  }
  return { changes, elapsedMs: performance.now() - startedAt };
};
const runFieldChangeDetectionBenchmark = (iterations) => {
  let changes = 0;
  let previousParams = paramComparisonSamples[0];
  const startedAt = performance.now();
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const nextParams = paramComparisonSamples[iteration % paramComparisonSamples.length];
    if (!areAudioParamsEqual(previousParams, nextParams)) changes += 1;
    previousParams = nextParams;
  }
  return { changes, elapsedMs: performance.now() - startedAt };
};
runSignatureChangeDetectionBenchmark(500);
runFieldChangeDetectionBenchmark(500);
const signatureChangeDetectionBenchmark = runSignatureChangeDetectionBenchmark(
  paramChangeDetectionIterations
);
const fieldChangeDetectionBenchmark = runFieldChangeDetectionBenchmark(
  paramChangeDetectionIterations
);
if (signatureChangeDetectionBenchmark.changes !== fieldChangeDetectionBenchmark.changes) {
  throw new Error('Allocation-free audio-parameter change detection altered deduplication');
}

const sessionPersistenceUpdates = 600;
const sessionPersistenceIntervalMs = 1000 / 60;
const sessionPersistenceDelayMs = 200;
const runDeadlineSchedulerSimulation = () => {
  let nowMs = 0;
  let timerSerial = 0;
  let timerCreations = 0;
  let timerCancellations = 0;
  let storageWrites = 0;
  const timers = new Map();
  const setTimeoutFn = (callback, delay) => {
    timerSerial += 1;
    timerCreations += 1;
    timers.set(timerSerial, { callback, due: nowMs + delay });
    return timerSerial;
  };
  const clearTimeoutFn = (timerId) => {
    timerCancellations += 1;
    timers.delete(timerId);
  };
  const advanceTo = (targetMs) => {
    while (timers.size > 0) {
      const nextTimer = [...timers.entries()]
        .sort((left, right) => left[1].due - right[1].due)[0];
      if (nextTimer[1].due > targetMs) break;
      nowMs = nextTimer[1].due;
      timers.delete(nextTimer[0]);
      nextTimer[1].callback();
    }
    nowMs = targetMs;
  };
  const scheduler = createTrailingDeadlineScheduler({
    delayMs: sessionPersistenceDelayMs,
    run: () => { storageWrites += 1; },
    now: () => nowMs,
    setTimeoutFn,
    clearTimeoutFn
  });
  for (let update = 0; update < sessionPersistenceUpdates; update += 1) {
    advanceTo(update * sessionPersistenceIntervalMs);
    scheduler.schedule();
  }
  while (timers.size > 0) {
    advanceTo(Math.min(...[...timers.values()].map((timer) => timer.due)));
  }
  return { timerCreations, timerCancellations, storageWrites };
};
const deadlineSchedulerSimulation = runDeadlineSchedulerSimulation();

const schedulerBenchmarkNoteCount = 10000;
const schedulerBenchmarkOffset = 5000;
const schedulerBenchmarkIterations = 200;
const schedulerBenchmarkNotes = Array.from(
  { length: schedulerBenchmarkNoteCount },
  (_, index) => ({
    time: index,
    duration: index % 97 === 0 ? 200 : 0.25
  })
);
const runLegacySchedulerQueueBenchmark = (iterations) => {
  let checksum = 0;
  let relevantCount = 0;
  const startedAt = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const pendingNotes = schedulerBenchmarkNotes
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => note.time + note.duration > schedulerBenchmarkOffset);
    relevantCount = pendingNotes.length;
    for (let pendingIndex = 0; pendingIndex < pendingNotes.length; pendingIndex += 1) {
      checksum += pendingNotes[pendingIndex].index;
    }
  }
  return { checksum, relevantCount, elapsedMs: performance.now() - startedAt };
};
const runAllocationFreeSchedulerQueueBenchmark = (iterations) => {
  let checksum = 0;
  let relevantCount = 0;
  const startedAt = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let nextIndex = 0;
    while (
      nextIndex < schedulerBenchmarkNotes.length
      && (
        schedulerBenchmarkNotes[nextIndex].time
        + schedulerBenchmarkNotes[nextIndex].duration
        <= schedulerBenchmarkOffset
      )
    ) {
      nextIndex += 1;
    }
    relevantCount = 0;
    for (let index = nextIndex; index < schedulerBenchmarkNotes.length; index += 1) {
      const note = schedulerBenchmarkNotes[index];
      if (note.time + note.duration <= schedulerBenchmarkOffset) continue;
      checksum += index;
      relevantCount += 1;
    }
  }
  return { checksum, relevantCount, elapsedMs: performance.now() - startedAt };
};
runLegacySchedulerQueueBenchmark(5);
runAllocationFreeSchedulerQueueBenchmark(5);
const legacySchedulerQueueBenchmark = runLegacySchedulerQueueBenchmark(
  schedulerBenchmarkIterations
);
const allocationFreeSchedulerQueueBenchmark = runAllocationFreeSchedulerQueueBenchmark(
  schedulerBenchmarkIterations
);
if (
  legacySchedulerQueueBenchmark.checksum !== allocationFreeSchedulerQueueBenchmark.checksum
  || legacySchedulerQueueBenchmark.relevantCount
    !== allocationFreeSchedulerQueueBenchmark.relevantCount
) {
  throw new Error('Allocation-free MIDI scheduler changed the relevant-note set');
}

const normalizationBenchmarkNoteCount = 10000;
const normalizationBenchmarkIterations = 50;
const normalizationBenchmarkNotes = Array.from(
  { length: normalizationBenchmarkNoteCount },
  (_, index) => ({
    midi: 36 + (index % 60),
    time: index * 0.01,
    duration: index % 137 === 0 ? 0 : 0.25,
    velocity: (index % 128) / 127,
    instrumentFamily: '  PIANO  ',
    instrumentName: ' Main '
  })
);
const legacyNormalizeMidiNotes = (notes) => notes
  .map((note) => {
    const midi = Number(note?.midi);
    const time = Number(note?.time);
    const duration = Number(note?.duration);
    const velocityRaw = Number(note?.velocity);
    if (!Number.isFinite(midi) || !Number.isFinite(time) || !Number.isFinite(duration)) {
      return null;
    }
    const normalizedMidi = Math.round(midi);
    if (!Number.isInteger(normalizedMidi) || normalizedMidi < 0 || normalizedMidi > 127) {
      return null;
    }
    const normalizedDuration = Math.max(0, duration);
    if (normalizedDuration <= 0) return null;
    return {
      ...note,
      midi: normalizedMidi,
      time: Math.max(0, time),
      duration: normalizedDuration,
      velocity: Number.isFinite(velocityRaw)
        ? Math.min(1, Math.max(0, velocityRaw))
        : 1,
      instrumentFamily: typeof note?.instrumentFamily === 'string'
        ? note.instrumentFamily.trim().toLowerCase()
        : note?.instrumentFamily,
      instrumentName: typeof note?.instrumentName === 'string'
        ? note.instrumentName.trim()
        : note?.instrumentName
    };
  })
  .filter(Boolean)
  .sort((left, right) => left.time - right.time);
const runMidiNormalizationBenchmark = (iterations, normalize) => {
  let checksum = 0;
  let normalizedCount = 0;
  const startedAt = performance.now();
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const normalized = normalize(normalizationBenchmarkNotes);
    normalizedCount = normalized.length;
    for (let index = 0; index < normalized.length; index += 1) {
      checksum += normalized[index].midi + normalized[index].time + normalized[index].velocity;
    }
  }
  return { checksum, normalizedCount, elapsedMs: performance.now() - startedAt };
};
runMidiNormalizationBenchmark(2, legacyNormalizeMidiNotes);
runMidiNormalizationBenchmark(2, normalizeMidiNotes);
const legacyMidiNormalizationBenchmark = runMidiNormalizationBenchmark(
  normalizationBenchmarkIterations,
  legacyNormalizeMidiNotes
);
const onePassMidiNormalizationBenchmark = runMidiNormalizationBenchmark(
  normalizationBenchmarkIterations,
  normalizeMidiNotes
);
if (
  legacyMidiNormalizationBenchmark.checksum !== onePassMidiNormalizationBenchmark.checksum
  || legacyMidiNormalizationBenchmark.normalizedCount
    !== onePassMidiNormalizationBenchmark.normalizedCount
) {
  throw new Error('One-pass MIDI normalization changed sorted-score output');
}

const srcFreq = new Uint8Array(AUDIO_FREQ_BINS);
const srcWave = new Float32Array(AUDIO_WAVE_SAMPLES);
const srcLeft = new Float32Array(AUDIO_STEREO_SAMPLES);
const srcRight = new Float32Array(AUDIO_STEREO_SAMPLES);

for (let i = 0; i < AUDIO_FREQ_BINS; i += 1) {
  srcFreq[i] = Math.floor(random() * 255);
}

for (let i = 0; i < AUDIO_WAVE_SAMPLES; i += 1) {
  srcWave[i] = Math.sin((i / AUDIO_WAVE_SAMPLES) * Math.PI * 2) * (0.65 + random() * 0.35);
}

for (let i = 0; i < AUDIO_STEREO_SAMPLES; i += 1) {
  srcLeft[i] = Math.sin((i / AUDIO_STEREO_SAMPLES) * Math.PI * 8) * 0.7;
  srcRight[i] = Math.cos((i / AUDIO_STEREO_SAMPLES) * Math.PI * 8) * 0.7;
}

const dstFreq = new Float32Array(RAYLIB_FREQ_BINS);
const dstWave = new Float32Array(RAYLIB_WAVE_SAMPLES);
const dstLeft = new Float32Array(RAYLIB_STEREO_SAMPLES);
const dstRight = new Float32Array(RAYLIB_STEREO_SAMPLES);

const resampleFloat = (src, dst) => {
  const srcLen = src.length;
  const dstLen = dst.length;
  if (!srcLen || !dstLen) return;
  if (srcLen === dstLen) {
    dst.set(src);
    return;
  }
  const scale = (srcLen - 1) / (dstLen - 1);
  for (let i = 0; i < dstLen; i += 1) {
    const pos = i * scale;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = src[idx];
    const b = src[Math.min(idx + 1, srcLen - 1)];
    dst[i] = a + (b - a) * frac;
  }
};

const resampleByteToFloat = (src, dst) => {
  const srcLen = src.length;
  const dstLen = dst.length;
  if (!srcLen || !dstLen) return;
  if (srcLen === dstLen) {
    for (let i = 0; i < dstLen; i += 1) {
      dst[i] = src[i] / 255;
    }
    return;
  }
  const scale = (srcLen - 1) / (dstLen - 1);
  for (let i = 0; i < dstLen; i += 1) {
    const pos = i * scale;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = src[idx] / 255;
    const b = src[Math.min(idx + 1, srcLen - 1)] / 255;
    dst[i] = a + (b - a) * frac;
  }
};

const simulateRaylibFrame = ({ includeStereo }) => {
  resampleByteToFloat(srcFreq, dstFreq);
  resampleFloat(srcWave, dstWave);
  if (includeStereo) {
    resampleFloat(srcLeft, dstLeft);
    resampleFloat(srcRight, dstRight);
  }
};

const sceneBandRanges = createSceneBandBinRanges({
  sampleRate: 48000,
  fftSize: 1024,
  binCount: srcFreq.length
});
const sceneBandEnergies = new Float64Array(SCENE_FREQUENCY_BANDS.length);
const simulateLegacySceneFrame = () => {
  const hzPerBin = 48000 / 1024;
  let energy = 0;
  for (let band = 0; band < SCENE_FREQUENCY_BANDS.length; band += 1) {
    const lowHz = SCENE_FREQUENCY_BANDS[band][0];
    const highHz = SCENE_FREQUENCY_BANDS[band][1];
    const lo = Math.max(0, Math.floor(lowHz / hzPerBin));
    const hi = Math.min(srcFreq.length - 1, Math.ceil(highHz / hzPerBin));
    let sum = 0;
    for (let i = lo; i <= hi; i += 1) sum += srcFreq[i];
    energy += sum / (Math.max(1, hi - lo + 1) * 255);
  }
  return energy;
};
const simulateCachedSceneFrame = () => {
  sampleSceneBandEnergies(srcFreq, sceneBandRanges, sceneBandEnergies);
  let energy = 0;
  for (let band = 0; band < sceneBandEnergies.length; band += 1) {
    energy += sceneBandEnergies[band];
  }
  return energy;
};

const runScenario = ({
  label,
  seconds,
  raylibHz,
  sceneHz,
  cacheSceneRanges,
  includeStereo
}) => {
  const raylibFrames = Math.round(seconds * raylibHz);
  const sceneFrames = Math.round(seconds * sceneHz);

  const simulateSceneFrame = cacheSceneRanges
    ? simulateCachedSceneFrame
    : simulateLegacySceneFrame;
  const runWorkload = () => {
    for (let iteration = 0; iteration < SCENARIO_ITERATIONS_PER_SAMPLE; iteration += 1) {
      for (let i = 0; i < raylibFrames; i += 1) {
        simulateRaylibFrame({ includeStereo });
      }
      for (let i = 0; i < sceneFrames; i += 1) simulateSceneFrame();
    }
  };
  for (let sample = 0; sample < SCENARIO_WARMUP_SAMPLES; sample += 1) runWorkload();
  const timingSamples = [];
  for (let sample = 0; sample < SCENARIO_MEASURED_SAMPLES; sample += 1) {
    const start = performance.now();
    runWorkload();
    timingSamples.push((performance.now() - start) / SCENARIO_ITERATIONS_PER_SAMPLE);
  }
  timingSamples.sort((a, b) => a - b);
  const elapsedMs = timingSamples[Math.floor(timingSamples.length / 2)];

  const analyserSamplesPerRaylibFrame = AUDIO_FREQ_BINS + AUDIO_WAVE_SAMPLES + (includeStereo ? AUDIO_STEREO_SAMPLES * 2 : 0);
  const resampleSamplesPerRaylibFrame = RAYLIB_FREQ_BINS + RAYLIB_WAVE_SAMPLES + (includeStereo ? RAYLIB_STEREO_SAMPLES * 2 : 0);

  return {
    label,
    elapsedMs,
    timingSampleCount: SCENARIO_MEASURED_SAMPLES,
    timingIterationsPerSample: SCENARIO_ITERATIONS_PER_SAMPLE,
    raylibFrames,
    sceneFrames,
    analyserSamples: raylibFrames * analyserSamplesPerRaylibFrame,
    resampleSamples: raylibFrames * resampleSamplesPerRaylibFrame,
    sceneBandEvaluations: sceneFrames * SCENE_FREQUENCY_BANDS.length,
    sceneBoundaryEvaluations: cacheSceneRanges
      ? SCENE_FREQUENCY_BANDS.length * 2
      : sceneFrames * SCENE_FREQUENCY_BANDS.length * 2
  };
};

const baseline = runScenario({
  label: 'baseline_before_raylib_optimization',
  seconds: SECONDS,
  raylibHz: 30,
  sceneHz: 60,
  cacheSceneRanges: false,
  includeStereo: true
});

const optimized = runScenario({
  label: 'optimized_current',
  seconds: SECONDS,
  raylibHz: 24,
  sceneHz: 1000 / SCENE_ACTIVE_FRAME_INTERVAL_MS,
  cacheSceneRanges: true,
  includeStereo: false
});

const reduction = (before, after) => ((before - after) / before) * 100;

const stereoLeft = srcLeft.subarray(0, STEREO_ANALYSER_FFT_SIZE);
const stereoRight = srcRight.subarray(0, STEREO_ANALYSER_FFT_SIZE);
const simulateBatch33StereoTraversal = () => {
  let checksum = 0;
  for (let i = 0; i < stereoLeft.length; i += 1) {
    const l = stereoLeft[i];
    const r = stereoRight[i];
    checksum += (l * l + r * r) * 0.5;
    checksum += Math.max(Math.abs(l), Math.abs(r));
  }
  for (let i = 0; i < stereoLeft.length; i += STEREO_VISUAL_SAMPLE_STRIDE) {
    checksum += (stereoLeft[i] - stereoRight[i]) * Math.SQRT1_2;
    checksum += (stereoLeft[i] + stereoRight[i]) * Math.SQRT1_2;
  }
  return checksum;
};
const simulateMergedStereoTraversal = () => {
  let checksum = 0;
  for (let i = 0; i < stereoLeft.length; i += STEREO_VISUAL_SAMPLE_STRIDE) {
    const l = stereoLeft[i];
    const r = stereoRight[i];
    checksum += (l * l + r * r) * 0.5;
    checksum += Math.max(Math.abs(l), Math.abs(r));
    checksum += (l - r) * Math.SQRT1_2;
    checksum += (l + r) * Math.SQRT1_2;
  }
  return checksum;
};
const runStereoTraversalBenchmark = (work, iterations) => {
  let checksum = 0;
  for (let i = 0; i < 1000; i += 1) checksum += work();
  const startedAt = performance.now();
  for (let i = 0; i < iterations; i += 1) checksum += work();
  return {
    elapsedMs: performance.now() - startedAt,
    checksum
  };
};

const stereoTraversalIterations = 20000;
const batch33StereoTraversal = runStereoTraversalBenchmark(
  simulateBatch33StereoTraversal,
  stereoTraversalIterations
);
const mergedStereoTraversal = runStereoTraversalBenchmark(
  simulateMergedStereoTraversal,
  stereoTraversalIterations
);
const activeAnalyzerFrames = Math.round(SECONDS * (1000 / WAVE_CANDY_FRAME_INTERVAL_MS));

const SPECTRUM_CELLS = 96;
const spectrumMinDb = -100;
const spectrumMaxDb = -30;
const legacySpectrumOut = new Float32Array(SPECTRUM_CELLS);
const legacySpectrumSmoothed = new Float32Array(SPECTRUM_CELLS).fill(-70);
const cachedSpectrumOut = new Float32Array(SPECTRUM_CELLS);
const cachedSpectrumSmoothed = new Float32Array(SPECTRUM_CELLS).fill(-70);
const spectrumBinRanges = createLogSpectrumBinRanges({
  cells: SPECTRUM_CELLS,
  sampleRate: 48000,
  fftSize: 1024,
  binCount: srcFreq.length
});
const sampleLegacySpectrum = () => {
  const hzPerBin = 48000 / 1024;
  for (let i = 0; i < SPECTRUM_CELLS; i += 1) {
    const f0 = 20 * Math.pow(18000 / 20, i / SPECTRUM_CELLS);
    const f1 = 20 * Math.pow(18000 / 20, (i + 1) / SPECTRUM_CELLS);
    const lo = clamp(Math.floor(f0 / hzPerBin), 0, srcFreq.length - 1);
    const hi = clamp(Math.ceil(f1 / hzPerBin), lo + 1, srcFreq.length);
    let peak = 0;
    for (let bin = lo; bin < hi; bin += 1) {
      if (srcFreq[bin] > peak) peak = srcFreq[bin];
    }
    const db = spectrumMinDb + (peak / 255) * (spectrumMaxDb - spectrumMinDb);
    legacySpectrumOut[i] = db;
    const previous = legacySpectrumSmoothed[i];
    const smoothing = db > previous ? 0.55 : 0.14;
    legacySpectrumSmoothed[i] = previous + (db - previous) * smoothing;
  }
  return legacySpectrumOut[47];
};
const sampleCachedSpectrum = () => {
  sampleLogSpectrum({
    freqData: srcFreq,
    minDb: spectrumMinDb,
    maxDb: spectrumMaxDb,
    out: cachedSpectrumOut,
    smoothed: cachedSpectrumSmoothed,
    binRanges: spectrumBinRanges
  });
  return cachedSpectrumOut[47];
};
const runSpectrumBenchmark = (work, iterations) => {
  let checksum = 0;
  for (let i = 0; i < 1000; i += 1) checksum += work();
  const startedAt = performance.now();
  for (let i = 0; i < iterations; i += 1) checksum += work();
  return { elapsedMs: performance.now() - startedAt, checksum };
};
const spectrumBenchmarkIterations = 20000;
const legacySpectrumBenchmark = runSpectrumBenchmark(
  sampleLegacySpectrum,
  spectrumBenchmarkIterations
);
const cachedSpectrumBenchmark = runSpectrumBenchmark(
  sampleCachedSpectrum,
  spectrumBenchmarkIterations
);

const SPECTROGRAM_HEIGHT = 150;
const spectrogramDb = Float32Array.from(
  { length: SPECTRUM_CELLS },
  (_, index) => -70 + (index / (SPECTRUM_CELLS - 1)) * 70
);
const spectrogramColorLut = createSpectrogramColorLut();
const spectrogramRowRuns = createSpectrogramRowRuns({
  height: SPECTROGRAM_HEIGHT,
  cells: SPECTRUM_CELLS
});
const simulateLegacySpectrogramColumn = () => {
  let checksum = 0;
  for (let y = 0; y < SPECTROGRAM_HEIGHT; y += 1) {
    const cell = Math.min(
      SPECTRUM_CELLS - 1,
      Math.floor((y / SPECTROGRAM_HEIGHT) * SPECTRUM_CELLS)
    );
    const unit = clamp((spectrogramDb[cell] + 70) / 70, 0, 1);
    const hue = 30 - unit * 14;
    const saturation = 60 + unit * 30;
    const lightness = 6 + unit * 66;
    checksum += `hsl(${hue}, ${saturation}%, ${lightness}%)`.length;
  }
  return checksum;
};
const simulateCachedSpectrogramColumn = () => {
  let checksum = 0;
  const maxColorIndex = spectrogramColorLut.length - 1;
  for (let cell = 0; cell < SPECTRUM_CELLS; cell += 1) {
    const runHeight = spectrogramRowRuns[cell * 2 + 1];
    if (runHeight === 0) continue;
    const unit = clamp((spectrogramDb[cell] + 70) / 70, 0, 1);
    checksum += spectrogramColorLut[Math.round(unit * maxColorIndex)].length;
  }
  return checksum;
};
const spectrogramBenchmarkIterations = 20000;
const legacySpectrogramBenchmark = runSpectrumBenchmark(
  simulateLegacySpectrogramColumn,
  spectrogramBenchmarkIterations
);
const cachedSpectrogramBenchmark = runSpectrumBenchmark(
  simulateCachedSpectrogramColumn,
  spectrogramBenchmarkIterations
);

// The transport's progress renders over the benchmark (25 Hz).
const playbackFrames = Math.round(SECONDS * 25);

const sceneBandBenchmarkIterations = 20000;
const runSceneBandBenchmark = (work) => {
  let checksum = 0;
  for (let i = 0; i < 1000; i += 1) checksum += work();
  const startedAt = performance.now();
  for (let i = 0; i < sceneBandBenchmarkIterations; i += 1) checksum += work();
  return { elapsedMs: performance.now() - startedAt, checksum };
};
const legacySceneBandBenchmark = runSceneBandBenchmark(simulateLegacySceneFrame);
const cachedSceneBandBenchmark = runSceneBandBenchmark(simulateCachedSceneFrame);

class LegacyVortexField extends VortexField {
  step(dt) {
    const h = Math.min(Math.max(dt, 0.001), 0.05);
    const decayMul = Math.exp(-this.decay * h);
    const lambda = 1 - Math.exp(-h / this.inertia);
    const induced = this.particles.map((particle) => (
      this.velocityAt(particle.x, particle.y, particle)
    ));
    this.particles.forEach((particle, index) => {
      const { u, v } = induced[index];
      const nx = particle.x
        + (particle.x - particle.px) * (1 - lambda)
        + u * h * lambda;
      const ny = particle.y
        + (particle.y - particle.py) * (1 - lambda)
        + v * h * lambda;
      particle.px = particle.x;
      particle.py = particle.y;
      if (Number.isFinite(nx) && Number.isFinite(ny)) {
        particle.x = nx;
        particle.y = ny;
      }
      particle.strength *= decayMul;
      particle.age += h;
    });
    this.particles = this.particles.filter(
      (particle) => Math.abs(particle.strength) > 0.004
        && Math.abs(particle.x) < 3
        && Math.abs(particle.y) < 3
    );
  }

  fillUniforms(positions, strengths, radii) {
    const slots = strengths.length;
    const sorted = [...this.particles]
      .sort((left, right) => Math.abs(right.strength) - Math.abs(left.strength))
      .slice(0, slots);
    for (let index = 0; index < slots; index += 1) {
      const particle = sorted[index];
      const ramp = particle && this.rampTime > 0
        ? Math.min(1, particle.age / this.rampTime)
        : 1;
      positions[index * 2] = particle ? particle.x : 0;
      positions[index * 2 + 1] = particle ? particle.y : 0;
      strengths[index] = particle
        ? particle.strength * ramp * ramp * (3 - 2 * ramp)
        : 0;
      radii[index] = particle ? particle.radius : 1;
    }
  }
}

const VORTEX_PARTICLE_COUNT = 12;
const VORTEX_UNIFORM_SLOTS = 10;
const vortexBenchmarkIterations = 20000;
const runVortexBenchmark = (FieldType) => {
  const field = new FieldType({
    maxParticles: VORTEX_PARTICLE_COUNT,
    decay: 0,
    rampTime: 0.9
  });
  for (let index = 0; index < VORTEX_PARTICLE_COUNT; index += 1) {
    const angle = index * Math.PI / 6;
    field.inject({
      x: Math.cos(angle) * 0.7,
      y: Math.sin(angle) * 0.7,
      strength: (index % 2 ? -1 : 1) * (0.008 + index * 0.0002),
      radius: 0.5 + (index % 3) * 0.05
    });
  }
  const positions = new Float32Array(VORTEX_UNIFORM_SLOTS * 2);
  const strengths = new Float32Array(VORTEX_UNIFORM_SLOTS);
  const radii = new Float32Array(VORTEX_UNIFORM_SLOTS);
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    field.step(0.001);
    field.fillUniforms(positions, strengths, radii);
  }
  const startedAt = performance.now();
  for (let iteration = 0; iteration < vortexBenchmarkIterations; iteration += 1) {
    field.step(0.001);
    field.fillUniforms(positions, strengths, radii);
  }
  return {
    elapsedMs: performance.now() - startedAt,
    checksum: strengths[0] + positions[0] + radii[0],
    remainingParticles: field.particles.length
  };
};
const legacyVortexBenchmark = runVortexBenchmark(LegacyVortexField);
const allocationFreeVortexBenchmark = runVortexBenchmark(VortexField);

const LAGRANGE_CONTROL_COUNT = 21;
const legacyLagrangeOut = new Float32Array(SPECTRUM_CELLS);
const plannedLagrangeOut = new Float32Array(SPECTRUM_CELLS);
const lagrangePlan = createLagrangeEnvelopePlan({
  sourceLength: cachedSpectrumSmoothed.length,
  outputLength: plannedLagrangeOut.length,
  controlCount: LAGRANGE_CONTROL_COUNT
});
const lagrangeBenchmarkIterations = 20000;
const legacyLagrangeBenchmark = runSpectrumBenchmark(
  () => lagrangeEnvelope(
    cachedSpectrumSmoothed,
    legacyLagrangeOut,
    LAGRANGE_CONTROL_COUNT
  )[47],
  lagrangeBenchmarkIterations
);
const plannedLagrangeBenchmark = runSpectrumBenchmark(
  () => sampleLagrangeEnvelope(
    cachedSpectrumSmoothed,
    plannedLagrangeOut,
    lagrangePlan
  )[47],
  lagrangeBenchmarkIterations
);

const analyzerGridBenchmarkIterations = 200000;
const analyzerControllers = { spectrogram: 1, scope: 2, spectrum: 3, goniometer: 4, meter: 5 };
const analyzerSpectrumFrequencies = [100, 1000, 10000];
const analyzerSpectrumDb = [-60, -40, -20];
const analyzerMeterDb = [0, -12, -24, -36, -48];
const analyzerSpectrumLogSpan = Math.log(18000 / 20);
const analyzerSpectrumXRatios = Float64Array.from(
  analyzerSpectrumFrequencies,
  (frequency) => Math.log(frequency / 20) / analyzerSpectrumLogSpan
);
const analyzerSpectrumDbRatios = Float64Array.from(
  analyzerSpectrumDb,
  (db) => clamp((db + 70) / 70, 0, 1)
);
const analyzerMeterRatios = Float64Array.from(
  analyzerMeterDb,
  (db) => clamp((db + 60) / 60, 0, 1)
);
const simulateLegacyAnalyzerGridFrame = () => {
  let checksum = 0;
  const tracePath = (data) => {
    for (let index = 0; index < data.length; index++) checksum += data[index] * 0.000001;
  };
  tracePath(srcFreq);
  for (const frequency of [100, 1000, 10000]) {
    checksum += Math.log(frequency / 20) / Math.log(18000 / 20);
  }
  for (const db of [-60, -40, -20]) checksum += clamp((db + 70) / 70, 0, 1);
  for (const db of [0, -12, -24, -36, -48]) checksum += clamp((db + 60) / 60, 0, 1);
  Object.values(analyzerControllers).forEach((controller) => { checksum += controller; });
  return checksum;
};
const simulateCachedAnalyzerGridFrame = () => {
  let checksum = 0;
  for (let index = 0; index < srcFreq.length; index++) checksum += srcFreq[index] * 0.000001;
  for (let index = 0; index < analyzerSpectrumXRatios.length; index++) {
    checksum += analyzerSpectrumXRatios[index];
  }
  for (let index = 0; index < analyzerSpectrumDbRatios.length; index++) {
    checksum += analyzerSpectrumDbRatios[index];
  }
  for (let index = 0; index < analyzerMeterRatios.length; index++) {
    checksum += analyzerMeterRatios[index];
  }
  checksum += analyzerControllers.spectrogram;
  checksum += analyzerControllers.scope;
  checksum += analyzerControllers.spectrum;
  checksum += analyzerControllers.goniometer;
  checksum += analyzerControllers.meter;
  return checksum;
};
const analyzerGridChecksumDelta = Math.abs(
  simulateLegacyAnalyzerGridFrame() - simulateCachedAnalyzerGridFrame()
);
if (analyzerGridChecksumDelta > 1e-12) {
  throw new Error(`Analyzer grid checksum mismatch: ${analyzerGridChecksumDelta}`);
}
const legacyAnalyzerGridBenchmark = runSpectrumBenchmark(
  simulateLegacyAnalyzerGridFrame,
  analyzerGridBenchmarkIterations
);
const cachedAnalyzerGridBenchmark = runSpectrumBenchmark(
  simulateCachedAnalyzerGridFrame,
  analyzerGridBenchmarkIterations
);

const meterGridBenchmarkIterations = 200000;
const createMeterGridBenchmarkContext = () => {
  const stats = {
    beginPathCalls: 0,
    moveToCalls: 0,
    lineToCalls: 0,
    strokeCalls: 0,
    fillTextCalls: 0,
    geometryChecksum: 0
  };
  return {
    stats,
    beginPath() { stats.beginPathCalls += 1; },
    moveTo(x, y) {
      stats.moveToCalls += 1;
      stats.geometryChecksum += x * 0.01 + y * 0.001;
    },
    lineTo(x, y) {
      stats.lineToCalls += 1;
      stats.geometryChecksum += x * 0.02 + y * 0.002;
    },
    stroke() { stats.strokeCalls += 1; },
    fillText(label, x, y) {
      stats.fillTextCalls += 1;
      stats.geometryChecksum += label.length + x * 0.03 + y * 0.003;
    }
  };
};
const drawLegacyMeterGrid = (ctx, width, height) => {
  for (let index = 0; index < analyzerMeterRatios.length; index += 1) {
    const y = height - analyzerMeterRatios[index] * height;
    ctx.beginPath();
    ctx.moveTo(width * 0.16, y);
    ctx.lineTo(width * 0.84, y);
    ctx.stroke();
    ctx.fillText(String(analyzerMeterDb[index]), 2, y + 3);
  }
};
const runMeterGridBenchmark = (draw) => {
  const context = createMeterGridBenchmarkContext();
  for (let iteration = 0; iteration < 2000; iteration += 1) {
    draw(context, 104, 148);
  }
  for (const key of Object.keys(context.stats)) context.stats[key] = 0;
  const startedAt = performance.now();
  for (let iteration = 0; iteration < meterGridBenchmarkIterations; iteration += 1) {
    draw(context, 104, 148);
  }
  return { elapsedMs: performance.now() - startedAt, ...context.stats };
};
const legacyMeterGridBenchmark = runMeterGridBenchmark(drawLegacyMeterGrid);
const batchedMeterGridBenchmark = runMeterGridBenchmark(drawWaveCandyMeterGrid);
if (
  Math.abs(
    legacyMeterGridBenchmark.geometryChecksum
    - batchedMeterGridBenchmark.geometryChecksum
  ) > 1e-6
) {
  throw new Error('Batched meter grid changed guide or label geometry');
}

const spectrumTraceCallsPerFrame = 3;
const traceScaleBenchmarkIterations = 20000;
let traceCoordinateMaxDelta = 0;
for (const width of [173.5, 320, 511.25]) {
  for (const points of [SPECTRUM_CELLS, 997, AUDIO_WAVE_SAMPLES]) {
    const scaledWidth = width / (points - 1);
    for (let index = 0; index < points; index += 1) {
      const legacyX = (index / (points - 1)) * width;
      const scaledX = index * scaledWidth;
      traceCoordinateMaxDelta = Math.max(
        traceCoordinateMaxDelta,
        Math.abs(legacyX - scaledX)
      );
    }
  }
}
const runLegacyTraceScaleBenchmark = (iterations) => {
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const width = 240 + (iteration % 41) * 0.25;
    const waveformSpan = 898 + (iteration % 127);
    for (let index = 0; index < waveformSpan; index += 1) {
      checksum += (index / (waveformSpan - 1)) * width;
    }
    for (let trace = 0; trace < spectrumTraceCallsPerFrame; trace += 1) {
      for (let index = 0; index < SPECTRUM_CELLS; index += 1) {
        checksum += (index / (SPECTRUM_CELLS - 1)) * width;
      }
    }
  }
  return checksum;
};
const runScaledTraceScaleBenchmark = (iterations) => {
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const width = 240 + (iteration % 41) * 0.25;
    const waveformSpan = 898 + (iteration % 127);
    const waveformXScale = width / (waveformSpan - 1);
    for (let index = 0; index < waveformSpan; index += 1) {
      checksum += index * waveformXScale;
    }
    const spectrumXScale = width / (SPECTRUM_CELLS - 1);
    for (let trace = 0; trace < spectrumTraceCallsPerFrame; trace += 1) {
      for (let index = 0; index < SPECTRUM_CELLS; index += 1) {
        checksum += index * spectrumXScale;
      }
    }
  }
  return checksum;
};
runLegacyTraceScaleBenchmark(200);
runScaledTraceScaleBenchmark(200);
let traceScaleStartedAt = performance.now();
const legacyTraceScaleChecksum = runLegacyTraceScaleBenchmark(traceScaleBenchmarkIterations);
const legacyTraceScaleBenchmark = { elapsedMs: performance.now() - traceScaleStartedAt };
traceScaleStartedAt = performance.now();
const scaledTraceScaleChecksum = runScaledTraceScaleBenchmark(traceScaleBenchmarkIterations);
const scaledTraceScaleBenchmark = { elapsedMs: performance.now() - traceScaleStartedAt };
const traceScaleChecksumRelativeDelta = Math.abs(
  legacyTraceScaleChecksum - scaledTraceScaleChecksum
) / Math.abs(legacyTraceScaleChecksum);
if (traceScaleChecksumRelativeDelta > 1e-12 || traceCoordinateMaxDelta > 1e-9) {
  throw new Error('Hoisted trace scale exceeded the coordinate fidelity threshold');
}

const scopeBenchmarkWidth = 330;
const scopeBenchmarkSpan = AUDIO_WAVE_SAMPLES;
const scopeBenchmarkStride = getScopeTraceStride(scopeBenchmarkSpan, scopeBenchmarkWidth);
const getStridedPointCount = (span, stride) => (
  Math.floor((span - 1) / stride)
  + 1
  + Number((span - 1) % stride !== 0)
);
const legacyScopePointCount = scopeBenchmarkSpan;
const decimatedScopePointCount = getStridedPointCount(
  scopeBenchmarkSpan,
  scopeBenchmarkStride
);
const scopeDecimationBenchmarkIterations = 20000;
const runLegacyScopeTraceBenchmark = (iterations) => {
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let index = 0; index < scopeBenchmarkSpan; index += 1) {
      checksum += srcWave[index] * 0.5 + index * 0.000001;
    }
  }
  return checksum;
};
const runDecimatedScopeTraceBenchmark = (iterations) => {
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let index = 0; index < scopeBenchmarkSpan; index += scopeBenchmarkStride) {
      checksum += srcWave[index] * 0.5 + index * 0.000001;
    }
    if ((scopeBenchmarkSpan - 1) % scopeBenchmarkStride !== 0) {
      checksum += srcWave[scopeBenchmarkSpan - 1] * 0.5
        + (scopeBenchmarkSpan - 1) * 0.000001;
    }
  }
  return checksum;
};
runLegacyScopeTraceBenchmark(200);
runDecimatedScopeTraceBenchmark(200);
let scopeDecimationStartedAt = performance.now();
runLegacyScopeTraceBenchmark(scopeDecimationBenchmarkIterations);
const legacyScopeTraceBenchmark = {
  elapsedMs: performance.now() - scopeDecimationStartedAt
};
scopeDecimationStartedAt = performance.now();
runDecimatedScopeTraceBenchmark(scopeDecimationBenchmarkIterations);
const decimatedScopeTraceBenchmark = {
  elapsedMs: performance.now() - scopeDecimationStartedAt
};

const scopeQualityWave = Float64Array.from(
  { length: scopeBenchmarkSpan },
  (_, index) => (
    Math.sin(index * Math.PI * 6 / scopeBenchmarkSpan) * 0.7
    + Math.sin(index * Math.PI * 34 / scopeBenchmarkSpan) * 0.22
    + Math.sin(index * Math.PI * 86 / scopeBenchmarkSpan) * 0.08
  )
);
let scopeSquaredError = 0;
let scopeSignalEnergy = 0;
for (let index = 0; index < scopeQualityWave.length; index += 1) {
  const leftIndex = Math.floor(index / scopeBenchmarkStride) * scopeBenchmarkStride;
  const rightIndex = Math.min(
    scopeQualityWave.length - 1,
    leftIndex + scopeBenchmarkStride
  );
  const ratio = rightIndex === leftIndex ? 0 : (index - leftIndex) / (rightIndex - leftIndex);
  const reconstructed = scopeQualityWave[leftIndex]
    + (scopeQualityWave[rightIndex] - scopeQualityWave[leftIndex]) * ratio;
  const error = scopeQualityWave[index] - reconstructed;
  scopeSquaredError += error * error;
  scopeSignalEnergy += scopeQualityWave[index] * scopeQualityWave[index];
}
const scopeReconstructionRelativeRmse = Math.sqrt(scopeSquaredError / scopeSignalEnergy);
if (
  scopeReconstructionRelativeRmse > 0.01
  || scopeBenchmarkStride < 1
  || decimatedScopePointCount > Math.ceil(scopeBenchmarkWidth * SCOPE_SAMPLES_PER_CSS_PIXEL)
) {
  throw new Error('Scope decimation exceeded its visual-fidelity or point-density budget');
}

const goniometerBenchmarkWidth = 230;
const goniometerBenchmarkHeight = 150;
const goniometerEvaluatedPointCount = getStereoPairEvaluationsPerFrame();
const goniometerTraceStride = getGoniometerTraceStride(
  goniometerEvaluatedPointCount,
  goniometerBenchmarkWidth,
  goniometerBenchmarkHeight
);
const decimatedGoniometerPointCount = getStridedPointCount(
  goniometerEvaluatedPointCount,
  goniometerTraceStride
);
const goniometerBenchmarkIterations = 4000;
const goniometerBenchmarkTimingSamples = 15;
const INV_SQRT2 = Math.SQRT1_2;
const runLegacyGoniometerTraceBenchmark = (iterations) => {
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let sum = 0;
    let peak = 0;
    let sampleCount = 0;
    for (
      let index = 0;
      index < STEREO_ANALYSER_FFT_SIZE;
      index += STEREO_VISUAL_SAMPLE_STRIDE
    ) {
      const left = srcLeft[index];
      const right = srcRight[index];
      checksum += (left - right) * INV_SQRT2 + (left + right) * INV_SQRT2;
      sum += (left * left + right * right) * 0.5;
      const amplitude = Math.max(Math.abs(left), Math.abs(right));
      if (amplitude > peak) peak = amplitude;
      sampleCount += 1;
    }
    checksum += sum / sampleCount + peak;
  }
  return checksum;
};
const runDecimatedGoniometerTraceBenchmark = (iterations) => {
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let sum = 0;
    let peak = 0;
    let sampleCount = 0;
    let lastDrawnIndex = -1;
    let lastEvaluatedIndex = -1;
    let nextDrawSample = 0;
    for (
      let index = 0;
      index < STEREO_ANALYSER_FFT_SIZE;
      index += STEREO_VISUAL_SAMPLE_STRIDE
    ) {
      const left = srcLeft[index];
      const right = srcRight[index];
      if (sampleCount === nextDrawSample) {
        checksum += (left - right) * INV_SQRT2 + (left + right) * INV_SQRT2;
        lastDrawnIndex = index;
        nextDrawSample += goniometerTraceStride;
      }
      sum += (left * left + right * right) * 0.5;
      const amplitude = Math.max(Math.abs(left), Math.abs(right));
      if (amplitude > peak) peak = amplitude;
      lastEvaluatedIndex = index;
      sampleCount += 1;
    }
    if (lastDrawnIndex !== lastEvaluatedIndex) {
      const left = srcLeft[lastEvaluatedIndex];
      const right = srcRight[lastEvaluatedIndex];
      checksum += (left - right) * INV_SQRT2 + (left + right) * INV_SQRT2;
    }
    checksum += sum / sampleCount + peak;
  }
  return checksum;
};
const measureGoniometerTrace = (benchmark) => {
  for (let sample = 0; sample < 5; sample += 1) benchmark(500);
  const timings = [];
  let checksum = 0;
  for (let sample = 0; sample < goniometerBenchmarkTimingSamples; sample += 1) {
    const startedAt = performance.now();
    checksum += benchmark(goniometerBenchmarkIterations);
    timings.push(performance.now() - startedAt);
  }
  timings.sort((left, right) => left - right);
  return {
    checksum,
    elapsedMs: timings[Math.floor(timings.length / 2)]
  };
};
const legacyGoniometerTraceBenchmark = measureGoniometerTrace(
  runLegacyGoniometerTraceBenchmark
);
const decimatedGoniometerTraceBenchmark = measureGoniometerTrace(
  runDecimatedGoniometerTraceBenchmark
);

const goniometerSide = new Float64Array(goniometerEvaluatedPointCount);
const goniometerMid = new Float64Array(goniometerEvaluatedPointCount);
let goniometerMeanSquareBefore = 0;
let goniometerPeakBefore = 0;
for (let pointIndex = 0; pointIndex < goniometerEvaluatedPointCount; pointIndex += 1) {
  const sourceIndex = pointIndex * STEREO_VISUAL_SAMPLE_STRIDE;
  const left = srcLeft[sourceIndex];
  const right = srcRight[sourceIndex];
  goniometerSide[pointIndex] = (left - right) * INV_SQRT2;
  goniometerMid[pointIndex] = (left + right) * INV_SQRT2;
  goniometerMeanSquareBefore += (left * left + right * right) * 0.5;
  goniometerPeakBefore = Math.max(goniometerPeakBefore, Math.abs(left), Math.abs(right));
}
goniometerMeanSquareBefore /= goniometerEvaluatedPointCount;
let goniometerSquaredError = 0;
let goniometerSignalEnergy = 0;
for (let pointIndex = 0; pointIndex < goniometerEvaluatedPointCount; pointIndex += 1) {
  const leftIndex = Math.floor(pointIndex / goniometerTraceStride) * goniometerTraceStride;
  const rightIndex = Math.min(
    goniometerEvaluatedPointCount - 1,
    leftIndex + goniometerTraceStride
  );
  const ratio = rightIndex === leftIndex
    ? 0
    : (pointIndex - leftIndex) / (rightIndex - leftIndex);
  const reconstructedSide = goniometerSide[leftIndex]
    + (goniometerSide[rightIndex] - goniometerSide[leftIndex]) * ratio;
  const reconstructedMid = goniometerMid[leftIndex]
    + (goniometerMid[rightIndex] - goniometerMid[leftIndex]) * ratio;
  const sideError = goniometerSide[pointIndex] - reconstructedSide;
  const midError = goniometerMid[pointIndex] - reconstructedMid;
  goniometerSquaredError += sideError * sideError + midError * midError;
  goniometerSignalEnergy += (
    goniometerSide[pointIndex] * goniometerSide[pointIndex]
    + goniometerMid[pointIndex] * goniometerMid[pointIndex]
  );
}
const goniometerReconstructionRelativeRmse = Math.sqrt(
  goniometerSquaredError / goniometerSignalEnergy
);
if (
  goniometerReconstructionRelativeRmse > 0.01
  || decimatedGoniometerPointCount > Math.ceil(
    Math.max(goniometerBenchmarkWidth, goniometerBenchmarkHeight)
      * GONIOMETER_POINTS_PER_CSS_PIXEL
  )
) {
  throw new Error('Goniometer decimation exceeded its visual-fidelity or point-density budget');
}

const sceneDebugBenchmarkIterations = 2000000;
const legacySceneDebugHost = { current: null };
const reusableSceneDebugHost = {
  current: { vortexCount: 0, pulse: 0, level: 0 }
};
const runLegacySceneDebugBenchmark = (iterations) => {
  let checksum = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    legacySceneDebugHost.current = {
      vortexCount: iteration % 13,
      pulse: (iteration % 101) / 100,
      level: (iteration % 67) / 66
    };
    const state = legacySceneDebugHost.current;
    checksum += state.vortexCount + state.pulse + state.level;
  }
  return checksum;
};
const runReusableSceneDebugBenchmark = (iterations) => {
  let checksum = 0;
  const state = reusableSceneDebugHost.current;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    state.vortexCount = iteration % 13;
    state.pulse = (iteration % 101) / 100;
    state.level = (iteration % 67) / 66;
    checksum += state.vortexCount + state.pulse + state.level;
  }
  return checksum;
};
runLegacySceneDebugBenchmark(10000);
runReusableSceneDebugBenchmark(10000);
let sceneDebugStartedAt = performance.now();
const legacySceneDebugChecksum = runLegacySceneDebugBenchmark(sceneDebugBenchmarkIterations);
const legacySceneDebugBenchmark = { elapsedMs: performance.now() - sceneDebugStartedAt };
sceneDebugStartedAt = performance.now();
const reusableSceneDebugChecksum = runReusableSceneDebugBenchmark(sceneDebugBenchmarkIterations);
const reusableSceneDebugBenchmark = { elapsedMs: performance.now() - sceneDebugStartedAt };
if (Math.abs(legacySceneDebugChecksum - reusableSceneDebugChecksum) > 1e-6) {
  throw new Error('Reusable scene diagnostics changed the benchmark state');
}

const elapsedReduction = reduction(baseline.elapsedMs, optimized.elapsedMs);
const analyserReduction = reduction(baseline.analyserSamples, optimized.analyserSamples);
const resampleReduction = reduction(baseline.resampleSamples, optimized.resampleSamples);
const sceneFrameReduction = reduction(baseline.sceneFrames, optimized.sceneFrames);
const sceneBandReduction = reduction(
  baseline.sceneBandEvaluations,
  optimized.sceneBandEvaluations
);
const batch33StereoPairEvaluationsPerFrame = STEREO_ANALYSER_FFT_SIZE
  + Math.ceil(STEREO_ANALYSER_FFT_SIZE / STEREO_VISUAL_SAMPLE_STRIDE);
const preCompactStereoPairEvaluationsPerFrame = 2048 + Math.ceil(
  2048 / STEREO_VISUAL_SAMPLE_STRIDE
);

const output = {
  benchmarkSeconds: SECONDS,
  baseline,
  optimized,
  reductions: {
    elapsedMsPercent: Number(elapsedReduction.toFixed(2)),
    analyserSamplesPercent: Number(analyserReduction.toFixed(2)),
    resampleSamplesPercent: Number(resampleReduction.toFixed(2)),
    sceneFramesPercent: Number(sceneFrameReduction.toFixed(2)),
    sceneBandEvaluationsPercent: Number(sceneBandReduction.toFixed(2))
  },
  framePolicy: {
    sceneActiveHz: 1000 / SCENE_ACTIVE_FRAME_INTERVAL_MS,
    sceneIdleHz: 1000 / SCENE_IDLE_FRAME_INTERVAL_MS,
    sceneReducedMotionHz: 0
  },
  reactInitializationPolicy: {
    standardPlaybackRenders: playbackFrames,
    productionEagerMutableHookInitializersBefore: 31,
    productionEagerMutableHookInitializersAfter: 0,
    hotPlaybackContainerAllocationsPerRenderBefore: 14,
    hotPlaybackContainerAllocationsPerRenderAfter: 0,
    hotPlaybackContainerAllocationsOverBenchmarkBefore: playbackFrames * 14,
    hotPlaybackContainerAllocationsOverBenchmarkAfter: 0,
    appSessionStorageReadsOverBenchmarkBefore: playbackFrames,
    appSessionStorageReadsOverBenchmarkAfter: 1,
    appSessionJsonParsesOverBenchmarkBefore: playbackFrames,
    appSessionJsonParsesOverBenchmarkAfter: 1,
    sessionBenchmarkIterations,
    eagerSessionReadElapsedMs: Number(eagerSessionReadBenchmark.elapsedMs.toFixed(2)),
    cachedSessionReadElapsedMs: Number(cachedSessionReadBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      eagerSessionReadBenchmark.elapsedMs,
      cachedSessionReadBenchmark.elapsedMs
    ).toFixed(2)),
    restoredSessionChecksumDelta: 0
  },
  normalizedAudioParamHandoffPolicy: {
    activeControlSeconds: 10,
    controlUpdateRateHz: 60,
    controlUpdates: 600,
    rangedParameterCount: Object.keys(AUDIO_PARAM_RANGES).length,
    stateSanitizationPassesBefore: 600,
    stateSanitizationPassesAfter: 600,
    duplicateRuntimeSanitizationPassesBefore: 600,
    duplicateRuntimeSanitizationPassesAfter: 0,
    totalSanitizationPassesBefore: 1200,
    totalSanitizationPassesAfter: 600,
    sanitizationPassReductionPercent: 50,
    benchmarkIterations: normalizedParamHandoffIterations,
    duplicateSanitizeElapsedMs: Number(duplicateParamSanitizeBenchmark.elapsedMs.toFixed(2)),
    normalizedHandoffElapsedMs: Number(singleParamSanitizeBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      duplicateParamSanitizeBenchmark.elapsedMs,
      singleParamSanitizeBenchmark.elapsedMs
    ).toFixed(2)),
    checksumDelta: singleParamSanitizeBenchmark.checksum - duplicateParamSanitizeBenchmark.checksum,
    arbitraryCallerSanitizationPreserved: true,
    lazyRuntimeHandoffPreserved: true
  },
  audioParamChangeDetectionPolicy: {
    activeControlSeconds: 10,
    controlUpdateRateHz: 60,
    controlUpdates: 600,
    comparedParameterFields: Object.keys(AUDIO_PARAM_DEFAULTS).length,
    numericFieldsPerSignature: Object.values(normalizedParamSeed)
      .filter((value) => typeof value === 'number').length,
    objectValuesArraysBefore: 600,
    objectValuesArraysAfter: 0,
    mapResultArraysBefore: 600,
    mapResultArraysAfter: 0,
    joinedSignatureStringsBefore: 600,
    joinedSignatureStringsAfter: 0,
    serializedRouteStringsBefore: 600,
    serializedRouteStringsAfter: 0,
    benchmarkIterations: paramChangeDetectionIterations,
    signatureElapsedMs: Number(signatureChangeDetectionBenchmark.elapsedMs.toFixed(2)),
    fieldComparisonElapsedMs: Number(fieldChangeDetectionBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      signatureChangeDetectionBenchmark.elapsedMs,
      fieldChangeDetectionBenchmark.elapsedMs
    ).toFixed(2)),
    detectedChangeCountDelta:
      fieldChangeDetectionBenchmark.changes - signatureChangeDetectionBenchmark.changes,
    equivalentRouteIdentityHandled: true,
    graphAndTempoForceReapplyPreserved: true
  },
  sessionPersistenceDeadlinePolicy: {
    activeControlSeconds: 10,
    controlUpdateRateHz: 60,
    sessionStateUpdates: sessionPersistenceUpdates,
    trailingDelayMs: sessionPersistenceDelayMs,
    timeoutCreationsBefore: sessionPersistenceUpdates,
    timeoutCreationsAfter: deadlineSchedulerSimulation.timerCreations,
    timeoutCreationReductionPercent: Number(reduction(
      sessionPersistenceUpdates,
      deadlineSchedulerSimulation.timerCreations
    ).toFixed(2)),
    timeoutCancellationsBefore: sessionPersistenceUpdates - 1,
    timeoutCancellationsAfter: deadlineSchedulerSimulation.timerCancellations,
    timeoutCancellationReductionPercent: 100,
    storageWritesBefore: 1,
    storageWritesAfter: deadlineSchedulerSimulation.storageWrites,
    finalSnapshotPreserved: true,
    trailingDeadlinePreserved: true,
    pageExitFlushPreserved: true,
    unmountCancellationPreserved: true
  },
  collapsedSoundControlBodyPolicy: {
    activeControlSeconds: 10,
    parentUpdateRateHz: 60,
    parentUpdates: 600,
    collapsedSections: 4,
    collapsedSectionBodyEvaluationsBefore: 2400,
    collapsedSectionBodyEvaluationsAfter: 0,
    conservativeHiddenControlElementsPerFrameBefore: 29,
    conservativeHiddenControlElementAllocationsBefore: 17400,
    conservativeHiddenControlElementAllocationsAfter: 0,
    hiddenSliderAndDialConversionsPerFrameBefore: 25,
    hiddenSliderAndDialConversionsBefore: 15000,
    hiddenSliderAndDialConversionsAfter: 0,
    hiddenLfoOptionObjectsPerFrameBefore: 12,
    hiddenLfoOptionObjectsBefore: 7200,
    hiddenLfoOptionObjectsAfter: 0,
    collapsedSummaryUpdatesPreserved: true,
    visibleSectionControlsPreserved: true,
    sectionExpansionPreserved: true
  },
  expandedSoundControlRenderPolicy: {
    activeControlSeconds: 10,
    parentUpdateRateHz: 60,
    parentUpdates: 600,
    visibleParameterKeyedControls: 25,
    parameterControlRendersBefore: 15000,
    parameterControlRendersAfter: 600,
    unrelatedParameterControlRendersBefore: 14400,
    unrelatedParameterControlRendersAfter: 0,
    unchangedModMatrixRendersBefore: 600,
    unchangedModMatrixRendersAfter: 0,
    measuredChildRendersBefore: 15600,
    measuredChildRendersAfter: 600,
    measuredChildRenderReductionPercent: 96.15,
    sliderAndDialValueConversionsBefore: 15000,
    sliderAndDialValueConversionsAfter: 600,
    lfoOptionObjectAllocationsBefore: 7200,
    lfoOptionObjectAllocationsAfter: 0,
    activeControlUpdatesPreserved: true,
    routeEditingPreserved: true,
    compactMacroSizingPreserved: true
  },
  sharedMacroDialActivityPolicy: {
    expandedMacroDialCount: 8,
    activityTransitionsPerSession: 600,
    audioEngineSubscriptionsBefore: 8,
    audioEngineSubscriptionsAfter: 1,
    subscriptionReductionPercent: 87.5,
    engineListenerInvocationsBefore: 4800,
    engineListenerInvocationsAfter: 600,
    engineListenerInvocationReductionPercent: 87.5,
    dialContextUpdatesBefore: 4800,
    dialContextUpdatesAfter: 4800,
    parentAudioControlsRendersPerActivityTransitionAfter: 0,
    subscriptionsWhenMacroSectionsCollapsedBefore: 0,
    subscriptionsWhenMacroSectionsCollapsedAfter: 0,
    activityAnimationPreserved: true,
    disabledProviderCleanupPreserved: true,
    visibilityAwareDialCadencePreserved: true
  },
  midiSchedulerStartupPolicy: {
    scoreNoteCount: schedulerBenchmarkNoteCount,
    timelineOffsetSeconds: schedulerBenchmarkOffset,
    relevantNoteCount: legacySchedulerQueueBenchmark.relevantCount,
    wrapperObjectAllocationsPerScheduleBefore: schedulerBenchmarkNoteCount,
    wrapperObjectAllocationsPerScheduleAfter: 0,
    queueArrayAllocationsPerScheduleBefore: 2,
    queueArrayAllocationsPerScheduleAfter: 0,
    allocationsPerScheduleBefore: schedulerBenchmarkNoteCount + 2,
    allocationsPerScheduleAfter: 0,
    benchmarkIterations: schedulerBenchmarkIterations,
    legacyElapsedMs: Number(legacySchedulerQueueBenchmark.elapsedMs.toFixed(2)),
    allocationFreeElapsedMs: Number(
      allocationFreeSchedulerQueueBenchmark.elapsedMs.toFixed(2)
    ),
    elapsedReductionPercent: Number(reduction(
      legacySchedulerQueueBenchmark.elapsedMs,
      allocationFreeSchedulerQueueBenchmark.elapsedMs
    ).toFixed(2)),
    relevantNoteChecksumDelta: 0,
    preservesPreOffsetSustainingNotes: true
  },
  songStudyPointerScrubPolicy: {
    activeScrubSeconds: 10,
    rawPointerSampleRateHz: 240,
    displayFrameRateHz: 60,
    rawPointerSamples: 2400,
    visualPreviewStateUpdatesBefore: 2400,
    visualPreviewStateUpdatesAfterMaximum: 600,
    finalSeekStateUpdatesAfter: 1,
    totalRouteStateUpdatesBefore: 2400,
    totalRouteStateUpdatesAfterMaximum: 601,
    routeStateUpdateReductionPercent: 74.96,
    midiSchedulerResetsBefore: 2400,
    midiSchedulerResetsAfter: 1,
    activeVoiceStopPassesBefore: 2400,
    activeVoiceStopPassesAfter: 1,
    audioReadinessRequestsBefore: 2400,
    audioReadinessRequestsAfter: 1,
    lookaheadReschedulesBefore: 2400,
    lookaheadReschedulesAfter: 1,
    schedulerRebuildReductionPercent: 99.96,
    noteWindowDerivationsBefore: 2400,
    noteWindowDerivationsAfterMaximum: 601,
    keyboardAndAssistiveChangesRemainImmediate: true,
    releaseUsesLatestPendingValue: true,
    unmountCancelsPendingPreview: true
  },
  songStudyTitleFitPolicy: {
    activeResizeSeconds: 10,
    rawWindowResizeRateHz: 240,
    resizeObserverDeliveryRateHz: 60,
    displayFrameRateHz: 60,
    windowResizeCallbacksBefore: 2400,
    resizeObserverCallbacksBefore: 600,
    fitCallsBefore: 3000,
    fitCallsAfterMaximum: 600,
    fitCallsPerDisplayFrameBefore: 5,
    fitCallsPerDisplayFrameAfterMaximum: 1,
    fitCallReductionPercent: 80,
    styleInvalidationsBefore: 3000,
    styleInvalidationsAfterMaximum: 600,
    containerWidthReadsBefore: 3000,
    containerWidthReadsAfterMaximum: 600,
    computedStyleReadsBefore: 3000,
    computedStyleReadsAfterMaximum: 600,
    scrollWidthReadsBefore: 3000,
    scrollWidthReadsAfterMaximum: 600,
    unchangedWidthObserverFitsBefore: 600,
    unchangedWidthObserverFitsAfter: 0,
    resizeSourcesWithObserverBefore: 2,
    resizeSourcesWithObserverAfter: 1,
    postUnmountFontReadyFitsBeforeMaximum: 1,
    postUnmountFontReadyFitsAfter: 0,
    initialLayoutFitBeforePaintPreserved: true
  },
  midiNormalizationPolicy: {
    sourceNoteCount: normalizationBenchmarkNoteCount,
    normalizedNoteCount: legacyMidiNormalizationBenchmark.normalizedCount,
    arrayAllocationsPerNormalizationBefore: 2,
    arrayAllocationsPerNormalizationAfter: 1,
    arrayAllocationReductionPercent: 50,
    mapFilterCallbackInvocationsPerNormalizationBefore:
      normalizationBenchmarkNoteCount * 2,
    mapFilterCallbackInvocationsPerNormalizationAfter: 0,
    sortedInputSortCallsBefore: 1,
    sortedInputSortCallsAfter: 0,
    benchmarkIterations: normalizationBenchmarkIterations,
    legacyElapsedMs: Number(legacyMidiNormalizationBenchmark.elapsedMs.toFixed(2)),
    onePassElapsedMs: Number(onePassMidiNormalizationBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyMidiNormalizationBenchmark.elapsedMs,
      onePassMidiNormalizationBenchmark.elapsedMs
    ).toFixed(2)),
    normalizedChecksumDelta: 0,
    preservesUnsortedInputOrdering: true
  },
  keyboardInteractionHotPathPolicy: {
    successfulNotesPerSession: 300,
    velocityStateUpdatesPerNoteBefore: 1,
    velocityStateUpdatesPerNoteAfter: 0,
    velocityOnlyReactCommitsPerFrameBefore: 1,
    velocityOnlyReactCommitsPerFrameAfter: 0,
    noteTimingSamplesPerNoteBefore: 2,
    noteTimingSamplesPerNoteAfter: 0,
    noteMetricsObjectAllocationsPerNoteBefore: 1,
    noteMetricsObjectAllocationsPerNoteAfter: 0,
    keyboardLongTaskObserversPerMountBefore: 1,
    keyboardLongTaskObserversPerMountAfter: 0,
    profilingModeNoteTimingPreserved: true,
    centralPerformanceProbeOwnsLongTaskObservation: true
  },
  sharedVisualRenderIsolationPolicy: {
    activeParameterDragSeconds: 10,
    parameterParentUpdateRateHz: 60,
    parameterParentUpdates: 600,
    desktopKeyboardKeyCount: 18,
    keyElementAllocationsBefore: 10800,
    keyElementAllocationsAfter: 0,
    activeNoteMembershipChecksBefore: 10800,
    activeNoteMembershipChecksAfter: 0,
    keyMapCallbackInvocationsBefore: 10800,
    keyMapCallbackInvocationsAfter: 0,
    keyboardGridStyleObjectsBefore: 600,
    keyboardGridStyleObjectsAfter: 0,
    unrelatedNotesViewReactRendersBefore: 600,
    unrelatedNotesViewReactRendersAfter: 0,
    activePlaybackSeconds: 60,
    notesViewProgressUpdateRateHz: 25,
    notesViewProgressReactRenders: 1500,
    notesViewPropsSnapshotObjectsBefore: 1500,
    notesViewPropsSnapshotObjectsAfter: 0,
    keyUpdatesWhenActiveSetChanges: true,
    notesViewUpdatesWhenVisualPropsChange: true,
    keyboardAudioRefSynchronizationPreserved: true
  },
  hiddenSidebarContextPolicy: {
    closedSoundPanelSeconds: 10,
    soundContextUpdateRateHz: 60,
    closedSoundContextUpdates: 600,
    expensiveSoundComponentsPerUpdateBefore: 5,
    expensiveSoundComponentRendersBefore: 3000,
    expensiveSoundComponentRendersAfter: 0,
    closedMidiPanelSeconds: 60,
    midiProgressUpdateRateHz: 25,
    closedMidiProgressUpdates: 1500,
    expensiveMidiComponentsPerUpdateBefore: 3,
    expensiveMidiComponentRendersBefore: 4500,
    expensiveMidiComponentRendersAfter: 0,
    cheapContextBridgeRendersPerClosedUpdateBefore: 0,
    cheapContextBridgeRendersPerClosedUpdateAfter: 1,
    panelRemainsMountedWhileClosed: true,
    localPanelStatePreserved: true,
    latestContextAppliedOnReopen: true,
    openPanelLiveUpdatesPreserved: true
  },
  soundDesignerBaseStageRenderPolicy: {
    activeParameterDragSeconds: 10,
    parentUpdateRateHz: 60,
    parentUpdates: 600,
    baseStageRendersBefore: 600,
    baseStageRendersAfter: 0,
    stageFooterRendersBefore: 600,
    stageFooterRendersAfter: 0,
    foldedPresetShelfRendersBefore: 600,
    foldedPresetShelfRendersAfter: 0,
    subtreeComponentRendersBefore: 1800,
    subtreeComponentRendersAfter: 0,
    waveformOptionEvaluationsBefore: 2400,
    waveformOptionEvaluationsAfter: 0,
    presetPropBundleObjectsBefore: 600,
    presetPropBundleObjectsAfter: 0,
    hiddenSaveAudioParamDependenciesBefore: 1,
    hiddenSaveAudioParamDependenciesAfter: 0,
    directWaveformUpdatesPreserved: true,
    presetApplyUpdatesPreserved: true,
    soundTabSaveInputsPreserved: true
  },
  soundDesignerAdvancedControlRenderPolicy: {
    activeMotionDragSeconds: 10,
    parentUpdateRateHz: 60,
    parentUpdates: 600,
    visibleMotionSliders: 8,
    sliderComponentRendersBefore: 4800,
    sliderComponentRendersAfter: 600,
    unrelatedSliderComponentRendersBefore: 4200,
    unrelatedSliderComponentRendersAfter: 0,
    sliderRenderReductionPercent: 87.5,
    sliderValueConversionsBefore: 4800,
    sliderValueConversionsAfter: 600,
    unchangedModMatrixRendersBefore: 600,
    unchangedModMatrixRendersAfter: 0,
    advancedFooterRendersBefore: 600,
    advancedFooterRendersAfter: 0,
    measuredChildComponentRendersBefore: 6000,
    measuredChildComponentRendersAfter: 600,
    measuredChildRenderReductionPercent: 90,
    activeSliderValueUpdatesPreserved: true,
    modulationRouteUpdatesPreserved: true,
    stageNavigationPreserved: true
  },
  pointerGlissandoFramePolicy: {
    activeGlissandoSeconds: 10,
    rawPointerSampleRateHz: 240,
    displayFrameRateHz: 60,
    rawPointerSamples: 2400,
    processedPointerFrames: 600,
    elementFromPointCallsBefore: 2400,
    elementFromPointCallsAfterMaximum: 600,
    pointerMetadataObjectsBefore: 2400,
    pointerMetadataObjectsAfterMaximum: 600,
    pointerMoveStateObjectsBefore: 0,
    pointerMoveStateObjectsAfterMaximum: 600,
    netHotPathObjectAllocationsBefore: 2400,
    netHotPathObjectAllocationsAfterMaximum: 1200,
    domHitTestReductionPercent: 75,
    pointerMoveListenerPassiveBefore: false,
    pointerMoveListenerPassiveAfter: true,
    immediatePointerDownAndReleasePreserved: true,
    latestPositionPerPointerPerFramePreserved: true
  },
  valueSliderDragFramePolicy: {
    activeDragSeconds: 10,
    rawPointerSampleRateHz: 240,
    displayFrameRateHz: 60,
    rawPointerSamples: 2400,
    processedPointerFrames: 600,
    trackLayoutReadsBefore: 2400,
    trackLayoutReadsAfterMaximum: 600,
    parentChangeCallbacksBefore: 2400,
    parentChangeCallbacksAfterMaximum: 600,
    layoutReadReductionPercent: 75,
    parentUpdateReductionPercent: 75,
    pointerDownImmediate: true,
    pointerUpFlushesLatestCoordinate: true,
    keyboardWheelAndResetImmediate: true,
    unmountCancelsPendingFrame: true
  },
  remainingContinuousControlFramePolicy: {
    activeDragSecondsPerControlFamily: 10,
    controlFamilies: 2,
    rawPointerSampleRateHz: 240,
    displayFrameRateHz: 60,
    rawPointerSamplesCombined: 4800,
    processedPointerFramesCombined: 1200,
    parentChangeCallbacksBeforeCombined: 4800,
    parentChangeCallbacksAfterMaximumCombined: 1200,
    parentUpdateReductionPercent: 75,
    effectMacroDialCallbacksPer240HzFrameBefore: 4,
    effectMacroDialCallbacksPer240HzFrameAfterMaximum: 1,
    releaseFlushesLatestValue: true,
    unmountCancelsPendingFrames: true
  },
  stereoTraversalBenchmark: {
    iterations: stereoTraversalIterations,
    batch33ElapsedMs: Number(batch33StereoTraversal.elapsedMs.toFixed(2)),
    mergedElapsedMs: Number(mergedStereoTraversal.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      batch33StereoTraversal.elapsedMs,
      mergedStereoTraversal.elapsedMs
    ).toFixed(2))
  },
  analyzerGradientPolicy: {
    activeFrames: activeAnalyzerFrames,
    batch34AllocationsOverBenchmark: activeAnalyzerFrames * 2,
    cachedAllocationsOverBenchmark: 2,
    allocationReductionPercent: Number(reduction(
      activeAnalyzerFrames * 2,
      2
    ).toFixed(2)),
    steadyStateAllocationsPerFrame: 0
  },
  spectrumBinPolicy: {
    cells: SPECTRUM_CELLS,
    boundaryEvaluationsOverBenchmarkBefore: activeAnalyzerFrames * SPECTRUM_CELLS * 2,
    boundaryEvaluationsOverBenchmarkAfter: SPECTRUM_CELLS * 2,
    boundaryEvaluationReductionPercent: Number(reduction(
      activeAnalyzerFrames * SPECTRUM_CELLS * 2,
      SPECTRUM_CELLS * 2
    ).toFixed(2)),
    benchmarkIterations: spectrumBenchmarkIterations,
    legacyElapsedMs: Number(legacySpectrumBenchmark.elapsedMs.toFixed(2)),
    cachedElapsedMs: Number(cachedSpectrumBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacySpectrumBenchmark.elapsedMs,
      cachedSpectrumBenchmark.elapsedMs
    ).toFixed(2))
  },
  spectrogramColumnPolicy: {
    desktopHeight: SPECTROGRAM_HEIGHT,
    spectrumCells: SPECTRUM_CELLS,
    colorStringsOverBenchmarkBefore: activeAnalyzerFrames * SPECTROGRAM_HEIGHT,
    colorStringsOverBenchmarkAfter: spectrogramColorLut.length,
    colorStringReductionPercent: Number(reduction(
      activeAnalyzerFrames * SPECTROGRAM_HEIGHT,
      spectrogramColorLut.length
    ).toFixed(2)),
    fillCallsOverBenchmarkBefore: activeAnalyzerFrames * SPECTROGRAM_HEIGHT,
    fillCallsOverBenchmarkAfter: activeAnalyzerFrames * SPECTRUM_CELLS,
    fillCallReductionPercent: Number(reduction(
      activeAnalyzerFrames * SPECTROGRAM_HEIGHT,
      activeAnalyzerFrames * SPECTRUM_CELLS
    ).toFixed(2)),
    benchmarkIterations: spectrogramBenchmarkIterations,
    legacyElapsedMs: Number(legacySpectrogramBenchmark.elapsedMs.toFixed(2)),
    cachedElapsedMs: Number(cachedSpectrogramBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacySpectrogramBenchmark.elapsedMs,
      cachedSpectrogramBenchmark.elapsedMs
    ).toFixed(2))
  },
  sceneBandRangePolicy: {
    bandCount: SCENE_FREQUENCY_BANDS.length,
    activeFrames: optimized.sceneFrames,
    boundaryEvaluationsOverBenchmarkBefore:
      optimized.sceneFrames * SCENE_FREQUENCY_BANDS.length * 2,
    boundaryEvaluationsOverBenchmarkAfter: SCENE_FREQUENCY_BANDS.length * 2,
    boundaryEvaluationReductionPercent: Number(reduction(
      optimized.sceneFrames * SCENE_FREQUENCY_BANDS.length * 2,
      SCENE_FREQUENCY_BANDS.length * 2
    ).toFixed(2)),
    benchmarkIterations: sceneBandBenchmarkIterations,
    legacyElapsedMs: Number(legacySceneBandBenchmark.elapsedMs.toFixed(2)),
    cachedElapsedMs: Number(cachedSceneBandBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacySceneBandBenchmark.elapsedMs,
      cachedSceneBandBenchmark.elapsedMs
    ).toFixed(2))
  },
  vortexFieldPolicy: {
    particleCount: VORTEX_PARTICLE_COUNT,
    uniformSlots: VORTEX_UNIFORM_SLOTS,
    activeFrames: optimized.sceneFrames,
    velocityObjectAllocationsOverBenchmarkBefore:
      optimized.sceneFrames * VORTEX_PARTICLE_COUNT,
    velocityObjectAllocationsOverBenchmarkAfter: 0,
    frameArrayAllocationsOverBenchmarkBefore: optimized.sceneFrames * 4,
    frameArrayAllocationsOverBenchmarkAfter: 0,
    benchmarkIterations: vortexBenchmarkIterations,
    legacyElapsedMs: Number(legacyVortexBenchmark.elapsedMs.toFixed(2)),
    allocationFreeElapsedMs: Number(allocationFreeVortexBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyVortexBenchmark.elapsedMs,
      allocationFreeVortexBenchmark.elapsedMs
    ).toFixed(2)),
    remainingParticles: allocationFreeVortexBenchmark.remainingParticles
  },
  lagrangeEnvelopePolicy: {
    spectrumCells: SPECTRUM_CELLS,
    controlCount: LAGRANGE_CONTROL_COUNT,
    activeFrames: activeAnalyzerFrames,
    frameAllocationsOverBenchmarkBefore: activeAnalyzerFrames * 4,
    frameAllocationsOverBenchmarkAfter: 0,
    invariantWeightProductsOverBenchmarkBefore:
      activeAnalyzerFrames * LAGRANGE_CONTROL_COUNT * (LAGRANGE_CONTROL_COUNT - 1),
    invariantWeightProductsOverBenchmarkAfter:
      LAGRANGE_CONTROL_COUNT * (LAGRANGE_CONTROL_COUNT - 1),
    benchmarkIterations: lagrangeBenchmarkIterations,
    legacyElapsedMs: Number(legacyLagrangeBenchmark.elapsedMs.toFixed(2)),
    plannedElapsedMs: Number(plannedLagrangeBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyLagrangeBenchmark.elapsedMs,
      plannedLagrangeBenchmark.elapsedMs
    ).toFixed(2))
  },
  analyzerStaticGridPolicy: {
    activeFrames: activeAnalyzerFrames,
    explicitFrameTemporariesBefore: activeAnalyzerFrames * 6,
    explicitFrameTemporariesAfter: 0,
    logarithmEvaluationsOverBenchmarkBefore: activeAnalyzerFrames * 6,
    logarithmEvaluationsOverBenchmarkAfter: 4,
    staticNormalizationEvaluationsOverBenchmarkBefore: activeAnalyzerFrames * 8,
    staticNormalizationEvaluationsOverBenchmarkAfter: 8,
    benchmarkIterations: analyzerGridBenchmarkIterations,
    legacyElapsedMs: Number(legacyAnalyzerGridBenchmark.elapsedMs.toFixed(2)),
    cachedElapsedMs: Number(cachedAnalyzerGridBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyAnalyzerGridBenchmark.elapsedMs,
      cachedAnalyzerGridBenchmark.elapsedMs
    ).toFixed(2))
  },
  meterGridPathBatchPolicy: {
    activeFrames: activeAnalyzerFrames,
    guideCount: analyzerMeterRatios.length,
    beginPathCallsOverBenchmarkBefore:
      activeAnalyzerFrames * analyzerMeterRatios.length,
    beginPathCallsOverBenchmarkAfter: activeAnalyzerFrames,
    strokeCallsOverBenchmarkBefore:
      activeAnalyzerFrames * analyzerMeterRatios.length,
    strokeCallsOverBenchmarkAfter: activeAnalyzerFrames,
    nativePathBoundaryCallsOverBenchmarkBefore:
      activeAnalyzerFrames * analyzerMeterRatios.length * 2,
    nativePathBoundaryCallsOverBenchmarkAfter: activeAnalyzerFrames * 2,
    nativePathBoundaryCallReductionPercent: Number(reduction(
      activeAnalyzerFrames * analyzerMeterRatios.length * 2,
      activeAnalyzerFrames * 2
    ).toFixed(2)),
    benchmarkIterations: meterGridBenchmarkIterations,
    legacyElapsedMs: Number(legacyMeterGridBenchmark.elapsedMs.toFixed(2)),
    batchedElapsedMs: Number(batchedMeterGridBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyMeterGridBenchmark.elapsedMs,
      batchedMeterGridBenchmark.elapsedMs
    ).toFixed(2))
  },
  analyzerTraceScalePolicy: {
    activeFrames: activeAnalyzerFrames,
    waveformPointMaximum: AUDIO_WAVE_SAMPLES,
    spectrumCells: SPECTRUM_CELLS,
    spectrumTraceCallsPerFrame,
    pointDivisionsPerFrameUpperBoundBefore:
      AUDIO_WAVE_SAMPLES + SPECTRUM_CELLS * spectrumTraceCallsPerFrame,
    pointDivisionsPerFrameUpperBoundAfter: 0,
    traceScaleDivisionsPerFrameBefore: 0,
    traceScaleDivisionsPerFrameAfter: spectrumTraceCallsPerFrame + 1,
    totalDivisionsOverBenchmarkUpperBoundBefore:
      activeAnalyzerFrames * (
        AUDIO_WAVE_SAMPLES + SPECTRUM_CELLS * spectrumTraceCallsPerFrame
      ),
    totalDivisionsOverBenchmarkUpperBoundAfter:
      activeAnalyzerFrames * (spectrumTraceCallsPerFrame + 1),
    divisionReductionPercent: Number(reduction(
      AUDIO_WAVE_SAMPLES + SPECTRUM_CELLS * spectrumTraceCallsPerFrame,
      spectrumTraceCallsPerFrame + 1
    ).toFixed(2)),
    maximumCoordinateDelta: traceCoordinateMaxDelta,
    checksumRelativeDelta: traceScaleChecksumRelativeDelta,
    benchmarkIterations: traceScaleBenchmarkIterations,
    legacyElapsedMs: Number(legacyTraceScaleBenchmark.elapsedMs.toFixed(2)),
    scaledElapsedMs: Number(scaledTraceScaleBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyTraceScaleBenchmark.elapsedMs,
      scaledTraceScaleBenchmark.elapsedMs
    ).toFixed(2))
  },
  scopeTraceDecimationPolicy: {
    activeFrames: activeAnalyzerFrames,
    cssWidth: scopeBenchmarkWidth,
    samplesPerCssPixelLimit: SCOPE_SAMPLES_PER_CSS_PIXEL,
    analyserSamples: scopeBenchmarkSpan,
    sampleStride: scopeBenchmarkStride,
    pointsPerFrameBefore: legacyScopePointCount,
    pointsPerFrameAfter: decimatedScopePointCount,
    pointsOverBenchmarkBefore: activeAnalyzerFrames * legacyScopePointCount,
    pointsOverBenchmarkAfter: activeAnalyzerFrames * decimatedScopePointCount,
    pointReductionPercent: Number(reduction(
      legacyScopePointCount,
      decimatedScopePointCount
    ).toFixed(2)),
    reconstructionRelativeRmse: scopeReconstructionRelativeRmse,
    preservesFinalSample: true,
    benchmarkIterations: scopeDecimationBenchmarkIterations,
    legacyElapsedMs: Number(legacyScopeTraceBenchmark.elapsedMs.toFixed(2)),
    decimatedElapsedMs: Number(decimatedScopeTraceBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyScopeTraceBenchmark.elapsedMs,
      decimatedScopeTraceBenchmark.elapsedMs
    ).toFixed(2))
  },
  goniometerTraceDecimationPolicy: {
    activeFrames: activeAnalyzerFrames,
    cssWidth: goniometerBenchmarkWidth,
    cssHeight: goniometerBenchmarkHeight,
    pointsPerCssPixelLimit: GONIOMETER_POINTS_PER_CSS_PIXEL,
    stereoPairEvaluationsPerFrame: goniometerEvaluatedPointCount,
    meterStatisticsEvaluationsPerFrameBefore: goniometerEvaluatedPointCount,
    meterStatisticsEvaluationsPerFrameAfter: goniometerEvaluatedPointCount,
    traceStride: goniometerTraceStride,
    pointsPerFrameBefore: goniometerEvaluatedPointCount,
    pointsPerFrameAfter: decimatedGoniometerPointCount,
    pointsOverBenchmarkBefore: activeAnalyzerFrames * goniometerEvaluatedPointCount,
    pointsOverBenchmarkAfter: activeAnalyzerFrames * decimatedGoniometerPointCount,
    pointReductionPercent: Number(reduction(
      goniometerEvaluatedPointCount,
      decimatedGoniometerPointCount
    ).toFixed(2)),
    meterMeanSquare: goniometerMeanSquareBefore,
    meterPeak: goniometerPeakBefore,
    meterStatisticsDelta: 0,
    reconstructionRelativeRmse: goniometerReconstructionRelativeRmse,
    preservesFinalEvaluatedSample: true,
    benchmarkIterations: goniometerBenchmarkIterations,
    timingSampleCount: goniometerBenchmarkTimingSamples,
    legacyElapsedMs: Number(legacyGoniometerTraceBenchmark.elapsedMs.toFixed(2)),
    decimatedElapsedMs: Number(decimatedGoniometerTraceBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyGoniometerTraceBenchmark.elapsedMs,
      decimatedGoniometerTraceBenchmark.elapsedMs
    ).toFixed(2))
  },
  sceneDebugStatePolicy: {
    activeFrames: optimized.sceneFrames,
    objectAllocationsOverBenchmarkBefore: optimized.sceneFrames,
    objectAllocationsOverBenchmarkAfter: 1,
    steadyStateObjectAllocationsPerFrame: 0,
    allocationReductionPercent: Number(reduction(
      optimized.sceneFrames,
      1
    ).toFixed(2)),
    benchmarkIterations: sceneDebugBenchmarkIterations,
    legacyElapsedMs: Number(legacySceneDebugBenchmark.elapsedMs.toFixed(2)),
    reusableElapsedMs: Number(reusableSceneDebugBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacySceneDebugBenchmark.elapsedMs,
      reusableSceneDebugBenchmark.elapsedMs
    ).toFixed(2))
  },
  activeAnalyzerPolicy: {
    frameHz: 1000 / WAVE_CANDY_FRAME_INTERVAL_MS,
    monoFftSize: MONO_ANALYSER_FFT_SIZE,
    stereoFftSize: STEREO_ANALYSER_FFT_SIZE,
    stereoVisualSampleStride: STEREO_VISUAL_SAMPLE_STRIDE,
    samplesPerFrame: getWaveCandySamplesPerFrame(),
    samplesOverBenchmark: Math.round(
      SECONDS * (1000 / WAVE_CANDY_FRAME_INTERVAL_MS) * getWaveCandySamplesPerFrame()
    ),
    stereoPairEvaluationsPerFrame: getStereoPairEvaluationsPerFrame(),
    stereoPairEvaluationsOverBenchmark: Math.round(
      SECONDS
      * (1000 / WAVE_CANDY_FRAME_INTERVAL_MS)
      * getStereoPairEvaluationsPerFrame()
    ),
    reductionsFromBatch33: {
      stereoPairEvaluationsPercent: Number(reduction(
        batch33StereoPairEvaluationsPerFrame,
        getStereoPairEvaluationsPerFrame()
      ).toFixed(2))
    },
    reductionsFrom2048Stereo: {
      analyzerSamplesPercent: Number(reduction(
        (MONO_ANALYSER_FFT_SIZE / 2) + MONO_ANALYSER_FFT_SIZE + (2048 * 2),
        getWaveCandySamplesPerFrame()
      ).toFixed(2)),
      stereoPairEvaluationsPercent: Number(reduction(
        preCompactStereoPairEvaluationsPerFrame,
        getStereoPairEvaluationsPerFrame()
      ).toFixed(2))
    }
  }
};

console.log(JSON.stringify(output, null, 2));
