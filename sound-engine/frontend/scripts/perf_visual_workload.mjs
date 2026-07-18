import { performance } from 'node:perf_hooks';
import {
  SCENE_ACTIVE_FRAME_INTERVAL_MS,
  SCENE_IDLE_FRAME_INTERVAL_MS,
  WAVE_CANDY_FRAME_INTERVAL_MS
} from '../src/utils/visualFramePolicy.js';
import {
  MONO_ANALYSER_FFT_SIZE,
  STEREO_ANALYSER_FFT_SIZE,
  STEREO_VISUAL_SAMPLE_STRIDE,
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
  RADAR_PALETTE_STATE_LIMIT,
  getRadarMidiPalette
} from '../src/utils/radarPalette.js';
import {
  RADAR_PARTICLE_COLOR_COUNT,
  getRadarParticleColor
} from '../src/utils/radarParticleColor.js';
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
import {
  getVisibleNoteRange,
  lowerBound,
  upperBound
} from '../src/components/midiBirdsEyeMath.js';
import { drawWaveCandyMeterGrid } from '../src/utils/waveCandyMeterGrid.js';

const SECONDS = 20;

const AUDIO_FREQ_BINS = 512;
const AUDIO_WAVE_SAMPLES = 1024;
const AUDIO_STEREO_SAMPLES = 2048;

const RAYLIB_FREQ_BINS = 512;
const RAYLIB_WAVE_SAMPLES = 1024;
const RAYLIB_STEREO_SAMPLES = 1024;

const MIDI_NOTE_COUNT = 720;
const VISIBLE_NOTE_COUNT = 260;
const ACTIVE_NOTE_RATIO = 0.12;
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

const midiNotes = Array.from({ length: MIDI_NOTE_COUNT }, (_, index) => {
  const time = index * 0.08 + random() * 0.04;
  const duration = 0.08 + random() * 0.9;
  return {
    midi: 24 + Math.floor(random() * 72),
    time,
    duration,
    endTime: time + duration
  };
});

const simulateRadarFrame = ({ frameIndex, particleCount }) => {
  const nowTime = (frameIndex / 30) % 64;
  const nowSeconds = frameIndex * 0.033;

  for (let i = 0; i < particleCount; i += 1) {
    const lane = (i * 0.07 + 0.13) % 1;
    const depth = (i * 0.11 + nowSeconds * 0.08) % 1;
    const spread = 0.16 + depth * 0.84;
    const laneX = 18 + lane * 340;
    const x = 188 + (laneX - 188) * spread;
    const y = 18 + depth * 170;
    if (x + y < -1) {
      throw new Error('unreachable guard');
    }
  }

  const from = frameIndex % Math.max(1, midiNotes.length - VISIBLE_NOTE_COUNT);
  const to = from + VISIBLE_NOTE_COUNT;
  for (let i = from; i < to; i += 1) {
    const note = midiNotes[i];
    if (note.endTime < nowTime - 1.6 || note.time > nowTime + 12) continue;
    const depthNorm = clamp((note.time - nowTime + 1.6) / (12 + 1.6), 0, 1);
    const farRatio = clamp(1 - depthNorm, 0, 1);
    const nearRatio = 1 - farRatio;
    const laneNorm = note.midi / 127;
    const perspectiveSpread = 0.18 + nearRatio * 0.82;
    const x = 18 + laneNorm * 340 * perspectiveSpread;
    const noteWidth = Math.max(2.5, (340 / 88) * (0.18 + nearRatio * 0.64));
    const bodyLen = clamp(12 + note.duration * 78 * (0.44 + nearRatio * 0.82), 10, 180);
    const tailLen = clamp(bodyLen * (0.9 + nearRatio * 2.3), 12, 220);
    if (x + noteWidth + bodyLen + tailLen < -1) {
      throw new Error('unreachable guard');
    }
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
  radarHz,
  sceneHz,
  cacheSceneRanges,
  includeStereo,
  particleCount
}) => {
  const raylibFrames = Math.round(seconds * raylibHz);
  const radarFrames = Math.round(seconds * radarHz);
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
      for (let i = 0; i < radarFrames; i += 1) {
        simulateRadarFrame({
          frameIndex: i,
          particleCount
        });
      }
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
    radarFrames,
    sceneFrames,
    analyserSamples: raylibFrames * analyserSamplesPerRaylibFrame,
    resampleSamples: raylibFrames * resampleSamplesPerRaylibFrame,
    radarNoteEvaluations: radarFrames * VISIBLE_NOTE_COUNT,
    activeNoteEvaluations: Math.round(radarFrames * VISIBLE_NOTE_COUNT * ACTIVE_NOTE_RATIO),
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
  radarHz: 20,
  sceneHz: 60,
  cacheSceneRanges: false,
  includeStereo: true,
  particleCount: 20
});

