import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertAllowlistedUrl,
  assertLikelyAudioContentType,
  assertNotGitLfsPointer,
  buildManifestSnapshot,
  classifyExistingFileIntegrity,
  computeGitBlobSha,
  computeGitBlobShaFromFile,
  computePackMetadataSignature,
  getRequiredExpectedSize,
  getSafeSourceRelativePath,
  getBlobIntegrityStatus,
  hasMatchingByteSize,
  isPathWithinPrefix,
  isValidGitSha,
  isLikelyGitLfsPointer,
  resolveSafeOutputPath,
  summarizeInventoryEntries,
  summarizeInventoryPackSummaries,
  summarizeInventoryPacks,
  toPathCollisionKey,
  validateInventorySummary,
  validateStarterSoundManifest
} from './starter_sound_sync_utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(frontendRoot, 'src/data/starterSoundSources.json');
const outputRoot = path.join(frontendRoot, 'public/samples');
const inventoryPath = path.join(frontendRoot, 'src/data/starterSoundInventory.json');

const args = new Set(process.argv.slice(2));
const forceDownload = args.has('--force');
const quiet = args.has('--quiet');
const verifyExisting = args.has('--verify-existing');
const maxConcurrent = 6;
const REQUEST_TIMEOUT_MS = 25000;
const MAX_FETCH_ATTEMPTS = 4;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const treeCache = new Map();
const targetPathOwners = new Map();

const log = (...values) => {
  if (!quiet) console.log(...values);
};

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
validateStarterSoundManifest(manifest);

let downloaded = 0;
let skipped = 0;
let failed = 0;
let totalBytes = 0;
let verified = 0;
let unverified = 0;
let mismatched = 0;

const inventory = {
  ...buildManifestSnapshot(manifest),
  packs: []
};

await fs.mkdir(outputRoot, { recursive: true });

