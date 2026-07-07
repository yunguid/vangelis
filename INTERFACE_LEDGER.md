# INTERFACE LEDGER

Shared memory for the INTERFACE_PURGE loop (see `INTERFACE_PURGE.md`). Every iteration
reads this first and updates it last. Append-honest: failures, reverts, and user vetoes
are recorded, never erased. Successor to ENGINE_DESCENT (see `ENGINE_LEDGER.md`), whose
engine work is frozen and out of scope here — this loop is UI/UX only.

## Gates — how to run (from `sound-engine/frontend/`)

| Gate | Check | Command |
|------|-------|---------|
| G1 | Tests pass | `npm test` |
| G2 | Build passes; dev server boots; zero new console errors | `npm run build` (+ manual/preview-tool boot check) |
| G3 | Engine untouched: audio golden apparatus stays 225/225 bit-exact. UI iterations never edit `src/audio/` or `utils/audioEngine/` (exception: deleting samples code, staged, with the audit green after) | `npm run audit:audio` |
| G4 | Screenshot every visual iteration (preview tools), saved and shown in the report. The user is the aesthetic oracle: a veto in any future message = revert that item | (manual, preview tools) |
| G5 | Tell census strictly decreases until zero | `npm run audit:ui` |

Fail a gate -> revert the working tree, record why in the ledger.

## Baseline census — iteration 0, 2026-07-07