const optimized = runScenario({
  label: 'optimized_current',
  seconds: SECONDS,
  raylibHz: 24,
  radarHz: 20,
  sceneHz: 1000 / SCENE_ACTIVE_FRAME_INTERVAL_MS,
  cacheSceneRanges: true,
  includeStereo: false,
  particleCount: 20
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

const createLegacyRadarPalette = (midi, isActive) => {
  const mix = clamp((midi - 21) / (108 - 21), 0, 1);
  const blue = [108, 168, 232];
  const orange = [255, 164, 112];
  const red = Math.round(blue[0] + (orange[0] - blue[0]) * mix);
  const green = Math.round(blue[1] + (orange[1] - blue[1]) * mix * 0.8);
  const blueChannel = Math.round(blue[2] + (orange[2] - blue[2]) * mix);
  return {
    glow: `rgba(${red}, ${green}, ${blueChannel}, ${isActive ? 0.28 : 0.12})`,
    trail: `rgba(${red}, ${green}, ${blueChannel}, ${isActive ? 0.12 : 0.08})`,
    core: `rgba(${Math.min(255, red + 18)}, ${Math.min(255, green + 16)}, ${Math.min(255, blueChannel + 14)}, ${isActive ? 0.9 : 0.72})`,
    edge: `rgba(245, 248, 252, ${isActive ? 0.86 : 0.46})`
  };
};
const radarPaletteBenchmarkIterations = 200000;
const runRadarPaletteBenchmark = (factory) => {
  let checksum = 0;
  const startedAt = performance.now();
  for (let i = 0; i < radarPaletteBenchmarkIterations; i += 1) {
    const palette = factory(i % 128, Boolean((i >> 7) & 1));
    checksum += palette.core.length;
  }
  return { elapsedMs: performance.now() - startedAt, checksum };
};
const legacyRadarPaletteBenchmark = runRadarPaletteBenchmark(createLegacyRadarPalette);
const cachedRadarPaletteBenchmark = runRadarPaletteBenchmark(getRadarMidiPalette);
const radarPlayingFrames = Math.round(SECONDS * 25);
const radarParticleColorBenchmarkIterations = 200000;
const runRadarParticleColorBenchmark = (formatter) => {
  let checksum = 0;
  const startedAt = performance.now();
  for (let i = 0; i < radarParticleColorBenchmarkIterations; i += 1) {
    const alpha = 0.015 + ((i % 1000) / 999) * 0.12;
    checksum += formatter(alpha).length;
  }
  return { elapsedMs: performance.now() - startedAt, checksum };
};
const legacyRadarParticleColorBenchmark = runRadarParticleColorBenchmark(
  (alpha) => `rgba(255, 176, 110, ${alpha.toFixed(3)})`
);
const cachedRadarParticleColorBenchmark = runRadarParticleColorBenchmark(getRadarParticleColor);

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

const radarStartTimes = Float64Array.from(midiNotes, (note) => note.time);
const radarRangeBenchmarkIterations = 500000;
const reusableRadarRange = { startIndex: 0, endIndex: 0, windowStart: 0, windowEnd: 0 };
const getLegacyVisibleNoteRange = ({
  startTimes,
  nowTime,
  lookBehindSeconds,
  lookAheadSeconds,
  maxDuration
}) => {
  const windowStart = nowTime - lookBehindSeconds;
  const windowEnd = nowTime + lookAheadSeconds;
  const earliestRelevantStart = windowStart - maxDuration;
  return {
    startIndex: lowerBound(startTimes, earliestRelevantStart),
    endIndex: upperBound(startTimes, windowEnd),
    windowStart,
    windowEnd
  };
};
const runRadarRangeBenchmark = (sample) => {
  let checksum = 0;
  const startedAt = performance.now();
  for (let iteration = 0; iteration < radarRangeBenchmarkIterations; iteration += 1) {
    const range = sample((iteration % 5000) * 0.01);
    checksum += range.startIndex + range.endIndex + range.windowStart + range.windowEnd;
  }
  return { elapsedMs: performance.now() - startedAt, checksum };
};
const legacyRadarRangeBenchmark = runRadarRangeBenchmark((nowTime) => (
  getLegacyVisibleNoteRange({
    startTimes: radarStartTimes,
    nowTime,
    lookBehindSeconds: 1.8,
    lookAheadSeconds: 14,
    maxDuration: 0.98
  })
));
const reusableRadarRangeBenchmark = runRadarRangeBenchmark((nowTime) => (
  getVisibleNoteRange(
    radarStartTimes,
    nowTime,
    1.8,
    14,
    0.98,
    reusableRadarRange
  )
));

if (Math.abs(legacyRadarRangeBenchmark.checksum - reusableRadarRangeBenchmark.checksum) > 1e-6) {
  throw new Error('Reusable radar range calculation changed the benchmark result');
}

const radarLabelPositions = [42, 87, 134, 203, 248, 302, 361, 418];
const radarLabelBenchmarkIterations = 1000000;
const runLegacyRadarLabelBenchmark = (iterations) => {
  let accepted = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const candidateX = (iteration % 640) * 0.75;
    accepted += Number(
      radarLabelPositions.every((placedX) => Math.abs(placedX - candidateX) > 28)
    );
  }
  return accepted;
};
const runIndexedRadarLabelBenchmark = (iterations) => {
  let accepted = 0;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const candidateX = (iteration % 640) * 0.75;
    let canPlace = true;
    for (let index = 0; index < radarLabelPositions.length; index += 1) {
      if (Math.abs(radarLabelPositions[index] - candidateX) <= 28) {
        canPlace = false;
        break;
      }
    }
    accepted += Number(canPlace);
  }
  return accepted;
};
runLegacyRadarLabelBenchmark(10000);
runIndexedRadarLabelBenchmark(10000);
let radarLabelStartedAt = performance.now();
const legacyRadarLabelAccepted = runLegacyRadarLabelBenchmark(radarLabelBenchmarkIterations);
const legacyRadarLabelBenchmark = { elapsedMs: performance.now() - radarLabelStartedAt };
radarLabelStartedAt = performance.now();
const indexedRadarLabelAccepted = runIndexedRadarLabelBenchmark(radarLabelBenchmarkIterations);
const indexedRadarLabelBenchmark = { elapsedMs: performance.now() - radarLabelStartedAt };
if (legacyRadarLabelAccepted !== indexedRadarLabelAccepted) {
  throw new Error('Indexed radar label collision scan changed placement decisions');
}

