/**
 * Classical catalog importer.
 *
 * Reads src/data/classicalCatalog.json and materializes every entry's MIDI
 * file under public/, verifying SHA-256 checksums so the shipped corpus is
 * exactly the corpus that was audited. Designed to be safe to re-run:
 * verified files are skipped, partial runs resume, and every run ends with a
 * human-readable audit report (counts, license table, failures/omissions).
 *
 *   node scripts/sync_classical_midis.mjs            # sync + verify + report
 *   node scripts/sync_classical_midis.mjs --dry-run  # plan + report, no network
 *   node scripts/sync_classical_midis.mjs --verify   # verify existing files only
 *   node scripts/sync_classical_midis.mjs --pin      # for entries with null
 *     sha256: download, then print the hash/size block to paste into the
 *     manifest (nothing is auto-written to the manifest — pins stay reviewable)
 *
 * Network behavior: domain allowlist, one request at a time, polite spacing
 * with jitter, bounded timeouts, retries with exponential backoff. Archive
 * sources are pinned to immutable snapshot URLs so downloads are
 * deterministic; a checksum mismatch is a hard failure, never silently kept.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, '..');
const catalogPath = path.join(frontendRoot, 'src/data/classicalCatalog.json');
const publicRoot = path.join(frontendRoot, 'public');

const ALLOWED_HOSTS = new Set(['web.archive.org', 'www.mutopiaproject.org']);
const REQUEST_TIMEOUT_MS = 90000;
const REQUEST_SPACING_MS = 8000;
const MAX_ATTEMPTS = 3;

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const verifyOnly = args.has('--verify');
const pinMode = args.has('--pin');

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const jitter = (ms) => ms + Math.floor(Math.random() * (ms / 2));

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const resolveTargetPath = (relativeFile) => {
  const target = path.resolve(publicRoot, relativeFile);
  if (!target.startsWith(publicRoot + path.sep)) {
    throw new Error(`entry file escapes public/: ${relativeFile}`);
  }
  return target;
};

const verifyLocal = async (entry, targetPath) => {
  let bytes;
  try {
    bytes = await fs.readFile(targetPath);
  } catch {
    return { state: 'missing' };
  }
  if (bytes.byteLength !== entry.byteSize) {
    return { state: 'size-mismatch', actual: bytes.byteLength };
  }
  const digest = sha256(bytes);
  if (digest !== entry.sha256) {
    return { state: 'hash-mismatch', actual: digest };
  }
  return { state: 'verified' };
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
};

const download = async (entry, targetPath) => {
  const source = new URL(entry.provenance.sourceUrl);
  if (!ALLOWED_HOSTS.has(source.hostname)) {
    throw new Error(`host not allowlisted: ${source.hostname}`);
  }

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(entry.provenance.sourceUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const digest = sha256(bytes);
      if (entry.sha256 === null) {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, bytes);
        return { pinned: { id: entry.id, sha256: digest, byteSize: bytes.byteLength } };
      }
      if (bytes.byteLength !== entry.byteSize || digest !== entry.sha256) {
        throw new Error(
          `integrity mismatch (got ${bytes.byteLength}B ${digest.slice(0, 12)}…, `
          + `want ${entry.byteSize}B ${entry.sha256.slice(0, 12)}…)`
        );
      }
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, bytes);
      return {};
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(jitter(REQUEST_SPACING_MS * attempt));
      }
    }
  }
  throw lastError;
};

const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
const entries = catalog.entries || [];
const report = { verified: 0, downloaded: 0, failed: 0, planned: 0 };
const failures = [];
const licenseRows = [];
const pinnedResults = [];

let firstRequestDone = false;
for (const entry of entries) {
  const targetPath = resolveTargetPath(entry.file);
  const unpinned = entry.sha256 === null;
  const local = unpinned ? { state: 'unpinned' } : await verifyLocal(entry, targetPath);
  licenseRows.push([
    entry.id,
    entry.provenance.license,
    entry.provenance.source,
    entry.provenance.retrieved
  ]);

  if (local.state === 'verified') {
    report.verified += 1;
    console.log(`[ok]       ${entry.id} (sha256 verified)`);
    continue;
  }

  if (unpinned && !pinMode) {
    report.failed += 1;
    failures.push({ id: entry.id, reason: 'sha256 is null — run --pin and record the hash' });
    console.error(`[fail]     ${entry.id} has no pinned sha256`);
    continue;
  }

  if (dryRun) {
    report.planned += 1;
    console.log(`[plan]     ${entry.id} ${local.state} -> would fetch ${entry.provenance.sourceUrl}`);
    continue;
  }

  if (verifyOnly) {
    report.failed += 1;
    failures.push({ id: entry.id, reason: `local file ${local.state}` });
    console.error(`[fail]     ${entry.id} local file ${local.state}`);
    continue;
  }

  try {
    if (firstRequestDone) await sleep(jitter(REQUEST_SPACING_MS));
    firstRequestDone = true;
    console.log(`[download] ${entry.id}`);
    const outcome = await download(entry, targetPath);
    report.downloaded += 1;
    if (outcome?.pinned) {
      pinnedResults.push(outcome.pinned);
      console.log(`[pin]      ${entry.id} sha256 ${outcome.pinned.sha256.slice(0, 12)}… (${outcome.pinned.byteSize}B)`);
    } else {
      console.log(`[ok]       ${entry.id} downloaded + sha256 verified`);
    }
  } catch (error) {
    report.failed += 1;
    failures.push({ id: entry.id, reason: error.message });
    console.error(`[fail]     ${entry.id}: ${error.message}`);
  }
}

console.log('\n=== classical catalog audit ===');
console.log(`entries: ${entries.length}  verified: ${report.verified}  downloaded: ${report.downloaded}  planned: ${report.planned}  failed: ${report.failed}`);
console.log('\nlicense table:');
for (const [id, license, source, retrieved] of licenseRows) {
  console.log(`  ${id}  |  ${license}  |  ${source}  |  retrieved ${retrieved}`);
}
if (pinnedResults.length > 0) {
  console.log('\npinned hashes — paste into classicalCatalog.json, then re-run --verify:');
  console.log(JSON.stringify(pinnedResults, null, 2));
}
if (failures.length > 0) {
  console.log('\nfailures/omissions:');
  for (const failure of failures) {
    console.log(`  ${failure.id}: ${failure.reason}`);
  }
  process.exitCode = 1;
}
