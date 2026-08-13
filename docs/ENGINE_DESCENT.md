# THE ENGINE DESCENT — an iterated contraction toward the audio engine's fixed point

You are one iteration of a loop. Prior iterations may have run; future iterations will.
Your only shared memory is `ENGINE_LEDGER.md` at the repo root. **Read it before anything
else.** If it does not exist, this is iteration zero, and your duties are different (§3).

## 1. The object

The audio engine of this synthesizer:

- `sound-engine/frontend/src/audio/*.js` — the AudioWorklet processors.
  `synth-worklet.js` (~977 lines) is the monolith to decompose.
- `sound-engine/frontend/src/utils/audioEngine/` — graph construction, sample pool,
  effects, recorder.
- `sound-engine/frontend/src/utils/audioParams.js` — parameter definitions.

The goal, stated once and never re-litigated: a modular, well-factored engine — pure DSP
units with direct unit tests, one canonical parameter definition consumed by both UI and
worklet, no duplicated constants — that sounds *measurably* better and *never* regresses.

## 2. Why this loop converges: the gates

"Better" is not a vibe; it is a vector of measurables. An iterated refactor is a
contraction mapping only if every step is gated. A step that fails a gate is reverted —
no partial credit, no "mostly works." The gates:

- **G1 — Tests.** `npm test` (vitest) passes. New pure logic ships with tests.
- **G2 — Build.** `npm run build` succeeds and the dev server loads the worklets.
- **G3 — Performance.** `node scripts/bench_synth_worklet.mjs` — realtime headroom does
  not regress beyond noise (>5% sustained regression = fail).
- **G4 — Golden masters.** Deterministic offline renders of fixed phrases through every
  factory preset match the stored references (spectral distance under epsilon; report
  per-preset). A *deliberate* sound improvement may re-bless a reference, but only with a
  ledger entry stating which metric improved and by how much — never silently.
- **G5 — Quality metrics.** None regress; the iteration's target metric improves:
  - aliasing energy above the harmonic comb (extend `scripts/check_triangle_alias.mjs`
    to all oscillator modes and FM)
  - click count: max sample-to-sample discontinuity at note-on, note-off, and voice steal
  - DC offset and noise floor per preset render
  - allocation count in the hot loop (zero is the only passing value)

## 3. Iteration zero: build the apparatus, refactor nothing

If `ENGINE_LEDGER.md` does not exist, you are the instrument-maker, not the player.

1. Build the golden-master harness: a Node script (the worklet already runs headless —
   see `scripts/test_synth_worklet.mjs`) that renders a fixed set of phrases (single
   note, legato line, dense chord, fast repeated notes forcing voice steal, pitch-bend
   sweep) through **every factory preset** and writes reference renders + a metrics
   table. Determinism is a precondition: seed every stochastic element (noise, drift,
   random detune phase) or the golden master is sand.
2. Build the metrics script (`npm run audit:audio`) computing everything in G5.
3. Record the baseline table in the ledger. These numbers are the boundary conditions;
   every future iteration is measured against them.
4. Audit the engine code and seed the backlog (§6 gives the initial direction). Each
   item: one line, a value/effort guess, and the gate it will be judged by.
5. Commit. Do not refactor anything yet.

## 4. Iteration k: one step of the descent

1. Read the ledger. Pick **exactly one** backlog item — highest value-to-effort. One.
2. Implement it completely. Half-done work is potential energy with no place to go.
3. Run all gates.
4. **Pass** → one commit, message prefixed `descent(k):`, ledger updated (item moved to
   done, metrics table refreshed). **Fail** → revert the working tree, record in the
   ledger *why* it failed so no future iteration repeats the attempt blindly.
5. Re-audit only what you touched; append newly exposed backlog items. The backlog may
   grow when the audit sees deeper — that is the loop learning the true landscape, not
   divergence.
6. End your report with exactly one line:
   `ITERATION k: <item> — G1..G5 <pass|fail> — backlog: n items`

## 5. The fixed point: termination

The loop halts when all three hold:

1. The backlog is empty.
2. Two consecutive iterations discovered no new items (the dry-well condition).
3. All gates are green.

Then write `FIXED POINT REACHED` in the ledger with the final metrics table beside the
iteration-zero baselines, and say so in your report. If the loop is still running after
~25 iterations, something is wrong with the gates or the backlog granularity — say that
instead, loudly, rather than grinding on.

## 6. Direction of descent (seed backlog; iteration zero refines it)

- Decompose `synth-worklet.js` into pure DSP modules — oscillator, filter, envelopes,
  LFO, voice, mod-matrix router — each importable by both the worklet and vitest.
  Verify worklet module loading survives the Vite build (G2 exists for this).
- One canonical parameter schema: `audioParams.js` as the single source; worklet
  param handling, UI ranges, and preset sanitization all derive from it. Kill every
  duplicated constant and range.
- Quality targets, each earning its keep through G5: consistent TPT/ZDF filter topology,
  click-free everything (attack, release, steal, param jumps), alias suppression across
  all oscillator modes and FM depths, bounded analog drift that is seeded and testable.
- Keep the hot loop allocation-free JS. The bench is the referee, not your intuition.

## 7. Boundary conditions (non-negotiable)

- Never widen scope beyond the engine paths in §1. Sidebar, visuals, and the synth
  designer are different loops for a different day; if you see work there, note it in the
  ledger under "out of domain" and move on.
- Playability cannot be gated headless. If a change plausibly affects feel (latency,
  envelope timing), flag it in the ledger for a human listening pass.
- The ledger is append-honest: failed attempts, reverted commits, and re-blessed golden
  masters are all recorded. A loop that hides its failures cannot converge.
