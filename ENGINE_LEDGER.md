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
| B12 | Envelope semantics: exponential-approach coeffs mean the attack knob isn't attack time; steal-restart fades to 0 then restarts from 0.001 (no retrigger-from-level). Document/calibrate. | L/M | G4 re-bless if changed |
| B13 | Stale comments ("at 44100 Hz" for values computed from real sampleRate); CLAUDE.md says recording uses ScriptProcessorNode but recorder-worklet.js exists. Cleanup batch. | L/L | G1 |

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

### Iteration 9 — B8: REFUTED and reverted — 2026-07-07
Hypothesis: per-sample `Math.tan` in the SVF is a hot-loop cost; memoize coefficients.
Implemented exact-equality memoization (bit-exact by construction — the one-pole
smoothers converge to the target in finite float steps, after which coefficients reuse
identical inputs). Built a dedicated static-filter bench (24 voices, converged filter,
no cutoff modulation — the best case for memoization): **9.1x before, 9.1x after.**
`Math.tan` costs ~1% of the sample budget on a modern JS engine; the item's premise is
false. Reverted per §6 ("the bench is the referee") — five instance fields and two
branches that pay no measured rent are entropy, not optimization. All gates re-verified
green after revert (225/225 bit-exact). Ledger note for future perf work: profile
before hypothesizing; transcendentals are not where this engine's time goes.

`ITERATION 9: B8 refuted (null result, reverted) — G1..G5 pass — backlog: 6 items`

### Iteration 10 — B9: setParams allocation churn eliminated — 2026-07-07
Mod routes now compile **once per setParams** at the processor into a shared immutable
template (`routesBox`); each voice keeps only a persistent `depthSmoothed` +
scratch Float32Array and carries matching depths across route swaps without allocating.
Note-on no longer compiles routes either (it previously allocated 3 typed arrays + an
object per note). Steal-fade nuance documented in code: a pending start now picks up the
freshest compiled routes rather than a snapshot — observable only if setParams lands
inside a 5 ms fade.

**Measured (5000-drag + 2000-retrigger churn bench, 24 held voices):** allocation volume
13.0 MB → 0.6 MB (−95%; remainder is param-object spreads, not route state). CPU time
unchanged (2.2 s) — the win is GC-pause risk during live tweaking, not throughput.
G4 225/225 bit-exact. G1 361/361 + smoke. G3 6.7x. G5 heap −25 KB. G2 pass.

`ITERATION 10: B9 route-compile dedup — G1..G5 pass (G4 bit-exact) — backlog: 5 items`

### Iteration 11 — B11: apparatus extended to delay + reverb worklets — 2026-07-07
`audit:audio` now golden-gates the FX worklets: 7 self-contained cases (delay
digital/tape/ping-pong/stress, reverb hall/plate/ambient-max), sine-burst stimulus,
**both channels captured** (per-channel metrics + fingerprints + interchannel
correlation, gated at ±0.05) — this is also the stereo-capture groundwork B10 needs.
FX cases define their own param sets (the audit can no longer import
utils/audioEngine/worklets.js — it carries the ?worker&url specifier only Vite can
parse). Both worklets verified deterministic; FDN double-render self-check added.
Fix recorded honestly: first version ran at module level before `failures` initialized
(TDZ crash in compare mode only — bless mode masked it); restructured into a function
called from the main flow.

**Discovery — new B15 (H/M):** the delay self-oscillates at max legal settings
(loop gain ≈ 7 at feedback+crossfeed 0.96 through tanh drive; tailRms 0.87 ≥ rms 0.78,
peak 1.51, UI-reachable at feedback 0.92 + age 0.4). Reverb ambient-max tail decays
cleanly (0.004 after 4 s). G1 361/361, G4 225/225 bit-exact + 7 fx cases blessed,
G3 6.8x, G2 pass.

`ITERATION 11: B11 FX apparatus — G1..G5 pass — backlog: 5 items (B15 added, B11 done)`

### Iteration 12 — B15: delay feedback loop made contractive — 2026-07-07
The tanh drive stage in the delay's feedback path is now normalized to unity
small-signal gain (`tanh(x·g)/g` — drive adds saturation color, no longer multiplies
every repeat by up to 3.8×), and combined feedback+crossfeed recirculation is capped at
0.96, so the loop is strictly contractive at any legal settings.

