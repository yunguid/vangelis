# CATALOG LEDGER — classical/MIDI learning catalog

Shared memory for the catalog-and-instrument mission (2026-07-19). One entry per
slice: investigate → implement → verify → measure → commit. Sibling loops:
ENGINE_LEDGER (audio, frozen at fixed point), INTERFACE_LEDGER (UI purge, blocked
awaiting control-kit sign-off), PERFORMANCE_LEDGER (delivery budgets).

## Mission

A legal, well-indexed classical/MIDI learning catalog inside the existing site.
Launch item: **Schubert — Impromptu in G-flat major, Op. 90 No. 3 (D.899 No. 3)**,
correct metadata, playable where legally available, provenance-visible, fast and
deterministic. Then a curated Schubert-essentials set, a broader classical
collection, and an original patch bank. No unbounded asset dumps.

## Legal rules (binding)

- Only public-domain or explicitly licensed (CC/permissioned) assets. The
  *composition* being PD is not enough — the specific MIDI encoding/arrangement
  carries its own rights and must have its own license.
- Every imported asset records: source URL, author/encoder, license, attribution
  text, SHA-256, retrieval date. Unclear license → skip + record in omissions.
- No scraping behind logins, no paywall evasion, polite throttling, no
  commercial recordings. Modern artists (Vangelis, MJ, Mike Dean, Ye, …): no
  copyrighted recordings/stems/MIDI transcriptions; only original patches and
  broad-trait listening notes. No melody copying, no artist impersonation.

## Baseline — 2026-07-19 (before any catalog edits)

Code map (all verified by reading, paths relative to `sound-engine/frontend/`):

- **Routes** (`src/utils/routes.js`, hash-based, lazily mounted in `main.jsx`):
  `#/` home synth; `#/studies` library page; `#/studies/<slug>` built-in study
  page; `#/studies/generated/<jobId>` pipeline study; `#/pipeline/midi-builder`;
  `#/voice-loop`; `#/sound-designer` + `#/control-kit` (frozen, other loop).
- **MIDI data pipeline**: `src/data/russianMidiLibrary.json` (11 Mutopia entries:
  id/name/composer/source/infoUrl/sourceUrl/license) → `scripts/sync_russian_midis.mjs`
  (download + Mutopia FTP discovery crawl; no checksums, no rate limiting, no
  audit report) → `public/midi/russian/*.mid` → `getBuiltInMidiFiles()` in
  `src/utils/midiParser.js` (also 58 originals + 9 hand-listed classics) →
  `Sidebar/MidiLibrary.jsx` (search + rows; **display names are 6-digit hash
  codes** per INTERFACE_PURGE — classical entries are visually indistinguishable)
  → `parseMidiFile` (lazy @tonejs/midi, 4-entry source cache) →
  `useMidiPlayback` → synth worklet + BirdsEyeRadar.
- **Study system**: `src/data/songStudies.js` (`BUILT_IN_STUDIES`, exactly one:
  To the Unknown Man; title/artist/eyebrow/sourceLabel/midiUrl/waveform/params)
  → `StudySongsPage.jsx` (library list + dev-only pipeline polling) →
  `SongStudyPage.jsx` (transport, scrubber, tempo 0.75/1/1.25, chord/bass/lead
  readouts, radar, keyboard). No key/catalogue/provenance fields anywhere.
- **Budgets** (`scripts/perf_site_metrics.mjs`, 138 checks): initial JS ≤ 35 KiB
  raw / 14 KiB gzip / ≤2 requests; HTML ≤ 5 KiB; initial CSS ≤ 25 KiB gzip;
  per-route closure JS ≤ 40 KiB gzip, CSS ≤ 18 KiB gzip; worklets ≤ 38.7 KiB;
  deployment ≤ 1.65 MiB; **public static ≤ 0.95 MiB (current: 856.13 KiB →
  ~116 KiB headroom for new MIDI assets)**.

Browser baseline (dev server, Chrome, 1280×720, this session):

- Home `#/`: near-black first paint, no gray flash, zero console errors.
- Sidebar MIDI browser: 58 originals + 20 classics in one list; search
  "rachmaninoff" → 6 rows, all captioned by numeric code only; row click →
  lazy-loads `midiParser` + `@tonejs/midi` + fetches `.mid` on demand
  (rachmaninoff-op23-04-prelude.mid, 12.8 KB, 2 ms local), playback + radar +
  transport verified live (4:37, 50 BPM readout).
- `#/studies`: 1 saved study; pipeline "Background runs" details collapsed
  (pipeline API is dev-only — not routed in vercel.json).
- `#/studies/to-the-unknown-man`: loads with transport 7:52 / 84 BPM, readouts
  live, 178 DOM nodes, 8.4 MB heap, zero console errors.
- PERFORMANCE_LEDGER's 2026-07-19 live baseline (FCP 36–52 ms home, route
  transition 8.7 ms) remains the reference for whole-app numbers.

Existing licensing reference points: Mutopia corpus pattern in
`russianMidiLibrary.json`; VSCO-2-CE CC0 starter samples with pinned-SHA sync
(`SOUND_LIBRARY.md`) — the security/determinism bar the catalog importer should
meet or exceed.

