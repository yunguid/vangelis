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

Everything above. No code changed. Next: acquire Schubert D.899/3 legally,
implement schema + featured study.