Produced by `scripts/audit_ui_tells.mjs` (`npm run audit:ui`), scanning
`src/**/*.{css,jsx,js}`, skipping `*.test.*` files and the frozen engine paths
(`src/audio/`, `src/utils/audioEngine/`). Full per-line listing is in the script's
stdout (re-run any time — it's a census, not a stored artifact).

| Category | Count | What it counts |
|----------|------:|-----------------|
| Gradients | 45 | `linear-gradient(` / `radial-gradient(` / `conic-gradient(` |
| Glow shadows | 37 | `box-shadow` with an rgba/hsla color + blur >= 12px, or "glow" in an identifier/custom-property |
| Pill radii | 82 | `border-radius` > 8px (px values), plus `999px`/`9999px` pill tokens (`50%` radii listed separately for human review, uncounted — mostly genuine circles) |
| Chips & tags | 41 | identifiers/class names matching `/tag\|chip\|badge\|pill/i` (file:line listed for human judgment — includes some false positives, e.g. DOM `tagName`, canvas variable names `chipX`/`chipY`) |
| Animated dots | 22 | `@keyframes`/`animation`/class names matching `/pulse\|blink\|dot/i`, or bullet characters in JSX |
| "Vangelis Studio Original" / "Studio Original" | 1 | literal string occurrences in `src/` + `public/` |
| **TOTAL** | **228** | |

Heaviest offending files (from the listing): `src/components/Sidebar/Sidebar.css`,
`src/styles/components.css`, `src/styles/keyboard.css`, `src/pages/MidiPipelinePage.css`,
`src/pages/SongStudyPage.css`, `src/pages/StudySongsPage.css`. These six carry the large
majority of gradients/glows/pill-radii and are P4's real scope.

G5 target: this number must strictly decrease every iteration until zero.

## Refined backlog

Seed items P1-P9 from `INTERFACE_PURGE.md` §5, refined against the actual code (files
found via direct grep + a research pass, iteration zero).

| id | item | concrete files | value/effort |
|----|------|-----------------|---------------|
| P1 | Kill song-row tags + classification borders in the MIDI browser | `src/components/Sidebar/MidiTab.jsx` — `splitTag()` (lines 34-37) parses `"Title (Tag)"` and renders `<span className="midi-tab__badge">{tag}</span>` (lines 151, 160-163); group header also renders a count chip (`midi-tab__group-count`, lines 145-147). CSS: `.midi-tab__badge` (`Sidebar.css:477-489`, `border-radius: 999px` pill + orange border), `.midi-tab__group-count` (`Sidebar.css:351-355`, plain text already, low priority). Pure deletion per the mandate: stop rendering the tag span; the `(Tag)` substring stays embedded in the *name* string in data (`midiParser.js` `ORIGINAL_CUES`) until P5 touches names — deleting the render only removes the visual chip, not the parenthetical text next to the title unless `splitTag`'s `title` is used instead of raw `file.name`, which it already is (line 161 renders `title`, not the composed string) — so the visual, not the data, is the fix. | high value / low effort |
| P2 | Delete "Vangelis Studio Original" text everywhere | Single occurrence: `src/utils/midiParser.js:261`, `composer: 'Vangelis Studio Original'` (assigned to every entry built from `ORIGINAL_CUES`, ~58 files). Grep confirms zero other occurrences in `src/` or `public/`. Decide replacement composer string (mandate says "deleted", not "replaced" — likely blank/omitted composer field for originals, needs a UI check for how `file.composer` renders when empty in `MidiTab.jsx:164`). | high value / trivial effort |
| P3 | Kill recording-dot indicators | `src/components/AppHeader.jsx` — record button at line 178 (`record-button ${resolvedIsRecording ? 'recording' : ''}`), glyph-only (`O`/`\|\|`), not itself a dot. CSS: `.record-button.recording` (`components.css:455-459`) triggers `animation: recordPulse 1s ease-in-out infinite` (`@keyframes recordPulse`, lines 465-472, animated box-shadow ring). `.recording-indicator` + `@keyframes blink` (lines 474-483) are **dead CSS** — zero JSX references — can be deleted outright as a freebie. Separate, unrelated: Voice Loop Lab page has its own `.voice-loop-status__dot` + `voice-loop-status-pulse` keyframe in `src/pages/VoiceLoopLabPage.jsx`/`.css` — same tell category, out of the mandate's explicit scope (that's a different page) but counted in the census; note for future item if the user wants it too. | medium value / low effort |
| P4 | Purge gradients, glows, pill borders across sidebar + pop-out; apply §2 language | The big one, confirmed by census concentration: `src/components/Sidebar/Sidebar.css` (18 gradients/glows/radii combined), `src/styles/components.css`, `src/styles/keyboard.css`, `src/styles/controls.css`, `src/styles/layout.css`, `src/styles/overlays.css`, `src/styles/wave-candy.css`, `src/styles/responsive.css`, plus the "pop-out" pages' own CSS: `src/pages/MidiPipelinePage.css`, `src/pages/SongStudyPage.css`, `src/pages/StudySongsPage.css`, `src/pages/VoiceLoopLabPage.css`. "Pop-out page" resolved: there is no `window.open`; `src/main.jsx` hash-routes to full-page components (`src/utils/routes.js`) that are deliberately **hidden from primary navigation** (`AppHeader.jsx:5` comment: "pages are hidden from navigation (routes still exist if linked directly)") — `MidiPipelinePage.jsx` is the most likely candidate (it renders `AppHeader` + `Sidebar` itself and is linked from `StudySongsPage.jsx:102`). Should split by surface per the mandate's own suggestion — sidebar first (smaller, self-contained), pop-out pages after. | high value / high effort (split across iterations) |
| P5 | Rename all originals to odd codes | Master name list: `src/utils/midiParser.js`, `ORIGINAL_CUES` array, **lines 197-256** (58 `[id, name]` pairs, e.g. `['original-neon-cathedral', 'Neon Cathedral (Anthem)']`); consumed at lines 257-262 to build `originalFiles`. Parallel copy: `scripts/generate_original_midis.mjs` defines its own `id`/`name` per composition (e.g. lines 158-159 `id: 'original-neon-rain'`, `name: 'Neon Rain (Synth Blues)'`) used to render the 58 `.mid` files into `public/midi/originals/` (confirmed 58 files present, matching). **Two sources of truth for the same 58 names** — a deterministic generator seeded from the old name must update both, or `midiParser.js` must derive its display list from a shared manifest so they can't drift. Renaming also organically resolves P1's `(Tag)` chip source (new codes like `bx-41` carry no parenthetical) — sequence P5 before/with P1 to avoid duplicate work on the same strings. | high value / medium-high effort (needs a deterministic naming scheme + touches 2 files + regenerates a manifest) |
| P6 | Sidebar sounds-list rework | `src/components/Sidebar/index.jsx` (tab rail + panel shell, tabs array lines 94-130), `src/components/Sidebar/SoundTab.jsx` (the "Sound" tab — likely destination for designed sounds per P8), `src/components/Sidebar/MidiTab.jsx` (list density/structure), `src/components/Sidebar/Sidebar.css` (1140+ lines, the bulk of P4's pill/gradient counts also live here — P4 and P6 will touch the same file; sequence paint (P4) before structure (P6) or vice versa deliberately, don't let them race). | high value / high effort |
| P7 | Sound-designer page scaffold | New route/page needed: add to `src/utils/routes.js` (new `SOUND_DESIGNER_ROUTE`/`HREF` + `isSoundDesignerRoute`), wire into `src/main.jsx`'s `Root` switch, new `src/pages/SoundDesignerPage.jsx` (+ `.css`) modeled on `MidiPipelinePage.jsx`'s self-contained-page pattern (renders its own `AppHeader`). Reuses `src/components/AudioControls.jsx` (the full synth-param surface already exists) and `src/components/SynthKeyboard/` (keyboard test strip already exists as a component) — this item is composition of existing pieces into a new page shell, not new DSP/audio work. Multi-iteration per the mandate. | high value / high effort (multi-iteration) |
| P8 | Designed sounds save + appear in sidebar sound page | Pipeline: `src/components/PresetShelf.jsx` (existing save/load UI, localStorage-backed) + `src/utils/presetStorage.js` (user preset persistence already implemented, separate from the 45 factory patches) + `src/components/Sidebar/SoundTab.jsx` (needs to surface user presets, may already partially do this via `PresetShelf` — verify at implementation time). Depends on P7 existing first (the designer page is where a "save" action would originate). | medium-high value / medium effort, blocked on P7 |
| P9 | Kill the Samples page | Full deletion list assembled by research pass: **UI** — `src/components/Sidebar/SamplesTab.jsx` (558 lines) + `src/components/Sidebar/SamplesTab.test.jsx`; wiring to remove in `src/components/Sidebar/index.jsx` (import line 3, tab entry lines 120-129, subtitle/title conditionals lines 132-141, render block lines 202-207). **Data layer** — `src/utils/sampleStorage.js` (IndexedDB), `src/data/soundSets.js` + `.test.js`, `src/utils/starterCatalog.js`, `src/data/publicSoundCatalogSeed.json`, `src/data/starterSoundInventory.json` + `.test.js`, `src/data/starterSoundSources.json` + `.test.js`, `src/data/starterSoundSyncUtils.test.js`. **Scripts** — `scripts/sync_private_sound_sets.mjs`, `scripts/sync_starter_sounds.mjs`, `scripts/starter_sound_sync_utils.mjs` (+ their npm scripts `sync:private-sound-sets`, `sync:starter-sounds`). **Assets** — `public/samples/` (`rachmaninoff/`, `starter-pack/`). **Hazard found and confirmed by direct read**: `src/utils/instrumentSamples.js` (imports `soundSets.js`) is *also* imported by `src/hooks/useMidiPlayback.js:10` (`ensureSoundSetLoaded`) and used at line ~577 to load sample-layer instruments for MIDI files carrying a `soundSetId` (e.g. the built-in Rachmaninoff concerto sets `soundSetId: 'rachmaninoff-orchestral-lite'` in `midiParser.js`). Deleting `soundSets.js`/`public/samples/` wholesale would silently break that MIDI's layered playback — needs its own decoupling step (either strip `soundSetId` from the affected MIDI entries and accept plain synth playback, or keep the minimal sample-set data needed for that one song). Confirms the mandate's own staging: UI/route first (build green), dead-code sweep second, after nothing else references the corpse. `presetStorage.js`/`PresetShelf.jsx` (synth engine presets) are unrelated and untouched by this item. | high value / high effort (staged, sequence late) |