for (const pack of manifest.packs || []) {
  const files = await listPackFiles(pack);
  const includeExtensions = new Set((pack.includeExtensions || []).map((ext) => ext.toLowerCase()));
  const filtered = files.filter((entry) => {
    const ext = path.extname(entry.path).toLowerCase();
    if (!includeExtensions.size) return true;
    return includeExtensions.has(ext);
  });

  if (filtered.length === 0) {
    throw new Error(`Pack "${pack.id}" resolved zero files from "${pack.sourcePathPrefix}" with extensions [${[...includeExtensions].join(', ')}]`);
  }

  log(`[pack] ${pack.id} -> ${filtered.length} files`);

  const packInventory = {
    id: pack.id,
    repo: pack.repo,
    ref: pack.ref,
    sourcePathPrefix: pack.sourcePathPrefix,
    targetDir: pack.targetDir,
    includeExtensions: [...(pack.includeExtensions || [])],
    license: pack.license,
    attribution: pack.attribution,
    quality: pack.quality || null,
    files: []
  };
  let lfsPointerCount = 0;

  const tasks = filtered.map((entry) => async () => {
    const relativePath = getSafeSourceRelativePath(pack.sourcePathPrefix, entry.path);
    const targetPath = resolveSafeOutputPath(outputRoot, pack.targetDir, relativePath);
    const normalizedTargetPath = normalizeToPosix(path.relative(outputRoot, targetPath));
    if (!isPathWithinPrefix(pack.targetDir, normalizedTargetPath)) {
      throw new Error(`Target path escaped pack targetDir: ${normalizedTargetPath}`);
    }
    const targetCollisionKey = toPathCollisionKey(normalizedTargetPath);
    const targetOwner = `${pack.id}:${entry.path}`;
    const existingOwner = targetPathOwners.get(targetCollisionKey);
    if (existingOwner && existingOwner !== targetOwner) {
      failed += 1;
      mismatched += 1;
      packInventory.files.push({
        path: normalizedTargetPath,
        sourcePath: entry.path,
        bytes: null,
        status: 'failed',
        error: `Target path collision with ${existingOwner}`
      });
      console.error(`[error] target path collision ${pack.id}/${relativePath} -> ${normalizedTargetPath} (owner: ${existingOwner})`);
      return;
    }
    targetPathOwners.set(targetCollisionKey, targetOwner);
    const exists = await fileExists(targetPath);

    if (exists && !forceDownload) {
      let integrity = 'skipped';
      let localBlobSha = null;
      let sourceBlobSha = entry.sha || null;
      if (verifyExisting) {
        const localStats = await fs.stat(targetPath);
        const localBytes = Number(localStats.size) || 0;
        const expectedBytes = getRequiredExpectedSize(entry.size, `${pack.id}/${relativePath}`);
        const shouldVerifyChecksum = isValidGitSha(sourceBlobSha);
        let isLfsPointer = false;
        if (localBytes > 0 && localBytes <= 1024) {
          try {
            const maybePointer = await fs.readFile(targetPath, 'utf8');
            isLfsPointer = isLikelyGitLfsPointer(maybePointer);
            if (isLfsPointer) {
              lfsPointerCount += 1;
            }
          } catch {
            isLfsPointer = false;
          }
        }

        if (!isLfsPointer && shouldVerifyChecksum && hasMatchingByteSize(localBytes, expectedBytes)) {
          localBlobSha = await computeGitBlobShaFromFile(targetPath);
        }
        integrity = classifyExistingFileIntegrity({
          localBytes,
          expectedSize: expectedBytes,
          sourceBlobSha,
          localBlobSha,
          isLfsPointer
        });
        if (integrity === 'mismatch') {
          if (!hasMatchingByteSize(localBytes, expectedBytes)) {
            console.error(`[error] size mismatch (existing) ${pack.id}/${relativePath}`);
          } else {
            console.error(`[error] integrity mismatch (existing) ${pack.id}/${relativePath}`);
          }
        }
        if (integrity === 'mismatch') {
          failed += 1;
          mismatched += 1;
        } else if (integrity === 'verified') {
          verified += 1;
        } else if (integrity === 'unverified') {
          unverified += 1;
        }
      }

      skipped += 1;
      const expectedBytes = getRequiredExpectedSize(entry.size, `${pack.id}/${relativePath}`);
      totalBytes += expectedBytes;
      packInventory.files.push({
        path: normalizedTargetPath,
        sourcePath: entry.path,
        bytes: expectedBytes,
        status: 'skipped',
        sourceBlobSha,
        localBlobSha,
        integrity
      });
      return;
    }

    try {
      const rawUrl = toRawFileUrl(pack.repo, pack.ref, entry.path);
      assertAllowlistedUrl(rawUrl, manifest.allowlistedDomains || []);

      const data = await fetchBuffer(rawUrl);
      assertNotGitLfsPointer(data, `Downloaded asset ${pack.id}/${relativePath}`);
      const expectedBytes = getRequiredExpectedSize(entry.size, `${pack.id}/${relativePath}`);
      if (!hasMatchingByteSize(data.length, expectedBytes)) {
        throw new Error(`Size mismatch for ${relativePath}`);
      }
      const sourceBlobSha = entry.sha || null;
      const localBlobSha = isValidGitSha(sourceBlobSha) ? computeGitBlobSha(data) : null;
      const integrity = getBlobIntegrityStatus(sourceBlobSha, localBlobSha);
      if (integrity === 'mismatch') {
        throw new Error(`Checksum mismatch for ${relativePath}`);
      }
      if (integrity === 'verified') {
        verified += 1;
      } else if (integrity === 'unverified') {
        unverified += 1;
      }

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, data);

      downloaded += 1;
      totalBytes += data.length;

      packInventory.files.push({
        path: normalizedTargetPath,
        sourcePath: entry.path,
        bytes: data.length,
        status: 'downloaded',
        sourceBlobSha,
        localBlobSha,
        integrity
      });
      log(`[download] ${pack.id}: ${relativePath}`);
    } catch (error) {
      failed += 1;
      packInventory.files.push({
        path: normalizeToPosix(path.join(pack.targetDir, relativePath)),
        sourcePath: entry.path,
        bytes: null,
        status: 'failed',
        error: error.message
      });
      console.error(`[error] ${pack.id}/${relativePath}: ${error.message}`);
    }
  });

  await runConcurrent(tasks, maxConcurrent);
  if (lfsPointerCount > 0) {
    console.warn(`[warn] ${pack.id}: detected ${lfsPointerCount} Git LFS pointer file(s); run git lfs pull for full verification.`);
  }
  packInventory.files.sort((a, b) => a.path.localeCompare(b.path));
  packInventory.summary = summarizeInventoryEntries(packInventory.files);
  validateInventorySummary(
    {
      totalPacks: 1,
      ...packInventory.summary
    },
    `pack "${pack.id}" summary`
  );
  inventory.packs.push(packInventory);
}

