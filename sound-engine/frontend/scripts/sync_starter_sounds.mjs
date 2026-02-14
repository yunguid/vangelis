import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeGitBlobSha,
  computeGitBlobShaFromFile,
  getBlobIntegrityStatus,
  hasMatchingByteSize,
  resolveSafeOutputPath,
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
let mismatched = 0;

const inventory = {
  sourceManifestVersion: manifest.version || 1,
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

  log(`[pack] ${pack.id} -> ${filtered.length} files`);

  const packInventory = {
    id: pack.id,
    repo: pack.repo,
    ref: pack.ref,
    sourcePathPrefix: pack.sourcePathPrefix,
    targetDir: pack.targetDir,
    license: pack.license,
    attribution: pack.attribution,
    quality: pack.quality || null,
    files: []
  };

  const tasks = filtered.map((entry) => async () => {
    const relativePath = path.relative(pack.sourcePathPrefix, entry.path);
    const targetPath = resolveSafeOutputPath(outputRoot, pack.targetDir, relativePath);
    const normalizedTargetPath = normalizeToPosix(path.relative(outputRoot, targetPath));
    const targetOwner = `${pack.id}:${entry.path}`;
    const existingOwner = targetPathOwners.get(normalizedTargetPath);
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
    targetPathOwners.set(normalizedTargetPath, targetOwner);
    const exists = await fileExists(targetPath);

    if (exists && !forceDownload) {
      let integrity = 'skipped';
      let localBlobSha = null;
      let sourceBlobSha = entry.sha || null;
      if (verifyExisting) {
        const localStats = await fs.stat(targetPath);
        const localBytes = Number(localStats.size) || 0;
        const expectedBytes = Number(entry.size);
        if (!hasMatchingByteSize(localBytes, expectedBytes)) {
          integrity = 'mismatch';
          console.error(`[error] size mismatch (existing) ${pack.id}/${relativePath}`);
        } else {
          localBlobSha = await computeGitBlobShaFromFile(targetPath);
          integrity = getBlobIntegrityStatus(sourceBlobSha, localBlobSha);
          if (integrity === 'mismatch') {
            console.error(`[error] integrity mismatch (existing) ${pack.id}/${relativePath}`);
          }
        }
        if (integrity === 'mismatch') {
          failed += 1;
          mismatched += 1;
        } else if (integrity === 'verified') {
          verified += 1;
        }
      }

      skipped += 1;
      totalBytes += Number(entry.size) || 0;
      packInventory.files.push({
        path: normalizedTargetPath,
        sourcePath: entry.path,
        bytes: Number(entry.size) || null,
        status: 'skipped',
        sourceBlobSha,
        localBlobSha,
        integrity
      });
      return;
    }

    try {
      const rawUrl = toRawFileUrl(pack.repo, pack.ref, entry.path);
      enforceAllowlist(rawUrl, manifest.allowlistedDomains || []);

      const data = await fetchBuffer(rawUrl);
      const expectedBytes = Number(entry.size);
      if (!hasMatchingByteSize(data.length, expectedBytes)) {
        throw new Error(`Size mismatch for ${relativePath}`);
      }
      const sourceBlobSha = entry.sha || null;
      const localBlobSha = computeGitBlobSha(data);
      const integrity = getBlobIntegrityStatus(sourceBlobSha, localBlobSha);
      if (integrity === 'mismatch') {
        throw new Error(`Checksum mismatch for ${relativePath}`);
      }
      if (integrity === 'verified') {
        verified += 1;
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
  packInventory.files.sort((a, b) => a.path.localeCompare(b.path));
  inventory.packs.push(packInventory);
}

inventory.summary = {
  downloaded,
  skipped,
  failed,
  verified,
  mismatched,
  totalBytes,
  totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2))
};

await fs.writeFile(inventoryPath, JSON.stringify(inventory, null, 2));
log(`\nStarter sound sync complete: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed.`);

if (failed > 0) {
  process.exitCode = 1;
}

async function listPackFiles(pack) {
  const cacheKey = `${pack.repo}@${pack.ref}`;
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
  enforceAllowlist(treeUrl, manifest.allowlistedDomains || []);
  const response = await fetchWithRetry(treeUrl, { headers: githubHeaders() });
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

function enforceAllowlist(url, allowlist) {
  const parsed = new URL(url);
  if (!allowlist.includes(parsed.hostname)) {
    throw new Error(`Blocked host "${parsed.hostname}" (not in allowlist)`);
  }
}

async function fetchBuffer(url) {
  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchWithRetry(url, options = {}) {
  let attempt = 0;
  while (attempt < MAX_FETCH_ATTEMPTS) {
    attempt += 1;
    try {
      const response = await fetchWithTimeout(url, options);
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
