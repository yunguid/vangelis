# Mobile Design Perfection Loop — Vangelis

This file is the standing protocol for an autonomous design loop. Each loop iteration
reads this file and `MOBILE_DESIGN_LOG.md`, executes ONE iteration of the protocol
below, commits, updates the log, and schedules the next iteration.

## Mission

Make the mobile experience of the Vangelis web synth **stunning** — not merely
functional. A mobile-first rethink is in scope: the loop may restructure layout for
small screens (bottom sheets, collapsible panels, a mobile control rail, mobile-first
navigation) as long as desktop is untouched or improved.

- **Primary target:** portrait phone, 390×844.
- **Verified every iteration:** landscape phone, 844×390 (the natural "instrument" orientation).
- **Periodic check:** small Android, 360×740.
- **Regression gate:** desktop 1440×900 must not degrade — verify before every commit.
- **Scope order:** the main synth view (keyboard, AudioControls, PresetShelf, Sidebar,
  overlays, visualizers) comes first. Secondary pages (SongStudy, VoiceLoopLab,
  MidiPipeline, StudySongs) enter the backlog only after the main view is excellent.

## Design mandate — the north star

The app's identity is CS-80 / Blade Runner / synthwave. On a phone it should feel like
a beautiful piece of hardware in your hand, not a shrunken desktop page:

- **The keyboard is the hero.** Prominent, thumb-playable, glissando works, octave
  shifting reachable without leaving playing position.
- **Touch-first controls.** Desktop key shortcuts (A–;, Z/X octave, C/V velocity,
  Space record) are meaningless on touch — mobile needs on-screen equivalents placed
  in thumb reach (bottom of screen). Bottom sheets / tab bars beat sidebars on portrait.
- **Ergonomics per platform HIG:** ≥44×44px touch targets; `touch-action: manipulation`
  on controls (no double-tap zoom); no sticky `:hover` states — use `:active` /
  `@media (hover: hover)` guards; ≥16px font-size on inputs (avoids iOS focus-zoom).
- **Modern viewport discipline:** `100dvh` not `100vh`; `env(safe-area-inset-*)` with
  `viewport-fit=cover` in the meta tag; zero horizontal overflow at any target size.
- **Type & spacing that breathe:** fluid type via `clamp()`, deliberate rhythm, no
  cramped 10px labels. The gruvbox/synthwave palette stays; contrast stays accessible.
- **Motion with restraint:** framer-motion is already a dependency — use it for sheet
  transitions and micro-interactions; always respect `prefers-reduced-motion`.
- **Performance is part of beauty:** the WebGL Scene and WaveCandy visualizers must not
  chug on mobile GPUs. A reduced-quality tier for small screens is acceptable and
  encouraged if it keeps 60fps feel.

## Non-negotiable guardrails

1. **Never touch the DSP:** nothing under `sound-engine/frontend/src/audio/`
   (worklets), no preset parameter values, no MIDI generation scripts.
2. **Desktop must not regress.** Screenshot 1440×900 before every commit.
3. **Never commit broken state:** `npm test` (in `sound-engine/frontend/`) must pass
   and the preview console must be free of new errors before committing.
4. **No new heavy dependencies.** Work with what's installed (framer-motion, three, tailwind).
5. **Small, coherent iterations:** 1–3 shippable improvements per iteration with one
   theme, not a mega-refactor. (Exception: iteration 1 may lay a structural skeleton.)
6. **Only the main loop touches the preview browser and git.** Sub-agents never do.
7. **Commit on `main`,** message describes the design change and the evidence, ends with
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Stage explicit paths under
   `sound-engine/frontend/` only — never `git add -A`; never commit `AGENTS.md`,
   `MOBILE_DESIGN_LOOP.md`, or `MOBILE_DESIGN_LOG.md`. No pushing.

## Iteration protocol

1. **Orient.** Read `MOBILE_DESIGN_LOG.md`. Pick this iteration's theme: the top-ranked
   backlog item(s), or a fresh critique pass if the backlog is thin.
2. **See the current state.** Ensure the dev server is running (`preview_start`,
   `npm run dev` in `sound-engine/frontend/`). Resize to 390×844. Screenshot the states
   relevant to this iteration's theme — on the first iteration, baseline ALL of them:
   first load, keyboard, AudioControls (each section incl. mod matrix), PresetShelf,
   Sidebar open (MIDI tab + player, Samples tab), waveform overlay, shortcuts overlay,
   recording state, visualizers running. Repeat key states at 844×390.
3. **Critique like a designer.** Judge the screenshots yourself against the mandate.
   In parallel, fan out **read-only Explore sub-agents** for code-level audits that
   don't need a browser, e.g.: touch-target + hover-state audit across components;
   viewport/safe-area/overflow audit across `src/styles/`; breakpoint-coherence audit
   (do 1200/900/700/640/520 tell one story?); mobile-perf audit of Scene.jsx +
   WaveCandy (per-frame allocations, resolution scaling, devicePixelRatio caps).
4. **Decide.** Merge critique + audits into ranked findings (impact on the mobile
   feel × effort). Pick the top 1–3. Record the rest in the log's backlog.
5. **Implement.** Small diffs: main loop edits directly. Larger independent
   workstreams: dispatch implementation sub-agents **in parallel only when their file
   sets are disjoint**; each brief must be self-contained (exact paths, design intent,
   guardrails, "do not touch preview or git"). Otherwise work sequentially.
6. **Verify.** Reload; screenshot 390×844 and 844×390 for the changed states; check
   `preview_console_logs` for new errors; exercise touch flows that changed
   (`preview_click`/`preview_snapshot`); screenshot 1440×900 for desktop regression;
   run `npm test`.
7. **Commit** per the guardrails — only if verification passed.
8. **Record.** Append to `MOBILE_DESIGN_LOG.md`:

   ```
   ## Iteration N — <date> — <theme>
   **Changed:** …
   **Evidence:** what the before/after screenshots showed
   **Backlog (ranked):** …
   **Next:** the single most promising theme for iteration N+1
   **Dry streak:** 0|1|2  (consecutive iterations with no high-impact finding shipped)
   ```

9. **Continue or stop.** If the dry streak reaches 2, write a closing summary in the
   log and END the loop (do not schedule another iteration). Otherwise schedule the
   next iteration promptly — the work is continuous, so short delays are right.

## Suggested early backlog (validate against actual screenshots first)

- `index.html` viewport meta lacks `viewport-fit=cover`; audit for `100vh` vs `100dvh`.
- Portrait information architecture: what replaces the sidebar on a phone? (bottom
  sheet / tab bar / swipe-up panel)
- On-screen octave/velocity/record controls for touch users.
- Keyboard key sizing and octave-range choice at 390px width.
- Whether Scene + WaveCandy need a mobile quality tier.