**Metric deltas:** delay-stress sustained rms −2.1 → −18.6 dBFS, tail 0.873 → 0.0017
(drone → decaying echoes); peak no longer exceeds unity (+3.6 → −3.0 dBFS). Tape case
−6.6 dB rms (its drive 0.18 was regenerating repeats); digital/pingpong ≈ −1 dB.
Feedback knob now means what it says. FX goldens re-blessed (4 delay cases); reverb +
synth goldens untouched (225/225 bit-exact). New `delay-worklet.test.js` pins
decay-at-max-settings and audible-repeats-at-moderate-settings (G1 363/363). In-app:
echoes decay to 1.7e-5 by 4.5 s on the live session patch. G3 6.6x, G2 pass.

`ITERATION 12: B15 delay loop bounded — G1..G5 pass (G4 fx re-blessed) — backlog: 4 items`

### Iteration 13 — B10a: synth goldens go stereo (schema v2) — 2026-07-07
Split B10 deliberately: apparatus first, engine second — so a future correlation change
can't confuse apparatus bugs with engine bugs. `renderPhrase` now captures both
channels; each phrase golden records per-channel hash/metrics/fingerprints plus
interchannel correlation (gated ±0.02). While the engine is mono, the audit asserts
L hash-equals R on every render — pinned green across all 225 (the assertion gets
removed as part of B10b, on purpose, in the same commit that makes the engine stereo).
All 45 preset goldens re-blessed to schema v2 (bit-identical audio, new record shape).
G1 363/363, G4 225/225 bit-exact under dual-channel comparison, G3 6.7x, G2 pass.

`ITERATION 13: B10a stereo apparatus — G1..G5 pass (schema v2) — backlog: 4 items (B10 → B10b)`

### Iteration 14 — B10b: the engine goes stereo — 2026-07-07
Unison sub-voices now pan equal-power across a fixed 0.8 spread (√2-normalized: a
centered sub-voice has unity gain, so single-voice notes render **bit-identically** on
both channels via the mono-copy fast path — no cost, no drift). Spread voices get a true
stereo filter pair (the R filter only runs when unison > 1); the master chain is fully
per-channel (2× DC blocker, per-channel clip knee). The audit's L==R mono assertion
removed in this same change, as planned in iteration 13.

**Result:** 30/45 factory presets now have real stereo width — the CS-80/pad unison
patches are widest (chord-phrase correlation 0.21–0.26: taurus-fog, cs80-velvet,
blade-runner-blues, fairlight-air, ribbon-fall); 15 non-unison presets measure
correlation exactly 1.0. New vitest pins mono-voice bit-identity and unison
decorrelation with channel balance. G4 re-blessed (unison presets drift on both
channels + correlation; mono presets bit-exact). G1 364/364 + smoke. G3 6.1x (stereo
filter pair costs ~9%; baseline 5.7x respected). G2 pass. In-app boot + note verified.

`ITERATION 14: B10b engine stereo — G1..G5 pass (G4 re-blessed) — backlog: 3 items`

### Iteration 15 — B14: legato-only glide mode — 2026-07-07
New engine param `glideMode` (0 = always glide from the last note — the historical
behavior and the default; 1 = legato-only: glide engages only while another non-releasing
note is held, so staccato retriggers start on pitch). The gate lives in the processor's
noteOn, which can see the other voices' envelope stages; `glideFrom: 0` is the existing
"no glide source" convention in Voice.start. Param plumbed through DEFAULT_PARAMS →
AUDIO_PARAM_DEFAULTS (derived) → ranges table (integer) → toWorkletParams; the
defaults-agreement pin keeps all copies in lockstep. Vitest covers both directions
(staccato starts fast at 440 Hz; overlap glides from 110 Hz). Presets/UI can adopt
`glideMode: 1` freely; out-of-domain note: a Glide-mode toggle in AudioControls is
synth-designer-loop work, not engine work.

G4 225/225 bit-exact (default 0). G1 365/365 + smoke. G3 6.1x. G2 pass.

`ITERATION 15: B14 legato glide — G1..G5 pass (G4 bit-exact) — backlog: 2 items`
