import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SHA_REGEX = /^[0-9a-f]{40}$/;
const REPO_REGEX = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const HOSTNAME_REGEX = /^[A-Za-z0-9.-]+$/;
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
  assert(Array.isArray(value.allowlistedDomains), 'Starter sound manifest must define allowlisted domains');
  assert(value.allowlistedDomains.length > 0, 'Starter sound manifest allowlist cannot be empty');
  assert(Array.isArray(value.packs), 'Starter sound manifest must contain packs');
  assert(value.packs.length > 0, 'Starter sound manifest has no packs');

  const domainSet = new Set();
  value.allowlistedDomains.forEach((domain) => {
    assert(typeof domain === 'string' && domain.length > 0, 'Allowlisted domain must be a non-empty string');
    assert(domain.trim() === domain, `Allowlisted domain contains invalid whitespace: "${domain}"`);
    assert(HOSTNAME_REGEX.test(domain), `Allowlisted domain contains invalid characters: "${domain}"`);
    assert(!domainSet.has(domain), `Duplicate allowlisted domain "${domain}"`);
    domainSet.add(domain);
  });

  const ids = new Set();
  value.packs.forEach((pack) => {
    assert(typeof pack.id === 'string' && pack.id.length > 0, 'Each pack must define a non-empty id');
    assert(pack.id.trim() === pack.id, `Pack id has invalid whitespace: "${pack.id}"`);
    assert(!ids.has(pack.id), `Duplicate pack id "${pack.id}"`);
    ids.add(pack.id);

    assert(typeof pack.repo === 'string' && REPO_REGEX.test(pack.repo), `Pack "${pack.id}" repo must match owner/name`);
    assert(SHA_REGEX.test(pack.ref || ''), `Pack "${pack.id}" must pin an immutable 40-char commit SHA`);
    assert(isSafeRelativePath(pack.sourcePathPrefix), `Pack "${pack.id}" sourcePathPrefix is unsafe`);
    assert(isSafeRelativePath(pack.targetDir), `Pack "${pack.id}" targetDir is unsafe`);
    assert(pack.targetDir.startsWith('starter-pack/'), `Pack "${pack.id}" targetDir must stay within starter-pack/`);
    assert(typeof pack.license === 'string' && pack.license.length > 0, `Pack "${pack.id}" missing license`);
    assert(typeof pack.attribution === 'string' && pack.attribution.length > 0, `Pack "${pack.id}" missing attribution`);

    assert(Array.isArray(pack.includeExtensions), `Pack "${pack.id}" includeExtensions must be an array`);
    assert(pack.includeExtensions.length > 0, `Pack "${pack.id}" includeExtensions cannot be empty`);
    const extensionSet = new Set();
    pack.includeExtensions.forEach((ext) => {
      assert(typeof ext === 'string', `Pack "${pack.id}" extension must be a string`);
      assert(ext === ext.toLowerCase(), `Pack "${pack.id}" extension must be lowercase: "${ext}"`);
      assert(ALLOWED_EXTENSIONS.has(ext), `Pack "${pack.id}" extension "${ext}" is not allowlisted`);
      assert(!extensionSet.has(ext), `Pack "${pack.id}" has duplicate extension "${ext}"`);
      extensionSet.add(ext);
    });

    assert(Number.isInteger(pack.quality?.sampleRate), `Pack "${pack.id}" quality.sampleRate must be an integer`);
    assert(pack.quality.sampleRate >= 8000 && pack.quality.sampleRate <= 384000,
      `Pack "${pack.id}" quality.sampleRate is out of expected range`);
    assert(ALLOWED_BIT_DEPTHS.has(pack.quality?.bitDepth),
      `Pack "${pack.id}" quality.bitDepth must be one of ${Array.from(ALLOWED_BIT_DEPTHS).join(', ')}`);
  });
}