Order by value/effort each iteration. P1/P2/P3 are cheap, high-value, low-risk — good
early iterations to shrink the census fast and prove the loop works. P5 should land
before or alongside P1 since it naturally removes the `(Tag)` substring at the source.
P7/P8 are multi-iteration and P8 is blocked on P7. P9's sweep comes last, after the
`instrumentSamples.js` / `useMidiPlayback.js` dependency is explicitly resolved.

## Iteration log

### Iteration 0 — apparatus, no redesign — 2026-07-07

Built `scripts/audit_ui_tells.mjs` (pure `node:fs`/`node:path`, no dependencies),
wired as `npm run audit:ui` in `sound-engine/frontend/package.json`. Scans
`src/**/*.{css,jsx,js}`, skips `*.test.*` and the frozen engine paths (`src/audio/`,
`src/utils/audioEngine/` — both frozen per G3), prints a per-category count table, a grouped file:line listing (for human judgment on
the fuzzier categories — chips/tags and animated-dots intentionally over-report
slightly, e.g. flagging DOM `tagName` checks and canvas `chipX`/`chipY` variables — the
census is designed to never under-count, since G5 needs a trustworthy decreasing
number), and a final `TELL CENSUS TOTAL: <n>` line. Exit code is always 0 (census, not
a gate).

