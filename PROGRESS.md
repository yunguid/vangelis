# Vangelis Improvement Loop — PROGRESS

Mission: radically improve the audio engine, audio visualization, and UI.
Branch: `improve/engine-viz-ui` (off `main`). Every cycle ends with a working, committed build.

## Ground truth (verified against live code, 2026-06-09)

All prior-audit claims confirmed:

- **Dead WASM**: `sound-engine/audio-engine/` (743 LOC Rust) is compiled by `scripts/vercel-build.sh`
  (which installs the full Rust toolchain + wasm-pack on *every* deploy) into `public/pkg/`, whose
  only consumer is a `<link rel="modulepreload">` in `index.html` — the browser downloads the glue
  but **nothing imports it**. `status.wasmReady` is set when the AudioWorklet loads (misnomer).
- **Worklet** (`src/audio/synth-worklet.js`, 607 LOC): PolyBLEP saw/square; naive triangle; single
  sine FM modulator; sine-only LFO with 3 hardcoded targets; no mod matrix, no pitch bend, no glide;
  flat velocity multiplier; fixed 24-voice pool with score-based stealing.
- **Visualization**: `Scene.jsx` = static CSS gradient (three.js + @react-three/* in package.json,
  unused for it). `WaveCandy` = Raylib/WASM panel with `WaveCandyCanvas` (Canvas 2D, linear FFT
  binning) as fallback. Three analysers in `graph.js` (1024 + 2× 2048).
- **UI**: `App.jsx` 731 lines / 20 useState, heavy prop drilling; native range inputs in
  `AudioControls.jsx`, `MidiPlayer.jsx`, plus pages; presets clipboard-only.

## Plan (re-sequenced)

| # | Item | Status |
|---|------|--------|
| A | Resolve WASM lie → **delete dead Rust**, fix docs/build (decision below) | in progress |
| B | Modulation matrix in worklet + UI | pending |
| C | WebGL2 audio-reactive shader background replacing static Scene.jsx | pending |
| D | PolyBLAMP triangle + richer oscillators (supersaw path exists via unison; evaluate wavetable) | pending |
| E | Glide/portamento, pitch bend, velocity curves → amp + filter/FM | pending |
| F | Perceptual (log-freq, dB) spectrum + smoothing; goniometer/metering pass | pending |
| G | App.jsx → contexts; one accessible knob/slider primitive everywhere | pending |
| H–K | Tier 3 (FDN reverb / multi-op FM / voice alloc / preset browser / signal-flow UI) | budget-dependent |

## Decisions & rationale

### F/viz: retire the Raylib/WASM WaveCandy path (decided cycle 1, implement after verification)
- The panel is a 328KB Emscripten blob (C source in `frontend/raylib/wavecandy.c`) that needs an
  emcc toolchain to iterate; the JS fallback (`WaveCandyCanvas`) renders the same panels.
- Per-frame cost: three analysers copied + linearly resampled into WASM heap views every 42ms.
- `RAYLIB_DPR = 1` hard-locks it to CSS pixels — soft/blurry on every retina display.
- Item F (log-frequency spectrum, dB scaling, phosphor goniometer, metering) would have to be
  implemented twice or only in C. Canvas 2D comfortably does 5 panels at this size at 60fps.
- Plan: upgrade `WaveCandyCanvas` per item F, make it primary, delete `RaylibWaveCandy.jsx` +
  `public/raylib/` + `frontend/raylib/` (same one-language thesis as the Rust deletion).

### A. WASM: delete the Rust path (decision pending benchmark, see below)
Rationale gathered so far:
1. The crate doesn't implement the current worklet feature set (no unison, no steal-fade, no
   worklet param protocol) — "moving the hot loop to Rust" is a rewrite, not a port.
2. Items B/D/E mean months of churn *inside* the DSP loop; one JS file iterates 10× faster than a
   dual-language build with wasm-bindgen plumbing through `processorOptions`.
3. Every Vercel deploy currently pays `rustup + cargo install wasm-pack + wasm-pack build` (~minutes)
   for an artifact that is never executed. Deleting it speeds deploys dramatically.
4. Benchmark (below) to confirm JS has the headroom.

## Cycle log

### Cycle 1 (2026-06-09) — in progress
- Verified ground truth (above). Created branch `improve/engine-viz-ui`.
- **A (WASM removal)**: stripped Rust toolchain install from `scripts/vercel-build.sh` and
  `build-pages.sh`; removed dead `modulepreload` of `pkg/sound_engine.js` from `index.html`;
  rewrote CLAUDE.md architecture section. Crate + `public/pkg` deletion and benchmark numbers
  pending (sandbox exec was temporarily unavailable; scripts are written:
  `scripts/bench_synth_worklet.mjs`).
- **D (triangle)**: polyBLAMP corner-rounding added to the worklet triangle, paired with the
  existing 2-point polyBLEP. Numeric alias check: `scripts/check_triangle_alias.mjs`.
- **B (mod matrix, engine + UI)**: implemented in `synth-worklet.js`:
  - 7 sources (LFO1/LFO2 with 6 shapes incl. S&H, amp env, dedicated mod env, velocity,
    key-track, mod wheel) → 5 destinations (pitch ±12st, cutoff ±4oct, amp ±1,
    FM index ±10rad, unison detune ±50¢), ≤8 routes, per-route depth −1..1,
    ~20ms depth smoothing that survives live edits (carry-over by src/dst match).
  - Legacy `lfoRate/lfoDepth/lfoTarget` are compiled into equivalent implicit LFO1 routes —
    old presets and the existing UI keep their exact sound.
  - Routes flow UI → `sanitizeAudioParams` (new `sanitizeModRoutes`) → `toWorkletParams` →
    worklet `compileModRoutes` (typed arrays for the hot loop).
  - UI: route editor + LFO shapes/rates + mod-env ADSR in the Modulation section of
    AudioControls (existing control primitives; accessible labels on all inputs).
  - Fixed `paramsSignature` to deep-serialize objects — route edits were otherwise deduped
    into "[object Object]" and never reached the audio thread.
- **E (playability, engine)**: glide (exp slew from last note, 0–2s), pitch bend + mod wheel
  as dedicated worklet messages (`setPitchBend`/`setModWheel` on engine), velocity curve
  velocity^(2^(2·curve)). UI: glide + velocity-curve sliders. MIDI bend/CC wiring still todo.
- **C (shader background)**: `Scene.jsx` replaced with a WebGL2 fragment-shader
  audio-reactive background (domain-warped fbm aurora, gruvbox ember/aqua palette to match
  the current theme). Feeds off the master analyser with fast-attack/slow-release band
  followers (bass/mid/high/level). DPR capped at 1.25, `powerPreference: low-power`,
  pauses when tab hidden. Fallbacks: no WebGL2, shader compile failure, context loss, or
  `prefers-reduced-motion` → original static gradient div (kept as underlay).

### Cycle 1 continued (exec outage persisted >1h; additional isolated work)
- **F (perceptual visualizers)**: `WaveCandyCanvas.jsx` rewritten — log-frequency (20Hz–18kHz)
  peak-preserving spectrum with dB scale (−70dB floor), per-cell attack/release ballistics,
  octave/dB gridlines; log-frequency spectrogram with ember color ramp; zero-crossing-triggered
  oscilloscope; goniometer rotated to mid/side with phosphor persistence (additive blend,
  fading trails); short-term loudness meter (400ms RMS window, LUFS-style) with 1.5s peak hold
  + 12dB/s decay and dB tick marks.
- **Raylib retirement executed in code**: `WaveCandy.jsx` now renders the Canvas suite directly;
  no remaining imports of `RaylibWaveCandy`. File + `public/raylib/` + `frontend/raylib/`
  deletion deferred to the cleanup commit (needs git).
- **E (hardware input)**: new `useWebMidiInput` hook — Web MIDI note on/off with velocity,
  pitch-bend wheel → `setPitchBend` (±2 st), CC1 → `setModWheel`, CC123 all-notes-off, device
  connect notices, merged keyboard highlighting in App. Degrades silently without Web MIDI
  (Safari). **Deferred**: scheduling pitch-bend events parsed from MIDI *files* — bend is
  global per-synth while files are multi-track; applying every track's bend curve to one
  global wheel would be wrong more often than right, and per-track bend needs per-channel
  voice groups (Tier-3 scope).

### Cycle 1 continued (2) — item G (user directive: push through, deprioritize tests, ship ASAP)
- **G1 (accessible control primitive)**: new `components/controls/ValueSlider.jsx` —
  role="slider" with full ARIA (valuemin/max/now/text, label/labelledby), pointer drag with
  capture + click-to-jump, arrow-key nudge with Shift=fine (step/10), PageUp/Down=coarse,
  Home/End, hover mouse-wheel nudge, double-click→default, visible focus ring, disabled state.
  Visuals match the existing range styling (gradient track + 18px thumb via --slider-progress).
  Replaced every native range in the product surface: all AudioControls sliders (with
  double-click-to-default wired to AUDIO_PARAM_DEFAULTS), mod-route depth, MidiPlayer tempo.
  Deferred: native ranges in the secondary lab pages (SongStudy/VoiceLoopLab) — separate
  surfaces, mechanical follow-up.
- **G2 (contexts)**: new `context/SynthContexts.jsx` with three focused contexts —
  SoundControls, MidiTransport, VoicePhrase. App provides memoized values; Sidebar consumes
  via hooks. Sidebar's prop list dropped from ~37 to 8 (layout + samples only). Hooks are
  tolerant (empty-object fallback) so the lab pages' provider-less disabled rails keep working.
  Tab components untouched — refactor confined to App, Sidebar/index, and the context file.

### Cycle 1 continued (3) — presets + doc accuracy
- **J-lite (presets)**: `utils/presetStorage.js` + `components/PresetShelf.jsx` in the Sound
  tab — 4 factory patches that exercise the mod matrix (Vapor Keys, Acid Drift, FM Bell,
  Wide Anthem) + named user presets in localStorage (save/apply/delete). Replaces
  clipboard-only workflow (clipboard shortcuts still work).
- **CLAUDE.md**: structure corrected (ghost `PresetManager.jsx` removed; ValueSlider,
  contexts, useWebMidiInput, PresetShelf documented; synthesis feature list updated).

### Deferred (with justification)
- **H (FDN reverb / multi-op FM)**: engine pile is already large and unverified due to the
  exec outage; both are deep DSP rewrites that should land on a verified baseline.
- **I (CPU-aware voice allocation)**: benchmark (pending) is expected to show large JS
  headroom at 24 voices; dynamic allocation solves a problem we likely don't have.
- **K (signal-flow control surface)**: superseded in spirit by the mod-matrix editor;
  full node-graph UI is a redesign, not an increment.
- **MIDI-file pitch-bend scheduling** and **lab-page slider swap**: see earlier notes.

**Ship checklist (exec-blocked tail)**: run smoke tests → `npm run build` → browser sanity →
`git rm` dead Rust (`sound-engine/audio-engine/`, `public/pkg/`), Raylib
(`RaylibWaveCandy.jsx`, `public/raylib/`, `frontend/raylib/`) → chunked commits → push.

**Verification status**: all changes are edit-complete but NOT yet executed — the sandbox
command runner was down for most of this cycle. Next actions, in order:
1. `node scripts/test_synth_worklet.mjs` (new engine smoke suite: playback, release-to-silence,
   all waveforms, FM/filter/unison, legacy LFO tremolo, wheel→pitch route, bend, glide,
   velocity curve, 64-note steal flood)
2. `node scripts/check_triangle_alias.mjs`, `node scripts/bench_synth_worklet.mjs` (record numbers here)
3. `npx vitest run` + `npm run build`
4. Browser verification (load app, play notes, check shader + mod matrix)
5. Delete `sound-engine/audio-engine/` + `public/pkg/`, then commit in logical chunks + push.
