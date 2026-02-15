import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SHA_REGEX = /^[0-9a-f]{40}$/;
const REPO_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HOSTNAME_REGEX = /^[A-Za-z0-9.-]+$/;
const PACK_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TARGET_DIR_REGEX = /^starter-pack\/[a-z0-9][a-z0-9/_-]*$/;
const LICENSE_TOKEN_REGEX = /^[A-Za-z0-9.+-]+$/;
const REQUIRED_ALLOWLISTED_DOMAINS = ['api.github.com', 'raw.githubusercontent.com'];
const BLOCKED_RESPONSE_CONTENT_TYPE_SNIPPETS = [
  'text/html',
  'application/json',
  'text/xml',
  'application/xml'
];
const ALLOWED_EXTENSIONS = new Set(['.wav', '.flac', '.aif', '.aiff', '.ogg', '.mp3']);
const ALLOWED_BIT_DEPTHS = new Set([16, 24, 32]);
const ALLOWED_MANIFEST_KEYS = new Set([
  'version',
  'description',
  'allowlistedDomains',
  'licenseNotice',
  'packs'
]);
const ALLOWED_PACK_KEYS = new Set([
  'id',
  'repo',
  'ref',
  'sourcePathPrefix',
  'targetDir',
  'includeExtensions',
  'license',
  'attribution',
  'quality'
]);
const ALLOWED_QUALITY_KEYS = new Set(['sampleRate', 'bitDepth']);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNoUnexpectedKeys(value, allowedKeys, context) {
  const keys = Object.keys(value || {});
  const unexpected = keys.filter((key) => !allowedKeys.has(key));
  assert(unexpected.length === 0, `${context} contains unexpected key(s): ${unexpected.join(', ')}`);
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

export function isValidGitSha(value) {
  return typeof value === 'string' && SHA_REGEX.test(value);
}

export function getSafeSourceRelativePath(sourcePathPrefix, sourcePath) {
  const normalizedPrefix = normalizeManifestPath(sourcePathPrefix);
  const normalizedSourcePath = normalizeManifestPath(sourcePath);
  const prefixWithSlash = `${normalizedPrefix}/`;
  assert(
    normalizedSourcePath.startsWith(prefixWithSlash),
    `Source path "${sourcePath}" does not match sourcePathPrefix "${sourcePathPrefix}"`
  );

  const relativePath = normalizedSourcePath.slice(prefixWithSlash.length);
  assert(isSafeRelativePath(relativePath), `Unsafe source relative path "${relativePath}"`);
  return relativePath;
}

export function toPathCollisionKey(value) {
  return normalizeManifestPath(value).toLowerCase();
}

export function isPathWithinPrefix(prefix, candidatePath) {
  const normalizedPrefix = normalizeManifestPath(prefix);
  const normalizedCandidate = normalizeManifestPath(candidatePath);
  return normalizedCandidate === normalizedPrefix
    || normalizedCandidate.startsWith(`${normalizedPrefix}/`);
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

export function assertAllowlistedUrl(url, allowlist = []) {
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:', `Blocked protocol "${parsed.protocol}" for URL "${url}"`);
  assert(!parsed.username && !parsed.password, `Blocked URL credentials for host "${parsed.hostname}"`);
  assert(!parsed.port, `Blocked non-default port "${parsed.port}" for host "${parsed.hostname}"`);
  assert(Array.isArray(allowlist) && allowlist.includes(parsed.hostname),
    `Blocked host "${parsed.hostname}" (not in allowlist)`);
  return parsed;
}

export function assertLikelyAudioContentType(contentType, contextLabel = 'response') {
  if (typeof contentType !== 'string' || contentType.trim().length === 0) {
    return;
  }
  const normalized = contentType.toLowerCase();
  const blocked = BLOCKED_RESPONSE_CONTENT_TYPE_SNIPPETS.some((snippet) => normalized.includes(snippet));
  assert(!blocked, `${contextLabel} content-type "${contentType}" does not look like audio/binary payload`);
}

export function computeGitBlobSha(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, 'utf8');
  return createHash('sha1')
    .update(header)
    .update(buffer)
    .digest('hex');
}

function toCanonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => toCanonicalJson(entry));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => a.localeCompare(b))
      .reduce((acc, key) => {
        acc[key] = toCanonicalJson(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function computeCanonicalSha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(toCanonicalJson(value)), 'utf8')
    .digest('hex');
}

export function computeManifestFingerprint(manifest) {
  return computeCanonicalSha256(manifest);
}

export function computePackMetadataSignature(pack = {}) {
  return computeCanonicalSha256({
    repo: pack.repo,
    ref: pack.ref,
    sourcePathPrefix: pack.sourcePathPrefix,
    targetDir: pack.targetDir,
    includeExtensions: pack.includeExtensions,
    license: pack.license,
    attribution: pack.attribution,
    quality: pack.quality
  });
}

export function buildManifestSnapshot(manifest) {
  const packIds = Array.isArray(manifest?.packs)
    ? manifest.packs.map((pack) => pack.id)
    : [];
  return {
    sourceManifestVersion: manifest?.version,
    sourceManifestSha256: computeManifestFingerprint(manifest),
    sourceManifestDescription: manifest?.description,
    sourceManifestLicenseNotice: manifest?.licenseNotice,
    sourceAllowlistedDomains: [...(manifest?.allowlistedDomains || [])],
    sourcePackCount: packIds.length,
    sourcePackIds: packIds
  };
}

export function normalizeExpectedSize(value) {
  if (value == null) return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }
  return Math.trunc(numberValue);
}

