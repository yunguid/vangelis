import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SHA_REGEX = /^[0-9a-f]{40}$/;
const REPO_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HOSTNAME_REGEX = /^[A-Za-z0-9.-]+$/;
const PACK_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ALLOWED_EXTENSIONS = new Set(['.wav', '.flac', '.aif', '.aiff', '.ogg', '.mp3']);
const ALLOWED_BIT_DEPTHS = new Set([16, 24, 32]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasPathTraversal(value) {
  const normalized = String(value || '').replaceAll('\\', '/');
  return normalized.split('/').includes('..');
}

function isSafeRelativePath(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.trim() === value
    && !path.isAbsolute(value)
    && !value.startsWith('./')
    && !value.includes('\\')
    && !hasPathTraversal(value);
}

function normalizeManifestPath(value) {
  return String(value || '')
    .replaceAll('\\', '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/g, '');
}

export function toPathCollisionKey(value) {
  return normalizeManifestPath(value).toLowerCase();
}

export function resolveSafeOutputPath(outputRoot, targetDir, relativePath) {
  assert(isSafeRelativePath(targetDir), `Unsafe targetDir "${targetDir}"`);
  assert(isSafeRelativePath(relativePath), `Unsafe relative path "${relativePath}"`);

  const root = path.resolve(outputRoot);
  const resolved = path.resolve(root, targetDir, relativePath);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  assert(resolved.startsWith(rootWithSep), `Resolved path escapes output root: ${resolved}`);

  return resolved;
}

export function computeGitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return createHash('sha1')
    .update(header)
    .update(buffer)
    .digest('hex');
}

export function normalizeExpectedSize(value) {
  if (value == null) return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }
  return Math.trunc(numberValue);
}

export function hasMatchingByteSize(actualBytes, expectedSize) {
  const normalizedExpected = normalizeExpectedSize(expectedSize);
  if (normalizedExpected == null) {
    return true;
  }
  return actualBytes === normalizedExpected;
}

export function getBlobIntegrityStatus(sourceBlobSha, localBlobSha) {
  if (!sourceBlobSha || !SHA_REGEX.test(sourceBlobSha)) {
    return 'unverified';
  }
  if (!localBlobSha || !SHA_REGEX.test(localBlobSha)) {
    return 'mismatch';
  }
  return sourceBlobSha === localBlobSha ? 'verified' : 'mismatch';
}

export function classifyExistingFileIntegrity({
  localBytes,
  expectedSize,
  sourceBlobSha,
  localBlobSha,
  isLfsPointer = false
}) {
  if (isLfsPointer) {
    return 'unverified';
  }
  if (!hasMatchingByteSize(localBytes, expectedSize)) {
    return 'mismatch';
  }
  return getBlobIntegrityStatus(sourceBlobSha, localBlobSha);
}

export function isLikelyGitLfsPointer(content) {
  const text = typeof content === 'string'
    ? content
    : Buffer.isBuffer(content)
      ? content.toString('utf8')
      : '';

  if (!text) return false;
  const lines = text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines[0] !== 'version https://git-lfs.github.com/spec/v1') {
    return false;
  }

  const hasOid = lines.some((line) => /^oid sha256:[0-9a-f]{64}$/i.test(line));
  const hasSize = lines.some((line) => /^size \d+$/i.test(line));
  return hasOid && hasSize;
}

export function summarizeInventoryPacks(packs = []) {
  const allEntries = packs.flatMap((pack) => pack.files || []);
  const downloaded = allEntries.filter((entry) => entry.status === 'downloaded').length;
  const skipped = allEntries.filter((entry) => entry.status === 'skipped').length;
  const failed = allEntries.filter((entry) => entry.status === 'failed').length;
  const verified = allEntries.filter((entry) => entry.integrity === 'verified').length;
  const mismatched = allEntries.filter((entry) => entry.integrity === 'mismatch').length;
  const totalBytes = allEntries.reduce(
    (sum, entry) => sum + (Number.isFinite(entry.bytes) ? entry.bytes : 0),
    0
  );

  return {
    downloaded,
    skipped,
    failed,
    verified,
    mismatched,
    totalBytes,
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2))
  };
}