## Constraints carried from sibling loops

- Audio engine frozen: never edit `src/audio/` or `utils/audioEngine/`;
  `npm run audit:audio` must stay 225/225 bit-exact.
- UI language (INTERFACE_PURGE §2): flat, hairline borders, radius ≤ 6px, no
  gradients/glows/pills/chips/tag ornaments; dense lists; motion only for
  information. UI-tell census (currently 19–22 justified) must not grow.
- `#/sound-designer` + `#/control-kit` are another loop's blocked surface — do
  not modify.
- Originals keep their code-names; classical catalog entries get real titles on
  the catalog/study surfaces (the mission demands correct titles, composer, key,
  catalogue numbers).
- Repo protocol (user feedback, 2026-07-08): commit and push as soon as a slice
  lands and passes a sanity look; run tests/audits opportunistically after the
  push, never as blockers; fix forward.

## Schema (designed slice 1, implemented slice 2+)

`src/data/classicalCatalog.json` — one entry per playable catalog item:

```
{
  "schemaVersion": 1,
  "id": "schubert-d899-3-impromptu-gflat",     // deterministic: composer-catalog-movement-slug
  "title": "Impromptu in G-flat major",
  "altTitles": ["Impromptu Op. 90 No. 3"],
  "composer": "Franz Schubert",
  "composerYears": "1797–1828",
  "catalog": { "d": "D.899", "op": "Op. 90", "no": 3 },   // per-tradition numbers
  "key": "G-flat major",
  "movement": null,
  "genre": "impromptu", "period": "romantic",
  "yearComposed": "1827",
  "tags": ["piano", "lyrical", "study"],
  "difficulty": "advanced",
  "featuredRank": 1,                            // 1 = first card, first prefetch
  "durationHint": null,                         // filled from parsed MIDI at import
  "file": "midi/classical/schubert-d899-3-impromptu-gflat.mid",
  "sha256": "…",
  "byteSize": 0,
  "provenance": {
    "source": "…", "sourceUrl": "…", "infoUrl": "…",
    "encoder": "…", "license": "…", "licenseUrl": "…",
    "attribution": "…", "retrieved": "2026-07-19"
  },
  "searchTokens": ["schubert", "impromptu", "gflat", "d899", "op90", …]
}
```

Rules: IDs stable and deterministic (never renamed once shipped); manifest
sorted by id for stable diffs; importer verifies sha256 and byte size, resumes,
skips dupes, writes a human-readable audit report + omissions list. The
manifest is lazy-loaded (own chunk/fetch), never in the initial route graph.

## Iteration log

### Slice 0 — investigation + baseline — 2026-07-19

Everything above. No code changed.

### Slice 1 — featured Schubert flagship — 2026-07-19 — commit ece32f4

Acquisition: Bernd Krueger's D.899 No. 3 MIDI (piano-midi.de). The live site
418s non-browser clients and served blank pages to the embedded pane, so the
bytes came from the Internet Archive's snapshot of the canonical URL
(`web.archive.org/web/20230510125308id_/…/schuim-3.mid`) — polite, durable,
pinned. License evidence captured verbatim from the archived copy.htm
(snapshot 20241211185851): Krueger's MIDI files are CC BY-SA 3.0 DE with
attribution "Bernd Krueger, Source: http://www.piano-midi.de"; distribution
allowed under identical license conditions. Identity verified from the file
itself: embedded track names ("Impromptu Nr. 3 Ges-Dur", "Schubert:
Impromptus No.3 , Op. 90 - D 899", "Copyright © 2007 by Bernd Krueger",
"Edition: 2014-03-19"), G-flat major key signature, 8/4 meter, 5.71 min,
2,601 notes, B-flat-over-G-flat-arpeggio opening.

Shipped: `classicalCatalog.json` (schema v1) + gate test (schema/hash/
provenance/featured-rank), `sync_classical_midis.mjs` importer, featured
study first on `#/studies` with idle prefetch of exactly that one MIDI,
study page meta line + study notes + provenance footer (license + archived
source links), real titles for catalog rows in the sidebar (originals keep
code names). 591/591 tests, 138/138 budgets.

### Slice 2 — Schubert essentials + bounded budget — 2026-07-19 — commit 8409745

Impromptus D.899 Nos. 1/2/4, same provenance chain, ranks 2–4. Deliberate
budget decision: D00 public static 0.95 → 1.05 MiB, new D00b classical line
≤ 256 KiB + manifest↔directory bijection guard (orphan assets fail the
build). 139 checks. 225/225 audio renders stayed bit-exact.

### Slice 3 — Patch Lab — 2026-07-19 — commit 43acc9b

12 original patches, 4 technique categories (Cinema Analog / Orchestral Pop
/ Beat Lab / Experimental), authored against CLEAN_PATCH with the factory
bank's legality + stability test contract (attack floor 0.005 caught by the
gate and fixed). Own deferred chunk (2.21 KiB gzip) loading alongside the
factory bank; zero route-closure growth. 631/631 tests.

