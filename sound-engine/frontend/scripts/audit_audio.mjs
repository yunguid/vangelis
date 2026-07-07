#!/usr/bin/env node
/**
 * Golden-master + audio-quality apparatus for the synth worklet.
 *
 * Renders deterministic phrases through every factory preset (headless, same
 * stubbing pattern as test_synth_worklet.mjs) and compares against stored
 * references in golden/synth/. Also measures engine-level aliasing through the
 * full processor and hot-loop heap drift.
 *
 * Usage:
 *   node --expose-gc scripts/audit_audio.mjs            # compare vs golden (gate)
 *   node --expose-gc scripts/audit_audio.mjs --bless    # (re)write references
 *   node --expose-gc scripts/audit_audio.mjs --filter=<preset-id-substring>
 *
 * Determinism: the engine reads Math.random() for the S&H LFO and unison phase
 * jitter; we replace it with a PRNG reseeded per (preset, phrase), so renders
 * are reproducible and order-independent. Sample hashes are platform-pinned
 * (libm may differ across OS/arch); spectral distance is the portable gate.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 48000;
const BLOCK = 128;

// Comparison thresholds (fresh vs golden), per phrase
const SPECTRAL_MEAN_DB = 0.5; // mean |band dB diff| across all frames
const SPECTRAL_MAX_DB = 3.0; // worst single band/frame diff
const LEVEL_DB = 0.75; // |peak dB diff| and |rms dB diff|
const DELTA_RATIO = 1.25; // max sample-to-sample step growth
const TAIL_HEADROOM_DB = 3.0; // release tail may not rise more than this
const TAIL_FLOOR_DB = -80; // ...unless still below this absolute floor
const DC_ABS_FLOOR = 1e-3; // dc offset alarm threshold
const ALIAS_HEADROOM_DB = 1.5; // worst alias may not rise more than this
const HEAP_DRIFT_LIMIT = 2 * 1024 * 1024; // bytes across 4000 gc'd blocks

// Spectral fingerprint shape
const FFT_N = 4096;
const HOP = 4096;
const BANDS = 24;
const FMIN = 30;
const FMAX = 16000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = join(__dirname, '..', 'golden', 'synth');

const args = process.argv.slice(2);
const BLESS = args.includes('--bless');
const filterArg = args.find((a) => a.startsWith('--filter='));
const FILTER = filterArg ? filterArg.slice('--filter='.length) : null;

// --- Seeded PRNG replacing Math.random -------------------------------------

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = mulberry32(1);
Math.random = () => rng();
const reseed = (label) => {
  rng = mulberry32(fnv1a(label));
};

// --- Worklet stubs + engine import ------------------------------------------

globalThis.sampleRate = SR;
globalThis.AudioWorkletProcessor = class {
  constructor() {
    this.port = { onmessage: null, postMessage() {} };
  }
};
const PROCESSORS = {};
globalThis.registerProcessor = (name, cls) => {
  PROCESSORS[name] = cls;
};

await import('../src/audio/synth-worklet.js');
await import('../src/audio/delay-worklet.js');
await import('../src/audio/reverb-worklet.js');
const ProcessorClass = PROCESSORS['vangelis-synth'];
const { FACTORY_PRESETS } = await import('../src/utils/presetStorage.js');
const { sanitizeAudioParams, toWorkletParams } = await import('../src/utils/audioParams.js');

// --- DSP helpers -------------------------------------------------------------

function hashSamples(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < buf.length; i++) {
    const bits = view.getUint32(i * 4, true);
    h ^= bits & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (bits >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (bits >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= bits >>> 24;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const dB = (x) => 20 * Math.log10(Math.max(Math.abs(x), 1e-10));

const fftCache = new Map();
function fftTables(n) {
  let t = fftCache.get(n);
  if (t) return t;
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / n);
    sin[i] = Math.sin((-2 * Math.PI * i) / n);
  }
  const hann = new Float64Array(n);
  for (let i = 0; i < n; i++) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
  t = { rev, cos, sin, hann, re: new Float64Array(n), im: new Float64Array(n) };
  fftCache.set(n, t);
  return t;
}

// In-place iterative radix-2 FFT; returns {re, im} scratch (valid until next call).
function fft(input, n, windowed) {
  const { rev, cos, sin, hann, re, im } = fftTables(n);
  for (let i = 0; i < n; i++) {
    re[rev[i]] = windowed ? input[i] * hann[i] : input[i];
    im[rev[i]] = 0;
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = i, k = 0; j < i + half; j++, k += step) {
        const tr = re[j + half] * cos[k] - im[j + half] * sin[k];
        const ti = re[j + half] * sin[k] + im[j + half] * cos[k];
        re[j + half] = re[j] - tr;
        im[j + half] = im[j] - ti;
        re[j] += tr;
        im[j] += ti;
      }
    }
  }
  return { re, im };
}

function bandBinRanges() {
  const edges = [];
  for (let i = 0; i <= BANDS; i++) {
    const f = FMIN * Math.pow(FMAX / FMIN, i / BANDS);
    edges.push(Math.max(1, Math.round((f / SR) * FFT_N)));
  }
  const ranges = [];
  for (let i = 0; i < BANDS; i++) {
    ranges.push([edges[i], Math.max(edges[i] + 1, edges[i + 1])]);
  }
  return ranges;
}
const BAND_RANGES = bandBinRanges();

// Per-frame log-band power fingerprint (dB, 2 decimals, floored at -100).
function fingerprint(buf) {
  const frames = [];
  for (let start = 0; start + FFT_N <= buf.length; start += HOP) {
    const { re, im } = fft(buf.subarray(start, start + FFT_N), FFT_N, true);
    const bands = new Array(BANDS);
    for (let b = 0; b < BANDS; b++) {
      const [lo, hi] = BAND_RANGES[b];
      let p = 0;
      for (let k = lo; k < hi; k++) p += re[k] * re[k] + im[k] * im[k];
      p /= hi - lo;
      bands[b] = Math.round(Math.max(-100, 10 * Math.log10(p + 1e-12)) * 100) / 100;
    }
    frames.push(bands);
  }
  return frames;
}

function goertzelMag(buf, bin, n) {
  const w = (2 * Math.PI * bin) / n;
  const c = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const s0 = buf[i] + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const re = s1 - s2 * Math.cos(w);
  const im = s2 * Math.sin(w);
  return Math.sqrt(re * re + im * im) / (n / 2);
}

// --- Phrase definitions -------------------------------------------------------

const NOTE_HZ = (m) => 440 * Math.pow(2, (m - 69) / 12);

function buildPhrase(name) {
  const ev = [];
  const on = (t, midi, vel, id) => ev.push({ t, msg: { type: 'noteOn', noteId: id, frequency: NOTE_HZ(midi), velocity: vel } });
  const off = (t, id) => ev.push({ t, msg: { type: 'noteOff', noteId: id } });

  let lenSec;
  switch (name) {
    case 'single': {
      on(0, 60, 0.9, 'n0');
      off(1.0, 'n0');
      lenSec = 2.2;
      break;
    }
    case 'legato': {
      const line = [48, 52, 55, 59];
      line.forEach((m, i) => {
        on(i * 0.4, m, 0.85, `n${i}`);
        off(i * 0.4 + 0.5, `n${i}`); // 100ms overlap exercises glide/legato
      });
      lenSec = 3.0;
      break;
    }
    case 'chord': {
      [36, 43, 48, 52, 55, 59, 62, 64].forEach((m, i) => on(0, m, 0.8, `n${i}`));
      [36, 43, 48, 52, 55, 59, 62, 64].forEach((_, i) => off(1.2, `n${i}`));
      lenSec = 2.4;
      break;
    }
    case 'steal': {
      // 28 fast notes; long-release presets stack tails and force voice steals.
      const pent = [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
      for (let i = 0; i < 28; i++) {
        on(i * 0.1, pent[i % pent.length], 0.8, `n${i}`);
        off(i * 0.1 + 0.08, `n${i}`);
      }
      lenSec = 3.6;
      break;
    }
    case 'bend': {
      on(0, 57, 0.9, 'n0');
      // Pitch bend: 0 -> +2st -> -2st -> 0 over 0.3..1.5s, 10ms message rate
      for (let t = 0.3; t < 1.5; t += 0.01) {
        const u = (t - 0.3) / 1.2;
        const value = u < 0.5 ? u * 2 * 2 : 2 - (u - 0.5) * 2 * 4;
        ev.push({ t, msg: { type: 'pitchBend', value } });
      }
      ev.push({ t: 1.5, msg: { type: 'pitchBend', value: 0 } });
      // Mod wheel: 0 -> 1 over 1.5..2.0s
      for (let t = 1.5; t < 2.0; t += 0.01) {
        ev.push({ t, msg: { type: 'modWheel', value: (t - 1.5) / 0.5 } });
      }
      off(2.2, 'n0');
      lenSec = 2.8;
      break;
    }
    default:
      throw new Error(`unknown phrase ${name}`);
  }
  ev.sort((a, b) => a.t - b.t);
  return { lenSec, events: ev };
}

const PHRASES = ['single', 'legato', 'chord', 'steal', 'bend'];

// --- Rendering ----------------------------------------------------------------

function makeProc(params) {
  const proc = new ProcessorClass({ processorOptions: { paramDefaults: params } });
  proc.port.onmessage({ data: { type: 'setParams', params } });
  return proc;
}

function renderPhrase(preset, phraseName) {
  reseed(`${preset.id}|${phraseName}`);
  const params = toWorkletParams(sanitizeAudioParams(preset.audioParams));
  const proc = makeProc(params);
  const { lenSec, events } = buildPhrase(phraseName);

  const totalBlocks = Math.ceil((lenSec * SR) / BLOCK);
  const outL = new Float32Array(totalBlocks * BLOCK);
  const outR = new Float32Array(totalBlocks * BLOCK);
  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  const outputs = [[left, right]];

  let evIdx = 0;
  for (let b = 0; b < totalBlocks; b++) {
    const tBlock = (b * BLOCK) / SR;
    while (evIdx < events.length && events[evIdx].t <= tBlock + 1e-9) {
      const { msg } = events[evIdx];
      proc.port.onmessage({ data: msg.type === 'noteOn' ? { ...msg, waveform: preset.waveformType } : msg });
      evIdx++;
    }
    proc.process([], outputs);
    outL.set(left, b * BLOCK);
    outR.set(right, b * BLOCK);
  }
  return { outL, outR };
}

function measure(buf) {
  let peak = 0;
  let sumsq = 0;
  let sum = 0;
  let maxDelta = 0;
  let finite = true;
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    if (!Number.isFinite(x)) finite = false;
    const a = Math.abs(x);
    if (a > peak) peak = a;
    sumsq += x * x;
    sum += x;
    const d = Math.abs(x - prev);
    if (d > maxDelta) maxDelta = d;
    prev = x;
  }
  const tailN = Math.min(buf.length, Math.round(0.1 * SR));
  let tailSq = 0;
  for (let i = buf.length - tailN; i < buf.length; i++) tailSq += buf[i] * buf[i];
  const r6 = (x) => Number(x.toPrecision(7));
  return {
    finite,
    peak: r6(peak),
    rms: r6(Math.sqrt(sumsq / buf.length)),
    dc: r6(sum / buf.length),
    maxDelta: r6(maxDelta),
    tailRms: r6(Math.sqrt(tailSq / tailN))
  };
}

// --- Aliasing through the full processor --------------------------------------

const ALIAS_N = 8192;
const ALIAS_M = 853; // f0 = SR * M / N ~= 4998 Hz, cycle-exact (853 is prime)

function measureAliasing(label, waveform, extraParams) {
  reseed(`alias|${label}`);
  const params = toWorkletParams(sanitizeAudioParams({
    attack: 0.005,
    decay: 0.01,
    sustain: 1,
    release: 0.1,
    ...extraParams
  }));
  const proc = makeProc(params);
  const f0 = (SR * ALIAS_M) / ALIAS_N;
  proc.port.onmessage({
    data: { type: 'noteOn', noteId: 'a', frequency: f0, waveform, velocity: 1 }
  });

  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  const outputs = [[left, right]];
  const warmBlocks = 96; // ~256ms: envelope fully settled at sustain
  for (let i = 0; i < warmBlocks; i++) proc.process([], outputs);

  const buf = new Float32Array(ALIAS_N);
  const capBlocks = ALIAS_N / BLOCK;
  for (let i = 0; i < capBlocks; i++) {
    proc.process([], outputs);
    buf.set(left, i * BLOCK);
  }

  const fund = goertzelMag(buf, ALIAS_M, ALIAS_N);
  const half = ALIAS_N / 2;
  const audibleBin = Math.floor((20000 / SR) * ALIAS_N);
  const seen = new Set();
  let worst = -Infinity;
  let worstAudible = -Infinity;
  for (let k = 2; k <= 80; k++) {
    const raw = k * ALIAS_M;
    let m = raw % ALIAS_N;
    if (m > half) m = ALIAS_N - m;
    // Skip true harmonics (all signal components live at multiples of M,
    // including distortion products) and near-DC bins.
    if (m % ALIAS_M === 0 || m <= 3 || seen.has(m)) continue;
    seen.add(m);
    const rel = 20 * Math.log10(goertzelMag(buf, m, ALIAS_N) / Math.max(fund, 1e-12));
    if (rel > worst) worst = rel;
    // Folds landing above 20 kHz are inaudible but still tracked via `worst`.
    if (m <= audibleBin && rel > worstAudible) worstAudible = rel;
  }
  return {
    label,
    f0: Number(f0.toFixed(1)),
    worstAliasDb: Number(worst.toFixed(2)),
    worstAudibleAliasDb: Number(worstAudible.toFixed(2))
  };
}

const ALIAS_CASES = [
  ['saw', 'saw', {}],
  ['square', 'square', {}],
  ['triangle', 'triangle', {}],
  ['fm-sine', 'sine', { useFM: true, fmRatio: 2, fmIndex: 6 }]
];

// --- FX worklets (delay + reverb): stereo golden renders -----------------------
// Self-contained param sets (independent of app-default drift). Stimulus: a
// 0.3 s, 220 Hz, half-amplitude sine burst with 5 ms fades, then silence —
// excites feedback paths and exposes tails. Both channels captured; the
// interchannel correlation pins stereo width behavior.

const FX_LEN_SEC = 4.0;
const FX_CASES = [
  ['delay-digital', 'vangelis-delay', {
    enabled: true, inputLeft: 1, inputRight: 1, timeLeft: 0.24, timeRight: 0.31,
    feedback: 0.45, crossfeed: 0, lowCut: 120, highCut: 6800, drive: 0.05,
    modRate: 0.5, modDepth: 0.0004, flutterRate: 4, flutterDepth: 0.00002,
    width: 0.7, ducking: 0.12, duckRelease: 0.18
  }],
  ['delay-tape', 'vangelis-delay', {
    enabled: true, inputLeft: 1, inputRight: 1, timeLeft: 0.34, timeRight: 0.34,
    feedback: 0.55, crossfeed: 0.08, lowCut: 180, highCut: 4200, drive: 0.18,
    modRate: 0.17, modDepth: 0.0012, flutterRate: 5.2, flutterDepth: 0.0004,
    width: 0.6, ducking: 0.18, duckRelease: 0.2
  }],
  ['delay-pingpong', 'vangelis-delay', {
    enabled: true, inputLeft: 1, inputRight: 0, timeLeft: 0.28, timeRight: 0.28,
    feedback: 0.35, crossfeed: 0.5, lowCut: 150, highCut: 6400, drive: 0.03,
    modRate: 0.3, modDepth: 0.0003, flutterRate: 4, flutterDepth: 0.00002,
    width: 1, ducking: 0.12, duckRelease: 0.18
  }],
  ['delay-stress', 'vangelis-delay', {
    // Worst legal settings: max feedback + crossfeed + drive. Bounded-ness is
    // the gate; whether it self-oscillates is recorded, not asserted.
    enabled: true, inputLeft: 1, inputRight: 1, timeLeft: 0.2, timeRight: 0.26,
    feedback: 0.96, crossfeed: 0.96, lowCut: 90, highCut: 5400, drive: 0.4,
    modRate: 0.5, modDepth: 0.0005, flutterRate: 4, flutterDepth: 0.0001,
    width: 0.7, ducking: 0, duckRelease: 0.18
  }],
  ['reverb-hall', 'vangelis-reverb', {
    enabled: true, variant: 'hall', preDelay: 0.018, size: 0.58, decay: 0.52,
    damping: 0.42, lowCut: 120, highCut: 9200, width: 0.82, diffusion: 0.72,
    modRate: 0.16, modDepth: 0.0004, earlyLevel: 0.34
  }],
  ['reverb-plate', 'vangelis-reverb', {
    enabled: true, variant: 'plate', preDelay: 0.008, size: 0.4, decay: 0.6,
    damping: 0.3, lowCut: 140, highCut: 10500, width: 0.9, diffusion: 0.8,
    modRate: 0.22, modDepth: 0.0005, earlyLevel: 0.4
  }],
  ['reverb-ambient-max', 'vangelis-reverb', {
    // Near-maximal tail: stability + no-growth is the gate.
    enabled: true, variant: 'ambient', preDelay: 0.03, size: 0.9, decay: 0.95,
    damping: 0.25, lowCut: 90, highCut: 8000, width: 1, diffusion: 0.85,
    modRate: 0.12, modDepth: 0.0006, earlyLevel: 0.25
  }]
];

function renderFxCase(name, processorName, fxParams) {
  reseed(`fx|${name}`);
  const Processor = PROCESSORS[processorName];
  const proc = new Processor({ processorOptions: { paramDefaults: fxParams } });
  proc.port.onmessage({ data: { type: 'setParams', params: fxParams } });

  const totalBlocks = Math.ceil((FX_LEN_SEC * SR) / BLOCK);
  const outL = new Float32Array(totalBlocks * BLOCK);
  const outR = new Float32Array(totalBlocks * BLOCK);
  const inL = new Float32Array(BLOCK);
  const inR = new Float32Array(BLOCK);
  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  const inputs = [[inL, inR]];
  const outputs = [[left, right]];

  const burstSamples = Math.round(0.3 * SR);
  const fadeSamples = Math.round(0.005 * SR);
  for (let b = 0; b < totalBlocks; b++) {
    for (let i = 0; i < BLOCK; i++) {
      const n = b * BLOCK + i;
      let s = 0;
      if (n < burstSamples) {
        const env = Math.min(1, n / fadeSamples, (burstSamples - n) / fadeSamples);
        s = 0.5 * env * Math.sin((TWO_PI_AUDIT * 220 * n) / SR);
      }
      inL[i] = s;
      inR[i] = s;
    }
    proc.process(inputs, outputs);
    outL.set(left, b * BLOCK);
    outR.set(right, b * BLOCK);
  }
  return { outL, outR };
}

const TWO_PI_AUDIT = Math.PI * 2;

function stereoCorrelation(a, b) {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  const denom = Math.sqrt(aa * bb);
  return denom < 1e-12 ? 1 : ab / denom;
}

const FX_GOLDEN_DIR = join(GOLDEN_DIR, '..', 'fx');

// Called from the main flow below (needs `failures` initialized).
function runFxSection() {
  mkdirSync(FX_GOLDEN_DIR, { recursive: true });
  for (const [name, processorName, fxParams] of FX_CASES) {
  const { outL, outR } = renderFxCase(name, processorName, fxParams);
  const record = {
    name,
    sr: SR,
    correlation: Number(stereoCorrelation(outL, outR).toFixed(4)),
    channels: {
      left: { hash: hashSamples(outL), ...measure(outL), bands: fingerprint(outL) },
      right: { hash: hashSamples(outR), ...measure(outR), bands: fingerprint(outR) }
    }
  };
  if (!record.channels.left.finite || !record.channels.right.finite) {
    failures.push(`fx/${name}: non-finite output`);
  }

  const goldenPath = join(FX_GOLDEN_DIR, `${name}.json`);
  if (BLESS) {
    writeFileSync(goldenPath, JSON.stringify(record));
  } else if (!existsSync(goldenPath)) {
    failures.push(`fx/${name}: no golden reference (run --bless to create)`);
  } else {
    const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
    for (const ch of ['left', 'right']) {
      const fresh = record.channels[ch];
      const probs = comparePhrase(`fx-${name}`, ch, fresh, fresh.bands,
        { phrases: { [ch]: golden.channels[ch] } });
      failures.push(...probs);
    }
    if (Math.abs(record.correlation - golden.correlation) > 0.05) {
      failures.push(`fx/${name}: stereo correlation ${golden.correlation} -> ${record.correlation}`);
    }
  }
  }

  // Determinism self-check on the densest FDN case
  const detA = renderFxCase('reverb-hall', 'vangelis-reverb', FX_CASES[4][2]);
  const detB = renderFxCase('reverb-hall', 'vangelis-reverb', FX_CASES[4][2]);
  if (hashSamples(detA.outL) !== hashSamples(detB.outL)) {
    failures.push('fx determinism: reverb-hall rendered differently twice — apparatus invalid');
  }
  console.log(`fx: ${FX_CASES.length} cases rendered (delay x4, reverb x3), stereo capture`);
}

// --- Heap drift (hot-loop allocation proxy) ------------------------------------

function measureHeapDrift() {
  if (typeof global.gc !== 'function') return null;
  reseed('heap');
  const params = toWorkletParams(sanitizeAudioParams({
    useFM: true, fmRatio: 2.5, fmIndex: 3,
    useFilter: true, filterCutoff: 4000, filterResonance: 2,
    lfoRate: 5, lfoDepth: 0.5, lfoTarget: 3,
    unisonVoices: 4, unisonDetune: 12
  }));
  const proc = makeProc(params);
  for (let i = 0; i < 24; i++) {
    proc.port.onmessage({
      data: { type: 'noteOn', noteId: `h${i}`, frequency: 110 * Math.pow(2, i / 12), waveform: 'saw', velocity: 1 }
    });
  }
  const left = new Float32Array(BLOCK);
  const right = new Float32Array(BLOCK);
  const outputs = [[left, right]];
  for (let i = 0; i < 500; i++) proc.process([], outputs);
  global.gc();
  global.gc();
  const h0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < 4000; i++) proc.process([], outputs);
  global.gc();
  global.gc();
  const h1 = process.memoryUsage().heapUsed;
  return h1 - h0;
}

// --- Compare helpers ------------------------------------------------------------

function comparePhrase(presetId, phraseName, fresh, freshFp, golden) {
  const problems = [];
  const g = golden.phrases[phraseName];
  if (!g) return [`${presetId}/${phraseName}: missing from golden reference`];

  if (!fresh.finite) problems.push(`${presetId}/${phraseName}: non-finite samples`);
  if (fresh.hash === g.hash) return problems; // bit-exact: nothing else to check

  if (Math.abs(dB(fresh.peak) - dB(g.peak)) > LEVEL_DB) {
    problems.push(`${presetId}/${phraseName}: peak ${dB(g.peak).toFixed(2)} -> ${dB(fresh.peak).toFixed(2)} dBFS`);
  }
  if (Math.abs(dB(fresh.rms) - dB(g.rms)) > LEVEL_DB) {
    problems.push(`${presetId}/${phraseName}: rms ${dB(g.rms).toFixed(2)} -> ${dB(fresh.rms).toFixed(2)} dBFS`);
  }
  if (Math.abs(fresh.dc) > Math.max(2 * Math.abs(g.dc), DC_ABS_FLOOR)) {
    problems.push(`${presetId}/${phraseName}: dc ${g.dc} -> ${fresh.dc}`);
  }
  if (fresh.maxDelta > g.maxDelta * DELTA_RATIO + 1e-4) {
    problems.push(`${presetId}/${phraseName}: maxDelta ${g.maxDelta} -> ${fresh.maxDelta} (click risk)`);
  }
  const tailLimit = Math.max(dB(g.tailRms) + TAIL_HEADROOM_DB, TAIL_FLOOR_DB);
  if (dB(fresh.tailRms) > tailLimit) {
    problems.push(`${presetId}/${phraseName}: tail ${dB(g.tailRms).toFixed(1)} -> ${dB(fresh.tailRms).toFixed(1)} dBFS`);
  }

  const gFp = g.bands;
  if (freshFp.length !== gFp.length) {
    problems.push(`${presetId}/${phraseName}: frame count ${gFp.length} -> ${freshFp.length}`);
    return problems;
  }
  let sumAbs = 0;
  let count = 0;
  let maxAbs = 0;
  for (let f = 0; f < freshFp.length; f++) {
    for (let b = 0; b < BANDS; b++) {
      const d = Math.abs(freshFp[f][b] - gFp[f][b]);
      sumAbs += d;
      count++;
      if (d > maxAbs) maxAbs = d;
    }
  }
  const mean = sumAbs / count;
  if (mean > SPECTRAL_MEAN_DB || maxAbs > SPECTRAL_MAX_DB) {
    problems.push(
      `${presetId}/${phraseName}: spectral drift mean=${mean.toFixed(3)}dB max=${maxAbs.toFixed(2)}dB`
    );
  }
  return problems;
}

// --- Main -----------------------------------------------------------------------

const t0 = process.hrtime.bigint();
const presets = FILTER ? FACTORY_PRESETS.filter((p) => p.id.includes(FILTER)) : FACTORY_PRESETS;
if (presets.length === 0) {
  console.error(`no presets match --filter=${FILTER}`);
  process.exit(1);
}

const failures = [];

// 1. Determinism self-check on presets that exercise the RNG paths
{
  const rngPresets = presets
    .filter((p) => {
      const s = sanitizeAudioParams(p.audioParams);
      return s.unisonVoices > 1 || s.lfo1Shape === 5 || s.lfo2Shape === 5;
    })
    .slice(0, 5);
  for (const p of rngPresets) {
    const h1 = hashSamples(renderPhrase(p, 'single').outL);
    const h2 = hashSamples(renderPhrase(p, 'single').outL);
    if (h1 !== h2) {
      failures.push(`DETERMINISM: ${p.id} rendered differently twice (${h1} vs ${h2}) — apparatus invalid`);
    }
  }
  console.log(`determinism: ${rngPresets.length} RNG-heavy presets render reproducibly`);
}

// 2. Golden-master render + compare/bless
mkdirSync(GOLDEN_DIR, { recursive: true });
let blessed = 0;
let compared = 0;
let bitExact = 0;

// Schema v2: both channels captured per phrase (correlation + per-channel
// metrics/fingerprints). Unison voices spread across the stereo field as of
// descent(14); non-unison voices remain exactly centered (L==R by copy).
for (const preset of presets) {
  const record = { id: preset.id, name: preset.name, sr: SR, schema: 2, phrases: {} };
  for (const phrase of PHRASES) {
    const { outL, outR } = renderPhrase(preset, phrase);
    const mL = measure(outL);
    const mR = measure(outR);
    if (!mL.finite || !mR.finite) failures.push(`${preset.id}/${phrase}: non-finite output`);
    const hashL = hashSamples(outL);
    const hashR = hashSamples(outR);
    record.phrases[phrase] = {
      correlation: Number(stereoCorrelation(outL, outR).toFixed(4)),
      left: { hash: hashL, ...mL, bands: fingerprint(outL) },
      right: { hash: hashR, ...mR, bands: fingerprint(outR) }
    };
  }

  const goldenPath = join(GOLDEN_DIR, `${preset.id}.json`);
  if (BLESS) {
    writeFileSync(goldenPath, JSON.stringify(record));
    blessed++;
  } else if (!existsSync(goldenPath)) {
    failures.push(`${preset.id}: no golden reference (run --bless to create)`);
  } else {
    const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
    for (const phrase of PHRASES) {
      const fresh = record.phrases[phrase];
      const g = golden.phrases[phrase];
      if (!g || g.left === undefined) {
        failures.push(`${preset.id}/${phrase}: golden predates stereo schema (run --bless)`);
        compared++;
        continue;
      }
      let clean = true;
      for (const ch of ['left', 'right']) {
        const probs = comparePhrase(preset.id, `${phrase}.${ch[0].toUpperCase()}`, fresh[ch], fresh[ch].bands,
          { phrases: { [`${phrase}.${ch[0].toUpperCase()}`]: g[ch] } });
        failures.push(...probs);
        if (probs.length > 0) clean = false;
      }
      if (Math.abs(fresh.correlation - g.correlation) > 0.02) {
        failures.push(`${preset.id}/${phrase}: stereo correlation ${g.correlation} -> ${fresh.correlation}`);
        clean = false;
      }
      if (clean && fresh.left.hash === g.left.hash && fresh.right.hash === g.right.hash) bitExact++;
      compared++;
    }
  }
}

// 3. Aliasing through the full engine
const aliasResults = ALIAS_CASES.map(([label, wf, extra]) => measureAliasing(label, wf, extra));
const aliasPath = join(GOLDEN_DIR, '_aliasing.json');
if (BLESS) {
  writeFileSync(aliasPath, JSON.stringify(aliasResults, null, 2));
} else if (existsSync(aliasPath)) {
  const goldenAlias = JSON.parse(readFileSync(aliasPath, 'utf8'));
  for (const fresh of aliasResults) {
    const g = goldenAlias.find((x) => x.label === fresh.label);
    if (!g) {
      failures.push(`alias/${fresh.label}: missing from golden`);
    } else {
      if (fresh.worstAliasDb > g.worstAliasDb + ALIAS_HEADROOM_DB) {
        failures.push(`alias/${fresh.label}: worst alias ${g.worstAliasDb} -> ${fresh.worstAliasDb} dB`);
      }
      if (g.worstAudibleAliasDb !== undefined
        && fresh.worstAudibleAliasDb > g.worstAudibleAliasDb + ALIAS_HEADROOM_DB) {
        failures.push(`alias/${fresh.label}: worst audible alias ${g.worstAudibleAliasDb} -> ${fresh.worstAudibleAliasDb} dB`);
      }
    }
  }
} else {
  failures.push('alias: no golden reference (run --bless to create)');
}
for (const a of aliasResults) {
  console.log(`alias ${a.label.padEnd(9)} f0=${a.f0}Hz worst=${a.worstAliasDb}dB audible=${a.worstAudibleAliasDb}dB`);
}

// 3b. FX worklets (delay + reverb) golden renders
runFxSection();

// 4. Heap drift
const drift = measureHeapDrift();
if (drift === null) {
  console.log('heap drift: skipped (run with --expose-gc)');
} else {
  console.log(`heap drift: ${(drift / 1024).toFixed(0)} KB over 4000 saturated blocks`);
  if (drift > HEAP_DRIFT_LIMIT) {
    failures.push(`heap drift ${(drift / 1024 / 1024).toFixed(2)} MB exceeds ${HEAP_DRIFT_LIMIT / 1024 / 1024} MB`);
  }
}

const elapsed = Number(process.hrtime.bigint() - t0) / 1e9;
console.log(
  BLESS
    ? `\nblessed ${blessed} presets x ${PHRASES.length} phrases -> ${GOLDEN_DIR} (${elapsed.toFixed(1)}s)`
    : `\ncompared ${compared} renders (${bitExact} bit-exact) in ${elapsed.toFixed(1)}s`
);

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURE(S):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('AUDIT PASS');
