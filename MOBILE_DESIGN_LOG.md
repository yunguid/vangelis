# Mobile Design Loop — Log

Working memory for the autonomous mobile-design loop. Protocol: `MOBILE_DESIGN_LOOP.md`.
Neither file gets committed.

## Iteration 1 — 2026-07-06 — Un-break the phone viewport (commit 215adb6)

**Changed:**
- WaveCandy grid reflows at ≤900px to two fluid panes (scope + spectrum); spectrogram/goniometer/meter hidden (`candy-tile--*` modifier classes added in WaveCandyCanvas.jsx).
- `html { overflow-x: clip }` guard (variables.css).
- Sidebar never restores open on phones (App.jsx init, matchMedia ≤900px, jsdom-guarded).
- viewport-fit=cover + theme-color meta; 100dvh preference for #root/app-stage/app-shell; safe-area insets on .app-notice.

**Evidence:** Before: at 390×844 the layout viewport expanded to 828×1792 (zoom-out-to-fit
driven by WaveCandy's 780px of fixed grid minimums), whole UI rendered ~0.47× and soft,
fixed bottom rail landed off-screen at y:1726, app booted behind the open MIDI sheet.
After: innerWidth=390, scrollWidth=390, rail pinned at y:778, crisp render, sidebar closed
on boot. Landscape 844×390 clean (no overflow). Desktop 1440×900 unchanged (all 5 panes,
left rail). 337/337 tests pass, console clean.

**Preview-harness note:** screenshots at phone sizes include dead gray space right of the
390px app column (emulated viewport smaller than window) — ignore it, it is not the app.
`preview_resize` emulates media queries/clientWidth correctly; `window.innerWidth` and
fixed-element sizing follow real content-overflow behavior, which is what real phones do too.

**Backlog (ranked):**
1. **Portrait IA / hero keyboard** — keyboard is a 120px strip at y~332 with a huge dead
   zone beneath it before the bottom rail. Make the keyboard tall and thumb-playable,
   use the dead zone (preset quick-switcher? octave/velocity controls?). Hide desktop
   key-shortcut labels on touch (coupled: A-;/W-P letters rendered on keys are noise).
2. **On-screen octave/velocity controls** — Z/X and C/V are keyboard-only; touch users are
   locked to one octave at fixed velocity (useKeyboardInput.js:40-48, :20-27). Place in
   thumb reach near the keyboard.
3. **Sticky hover states** — unguarded `:hover` transforms on keys (keyboard.css:109,182),
   segment buttons (components.css:223), toggle pills (:358), preset chips (:632). Wrap in
   `@media (hover: hover)`.
4. **Touch-target sizes** — mod-route remove 28×28 (components.css:786), toggle pills 32px
   (:347), rail buttons 38px at ≤520 (Sidebar.css:1219), MIDI player buttons 36px
   (Sidebar.css:1177), preset steps 40px wide (:501), segment buttons 42px (:212).
5. **iOS zoom-on-focus** — inputs at ~12.5px font (components.css:768, search/name inputs).
   Use ≥16px on text inputs at phone sizes.
6. **Landscape instrument mode** — no orientation/height queries anywhere; at 844×390 the
   keyboard is a 40px-tall sliver and the sidebar sheet clips (72vh rules,
   Sidebar.css:1131). Consider: keyboard-dominant landscape layout, WaveCandy hidden below
   ~500px height.
7. **Mobile perf tier** — WaveCandy uncapped DPR + 5-canvas RAF (WaveCandyCanvas.jsx:367-467;
   hidden tiles now have 0-size canvases but loop still runs), Scene shader 10-vortex/8-band
   loops (Scene.jsx:76,92; DPR already capped 1.25), BirdsEyeRadar shadowBlur per note +
   RAF-when-hidden, EffectMacroDial always-on RAF per dial, MidiBirdsEyeView unthrottled.
8. **Sheet ergonomics** — bottom sheet max-heights use vh not dvh (Sidebar.css:1131,1227);
   add overscroll-behavior contain/none (body + panel); pull-to-refresh guard.
9. **Header on mobile** — tiny cryptic +/O/? buttons, Reset prominent while Record is
   invisible-ish. Rework header hierarchy for phones.
10. **Small-Android pass** — verify 360×740 after items 1-2 land.

**Next:** Item 1 + 2 together (portrait IA: hero keyboard + on-screen octave/velocity)
— they share the same layout surgery. Item 3 (hover guards) as a cheap rider if diff
stays reviewable.

**Dry streak:** 0