export async function computeGitBlobShaFromFile(filePath) {
  const fileStat = await fsp.stat(filePath);
  const hash = createHash('sha1');
  hash.update(Buffer.from(`blob ${fileStat.size}\0`, 'utf8'));

  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => {
      hash.update(chunk);
    });
    stream.on('error', reject);
    stream.on('end', resolve);
  });

  return hash.digest('hex');
}

export function validateStarterSoundManifest(value) {
  assert(value && typeof value === 'object', 'Starter sound manifest is invalid');
  assert(Number.isInteger(value.version) && value.version >= 1, 'Starter sound manifest version must be a positive integer');
  assert(typeof value.description === 'string' && value.description.trim().length > 0,
    'Starter sound manifest description must be a non-empty string');
  assert(value.description === value.description.trim(),
    'Starter sound manifest description has invalid surrounding whitespace');
  assert(typeof value.licenseNotice === 'string' && value.licenseNotice.trim().length > 0,
    'Starter sound manifest licenseNotice must be a non-empty string');
  assert(value.licenseNotice === value.licenseNotice.trim(),
    'Starter sound manifest licenseNotice has invalid surrounding whitespace');
  assert(Array.isArray(value.allowlistedDomains), 'Starter sound manifest must define allowlisted domains');
  assert(value.allowlistedDomains.length > 0, 'Starter sound manifest allowlist cannot be empty');
  assert(Array.isArray(value.packs), 'Starter sound manifest must contain packs');
  assert(value.packs.length > 0, 'Starter sound manifest has no packs');

  const domainSet = new Set();
  const normalizedDomains = [];
  value.allowlistedDomains.forEach((domain) => {
    assert(typeof domain === 'string' && domain.length > 0, 'Allowlisted domain must be a non-empty string');
    assert(domain.trim() === domain, `Allowlisted domain contains invalid whitespace: "${domain}"`);
    const normalizedDomain = domain.toLowerCase();
    assert(domain === normalizedDomain, `Allowlisted domain must be lowercase: "${domain}"`);
    assert(HOSTNAME_REGEX.test(normalizedDomain), `Allowlisted domain contains invalid characters: "${domain}"`);
    assert(!domainSet.has(normalizedDomain), `Duplicate allowlisted domain "${domain}"`);
    domainSet.add(normalizedDomain);
    normalizedDomains.push(normalizedDomain);
  });
  const sortedDomains = [...normalizedDomains].sort((a, b) => a.localeCompare(b));
  assert(
    normalizedDomains.every((domain, index) => domain === sortedDomains[index]),
    'Allowlisted domains must be sorted lexicographically'
  );

  const ids = new Set();
  const packIdsInOrder = [];
  const normalizedTargetDirs = new Set();
  const sourcePrefixesByRepoRef = new Map();
  value.packs.forEach((pack) => {
    assert(typeof pack.id === 'string' && pack.id.length > 0, 'Each pack must define a non-empty id');
    assert(pack.id.trim() === pack.id, `Pack id has invalid whitespace: "${pack.id}"`);
    assert(PACK_ID_REGEX.test(pack.id), `Pack id "${pack.id}" must be lowercase kebab-case`);
    assert(!ids.has(pack.id), `Duplicate pack id "${pack.id}"`);
    ids.add(pack.id);
    packIdsInOrder.push(pack.id);

    assert(typeof pack.repo === 'string' && REPO_REGEX.test(pack.repo), `Pack "${pack.id}" repo must match owner/name`);
    assert(SHA_REGEX.test(pack.ref || ''), `Pack "${pack.id}" must pin an immutable 40-char commit SHA`);
    assert(isSafeRelativePath(pack.sourcePathPrefix), `Pack "${pack.id}" sourcePathPrefix is unsafe`);
    assert(
      normalizeManifestPath(pack.sourcePathPrefix) === pack.sourcePathPrefix,
      `Pack "${pack.id}" sourcePathPrefix must be normalized (no duplicate/trailing slashes)`
    );
    assert(isSafeRelativePath(pack.targetDir), `Pack "${pack.id}" targetDir is unsafe`);
    assert(
      normalizeManifestPath(pack.targetDir) === pack.targetDir,
      `Pack "${pack.id}" targetDir must be normalized (no duplicate/trailing slashes)`
    );
    assert(pack.targetDir.startsWith('starter-pack/'), `Pack "${pack.id}" targetDir must stay within starter-pack/`);
    const normalizedTargetDir = normalizeManifestPath(pack.targetDir);
    const targetDirCollisionKey = toPathCollisionKey(pack.targetDir);
    assert(!normalizedTargetDirs.has(targetDirCollisionKey),
      `Pack "${pack.id}" targetDir duplicates existing targetDir "${normalizedTargetDir}"`);
    normalizedTargetDirs.add(targetDirCollisionKey);

    const normalizedSourcePrefix = normalizeManifestPath(pack.sourcePathPrefix);
    const sourcePrefixCollisionKey = toPathCollisionKey(pack.sourcePathPrefix);
    const repoRefKey = `${pack.repo}@${pack.ref}`;
    const existingPrefixes = sourcePrefixesByRepoRef.get(repoRefKey) || [];
    const overlapping = existingPrefixes.find((candidate) =>
      sourcePrefixCollisionKey === candidate.prefix
      || sourcePrefixCollisionKey.startsWith(`${candidate.prefix}/`)
      || candidate.prefix.startsWith(`${sourcePrefixCollisionKey}/`)
    );
    assert(!overlapping,
      `Pack "${pack.id}" overlaps sourcePathPrefix with pack "${overlapping?.id}" for ${repoRefKey}`);
    existingPrefixes.push({ id: pack.id, prefix: sourcePrefixCollisionKey });
    sourcePrefixesByRepoRef.set(repoRefKey, existingPrefixes);

    assert(typeof pack.license === 'string' && pack.license.trim().length > 0, `Pack "${pack.id}" missing license`);
    assert(pack.license === pack.license.trim(), `Pack "${pack.id}" license has invalid surrounding whitespace`);
    assert(typeof pack.attribution === 'string' && pack.attribution.trim().length > 0, `Pack "${pack.id}" missing attribution`);
    assert(pack.attribution === pack.attribution.trim(), `Pack "${pack.id}" attribution has invalid surrounding whitespace`);

    assert(Array.isArray(pack.includeExtensions), `Pack "${pack.id}" includeExtensions must be an array`);
    assert(pack.includeExtensions.length > 0, `Pack "${pack.id}" includeExtensions cannot be empty`);
    const extensionSet = new Set();
    const extensionsInOrder = [];
    pack.includeExtensions.forEach((ext) => {
      assert(typeof ext === 'string', `Pack "${pack.id}" extension must be a string`);
      assert(ext === ext.toLowerCase(), `Pack "${pack.id}" extension must be lowercase: "${ext}"`);
      assert(ALLOWED_EXTENSIONS.has(ext), `Pack "${pack.id}" extension "${ext}" is not allowlisted`);
      assert(!extensionSet.has(ext), `Pack "${pack.id}" has duplicate extension "${ext}"`);
      extensionSet.add(ext);
      extensionsInOrder.push(ext);
    });
    const sortedExtensions = [...extensionsInOrder].sort((a, b) => a.localeCompare(b));
    assert(
      extensionsInOrder.every((ext, index) => ext === sortedExtensions[index]),
      `Pack "${pack.id}" includeExtensions must be sorted lexicographically`
    );

    assert(Number.isInteger(pack.quality?.sampleRate), `Pack "${pack.id}" quality.sampleRate must be an integer`);
    assert(pack.quality.sampleRate >= 8000 && pack.quality.sampleRate <= 384000,
      `Pack "${pack.id}" quality.sampleRate is out of expected range`);
    assert(ALLOWED_BIT_DEPTHS.has(pack.quality?.bitDepth),
      `Pack "${pack.id}" quality.bitDepth must be one of ${Array.from(ALLOWED_BIT_DEPTHS).join(', ')}`);
  });

  const sortedPackIds = [...packIdsInOrder].sort((a, b) => a.localeCompare(b));
  assert(
    packIdsInOrder.every((id, index) => id === sortedPackIds[index]),
    'Pack ids must be sorted lexicographically'
  );
}
