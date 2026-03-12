# Starter Sound Library

This project ships with a curated **starter pack** of orchestral/piano samples under `public/samples/starter-pack`.
Current committed starter-pack footprint: **~644 MB** (Git LFS).

## Goals
- high-quality baseline sounds out of the box
- legally redistributable sample sources
- deterministic reproducible sync pipeline

## Legal / Licensing

Current starter pack source:

- **VSCO 2 Community Edition** (`sgossner/VSCO-2-CE`)
  - License: **CC0-1.0** (public-domain dedication)
  - Attribution in-app is still recommended even when not strictly required.

Bundled upgrade candidate researched:

- **VCSL** (`sgossner/VCSL`)
  - License: **CC0-1.0**
  - Better pitch coverage and broader factory-library intent than the current VSCO-only slice.
  - Safe to evaluate for future bundled upgrades because redistribution is explicitly allowed.

The source manifest is tracked in:

- `src/data/starterSoundSources.json`

Sources are pinned to an upstream commit SHA for deterministic reproducible downloads.

Do **not** add proprietary sample content (e.g. Spitfire LABS assets) to this repo.

Ableton Core Library, Kontakt / Native Instruments libraries, and similar commercial/free-but-proprietary content should only be used via the private local override flow below. Those assets may be valid for your own productions, but they are not safe repo defaults.

## Sync Script

```bash
cd sound-engine/frontend
npm run sync:starter-sounds
```

Options:
- `--force` re-download existing files
- `--quiet` minimal logs
- `--verify-existing` verify checksums for already-downloaded files

## Private Local Overrides

For machine-local upgrades sourced from your installed tools, use:

```bash
cd sound-engine/frontend
npm run sync:private-sound-sets
```

Current private sync behavior:

- pulls selected samples from Ableton Live 12 Suite's Core Library Grand Piano
- converts them to browser-safe `.wav`
- writes gitignored assets into `public/samples/private-library/`
- writes gitignored sound-set overrides to `public/private-sound-sets.json`

These overrides merge into the existing built-in sound sets at runtime, so you can replace weak zones locally without committing the proprietary source material.

The sync script writes inventory metadata to:

- `src/data/starterSoundInventory.json`

Network behavior:
- automatic retries with exponential backoff + jitter for transient HTTP/network failures
- bounded request timeouts per fetch
- existing-file checksum verification uses streamed hashing to avoid loading entire files into memory
- validates expected byte sizes from upstream tree metadata before hash verification
- marks assets as `unverified` (not failed) when upstream SHA metadata is unavailable

## Security

The sync pipeline enforces:
- strict lowercase domain allowlist (`raw.githubusercontent.com`, `api.github.com`)
- strict manifest schema validation (immutable refs, safe paths, allowlisted extensions)
- pack IDs are enforced as lowercase kebab-case for stable manifests
- output-path confinement (prevents write traversal outside `public/samples`)
- target-path collision detection (prevents multiple sources writing same local asset path)
- duplicate/overlapping source-prefix detection per repo ref (case-insensitive, prevents duplicate upstream slices)
- deterministic source manifest
- deterministic inventory ordering (packs + files sorted for stable diffs)
- inventory summary counters are derived from entry data (prevents counter drift)
- git-blob checksum verification against upstream tree SHA
- no free-form crawl targets

## Git Storage

Starter samples are tracked via **Git LFS** to keep normal git history manageable.
