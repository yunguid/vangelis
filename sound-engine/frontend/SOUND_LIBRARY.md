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

Validation shortcut (tests + verify-existing sync):

```bash
npm run verify:starter-sounds
```

Options:
- `--force` re-download existing files
- `--quiet` minimal logs
- `--verify-existing` verify checksums for already-downloaded files

The sync script writes inventory metadata to:

- `src/data/starterSoundInventory.json`
- inventory includes `sourceManifestSha256` so stale inventory files can be detected against the current manifest
- manifest fingerprinting uses canonicalized JSON key ordering (stable across object key reorderings)
- fingerprint value is persisted as 64-char lowercase SHA-256 hex
- inventory stores manifest snapshot metadata (`description`, `licenseNotice`, `allowlistedDomains`) for auditability
- inventory also records `sourcePackCount` for manifest-to-inventory pack cardinality checks
- inventory also records `sourcePackIds` for exact manifest-pack identity checks
- `sourcePackIds` / `sourcePackCount` are derived from sorted generated inventory packs for deterministic parity
- sync run fails if generated inventory pack IDs ever drift from manifest pack IDs
- sync run also fails if generated pack metadata drifts from source manifest metadata
- each inventory pack includes a derived summary block (counts/bytes/integrity tallies) for local auditability
- global inventory summary is cross-checked against aggregated pack summaries to catch drift

Network behavior:
- automatic retries with exponential backoff + jitter for transient HTTP/network failures
- bounded request timeouts per fetch
- existing-file checksum verification uses streamed hashing to avoid loading entire files into memory
- validates expected byte sizes from upstream tree metadata before hash verification
- requires valid upstream byte-size metadata for every synced file entry
- marks assets as `unverified` (not failed) when upstream SHA metadata is unavailable
- skips local checksum hashing when upstream SHA metadata is unavailable (records `unverified` instead)
- treats local Git LFS pointer files as `unverified` during `--verify-existing` (run `git lfs pull` for full verification)
- rejects downloaded upstream payloads that resolve to Git LFS pointer text instead of audio content
- fails fast if any configured pack resolves zero upstream files (prevents silent source-path drift)
- derives pack-relative source paths with strict prefix checks before writing output paths
- validates generated inventory entry paths stay inside each pack’s `targetDir` / `sourcePathPrefix`
- validates each inventory file extension against pack `includeExtensions` and source-path extension parity

## Security

The sync pipeline enforces:
- strict lowercase domain allowlist (`raw.githubusercontent.com`, `api.github.com`)
- allowlisted domains are fixed to required baseline hosts only (`api.github.com` and `raw.githubusercontent.com`)
- strict manifest schema validation (immutable refs, safe paths, allowlisted extensions)
- unknown top-level, pack, and quality keys are rejected to prevent silent manifest drift
- each pack and `quality` block must be an object (no null/array coercion)
- repository matching is canonicalized case-insensitively for overlap/collision protection
- manifest-level metadata (`version`, `description`, `licenseNotice`) must be present, trimmed, and canonical
- top-level `description` and `licenseNotice` fields must be single-line
- manifest paths must be canonicalized (no duplicate/trailing slashes)
- `targetDir` must stay lowercase and match `starter-pack/<slug-segments>`
- `includeExtensions` must be lexicographically sorted for deterministic manifests
- pack IDs are enforced as lowercase kebab-case for stable manifests
- license metadata must be SPDX-like token format; attribution must be non-empty, trimmed, and single-line
- output-path confinement (prevents write traversal outside `public/samples`)
- target-path collision detection (prevents multiple sources writing same local asset path)
- duplicate/overlapping `targetDir` definitions are rejected at manifest-validation time
- duplicate/overlapping source-prefix detection per repo ref (case-insensitive, prevents duplicate upstream slices)
- deterministic source manifest
- deterministic inventory ordering (packs + files sorted for stable diffs)
- inventory summary counters (including `totalPacks` / `totalFiles` / `verified` / `unverified` / `mismatched`) are derived from entry data (prevents counter drift)
- summary arithmetic is validated (`totalFiles = downloaded + skipped + failed`, size/MB parity)
- git-blob checksum verification against upstream tree SHA
- no free-form crawl targets

## Git Storage

Starter samples are tracked via **Git LFS** to keep normal git history manageable.
