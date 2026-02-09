import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const libraryPath = path.join(frontendRoot, 'src/data/russianMidiLibrary.json');
const outputDir = path.join(frontendRoot, 'public/midi/russian');

const args = new Set(process.argv.slice(2));
const forceDownload = args.has('--force');
const quiet = args.has('--quiet');
const REQUEST_TIMEOUT_MS = 12000;

const log = (...values) => {
  if (!quiet) {
    console.log(...values);
  }
};

const library = JSON.parse(await fs.readFile(libraryPath, 'utf8'));
const discoveryCache = new Map();
const directoryCache = new Map();

await fs.mkdir(outputDir, { recursive: true });

let downloaded = 0;
let skipped = 0;
let failed = 0;
let resolved = 0;

for (const entry of library) {
  const targetPath = path.join(outputDir, `${entry.id}.mid`);
  const exists = await fileExists(targetPath);

  if (exists && !forceDownload) {
    skipped += 1;
    log(`[skip] ${entry.id} already present`);
    continue;
  }

  if (!entry.sourceUrl) {
    failed += 1;
    console.error(`[error] ${entry.id} has no sourceUrl`);
    continue;
  }

  try {
    let resolvedUrl = entry.sourceUrl;
    let response = await fetchWithTimeout(resolvedUrl);

    if (!response.ok) {
      const discoveredUrl = await discoverMidiUrl(entry);
      if (discoveredUrl && discoveredUrl !== resolvedUrl) {
        log(`[resolve] ${entry.id} -> ${discoveredUrl}`);
        resolvedUrl = discoveredUrl;
        response = await fetchWithTimeout(resolvedUrl);
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    log(`[download] ${entry.id}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(targetPath, buffer);
    downloaded += 1;

    if (resolvedUrl !== entry.sourceUrl) {
      resolved += 1;
    }
  } catch (error) {
    failed += 1;
    console.error(`[error] Failed ${entry.id}: ${error.message}`);
  }
}

log(`\nMIDI sync complete: ${downloaded} downloaded (${resolved} via discovery), ${skipped} skipped, ${failed} failed.`);

if (failed > 0) {
  process.exitCode = 1;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function discoverMidiUrl(entry) {
  if (!entry?.sourceUrl) return null;

  let source;
  try {
    source = new URL(entry.sourceUrl);
  } catch {
    return null;
  }

  const pathParts = source.pathname.split('/').filter(Boolean);
  const ftpIndex = pathParts.indexOf('ftp');
  if (ftpIndex === -1 || ftpIndex + 1 >= pathParts.length) {
    return null;
  }

  const composerSlug = pathParts[ftpIndex + 1];
  const subdirs = pathParts.slice(ftpIndex + 2, -1);
  const roots = [];
  for (let i = subdirs.length; i >= 1; i--) {
    const partial = subdirs.slice(0, i).join('/');
    roots.push({
      url: `${source.origin}/ftp/${composerSlug}/${partial}/`,
      maxDepth: Math.min(2, Math.max(1, subdirs.length - i + 1)),
      maxDirectories: 80
    });
  }
  roots.push({
    url: `${source.origin}/ftp/${composerSlug}/`,
    maxDepth: 2,
    maxDirectories: 40
  });

  const tokenSet = new Set([
    ...tokenize(entry.id),
    ...tokenize(entry.name),
    ...tokenize(path.basename(source.pathname, path.extname(source.pathname))),
    ...tokenize(path.dirname(source.pathname).split('/').pop() || '')
  ]);
  const tokens = Array.from(tokenSet).filter(token => token.length > 1);

  let bestMatch = null;
  let bestScore = 0;

  for (const root of roots) {
    const midiUrls = await crawlMidiUrls(root.url, {
      maxDepth: root.maxDepth,
      maxDirectories: root.maxDirectories
    });
    for (const midiUrl of midiUrls) {
      const score = scoreMidiUrl(midiUrl, tokens);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = midiUrl;
      }
    }

    if (bestScore > 0) {
      return bestMatch;
    }
  }

  return null;
}

function tokenize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function scoreMidiUrl(url, tokens) {
  const normalized = String(url || '').toLowerCase();
  if (!normalized.endsWith('.mid')) return 0;

  let score = 0;
  for (const token of tokens) {
    if (normalized.includes(token)) {
      score += token.length;
    }
  }

  // Prefer shorter paths when token scores tie.
  return score * 1000 - normalized.length;
}

async function crawlMidiUrls(rootUrl, options = {}) {
  const maxDepth = Number.isFinite(options.maxDepth) ? options.maxDepth : 2;
  const maxDirectories = Number.isFinite(options.maxDirectories) ? options.maxDirectories : 80;
  const cacheKey = `${rootUrl}|${maxDepth}|${maxDirectories}`;

  if (discoveryCache.has(cacheKey)) {
    return discoveryCache.get(cacheKey);
  }

  const crawlPromise = (async () => {
    const queue = [{ url: rootUrl, depth: 0 }];
    const visited = new Set();
    const midiUrls = new Set();

    while (queue.length > 0 && visited.size < maxDirectories) {
      const { url, depth } = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      const links = await fetchDirectoryLinks(url);
      for (const link of links) {
        if (link.toLowerCase().endsWith('.mid')) {
          midiUrls.add(link);
          continue;
        }

        if (!link.endsWith('/')) continue;
        if (depth >= maxDepth) continue;
        if (visited.has(link)) continue;
        queue.push({ url: link, depth: depth + 1 });
      }
    }

    return Array.from(midiUrls);
  })();

  discoveryCache.set(cacheKey, crawlPromise);
  return crawlPromise;
}

async function fetchDirectoryLinks(directoryUrl) {
  if (directoryCache.has(directoryUrl)) {
    return directoryCache.get(directoryUrl);
  }

  const fetchPromise = (async () => {
    const links = [];
    try {
      const response = await fetchWithTimeout(directoryUrl);
      if (!response.ok) return links;
      const html = await response.text();

      const hrefRegex = /href="([^"]+)"/gi;
      let match;
      while ((match = hrefRegex.exec(html))) {
        const href = match[1];
        if (!href || href.startsWith('?')) continue;
        if (href.startsWith('../')) continue;

        let absolute;
        try {
          absolute = new URL(href, directoryUrl);
        } catch {
          continue;
        }

        if (absolute.origin !== new URL(directoryUrl).origin) continue;
        links.push(absolute.toString());
      }
    } catch {
      return links;
    }
    return links;
  })();

  directoryCache.set(directoryUrl, fetchPromise);
  return fetchPromise;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow'
    });
  } finally {
    clearTimeout(timer);
  }
}
