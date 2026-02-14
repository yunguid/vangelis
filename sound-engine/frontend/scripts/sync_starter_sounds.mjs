import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(frontendRoot, 'src/data/starterSoundSources.json');
const outputRoot = path.join(frontendRoot, 'public/samples');
const inventoryPath = path.join(frontendRoot, 'src/data/starterSoundInventory.json');

const args = new Set(process.argv.slice(2));
const forceDownload = args.has('--force');
const quiet = args.has('--quiet');
const maxConcurrent = 6;
const REQUEST_TIMEOUT_MS = 25000;

const treeCache = new Map();

const log = (...values) => {
  if (!quiet) console.log(...values);
};

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

let downloaded = 0;
let skipped = 0;
let failed = 0;
let totalBytes = 0;

const inventory = {
  generatedAt: new Date().toISOString(),
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
    const targetPath = path.join(outputRoot, pack.targetDir, relativePath);
    const exists = await fileExists(targetPath);

    if (exists && !forceDownload) {
      skipped += 1;
      totalBytes += Number(entry.size) || 0;
      packInventory.files.push({
        path: normalizeToPosix(path.relative(outputRoot, targetPath)),
        sourcePath: entry.path,
        bytes: Number(entry.size) || null,
        status: 'skipped'
      });
      return;
    }

    try {
      const rawUrl = toRawFileUrl(pack.repo, pack.ref, entry.path);
      enforceAllowlist(rawUrl, manifest.allowlistedDomains || []);

      const data = await fetchBuffer(rawUrl);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, data);

      downloaded += 1;
      totalBytes += data.length;

      packInventory.files.push({
        path: normalizeToPosix(path.relative(outputRoot, targetPath)),
        sourcePath: entry.path,
        bytes: data.length,
        status: 'downloaded'
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
  inventory.packs.push(packInventory);
}

inventory.summary = {
  downloaded,
  skipped,
  failed,
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
  const response = await fetchWithTimeout(treeUrl, { headers: githubHeaders() });
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
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
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
  const queue = [...taskFactories];
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      // eslint-disable-next-line no-await-in-loop
      await task();
    }
  });
  await Promise.all(workers);
}