inventory.packs.sort((a, b) => a.id.localeCompare(b.id));
inventory.sourcePackIds = inventory.packs.map((pack) => pack.id);
inventory.sourcePackCount = inventory.sourcePackIds.length;
const manifestPackIds = (manifest.packs || []).map((pack) => pack.id);
const packIdParityMatches = manifestPackIds.length === inventory.sourcePackIds.length
  && manifestPackIds.every((id, index) => id === inventory.sourcePackIds[index]);
if (!packIdParityMatches) {
  throw new Error('Generated inventory pack IDs drifted from source manifest pack IDs');
}
const manifestPackById = new Map((manifest.packs || []).map((pack) => [pack.id, pack]));
inventory.packs.forEach((pack) => {
  const sourcePack = manifestPackById.get(pack.id);
  if (!sourcePack) {
    throw new Error(`Generated inventory pack missing from manifest: ${pack.id}`);
  }

  const sourceSignature = computePackMetadataSignature(sourcePack);
  const inventorySignature = computePackMetadataSignature(pack);

  if (sourceSignature !== inventorySignature) {
    throw new Error(`Generated inventory pack metadata drifted from manifest for pack "${pack.id}"`);
  }
});

const derivedSummary = summarizeInventoryPacks(inventory.packs);
const derivedPackSummary = summarizeInventoryPackSummaries(inventory.packs);
validateInventorySummary(derivedPackSummary, 'aggregated pack summaries');
const trackedSummary = {
  totalPacks: inventory.packs.length,
  totalFiles: downloaded + skipped + failed,
  downloaded,
  skipped,
  failed,
  verified,
  unverified,
  mismatched,
  totalBytes
};
if (
  trackedSummary.totalPacks !== derivedSummary.totalPacks
  || trackedSummary.totalFiles !== derivedSummary.totalFiles
  || trackedSummary.downloaded !== derivedSummary.downloaded
  || trackedSummary.skipped !== derivedSummary.skipped
  || trackedSummary.failed !== derivedSummary.failed
  || trackedSummary.verified !== derivedSummary.verified
  || trackedSummary.unverified !== derivedSummary.unverified
  || trackedSummary.mismatched !== derivedSummary.mismatched
  || trackedSummary.totalBytes !== derivedSummary.totalBytes
) {
  throw new Error('Summary counters drift detected between runtime counters and derived entries');
}
if (
  derivedPackSummary.totalPacks !== derivedSummary.totalPacks
  || derivedPackSummary.totalFiles !== derivedSummary.totalFiles
  || derivedPackSummary.downloaded !== derivedSummary.downloaded
  || derivedPackSummary.skipped !== derivedSummary.skipped
  || derivedPackSummary.failed !== derivedSummary.failed
  || derivedPackSummary.verified !== derivedSummary.verified
  || derivedPackSummary.unverified !== derivedSummary.unverified
  || derivedPackSummary.mismatched !== derivedSummary.mismatched
  || derivedPackSummary.totalBytes !== derivedSummary.totalBytes
) {
  throw new Error('Pack-summary counters drift detected against derived entry summary');
}
if (inventory.sourcePackCount !== derivedSummary.totalPacks) {
  throw new Error('sourcePackCount does not match generated inventory pack count');
}
if (inventory.sourcePackIds.length !== inventory.sourcePackCount) {
  throw new Error('sourcePackIds length does not match sourcePackCount');
}
validateInventorySummary(derivedSummary, 'derived inventory summary');
inventory.summary = derivedSummary;

