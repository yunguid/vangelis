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

The source manifest is tracked in:

- `src/data/starterSoundSources.json`

Sources are pinned to an upstream commit SHA for deterministic reproducible downloads.

Do **not** add proprietary sample content (e.g. Spitfire LABS assets) to this repo.

## Sync Script

```bash
cd sound-engine/frontend
npm run sync:starter-sounds
```

Options:
- `--force` re-download existing files
- `--quiet` minimal logs
- `--verify-existing` verify checksums for already-downloaded files

The sync script writes inventory metadata to:

- `src/data/starterSoundInventory.json`

Network behavior:
- automatic retries with exponential backoff + jitter for transient HTTP/network failures
- bounded request timeouts per fetch
- existing-file checksum verification uses streamed hashing to avoid loading entire files into memory
- validates expected byte sizes from upstream tree metadata before hash verification
- marks assets as `unverified` (not failed) when upstream SHA metadata is unavailable
- treats local Git LFS pointer files as `unverified` during `--verify-existing` (run `git lfs pull` for full verification)

## Security

The sync pipeline enforces:
- strict lowercase domain allowlist (`raw.githubusercontent.com`, `api.github.com`)
- strict manifest schema validation (immutable refs, safe paths, allowlisted extensions)
- manifest paths must be canonicalized (no duplicate/trailing slashes)
- `includeExtensions` must be lexicographically sorted for deterministic manifests
- pack IDs are enforced as lowercase kebab-case for stable manifests
- license + attribution metadata must be non-empty and whitespace-clean
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
