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

### Iteration 4 — B3: mod-matrix enum dedup — 2026-07-07
`MOD_SRC`/`MOD_DST`/`LFO_SHAPES`/`MAX_MOD_ROUTES` now live only in `dsp/constants.js`.
`audioParams.js` derives its UI option lists and `sanitizeModRoutes` bounds from them
(and re-exports MAX_MOD_ROUTES for existing UI imports); `presetStorage.js` keeps its
compact SRC/DST patch-table aliases but derives every value; the route compiler's
hardcoded `s > 6 || d > 4` bounds now reference the enums. Adding a mod source/dest is
now a one-file change. G1 357/357, smoke clean, G4 225/225 bit-exact, G3 7.7x, G2 pass.

`ITERATION 4: B3 enum dedup — G1..G5 pass (G4 bit-exact) — backlog: 11 items`

### Iteration 5 — B4: table-driven sanitize (+B5 closed by evidence) — 2026-07-07
`sanitizeAudioParams` rewritten as a table pass over `AUDIO_PARAM_RANGES` (default-fill →
optional floor for the 5 integer params → clamp), with couplings/aliases/non-numerics
(delayHighCut ≥ lowCut+400, reverb↔reverbMix alias, enable flags, mode coercions,
modRoutes) kept explicit. ~90 lines shorter; adding a ranged param no longer requires a
hand-written clamp. Honest note: `null` inputs now uniformly take the default (the old
code coerced null→0 for the ~14 params written without `??` — degenerate-input path
only; factory presets and stored params are unaffected, G4 bit-exact confirms).

**B5 closed, no code change:** pan pinning to center is deliberate and pinned by
`audioParams.test.js` ("forces pan back to center when loading saved params") — the
stereoPanner is user-session state, not preset state. Backlog -2.

G1 357/357, smoke ALL PASS, G4 225/225 bit-exact, G3 7.6x, G2 pass.

`ITERATION 5: B4 table-driven sanitize — G1..G5 pass (G4 bit-exact) — backlog: 9 items`

### Iteration 6 — B6: DC offset eliminated (master DC blocker) — 2026-07-07
Cause confirmed: integer-ratio phase modulation (`tape-solitude` uses fmRatio 1) puts a
Bessel-weighted spectral component at exactly 0 Hz; each harmonic k of the triangle
carrier contributes when k + n·ratio = 0, and eight chord voices sum their offsets.
Fix: one-pole DC blocker (`dsp/dc-blocker.js`, 5 Hz corner, −0.03 dB at 65 Hz) on the
voice sum, before the clip knee so clipping stays symmetric. Two unit tests (step decay,
audio-band unity).

**Metric deltas (chord renders):** tape-solitude |dc| 0.107 → 3e-5; love-theme 0.015 →
5e-5; lullaby-ep 0.007 → 2e-5; worst |dc| across the whole bank now 1.5e-4 (was 0.103).
DC contamination was wider than the flagged preset — 95/225 renders drifted vs old
goldens (DC + sub-30 Hz cleanup across FM patches); **G4 re-blessed** for that reason.
Aliasing unchanged, heap −24 KB, G3 7.7x, G1 359/359 + smoke, G2 pass. In-app check:
note plays, output mean −6.6e-5. (Transient dev-only HMR "MAX_MOD_ROUTES already
declared" errors observed during concurrent editing — verified stale: single declaration
in tree, build/tests/boot all clean after reload.)

`ITERATION 6: B6 DC blocker — G1..G5 pass (G4 re-blessed) — backlog: 8 items`

### Iteration 7 — B7: 4-point polyBLEP for saw/square — 2026-07-07
Derived the cubic-B-spline BLEP residual (RES(x) = ∫B3 − u over a ±2-sample window) and
shipped it as `polyBlep4` in `dsp/oscillator.js`; saw/square use it whenever dt ≤ 0.2
(the window self-overlaps past that — heavily FM-widened tones fall back to 2-point).
Unit test pins branch continuity, window support, and the −2 step convention.

**Metric deltas (f0 ≈ 5 kHz through full engine):** saw/square worst alias −22.25 →
−30.52 dB; worst *audible* (< 20 kHz) alias: saw −41.1 dB, square −55.0 dB — the ≤ −40
target is met in the audible band. The remaining over-target bin is the k=5 partial
folding to 23 kHz (ultrasonic). Audit now records `worstAudibleAliasDb` alongside
`worstAliasDb` and gates on both. Triangle untouched (−35.3 dB at 13 kHz — now the worst
audible offender; re-scoped with the ultrasonic remainder as B7b).

G4 re-blessed (saw/square band-limiting legitimately changed; sine/triangle presets
unaffected). G1 360/360 + smoke. G3 7.1x (wider correction window costs ~8%; baseline
5.7x untouched). G2 pass. Heap −24 KB.

`ITERATION 7: B7 saw/square BLEP4 — G1..G5 pass (G4 re-blessed) — backlog: 8 items (B7 re-scoped to B7b)`

### Iteration 8 — B7b: triangle 4-point polyBLAMP; alias program complete — 2026-07-07
Derived the 4-point polyBLAMP (second antiderivative of the cubic-B-spline impulse minus
the ramp; RES(0)=7/30, quintic tails). First attempt reused the BLEP pair's ×2 scale
convention and *worsened* audible aliasing to −32.7 dB — an empirical scale sweep
(×1/×2/×4 → −71.8/−32.7/−21.6 dB) showed the triangle caller's `blampScale = 8·dt`
already supplies the full slope change, so polyBlamp4 returns the **unit** residual.
The convention asymmetry is documented in the source; unit test pins corner value 7/30,
evenness, continuity, window support. The failed ×2 attempt is recorded here per
append-honesty.

**Metric deltas (f0 ≈ 5 kHz):** triangle worst alias −35.3 → −44.5 dB; worst audible
−35.3 → **−71.9 dB**. All four cases now beat the ≤ −40 dB audible target (saw −41.1,
square −55.0, triangle −71.9, fm-sine −51.3). **Ultrasonic remainder closed as a
decision, not a backlog item:** the −30 dB folds land at 20–24 kHz, below hearing, above
the DAC's own filtering, and the only post-oscillator nonlinearity (clip knee) rarely
engages — 2× oversampling would cost ~30–50% headroom for inaudible gain. Revisit only
if an always-on nonlinear stage is ever added.

G4 re-blessed (triangle presets). G1 361/361 + smoke. G3 6.8x (baseline 5.7x). G2 pass.

`ITERATION 8: B7b triangle BLAMP4 — G1..G5 pass (G4 re-blessed) — backlog: 7 items`