### Slice 4 — Russian corpus → verified catalog — 2026-07-19 — commit c75c300

The committed russianMidiLibrary.json had wrong Mutopia piece-info ids
(id 236 "Tchaikovsky" was actually a Liszt ballade page). Ground truth
re-established from Mutopia composer tables + piece pages; all nine works
re-synced from canonical URLs via the importer's new --pin flow (8 of 9
downloads were bit-identical to the committed files — right bytes, wrong
labels). Identity corrections: "Scriabin Op.11 No.13" → **Op.11 No.1**
(C major, 42 s); "Rimsky Etude Op.11 No.7" → **Op.11 No.4 in D-flat major**
(the canonical typesetting's 5-flat signature; a different file from the
legacy one); "Stanchinsky Prelude in C minor" → **Prelude in Lydian Mode**
(21/16). Per-piece licenses recorded: PD/CC0 ×3 (Tchaikovsky ×3 via their
piece pages), CC BY-SA 4.0 ×2 (Rachmaninoff, typesetters Abel Cheung /
Joram Berger), CC BY 3.0 (Mussorgsky/Chernov arr., Robert Clausecker),
CC BY-SA 3.0 (Rimsky, Thomas Amthor), PD (Scriabin, Keith O'Hara), CC BY 4.0
(Stanchinsky, Robert Clausecker). Legacy manifest + sync script retired;
`sync:midis` now runs the classical importer; D00b 256 → 384 KiB (same
bytes, one audited bucket).

## Omissions and risks (explicit)

- **Removed**: `alyabyev-the-nightingale.mid`, `bortniansky-the-angel-cried.mid`
  — Mutopia hosts no such pieces (only a Cherubic Hymn and a Kontakion,
  both SATB), so their recorded provenance was false and no license trail
  exists. Deleted in slice 4 rather than shipped with a fabricated license.
  Restorable if a genuine licensed source is found.
- **Legacy, unverified provenance (kept, flagged)**: the pre-mission
  hand-listed files — `rachmaninoff-concerto2-mov{1,2,3}.mid`,
  `rachmaninoff-vocalise.mid`, `bach-wtc-prelude-c.mid`,
  `bach-prelude-cello.mid`, `satie-gymnopedie-1.mid`,
  `satie-gnossienne-1.mid` (PD compositions, unknown MIDI encoders) and
  `to-the-unknown-man.mid` (a transcription of a 1977 Vangelis work — the
  composition itself is NOT public domain). These predate the catalog, are
  not claimed by it, and carry no license assertions in-app. A product
  decision is needed: source licensed replacements, or remove.
- Mutopia's Schubert holdings are Lieder/quartet/marches only — no
  impromptu typesettings existed there; piano-midi.de was the correct
  licensed source for D.899.

## Verification record — 2026-07-19 (embedded Chrome pane, dev server)

- `#/studies`: 14 studies; featured card first (accent bar, "Featured ·
  piano-midi.de (Bernd Krueger) · CC BY-SA 3.0 DE", "Op. 90 · D.899 No. 3 ·
  G-flat major · 1827", 5:43); idle prefetch fetched exactly one file (the
  flagship MIDI); zero console errors.
- Study page `#/studies/schubert-d899-3-impromptu-gflat`: full metadata
  line, study notes, provenance footer with working license/archive links;
  transport parsed 5:42 / 111 BPM from the shipped file; opening readouts
  showed G♭maj7 / G♭2 / B♭4 — the piece's actual first sonority.
- Sidebar search: "schubert" filtered 80 → 4 rows in ≤0.2 ms handler time
  per keystroke, flagship first, real titles + catalogue sublabels.
- Mobile 375×812: library + study page stack cleanly, zero horizontal
  overflow, zero console errors.
- UI-tell census: 22 (unchanged — zero new tells).
- **Environment caveat**: the embedded pane reports `visibilityState:
  "hidden"` and never fires rAF, so the app's visibility-aware progress
  clock/radar loops (correctly) pause — transport time displays freeze in
  this pane while note scheduling proceeds. Identical behavior existed at
  baseline before any catalog change, and a real visible Chrome session ran
  this exact transport path live earlier today (PERFORMANCE_LEDGER browser
  baseline). First audible confirmation in a visible browser remains for
  the user's next real session.

## Coverage

Catalog: 13 hash-verified entries (4 Schubert D.899, 3 Tchaikovsky Op. 39,
2 Rachmaninoff Op. 23, 1 each Mussorgsky/Chernov, Rimsky-Korsakov, Scriabin,
Stanchinsky) — 314.8 KiB of the 384 KiB D00b line. Patch Lab: 12 original
patches. Studies: 14 (13 catalog + To the Unknown Man). Licenses: CC BY-SA
3.0 DE ×4, PD/CC0 ×4, CC BY-SA 4.0 ×2, CC BY-SA 3.0 ×1, CC BY 3.0 ×1,
CC BY 4.0 ×1. Every entry: pinned source URL, encoder, license URL,
attribution text, sha256, byte size, retrieval date.
