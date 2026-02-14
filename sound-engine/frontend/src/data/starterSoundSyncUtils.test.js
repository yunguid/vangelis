import { describe, expect, it } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {
  computeGitBlobSha,
  computeGitBlobShaFromFile,
  getBlobIntegrityStatus,
  hasMatchingByteSize,
  normalizeExpectedSize,
  resolveSafeOutputPath,
  summarizeInventoryPacks,
  validateStarterSoundManifest
} from '../../scripts/starter_sound_sync_utils.mjs';

const validManifest = {
  version: 1,
  allowlistedDomains: ['raw.githubusercontent.com', 'api.github.com'],
  packs: [
    {
      id: 'ok-pack',
      repo: 'owner/repo',
      ref: '440300901dfe9275fd84e0b7763af1f8443ae62e',
      sourcePathPrefix: 'Strings/Violin Section/susVib',
      targetDir: 'starter-pack/strings/violin',
      includeExtensions: ['.wav'],
      license: 'CC0-1.0',
      attribution: 'Example attribution',
      quality: {
        sampleRate: 44100,
        bitDepth: 24
      }
    }
  ]
};

describe('starter_sound_sync_utils', () => {
  it('rejects duplicate pack ids and unsafe target directories', () => {
    const duplicate = structuredClone(validManifest);
    duplicate.packs.push({ ...duplicate.packs[0] });
    expect(() => validateStarterSoundManifest(duplicate)).toThrow(/Duplicate pack id/i);

    const duplicateTarget = structuredClone(validManifest);
    duplicateTarget.packs.push({
      ...duplicateTarget.packs[0],
      id: 'other-pack'
    });
    expect(() => validateStarterSoundManifest(duplicateTarget)).toThrow(/targetDir duplicates existing targetDir/i);

    const unsafe = structuredClone(validManifest);
    unsafe.packs[0].targetDir = '../outside';
    expect(() => validateStarterSoundManifest(unsafe)).toThrow(/targetDir is unsafe/i);
  });

  it('rejects duplicate source prefix mappings across packs', () => {
    const duplicateSourcePrefix = structuredClone(validManifest);
    duplicateSourcePrefix.packs.push({
      ...duplicateSourcePrefix.packs[0],
      id: 'second-pack',
      targetDir: 'starter-pack/strings/violin-alt'
    });

    expect(() => validateStarterSoundManifest(duplicateSourcePrefix))
      .toThrow(/duplicates existing source prefix mapping/i);

    const uniqueSourcePrefix = structuredClone(validManifest);
    uniqueSourcePrefix.packs.push({
      ...uniqueSourcePrefix.packs[0],
      id: 'second-pack',
      sourcePathPrefix: 'Strings/Viola Section/susvib',
      targetDir: 'starter-pack/strings/viola'
    });

    expect(() => validateStarterSoundManifest(uniqueSourcePrefix))
      .not.toThrow();
  });

  it('rejects disallowed file extensions and non-SHA refs', () => {
    const badExt = structuredClone(validManifest);
    badExt.packs[0].includeExtensions = ['.exe'];
    expect(() => validateStarterSoundManifest(badExt)).toThrow(/not allowlisted/i);

    const badRef = structuredClone(validManifest);
    badRef.packs[0].ref = 'main';
    expect(() => validateStarterSoundManifest(badRef)).toThrow(/40-char commit SHA/i);
  });

  it('resolves safe output paths and blocks traversal', () => {
    const root = '/tmp/vangelis-samples';
    const safe = resolveSafeOutputPath(root, 'starter-pack/strings', 'violin/sample.wav');
    expect(safe).toBe(path.resolve(root, 'starter-pack/strings', 'violin/sample.wav'));

    expect(() => resolveSafeOutputPath(root, 'starter-pack/strings', '../../etc/passwd'))
      .toThrow(/Unsafe relative path/i);
    expect(() => resolveSafeOutputPath(root, '../outside', 'sample.wav'))
      .toThrow(/Unsafe targetDir/i);
  });

  it('computes identical git-blob sha for buffer and file stream', async () => {
    const tmpFilePath = path.join(
      os.tmpdir(),
      `vangelis-sync-utils-${process.pid}-${Date.now()}.wav`
    );
    const payload = Buffer.from('starter-pack-hash-test-payload', 'utf8');

    try {
      await fs.writeFile(tmpFilePath, payload);
      const fromBuffer = computeGitBlobSha(payload);
      const fromFile = await computeGitBlobShaFromFile(tmpFilePath);
      expect(fromFile).toBe(fromBuffer);
    } finally {
      await fs.unlink(tmpFilePath).catch(() => {});
    }
  });

  it('normalizes expected sizes and validates byte-size matches', () => {
    expect(normalizeExpectedSize(120)).toBe(120);
    expect(normalizeExpectedSize('120')).toBe(120);
    expect(normalizeExpectedSize(120.9)).toBe(120);
    expect(normalizeExpectedSize(-1)).toBeNull();
    expect(normalizeExpectedSize('abc')).toBeNull();

    expect(hasMatchingByteSize(120, 120)).toBe(true);
    expect(hasMatchingByteSize(120, '120')).toBe(true);
    expect(hasMatchingByteSize(121, 120)).toBe(false);
    expect(hasMatchingByteSize(120, null)).toBe(true);
    expect(hasMatchingByteSize(120, 'bad')).toBe(true);
  });

  it('classifies blob integrity status deterministically', () => {
    const validSha = '440300901dfe9275fd84e0b7763af1f8443ae62e';
    const otherSha = '7d225b9b9fcd9f4f1d1144c4da4fb5a94832c8e2';

    expect(getBlobIntegrityStatus(validSha, validSha)).toBe('verified');
    expect(getBlobIntegrityStatus(validSha, otherSha)).toBe('mismatch');
    expect(getBlobIntegrityStatus(validSha, null)).toBe('mismatch');
    expect(getBlobIntegrityStatus(null, validSha)).toBe('unverified');
    expect(getBlobIntegrityStatus('invalid-sha', validSha)).toBe('unverified');
  });

  it('derives stable summary counters from inventory entries', () => {
    const summary = summarizeInventoryPacks([
      {
        id: 'pack-a',
        files: [
          { status: 'downloaded', integrity: 'verified', bytes: 1200 },
          { status: 'skipped', integrity: 'verified', bytes: 800 },
          { status: 'failed', integrity: 'mismatch', bytes: null }
        ]
      },
      {
        id: 'pack-b',
        files: [
          { status: 'downloaded', integrity: 'unverified', bytes: 1024 },
          { status: 'skipped', integrity: 'skipped', bytes: 512 }
        ]
      }
    ]);

    expect(summary).toEqual({
      downloaded: 2,
      skipped: 2,
      failed: 1,
      verified: 2,
      mismatched: 1,
      totalBytes: 3536,
      totalMB: Number((3536 / (1024 * 1024)).toFixed(2))
    });
  });
});
