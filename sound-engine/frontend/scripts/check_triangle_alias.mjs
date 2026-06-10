#!/usr/bin/env node
/**
 * Verify the polyBLAMP triangle reduces aliasing vs the naive triangle.
 *
 * Renders one high-pitched triangle cycle-exact (no spectral leakage), then
 * measures energy at known alias bins (folded harmonics) with Goertzel.
 */

const SR = 48000;
const N = 8192;
const M = 853; // fundamental bin -> f0 = SR * M / N ~= 4998 Hz
const dt = M / N;

function naiveTri(p) {
  return 2.0 * Math.abs(2.0 * p - 1.0) - 1.0;
}

function polyBlamp(t, d) {
  if (t < d) {
    const x = t / d - 1.0;
    return -(x * x * x) / 3.0;
  }
  if (t > 1.0 - d) {
    const x = (t - 1.0) / d + 1.0;
    return (x * x * x) / 3.0;
  }
  return 0.0;
}

function blampTri(p) {
  let v = naiveTri(p);
  const s = 8.0 * dt;
  v -= s * polyBlamp(p, dt);
  v += s * polyBlamp((p + 0.5) % 1.0, dt);
  return v;
}

function render(fn) {
  const buf = new Float64Array(N);
  let p = 0;
  for (let i = 0; i < N; i++) {
    buf[i] = fn(p);
    p = (p + dt) % 1.0;
  }
  return buf;
}

function goertzelMag(buf, bin) {
  const w = (2 * Math.PI * bin) / N;
  const c = 2 * Math.cos(w);
  let s0 = 0, s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    s0 = buf[i] + c * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const re = s1 - s2 * Math.cos(w);
  const im = s2 * Math.sin(w);
  return Math.sqrt(re * re + im * im) / (N / 2);
}

// Odd harmonics k*M that exceed Nyquist fold to N - k*M (still a clean bin).
const aliasBins = [];
for (let k = 3; k <= 15; k += 2) {
  const bin = k * M;
  if (bin > N / 2 && N - bin > 0 && N - bin < N / 2) {
    aliasBins.push({ k, bin: N - bin });
  }
}

const naive = render(naiveTri);
const blamp = render(blampTri);
const fund = goertzelMag(naive, M);

let worstNaive = -Infinity;
let worstBlamp = -Infinity;
console.log(`f0=${(SR * M / N).toFixed(1)}Hz fundamental=${fund.toFixed(4)}`);
for (const { k, bin } of aliasBins) {
  const a = 20 * Math.log10(goertzelMag(naive, bin) / fund);
  const b = 20 * Math.log10(goertzelMag(blamp, bin) / fund);
  worstNaive = Math.max(worstNaive, a);
  worstBlamp = Math.max(worstBlamp, b);
  console.log(`alias of H${k} @ bin ${bin} (${(SR * bin / N).toFixed(0)}Hz): naive ${a.toFixed(1)}dB -> blamp ${b.toFixed(1)}dB`);
}
console.log(`worst alias: naive ${worstNaive.toFixed(1)}dB, blamp ${worstBlamp.toFixed(1)}dB`);

if (!(worstBlamp < worstNaive - 3)) {
  console.error('FAIL: polyBLAMP did not improve worst alias by at least 3dB');
  process.exit(1);
}
console.log('PASS');