export function getRequiredExpectedSize(value, contextLabel = 'entry') {
  const normalized = normalizeExpectedSize(value);
  assert(normalized != null, `${contextLabel} is missing valid expected size metadata`);
  return normalized;
}

export function hasMatchingByteSize(actualBytes, expectedSize) {
  const normalizedExpected = normalizeExpectedSize(expectedSize);
  if (normalizedExpected == null) {
    return true;
  }
  return actualBytes === normalizedExpected;
}

export function getBlobIntegrityStatus(sourceBlobSha, localBlobSha) {
  if (!isValidGitSha(sourceBlobSha)) {
    return 'unverified';
  }
  if (!isValidGitSha(localBlobSha)) {
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

export function assertNotGitLfsPointer(content, contextLabel = 'payload') {
  assert(!isLikelyGitLfsPointer(content), `${contextLabel} resolved to Git LFS pointer content`);
}

export function summarizeInventoryEntries(entries = []) {
  const totalFiles = entries.length;
  const downloaded = entries.filter((entry) => entry.status === 'downloaded').length;
  const skipped = entries.filter((entry) => entry.status === 'skipped').length;
  const failed = entries.filter((entry) => entry.status === 'failed').length;
  const verified = entries.filter((entry) => entry.integrity === 'verified').length;
  const unverified = entries.filter((entry) => entry.integrity === 'unverified').length;
  const mismatched = entries.filter((entry) => entry.integrity === 'mismatch').length;
  const totalBytes = entries.reduce(
    (sum, entry) => sum + (Number.isFinite(entry.bytes) ? entry.bytes : 0),
    0
  );

  return {
    totalFiles,
    downloaded,
    skipped,
    failed,
    verified,
    unverified,
    mismatched,
    totalBytes,
    totalMB: Number((totalBytes / (1024 * 1024)).toFixed(2))
  };
}

export function validateInventorySummary(summary = {}, contextLabel = 'inventory summary') {
  const countFields = [
    'totalPacks',
    'totalFiles',
    'downloaded',
    'skipped',
    'failed',
    'verified',
    'unverified',
    'mismatched',
    'totalBytes'
  ];

  countFields.forEach((field) => {
    const value = summary[field];
    assert(Number.isInteger(value) && value >= 0, `${contextLabel} field "${field}" must be a non-negative integer`);
  });

  const expectedTotalFiles = summary.downloaded + summary.skipped + summary.failed;
  assert(
    summary.totalFiles === expectedTotalFiles,
    `${contextLabel} totalFiles must equal downloaded + skipped + failed`
  );

  const trackedIntegrityTotal = summary.verified + summary.unverified + summary.mismatched;
  assert(
    trackedIntegrityTotal <= summary.totalFiles,
    `${contextLabel} integrity totals exceed totalFiles`
  );

  const expectedTotalMB = Number((summary.totalBytes / (1024 * 1024)).toFixed(2));
  assert(summary.totalMB === expectedTotalMB, `${contextLabel} totalMB does not match totalBytes`);
}

export function summarizeInventoryPacks(packs = []) {
  const allEntries = packs.flatMap((pack) => pack.files || []);
  const entrySummary = summarizeInventoryEntries(allEntries);
  const totalPacks = packs.length;

  return {
    totalPacks,
    ...entrySummary
  };
}

export function summarizeInventoryPackSummaries(packs = []) {
  const totalPacks = packs.length;
  const summary = {
    totalPacks,
    totalFiles: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    verified: 0,
    unverified: 0,
    mismatched: 0,
    totalBytes: 0
  };

  packs.forEach((pack) => {
    const packSummary = pack?.summary || {};
    summary.totalFiles += Number(packSummary.totalFiles) || 0;
    summary.downloaded += Number(packSummary.downloaded) || 0;
    summary.skipped += Number(packSummary.skipped) || 0;
    summary.failed += Number(packSummary.failed) || 0;
    summary.verified += Number(packSummary.verified) || 0;
    summary.unverified += Number(packSummary.unverified) || 0;
    summary.mismatched += Number(packSummary.mismatched) || 0;
    summary.totalBytes += Number(packSummary.totalBytes) || 0;
  });

  return {
    ...summary,
    totalMB: Number((summary.totalBytes / (1024 * 1024)).toFixed(2))
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
  assertNoUnexpectedKeys(value, ALLOWED_MANIFEST_KEYS, 'Starter sound manifest');
  assert(Number.isInteger(value.version) && value.version >= 1, 'Starter sound manifest version must be a positive integer');
  assert(typeof value.description === 'string' && value.description.trim().length > 0,
    'Starter sound manifest description must be a non-empty string');
  assert(value.description === value.description.trim(),
    'Starter sound manifest description has invalid surrounding whitespace');
  assert(!/[\r\n]/.test(value.description),
    'Starter sound manifest description must be single-line');
  assert(typeof value.licenseNotice === 'string' && value.licenseNotice.trim().length > 0,
    'Starter sound manifest licenseNotice must be a non-empty string');
  assert(value.licenseNotice === value.licenseNotice.trim(),
    'Starter sound manifest licenseNotice has invalid surrounding whitespace');
  assert(!/[\r\n]/.test(value.licenseNotice),
    'Starter sound manifest licenseNotice must be single-line');
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
  REQUIRED_ALLOWLISTED_DOMAINS.forEach((requiredDomain) => {
    assert(
      domainSet.has(requiredDomain),
      `Allowlisted domains must include required domain "${requiredDomain}"`
    );
  });
  assert(
    normalizedDomains.length === REQUIRED_ALLOWLISTED_DOMAINS.length,
    `Allowlisted domains must only include required domains: ${REQUIRED_ALLOWLISTED_DOMAINS.join(', ')}`
  );

  const ids = new Set();
  const packIdsInOrder = [];
  const normalizedTargetDirs = new Set();
  const targetDirMappings = [];
  const sourcePrefixesByRepoRef = new Map();
  value.packs.forEach((pack, packIndex) => {
    assert(pack && typeof pack === 'object' && !Array.isArray(pack), `Pack at index ${packIndex} must be an object`);
    assertNoUnexpectedKeys(pack, ALLOWED_PACK_KEYS, `Pack "${pack?.id || 'unknown'}"`);
    assert(typeof pack.id === 'string' && pack.id.length > 0, 'Each pack must define a non-empty id');
    assert(pack.id.trim() === pack.id, `Pack id has invalid whitespace: "${pack.id}"`);
    assert(PACK_ID_REGEX.test(pack.id), `Pack id "${pack.id}" must be lowercase kebab-case`);
    assert(!ids.has(pack.id), `Duplicate pack id "${pack.id}"`);
    ids.add(pack.id);
    packIdsInOrder.push(pack.id);

    assert(typeof pack.repo === 'string' && REPO_REGEX.test(pack.repo), `Pack "${pack.id}" repo must match owner/name`);
    assert(isValidGitSha(pack.ref), `Pack "${pack.id}" must pin an immutable 40-char commit SHA`);
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
    assert(TARGET_DIR_REGEX.test(pack.targetDir), `Pack "${pack.id}" targetDir must be lowercase kebab/segment path within starter-pack/`);
    assert(pack.targetDir.startsWith('starter-pack/'), `Pack "${pack.id}" targetDir must stay within starter-pack/`);
    const normalizedTargetDir = normalizeManifestPath(pack.targetDir);
    const targetDirCollisionKey = toPathCollisionKey(pack.targetDir);
    assert(!normalizedTargetDirs.has(targetDirCollisionKey),
      `Pack "${pack.id}" targetDir duplicates existing targetDir "${normalizedTargetDir}"`);
    const overlappingTargetDir = targetDirMappings.find((candidate) =>
      targetDirCollisionKey.startsWith(`${candidate.dir}/`)
      || candidate.dir.startsWith(`${targetDirCollisionKey}/`)
    );
    assert(!overlappingTargetDir,
      `Pack "${pack.id}" overlaps targetDir with pack "${overlappingTargetDir?.id}"`);
    normalizedTargetDirs.add(targetDirCollisionKey);
    targetDirMappings.push({ id: pack.id, dir: targetDirCollisionKey });

    const normalizedSourcePrefix = normalizeManifestPath(pack.sourcePathPrefix);
    const sourcePrefixCollisionKey = toPathCollisionKey(pack.sourcePathPrefix);
    const repoRefKey = `${pack.repo.toLowerCase()}@${pack.ref}`;
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
    assert(LICENSE_TOKEN_REGEX.test(pack.license), `Pack "${pack.id}" license must be SPDX-like token format`);
    assert(typeof pack.attribution === 'string' && pack.attribution.trim().length > 0, `Pack "${pack.id}" missing attribution`);
    assert(pack.attribution === pack.attribution.trim(), `Pack "${pack.id}" attribution has invalid surrounding whitespace`);
    assert(!/[\r\n]/.test(pack.attribution), `Pack "${pack.id}" attribution must be single-line`);

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

    assert(pack.quality && typeof pack.quality === 'object' && !Array.isArray(pack.quality),
      `Pack "${pack.id}" quality must be an object`);
    assert(Number.isInteger(pack.quality.sampleRate), `Pack "${pack.id}" quality.sampleRate must be an integer`);
    assert(pack.quality.sampleRate >= 8000 && pack.quality.sampleRate <= 384000,
      `Pack "${pack.id}" quality.sampleRate is out of expected range`);
    assert(ALLOWED_BIT_DEPTHS.has(pack.quality?.bitDepth),
      `Pack "${pack.id}" quality.bitDepth must be one of ${Array.from(ALLOWED_BIT_DEPTHS).join(', ')}`);
    assertNoUnexpectedKeys(pack.quality, ALLOWED_QUALITY_KEYS, `Pack "${pack.id}" quality`);
  });

  const sortedPackIds = [...packIdsInOrder].sort((a, b) => a.localeCompare(b));
  assert(
    packIdsInOrder.every((id, index) => id === sortedPackIds[index]),
    'Pack ids must be sorted lexicographically'
  );
}