Ran the census: **228 total tells** (45 gradients, 37 glow shadows, 82 pill radii, 41
chip/tag identifiers, 22 animated-dot occurrences, 1 "Vangelis Studio Original" string).
Refined the P1-P9 seed backlog against the real code — see table above; every item now
names concrete files, and two structural hazards were surfaced before any deletion
work starts: (1) P1/P5 both touch the same `(Tag)`-suffixed name strings and should be
sequenced together, not independently; (2) P9 (Samples page) cannot be a pure deletion
— `instrumentSamples.js` feeds MIDI sound-set layering for at least one built-in song
via `useMidiPlayback.js`, so the sweep needs an explicit decoupling step, matching the
mandate's own "decide samplePool's fate by what still references it" instruction.

No UI/CSS/JSX code was modified this iteration — only the two new apparatus files and
one npm script line. `npm test` and `npm run build` both verified green after the
apparatus was added (see below), proving the census script has zero footprint on the
running app.

**Review record (delegation protocol):** implementer: Sonnet subagent. 1 rework round.
Round 1 defects caught in orchestrator review: (a) docstring claimed utils/audioEngine
was excluded from the scan but SKIP_DIR_PREFIXES only contained src/audio — the
apparatus lied about its own scope; (b) pillRadii label/note claimed 50% radii were
counted in the 82 when they live in a separate uncounted bucket. Both fixed cleanly;
census total unchanged at 228 with zero hits lost, confirming the exclusion was
correct by construction. Orchestrator independently verified: census reproduces,
G1 373/373, G2 build clean, G3 audit 225/225 bit-exact. Visual baselines captured
(main view, Sound tab, MIDI tab, Samples tab) — dot badges, pill preset lists, song
tag chips, per-row "Vangelis Studio Original" bylines, pill filter chips all confirmed
on screen.

`ITERATION 0: apparatus — census baseline 228 tells — backlog: 9 items`

### Iteration 1 — P1+P2: MIDI browser rows stripped — 2026-07-07
Tag chips and the "Vangelis Studio Original" byline are gone from every song row.
`splitTag` keeps cleaning `(Tag)` out of displayed titles (data untouched until P5);
composer renders only when present; the dead `.midi-tab__badge` pill CSS deleted.
Implementer caught a consequential latent bug unprompted: the search filter
interpolated `undefined` composer as literal text ("undefined" would have matched all
originals) — guarded. One new test pins the stripped rows.

**Review record:** implementer: Sonnet subagent. 0 rework rounds. Two judgment calls
reviewed and approved (search-string guard, JSDoc optionality). Census 228 → 225
(chips −1, pills −1, studioOriginal 1 → 0). Orchestrator verified: G1 374/374 (+1),
G2 clean, G3 225/225 bit-exact, G4 screenshot confirms clean rows, G5 225.

`ITERATION 1: P1+P2 rows stripped — census 225 — backlog: 7 items`

### Iteration 2 — P5: the 58 originals renamed to odd codes — 2026-07-07
Every original cue now bears a flat machine-code name (`dial_51`, `3AM ZONE`, `GRUB 3`,
`mullet-61`, `DAWN DUCT`...) from a deterministic generator (FNV-1a of the stable id →
mulberry32; ids and file paths unchanged). Single source of truth established:
`src/data/originalCueNames.js` feeds BOTH midiParser and the corpus generator — the
two-copies drift hazard from iteration 0 is dead. All 58 .mid files regenerated so
embedded metadata matches. Tests pin: uniqueness, no parens, cringe-word absence,
generator↔committed-map determinism, .mid-metadata agreement, and a per-word-stem cap.

**Review record:** implementer: Sonnet subagent. 1 rework round. Round-1 defect: the
name list betrayed its own generator — krill×4, HUSK×3, brick×3 across 58 names, plus a
`MIDN` truncation that read as a bug. Fix: per-stem cap of 2 enforced deterministically
+ wordlist expanded (gasket, mullet, grommet, turnip...). Approved deviations: seeding
from stable id instead of old name (more robust, documented); vestigial name args in
generator call sites (log-only). Orchestrator verified independently: 58 unique, max
stem reuse 2, zero parens; G1 379/379, G2 clean, G3 225/225 bit-exact, G4 live
snapshot shows all codes rendering, G5 census 225 (names are not a tell category — no
increase, justified hold).

`ITERATION 2: P5 renames — census 225 — backlog: 6 items`
