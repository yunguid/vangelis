# ENGINE LEDGER

Shared memory for the ENGINE_DESCENT loop (see `ENGINE_DESCENT.md`). Every iteration
reads this first and updates it last. Append-honest: failures and re-blessed golden
masters are recorded, never erased.

## Gates — how to run

| Gate | Command (from `sound-engine/frontend/`) | Baseline (iteration 0) |
|------|------------------------------------------|------------------------|
| G1 tests | `npm test` | 337/337 pass (25 files) |
| G2 build | `npm run build` | pass, 1.16s |
| G3 perf | `node scripts/bench_synth_worklet.mjs` | **5.7x** realtime headroom (24 voices × 4 unison, FM+filter+LFO) |
| G4 golden | `npm run audit:audio` | 225/225 renders bit-exact vs `golden/synth/` |
| G5 quality | (included in audit:audio) | see baseline table below |

Golden masters: `golden/synth/<preset-id>.json` — per phrase: sample hash, peak, rms,
dc, maxDelta, tail rms, 24-band log-spectral fingerprint. Re-bless with
`npm run audit:audio:bless` **only** for a deliberate sound improvement, with a ledger
entry stating which metric improved and by how much.

Hashes are platform-pinned (baseline: macOS 26.5 arm64, Node v24.16.0). Bit-exact match
short-circuits; spectral distance (mean ≤ 0.5 dB, max ≤ 3 dB) is the portable gate.
Phrases: single, legato, chord (8 notes), steal (28 fast notes), bend (pitch-bend sweep
+ mod-wheel ramp). Determinism: audit reseeds a PRNG over `Math.random` per
(preset, phrase); self-check renders 5 RNG-heavy presets twice.

## Baseline quality metrics (iteration 0, 2026-07-06)

Aliasing through the full processor (worst folded partial vs fundamental, f0 ≈ 4998 Hz):

| case | worst alias |
|------|-------------|
| saw | **-22.2 dB** |
| square | **-22.1 dB** |
| triangle | -35.4 dB |
| fm-sine (ratio 2, index 6) | -29.6 dB |

Heap drift over 4000 saturated blocks: **-1 KB** (hot loop is allocation-clean).

Worst offenders across 225 golden renders:
- |DC offset|: `tape-solitude/chord` **0.103** (next: same preset 0.078; then ≤0.015)
- max sample step: `fairlight-bell-choir/chord` 0.95, `glass-bells/chord` 0.74
- release tails still ≥ -30 dBFS at render end for long pads (expected; gated relatively)
- peak range across bank: 0.014 – 0.853; 100/225 tails below -80 dBFS

## Backlog

Ordering: structure first (B1 unlocks B2/B3), then quality. One item per iteration.

| id | item | value/effort | gates |
|----|------|--------------|-------|
| B3 | Dedup mod-matrix enums + MAX_MOD_ROUTES, triplicated across synth-worklet.js, audioParams.js, presetStorage.js. | M/L | G1, G2 |
| B4 | Table-drive `sanitizeAudioParams` from `AUDIO_PARAM_RANGES` (~130 lines of hand-written clamps; per-param drift risk). | M/M | G1, G4 bit-exact |
| B5 | `pan` is silently pinned to 0.5 in sanitizeAudioParams (audioParams.js:495) — dead param or bug; decide, fix or remove. | M/L | G1 |
| B6 | `tape-solitude` DC offset 0.103 in chord render — likely integer-ratio FM producing a DC component. Find cause; fix (DC blocker or phase fix); re-bless with metric delta. | M/M | G4 re-bless, G5 dc improves |
| B7 | Alias suppression: -22 dB worst alias (saw/square) at ~5 kHz through full engine; polyBLEP is first-order and master `tanh` re-aliases. Target ≤ -40 dB (higher-order residuals, oversampled nonlinearity, or restructured drive). | H/H | G5 improves, G4 re-bless, G3 no regression |
| B8 | Filter smoothing computes `Math.tan` per sample per voice; hoist coefficients to block rate / on-change. Expect G3 gain from 5.7x. | M/M | G3 improves, G4 within spectral tolerance |
| B9 | `setParams` reallocates compiled mod routes for all 24 voices on every param change (UI drags churn 24 × 3 typed arrays). Compile once at processor level or diff. | M/M | G5 heap, G4 bit-exact |
| B10 | Engine is mono (identical L/R); no stereo unison spread; `width` doesn't exist. True stereo voice architecture. Extend apparatus to capture both channels first. | H/H | apparatus + G4 re-bless |
| B11 | Extend apparatus to delay + reverb worklets (burst golden renders, feedback stability, tail decay metrics). | M/M | apparatus |
| B12 | Envelope semantics: exponential-approach coeffs mean the attack knob isn't attack time; steal-restart fades to 0 then restarts from 0.001 (no retrigger-from-level). Document/calibrate. | L/M | G4 re-bless if changed |
| B13 | Stale comments ("at 44100 Hz" for values computed from real sampleRate); CLAUDE.md says recording uses ScriptProcessorNode but recorder-worklet.js exists. Cleanup batch. | L/L | G1 |
| B14 | Glide always starts from `lastFrequency` even for staccato retriggers; add legato-only glide mode. | M/M | G4 unaffected at defaults |