const elapsedReduction = reduction(baseline.elapsedMs, optimized.elapsedMs);
const analyserReduction = reduction(baseline.analyserSamples, optimized.analyserSamples);
const resampleReduction = reduction(baseline.resampleSamples, optimized.resampleSamples);
const radarReduction = reduction(baseline.radarNoteEvaluations, optimized.radarNoteEvaluations);
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
    radarNoteEvaluationsPercent: Number(radarReduction.toFixed(2)),
    sceneFramesPercent: Number(sceneFrameReduction.toFixed(2)),
    sceneBandEvaluationsPercent: Number(sceneBandReduction.toFixed(2))
  },
  framePolicy: {
    sceneActiveHz: 1000 / SCENE_ACTIVE_FRAME_INTERVAL_MS,
    sceneIdleHz: 1000 / SCENE_IDLE_FRAME_INTERVAL_MS,
    sceneReducedMotionHz: 0
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
  radarPalettePolicy: {
    paletteConstructionsOverBenchmarkBefore: optimized.radarNoteEvaluations,
    paletteConstructionsOverBenchmarkAfterMaximum: RADAR_PALETTE_STATE_LIMIT,
    constructionReductionPercent: Number(reduction(
      optimized.radarNoteEvaluations,
      RADAR_PALETTE_STATE_LIMIT
    ).toFixed(2)),
    benchmarkIterations: radarPaletteBenchmarkIterations,
    legacyElapsedMs: Number(legacyRadarPaletteBenchmark.elapsedMs.toFixed(2)),
    cachedElapsedMs: Number(cachedRadarPaletteBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyRadarPaletteBenchmark.elapsedMs,
      cachedRadarPaletteBenchmark.elapsedMs
    ).toFixed(2))
  },
  radarStaticGradientPolicy: {
    playingFrames: radarPlayingFrames,
    staticGradientCreationsOverBenchmarkBefore: radarPlayingFrames * 4,
    staticGradientCreationsOverBenchmarkAfter: 4,
    staticGradientReductionPercent: Number(reduction(
      radarPlayingFrames * 4,
      4
    ).toFixed(2)),
    allBackdropAndGridGradientCreationsBefore: radarPlayingFrames * 5,
    allBackdropAndGridGradientCreationsAfter: radarPlayingFrames + 4,
    allGradientReductionPercent: Number(reduction(
      radarPlayingFrames * 5,
      radarPlayingFrames + 4
    ).toFixed(2))
  },
  radarParticleColorPolicy: {
    particleCount: 32,
    colorStringsOverBenchmarkBefore: radarPlayingFrames * 32,
    colorStringsOverBenchmarkAfter: RADAR_PARTICLE_COLOR_COUNT,
    colorStringReductionPercent: Number(reduction(
      radarPlayingFrames * 32,
      RADAR_PARTICLE_COLOR_COUNT
    ).toFixed(2)),
    benchmarkIterations: radarParticleColorBenchmarkIterations,
    legacyElapsedMs: Number(legacyRadarParticleColorBenchmark.elapsedMs.toFixed(2)),
    cachedElapsedMs: Number(cachedRadarParticleColorBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyRadarParticleColorBenchmark.elapsedMs,
      cachedRadarParticleColorBenchmark.elapsedMs
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
  radarFrameContainerPolicy: {
    playingFrames: radarPlayingFrames,
    explicitContainersPerFrameBefore: 8,
    explicitContainersPerFrameAfter: 0,
    explicitContainersOverBenchmarkBefore: radarPlayingFrames * 8,
    explicitContainersOverBenchmarkAfter: 0,
    rangeBenchmarkIterations: radarRangeBenchmarkIterations,
    legacyRangeElapsedMs: Number(legacyRadarRangeBenchmark.elapsedMs.toFixed(2)),
    reusableRangeElapsedMs: Number(reusableRadarRangeBenchmark.elapsedMs.toFixed(2)),
    rangeElapsedReductionPercent: Number(reduction(
      legacyRadarRangeBenchmark.elapsedMs,
      reusableRadarRangeBenchmark.elapsedMs
    ).toFixed(2))
  },
  radarLabelCollisionPolicy: {
    activeNoteChecksOverBenchmark: optimized.activeNoteEvaluations,
    callbackAllocationsOverBenchmarkBefore: optimized.activeNoteEvaluations,
    callbackAllocationsOverBenchmarkAfter: 0,
    callbackAllocationReductionPercent: 100,
    benchmarkIterations: radarLabelBenchmarkIterations,
    legacyElapsedMs: Number(legacyRadarLabelBenchmark.elapsedMs.toFixed(2)),
    indexedElapsedMs: Number(indexedRadarLabelBenchmark.elapsedMs.toFixed(2)),
    elapsedReductionPercent: Number(reduction(
      legacyRadarLabelBenchmark.elapsedMs,
      indexedRadarLabelBenchmark.elapsedMs
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
