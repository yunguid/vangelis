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

## Security

The sync pipeline enforces:
- strict domain allowlist (`raw.githubusercontent.com`, `api.github.com`)
- strict manifest schema validation (immutable refs, safe paths, allowlisted extensions)
- output-path confinement (prevents write traversal outside `public/samples`)
- deterministic source manifest
- git-blob checksum verification against upstream tree SHA
- no free-form crawl targets

## Git Storage

Starter samples are tracked via **Git LFS** to keep normal git history manageable.