await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2));
log(`\nStarter sound sync complete: ${inventory.summary.downloaded} downloaded, ${inventory.summary.skipped} skipped, ${inventory.summary.failed} failed.`);

if (inventory.summary.failed > 0) {
  process.exitCode = 1;
}

async function listPackFiles(pack) {
  const cacheKey = `${String(pack.repo || '').toLowerCase()}@${pack.ref}`;
  if (!treeCache.has(cacheKey)) {
    treeCache.set(cacheKey, fetchRepoTree(pack.repo, pack.ref));
  }

  const tree = await treeCache.get(cacheKey);
  return tree.filter((entry) =>
    entry.type === 'blob' &&
    entry.path.startsWith(`${pack.sourcePathPrefix}/`)
  );
}

async function fetchRepoTree(repo, ref) {
  const treeUrl = `https://api.github.com/repos/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const allowlistedDomains = manifest.allowlistedDomains || [];
  assertAllowlistedUrl(treeUrl, allowlistedDomains);
  const response = await fetchWithRetry(treeUrl, { headers: githubHeaders() }, allowlistedDomains);
  if (!response.ok) {
    throw new Error(`Failed to fetch repository tree for ${repo}@${ref}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload.tree)) {
    throw new Error(`Invalid tree response for ${repo}@${ref}`);
  }
  return payload.tree;
}

function toRawFileUrl(repo, ref, filePath) {
  const encodedPath = filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(ref)}/${encodedPath}`;
}

function githubHeaders() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'vangelis-starter-sound-sync'
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchBuffer(url) {
  const allowlistedDomains = manifest.allowlistedDomains || [];
  assertAllowlistedUrl(url, allowlistedDomains);
  const response = await fetchWithRetry(url, {}, allowlistedDomains);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  assertLikelyAudioContentType(response.headers.get('content-type'), `Download ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fetchWithRetry(url, options = {}, allowlist = []) {
  let attempt = 0;
  while (attempt < MAX_FETCH_ATTEMPTS) {
    attempt += 1;
    try {
      const response = await fetchWithTimeout(url, options);
      assertAllowlistedUrl(response.url || url, allowlist);
      if (response.ok || !RETRYABLE_STATUS.has(response.status) || attempt >= MAX_FETCH_ATTEMPTS) {
        return response;
      }
      const waitMs = computeBackoffMs(attempt);
      log(`[retry] ${new URL(url).hostname} ${response.status} attempt ${attempt}/${MAX_FETCH_ATTEMPTS} in ${waitMs}ms`);
      await sleep(waitMs);
    } catch (error) {
      if (!isRetryableNetworkError(error) || attempt >= MAX_FETCH_ATTEMPTS) {
        throw error;
      }
      const waitMs = computeBackoffMs(attempt);
      log(`[retry] network error (${error.name}) attempt ${attempt}/${MAX_FETCH_ATTEMPTS} in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }

  throw new Error(`Exhausted retry attempts for ${url}`);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: 'follow'
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeToPosix(value) {
  return value.split(path.sep).join('/');
}

async function runConcurrent(taskFactories, limit) {
  const queue = taskFactories;
  let nextIndex = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (nextIndex < queue.length) {
      const taskIndex = nextIndex;
      nextIndex += 1;
      const task = queue[taskIndex];
      // eslint-disable-next-line no-await-in-loop
      await task();
    }
  });
  await Promise.all(workers);
}

function computeBackoffMs(attempt) {
  const base = 250;
  const jitter = Math.floor(Math.random() * 120);
  return base * (2 ** (attempt - 1)) + jitter;
}

function isRetryableNetworkError(error) {
  if (!error) return false;
  if (error.name === 'AbortError') return true;
  const message = String(error.message || '').toLowerCase();
  return message.includes('network')
    || message.includes('timed out')
    || message.includes('socket')
    || message.includes('econnreset')
    || message.includes('ecanceled');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