Out of domain (noted, not engine work): none yet.

## Iteration log

### Iteration 0 — 2026-07-06
Built the measurement apparatus (`scripts/audit_audio.mjs`, npm scripts `audit:audio` /
`audit:audio:bless`). Blessed 225 golden renders (45 presets × 5 phrases, 1.2 MB JSON),
verified compare mode 225/225 bit-exact, determinism self-check pass. Recorded baselines
above; all gates green. No engine code touched. Audited engine and seeded backlog
B1-B14. Notable discoveries: default-param disagreement between worklet and param layer
(B2), dead `pan` param (B5), tape-solitude DC (B6), -22 dB engine-level aliasing (B7).

`ITERATION 0: apparatus — G1..G5 pass — backlog: 14 items`

### Iteration 1 (hotfix, user-reported) — 2026-07-06
**"Sounds clip / sharp clashing noise on long holds."** Diagnosed live (headless renders
clean → measured in-app via `__vangelisAudioProbe`): two cascaded saturators. (1) Worklet
master `tanh(0.2·Σvoices)` — always-on, deep saturation for held chords (10 keys measured
only +3.5 dB over 1 key). (2) Distortion WaveShaper curve applied a (3+k)/9 small-signal
boost (3.3x at the user's drive 0.18, 17x at full) into a ~0.35 ceiling.

Fix: worklet master stage is now a transparent safety clip — unity below knee 0.5,
C1-continuous exponential knee to ±1 (`CLIP_KNEE`, synth-worklet.js); distortion curve
replaced with level-anchored tanh drive (unity-ish at the 0.35 program anchor,
effects.js). Two new vitest cases pin linear-below-knee and bounded-flood behavior.

Measured in-app (user's patch: saw, filter 950/2.1, distortion 0.18, delay+reverb on):
10-key mash now +14 dB over single note (was +3.5 dB); harshness ratio hf/rms 0.26 →
0.054; zero output clipping. Single notes ~2 dB quieter (the hidden distortion makeup
gain is gone — volume knob territory, not a regression).

**G4 re-blessed** (deliberate): chords/floods no longer tanh-compressed — chord peaks
rise ~0.8 dB, spectral deltas are removed intermod products. Aliasing unchanged (±0.15
dB), so B7's "master tanh re-aliases" clause is moot; B7 target stands. Heap drift -1 KB.
G1 339/339 (+2). G3 8.5x vs 5.7x baseline (knee skips `exp` below threshold; some delta
may be machine load — gate is "no regression," satisfied either way).

`ITERATION 1: gain-staging hotfix — G1..G5 pass (G4 re-blessed) — backlog: 14 items`

### Iteration 2 — B1: worklet decomposition — 2026-07-07
`synth-worklet.js` (977 lines) decomposed into pure-DSP ES modules under
`src/audio/dsp/` — constants, oscillator (polyBLEP/BLAMP), envelope, lfo, svf,
mod-routes, voice — each directly importable by vitest and Node; the worklet is now a
~210-line shell (message protocol, voice pool/steal, master clip). Code moved verbatim:
**G4 225/225 bit-exact**, proving zero behavior change.

The Vite bundling risk resolved via `?worker&url` import in
`utils/audioEngine/constants.js`: the worklet builds as a self-contained worker chunk
(13.3 kB, registerProcessor present, zero residual imports — verified in dist) and the
dev server addModule + audible output confirmed in-browser (peak 0.19, no console
errors). Delay/reverb/recorder worklets are import-free and keep the plain URL path.

17 new DSP unit tests (envelope stages, LFO shapes + seeded S&H, SVF stability/clamps,
BLEP residual continuity, route compiler validation/legacy mapping). G1 356/356.
G3 7.4x (baseline 5.7x). G5 unchanged. B2/B3 now unblocked.

`ITERATION 2: B1 worklet decomposition — G1..G5 pass (G4 bit-exact) — backlog: 13 items`

### Iteration 3 — B2: single source of truth for defaults — 2026-07-07
`DEFAULT_PARAMS` (dsp/constants.js) is now the canonical engine defaults, updated to the
values the app actually ships (attack 0.012, decay 0.18, sustain 0.76, release 0.42 —
the old worklet-side values were dead code, only reachable by headless partial-param
construction). `AUDIO_PARAM_DEFAULTS` derives its entire synth subset from it (only the
phaseOffsetDeg→phaseOffset name maps); the third hidden copy — magic-number fallbacks in
`Voice.applyParams` — now references DEFAULT_PARAMS. New vitest pin:
`WORKLET_PARAM_DEFAULTS` must deep-equal `DEFAULT_PARAMS`, so drift is a test failure.
`modRoutes` deliberately kept as a fresh `[]` per object (no shared mutable reference).

Note: `CLEAN_PATCH` in presetStorage.js is preset *content* (deliberately different
values), not a defaults duplicate — left alone. G1 357/357 + smoke ALL PASS.
G4 225/225 bit-exact (presets fully specify params). G3 7.7x. G2 pass.

`ITERATION 3: B2 defaults dedup — G1..G5 pass (G4 bit-exact) — backlog: 12 items`
