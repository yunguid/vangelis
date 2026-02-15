import { describe, expect, it } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import {
  assertAllowlistedUrl,
  assertExpectedContentLength,
  assertLikelyAudioContentType,
  assertNotGitLfsPointer,
  buildManifestSnapshot,
  classifyExistingFileIntegrity,
  computeManifestFingerprint,
  computePackMetadataSignature,
  computeGitBlobSha,
  computeGitBlobShaFromFile,
  getRequiredExpectedSize,
  getSafeSourceRelativePath,
  getBlobIntegrityStatus,
  hasMatchingByteSize,
  isPathWithinPrefix,
  isValidGitSha,
  isLikelyGitLfsPointer,
  normalizeExpectedSize,
  resolveSafeOutputPath,
  summarizeInventoryEntries,
  summarizeInventoryPackSummaries,
  summarizeInventoryPacks,
  toPathCollisionKey,
  validateInventorySummary,
  validateStarterSoundManifest
} from '../../scripts/starter_sound_sync_utils.mjs';

const validManifest = {
  version: 1,
  description: 'Curated legal source manifest for starter sounds',
  licenseNotice: 'VSCO CE content uses CC0 per upstream docs',
  allowlistedDomains: ['api.github.com', 'raw.githubusercontent.com'],
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
  it('rejects unexpected top-level and pack keys', () => {
    const extraTopLevel = structuredClone(validManifest);
    extraTopLevel.extraFlag = true;
    expect(() => validateStarterSoundManifest(extraTopLevel))
      .toThrow(/manifest contains unexpected key/i);

    const extraPackKey = structuredClone(validManifest);
    extraPackKey.packs[0].extraField = 'oops';
    expect(() => validateStarterSoundManifest(extraPackKey))
      .toThrow(/contains unexpected key/i);

    const extraQualityKey = structuredClone(validManifest);
    extraQualityKey.packs[0].quality.channels = 2;
    expect(() => validateStarterSoundManifest(extraQualityKey))
      .toThrow(/quality contains unexpected key/i);
  });

  it('rejects non-object packs and quality payloads', () => {
    const nonObjectPack = structuredClone(validManifest);
    nonObjectPack.packs = [null];
    expect(() => validateStarterSoundManifest(nonObjectPack))
      .toThrow(/Pack at index 0 must be an object/i);

    const arrayQuality = structuredClone(validManifest);
    arrayQuality.packs[0].quality = [];
    expect(() => validateStarterSoundManifest(arrayQuality))
      .toThrow(/quality must be an object/i);
  });

  it('rejects invalid manifest metadata fields', () => {
    const badVersion = structuredClone(validManifest);
    badVersion.version = 0;
    expect(() => validateStarterSoundManifest(badVersion))
      .toThrow(/version must be a positive integer/i);

    const blankDescription = structuredClone(validManifest);
    blankDescription.description = '   ';
    expect(() => validateStarterSoundManifest(blankDescription))
      .toThrow(/description must be a non-empty string/i);

    const paddedDescription = structuredClone(validManifest);
    paddedDescription.description = ' Example description';
    expect(() => validateStarterSoundManifest(paddedDescription))
      .toThrow(/description has invalid surrounding whitespace/i);

    const multilineDescription = structuredClone(validManifest);
    multilineDescription.description = 'Line 1\nLine 2';
    expect(() => validateStarterSoundManifest(multilineDescription))
      .toThrow(/description must be single-line/i);

    const blankLicenseNotice = structuredClone(validManifest);
    blankLicenseNotice.licenseNotice = '';
    expect(() => validateStarterSoundManifest(blankLicenseNotice))
      .toThrow(/licenseNotice must be a non-empty string/i);

    const multilineLicenseNotice = structuredClone(validManifest);
    multilineLicenseNotice.licenseNotice = 'Line 1\nLine 2';
    expect(() => validateStarterSoundManifest(multilineLicenseNotice))
      .toThrow(/licenseNotice must be single-line/i);
  });

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

    const caseVariantTarget = structuredClone(validManifest);
    caseVariantTarget.packs.push({
      ...caseVariantTarget.packs[0],
      id: 'other-pack',
      targetDir: 'starter-pack/strings/VIOLIN'
    });
    expect(() => validateStarterSoundManifest(caseVariantTarget))
      .toThrow(/targetDir must be lowercase kebab\/segment path/i);

    const slashVariantTarget = structuredClone(validManifest);
    slashVariantTarget.packs.push({
      ...slashVariantTarget.packs[0],
      id: 'other-pack',
      targetDir: 'starter-pack//strings/violin/'
    });
    expect(() => validateStarterSoundManifest(slashVariantTarget)).toThrow(/targetDir must be normalized/i);

    const unsafe = structuredClone(validManifest);
    unsafe.packs[0].targetDir = '../outside';
    expect(() => validateStarterSoundManifest(unsafe)).toThrow(/targetDir is unsafe/i);

    const uppercaseTargetDir = structuredClone(validManifest);
    uppercaseTargetDir.packs[0].targetDir = 'starter-pack/Strings/violin';
    expect(() => validateStarterSoundManifest(uppercaseTargetDir))
      .toThrow(/targetDir must be lowercase kebab\/segment path/i);

    const spacedTargetDir = structuredClone(validManifest);
    spacedTargetDir.packs[0].targetDir = 'starter-pack/strings/solo violin';
    expect(() => validateStarterSoundManifest(spacedTargetDir))
      .toThrow(/targetDir must be lowercase kebab\/segment path/i);

    const nonNormalizedTargetDir = structuredClone(validManifest);
    nonNormalizedTargetDir.packs[0].targetDir = 'starter-pack//strings/violin/';
    expect(() => validateStarterSoundManifest(nonNormalizedTargetDir))
      .toThrow(/targetDir must be normalized/i);

    const nonNormalizedSourcePrefix = structuredClone(validManifest);
    nonNormalizedSourcePrefix.packs[0].sourcePathPrefix = 'Strings//Violin Section/susVib/';
    expect(() => validateStarterSoundManifest(nonNormalizedSourcePrefix))
      .toThrow(/sourcePathPrefix must be normalized/i);

    const overlappingTargetDir = structuredClone(validManifest);
    overlappingTargetDir.packs.push({
      ...overlappingTargetDir.packs[0],
      id: 'overlap-pack',
      sourcePathPrefix: 'Strings/Viola Section/susvib',
      targetDir: 'starter-pack/strings'
    });
    expect(() => validateStarterSoundManifest(overlappingTargetDir))
      .toThrow(/overlaps targetDir/i);
  });

  it('rejects non-kebab-case pack ids', () => {
    const badPackId = structuredClone(validManifest);
    badPackId.packs[0].id = 'Bad_Pack';
    expect(() => validateStarterSoundManifest(badPackId))
      .toThrow(/must be lowercase kebab-case/i);
  });

  it('rejects unsorted pack id ordering', () => {
    const unsortedPackIds = structuredClone(validManifest);
    unsortedPackIds.packs = [
      {
        ...unsortedPackIds.packs[0],
        id: 'zz-pack',
        sourcePathPrefix: 'Strings/Viola Section/susvib',
        targetDir: 'starter-pack/strings/viola'
      },
      {
        ...unsortedPackIds.packs[0],
        id: 'aa-pack',
        sourcePathPrefix: 'Strings/Violin Section/susVib',
        targetDir: 'starter-pack/strings/violin'
      }
    ];
    expect(() => validateStarterSoundManifest(unsortedPackIds))
      .toThrow(/pack ids must be sorted lexicographically/i);
  });

  it('rejects duplicate or overlapping source prefixes per repo ref', () => {
    const duplicateSourcePrefix = structuredClone(validManifest);
    duplicateSourcePrefix.packs.push({
      ...duplicateSourcePrefix.packs[0],
      id: 'second-pack',
      targetDir: 'starter-pack/strings/violin-alt'
    });

    expect(() => validateStarterSoundManifest(duplicateSourcePrefix))
      .toThrow(/overlaps sourcePathPrefix/i);

    const overlappingSourcePrefix = structuredClone(validManifest);
    overlappingSourcePrefix.packs.push({
      ...overlappingSourcePrefix.packs[0],
      id: 'third-pack',
      sourcePathPrefix: 'Strings/Violin Section',
      targetDir: 'starter-pack/strings/violin-parent'
    });

    expect(() => validateStarterSoundManifest(overlappingSourcePrefix))
      .toThrow(/overlaps sourcePathPrefix/i);

    const caseVariantSourcePrefix = structuredClone(validManifest);
    caseVariantSourcePrefix.packs.push({
      ...caseVariantSourcePrefix.packs[0],
      id: 'case-pack',
      sourcePathPrefix: 'strings/violin section/susvib',
      targetDir: 'starter-pack/strings/violin-case'
    });

    expect(() => validateStarterSoundManifest(caseVariantSourcePrefix))
      .toThrow(/overlaps sourcePathPrefix/i);

    const caseVariantRepo = structuredClone(validManifest);
    caseVariantRepo.packs.push({
      ...caseVariantRepo.packs[0],
      id: 'repo-case-pack',
      repo: 'OWNER/REPO',
      targetDir: 'starter-pack/strings/violin-case-repo'
    });

    expect(() => validateStarterSoundManifest(caseVariantRepo))
      .toThrow(/overlaps sourcePathPrefix/i);

    const slashVariantSourcePrefix = structuredClone(validManifest);
    slashVariantSourcePrefix.packs.push({
      ...slashVariantSourcePrefix.packs[0],
      id: 'slash-pack',
      sourcePathPrefix: 'Strings//Violin Section//susVib/',
      targetDir: 'starter-pack/strings/violin-slash'
    });

    expect(() => validateStarterSoundManifest(slashVariantSourcePrefix))
      .toThrow(/sourcePathPrefix must be normalized/i);

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

  it('rejects unsorted includeExtensions ordering', () => {
    const unsortedExtensions = structuredClone(validManifest);
    unsortedExtensions.packs[0].includeExtensions = ['.wav', '.aiff', '.aif'];
    expect(() => validateStarterSoundManifest(unsortedExtensions))
      .toThrow(/includeExtensions must be sorted lexicographically/i);
  });

  it('rejects license or attribution values with surrounding whitespace', () => {
    const paddedLicense = structuredClone(validManifest);
    paddedLicense.packs[0].license = ' CC0-1.0';
    expect(() => validateStarterSoundManifest(paddedLicense))
      .toThrow(/license has invalid surrounding whitespace/i);

    const paddedAttribution = structuredClone(validManifest);
    paddedAttribution.packs[0].attribution = 'Example attribution ';
    expect(() => validateStarterSoundManifest(paddedAttribution))
      .toThrow(/attribution has invalid surrounding whitespace/i);

    const nonTokenLicense = structuredClone(validManifest);
    nonTokenLicense.packs[0].license = 'CC BY 4.0';
    expect(() => validateStarterSoundManifest(nonTokenLicense))
      .toThrow(/license must be SPDX-like token format/i);

    const multilineAttribution = structuredClone(validManifest);
    multilineAttribution.packs[0].attribution = 'Line 1\nLine 2';
    expect(() => validateStarterSoundManifest(multilineAttribution))
      .toThrow(/attribution must be single-line/i);
  });

  it('rejects uppercase allowlisted domain entries', () => {
    const badDomains = structuredClone(validManifest);
    badDomains.allowlistedDomains = ['Raw.GitHubusercontent.com', 'api.github.com'];
    expect(() => validateStarterSoundManifest(badDomains))
      .toThrow(/allowlisted domain must be lowercase/i);
  });

  it('rejects unsorted allowlisted domain order', () => {
    const unsortedDomains = structuredClone(validManifest);
    unsortedDomains.allowlistedDomains = ['raw.githubusercontent.com', 'api.github.com'];
    expect(() => validateStarterSoundManifest(unsortedDomains))
      .toThrow(/must be sorted lexicographically/i);
  });

  it('requires core github allowlisted domains', () => {
    const missingApiDomain = structuredClone(validManifest);
    missingApiDomain.allowlistedDomains = ['raw.githubusercontent.com'];
    expect(() => validateStarterSoundManifest(missingApiDomain))
      .toThrow(/must include required domain "api\.github\.com"/i);

    const missingRawDomain = structuredClone(validManifest);
    missingRawDomain.allowlistedDomains = ['api.github.com'];
    expect(() => validateStarterSoundManifest(missingRawDomain))
      .toThrow(/must include required domain "raw\.githubusercontent\.com"/i);

    const extraDomain = structuredClone(validManifest);
    extraDomain.allowlistedDomains = ['api.github.com', 'example.com', 'raw.githubusercontent.com'];
    expect(() => validateStarterSoundManifest(extraDomain))
      .toThrow(/must only include required domains/i);
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

  it('enforces strict allowlisted https urls', () => {
    expect(assertAllowlistedUrl(
      'https://raw.githubusercontent.com/owner/repo/main/sample.wav',
      validManifest.allowlistedDomains
    )).toBeInstanceOf(URL);

    expect(() => assertAllowlistedUrl(
      'http://raw.githubusercontent.com/owner/repo/main/sample.wav',
      validManifest.allowlistedDomains
    )).toThrow(/Blocked protocol/i);

    expect(() => assertAllowlistedUrl(
      'https://token@raw.githubusercontent.com/owner/repo/main/sample.wav',
      validManifest.allowlistedDomains
    )).toThrow(/Blocked URL credentials/i);

    expect(() => assertAllowlistedUrl(
      'https://raw.githubusercontent.com:444/owner/repo/main/sample.wav',
      validManifest.allowlistedDomains
    )).toThrow(/Blocked non-default port/i);

    expect(() => assertAllowlistedUrl(
      'https://example.com/owner/repo/main/sample.wav',
      validManifest.allowlistedDomains
    )).toThrow(/not in allowlist/i);
  });

  it('rejects clearly non-audio response content types', () => {
    expect(() => assertLikelyAudioContentType('audio/wav', 'sample')).not.toThrow();
    expect(() => assertLikelyAudioContentType('application/octet-stream', 'sample')).not.toThrow();
    expect(() => assertLikelyAudioContentType('', 'sample')).not.toThrow();
    expect(() => assertLikelyAudioContentType(null, 'sample')).not.toThrow();

    expect(() => assertLikelyAudioContentType('text/html; charset=utf-8', 'sample'))
      .toThrow(/does not look like audio\/binary payload/i);
    expect(() => assertLikelyAudioContentType('application/json', 'sample'))
      .toThrow(/does not look like audio\/binary payload/i);
    expect(() => assertLikelyAudioContentType('application/xml', 'sample'))
      .toThrow(/does not look like audio\/binary payload/i);
  });

  it('validates response content-length headers when present', () => {
    expect(() => assertExpectedContentLength(null, 2048, '', 'sample')).not.toThrow();
    expect(() => assertExpectedContentLength('2048', 2048, '', 'sample')).not.toThrow();
    expect(() => assertExpectedContentLength('2048', 2048, 'identity', 'sample')).not.toThrow();
    expect(() => assertExpectedContentLength('1024', 2048, 'gzip', 'sample')).not.toThrow();

    expect(() => assertExpectedContentLength('invalid', 2048, '', 'sample'))
      .toThrow(/content-length header "invalid" is invalid/i);
    expect(() => assertExpectedContentLength('2048.5', 2048, '', 'sample'))
      .toThrow(/content-length header "2048\.5" is invalid/i);
    expect(() => assertExpectedContentLength('1024', 2048, '', 'sample'))
      .toThrow(/content-length 1024 does not match expected size 2048/i);
  });

  it('derives safe relative source paths from manifest prefixes', () => {
    expect(
      getSafeSourceRelativePath(
        'Strings/Violin Section/susVib',
        'Strings/Violin Section/susVib/legato/sample.wav'
      )
    ).toBe('legato/sample.wav');

    expect(
      getSafeSourceRelativePath(
        'Strings/Violin Section/susVib',
        'Strings//Violin Section/susVib//legato/sample.wav'
      )
    ).toBe('legato/sample.wav');

    expect(() =>
      getSafeSourceRelativePath(
        'Strings/Violin Section/susVib',
        'Strings/Viola Section/susVib/sample.wav'
      )
    ).toThrow(/does not match sourcePathPrefix/i);

    expect(() =>
      getSafeSourceRelativePath(
        'Strings/Violin Section/susVib',
        'Strings/Violin Section/susVib/../../outside.wav'
      )
    ).toThrow(/Unsafe source relative path/i);
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
    expect(normalizeExpectedSize(' 120 ')).toBe(120);
    expect(normalizeExpectedSize(120.9)).toBeNull();
    expect(normalizeExpectedSize('120.9')).toBeNull();
    expect(normalizeExpectedSize(-1)).toBeNull();
    expect(normalizeExpectedSize('abc')).toBeNull();

    expect(hasMatchingByteSize(120, 120)).toBe(true);
    expect(hasMatchingByteSize(120, '120')).toBe(true);
    expect(hasMatchingByteSize(121, 120)).toBe(false);
    expect(hasMatchingByteSize(120, null)).toBe(true);
    expect(hasMatchingByteSize(120, 'bad')).toBe(true);
  });

  it('requires valid expected size metadata when requested', () => {
    expect(getRequiredExpectedSize(120, 'entry-1')).toBe(120);
    expect(getRequiredExpectedSize('120', 'entry-2')).toBe(120);
    expect(() => getRequiredExpectedSize(120.1, 'entry-2b'))
      .toThrow(/entry-2b is missing valid expected size metadata/i);
    expect(() => getRequiredExpectedSize(null, 'entry-3'))
      .toThrow(/entry-3 is missing valid expected size metadata/i);
    expect(() => getRequiredExpectedSize('oops', 'entry-4'))
      .toThrow(/entry-4 is missing valid expected size metadata/i);
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

  it('validates git sha strings', () => {
    expect(isValidGitSha('440300901dfe9275fd84e0b7763af1f8443ae62e')).toBe(true);
    expect(isValidGitSha('440300901DFE9275FD84E0B7763AF1F8443AE62E')).toBe(false);
    expect(isValidGitSha('short')).toBe(false);
    expect(isValidGitSha(null)).toBe(false);
  });

  it('classifies existing files with pointer precedence', () => {
    const validSha = '440300901dfe9275fd84e0b7763af1f8443ae62e';
    const otherSha = '7d225b9b9fcd9f4f1d1144c4da4fb5a94832c8e2';

    expect(classifyExistingFileIntegrity({
      localBytes: 128,
      expectedSize: 4096,
      sourceBlobSha: validSha,
      localBlobSha: otherSha,
      isLfsPointer: true
    })).toBe('unverified');

    expect(classifyExistingFileIntegrity({
      localBytes: 128,
      expectedSize: 4096,
      sourceBlobSha: validSha,
      localBlobSha: validSha,
      isLfsPointer: false
    })).toBe('mismatch');

    expect(classifyExistingFileIntegrity({
      localBytes: 4096,
      expectedSize: 4096,
      sourceBlobSha: validSha,
      localBlobSha: validSha,
      isLfsPointer: false
    })).toBe('verified');

    expect(classifyExistingFileIntegrity({
      localBytes: 4096,
      expectedSize: null,
      sourceBlobSha: validSha,
      localBlobSha: otherSha,
      isLfsPointer: false
    })).toBe('mismatch');
  });

  it('detects git lfs pointer payloads', () => {
    const lfsPointer = [
      'version https://git-lfs.github.com/spec/v1',
      'oid sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      'size 123456'
    ].join('\n');
    const lfsPointerWithCrLf = lfsPointer.replaceAll('\n', '\r\n');
    const invalidPointerMissingVersion = [
      'oid sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      'size 123456'
    ].join('\n');
    expect(isLikelyGitLfsPointer(lfsPointer)).toBe(true);
    expect(isLikelyGitLfsPointer(lfsPointerWithCrLf)).toBe(true);
    expect(isLikelyGitLfsPointer(Buffer.from(lfsPointer, 'utf8'))).toBe(true);
    expect(isLikelyGitLfsPointer(invalidPointerMissingVersion)).toBe(false);
    expect(isLikelyGitLfsPointer('not-a-pointer')).toBe(false);
  });

  it('throws when payload resolves to git lfs pointer', () => {
    const lfsPointer = [
      'version https://git-lfs.github.com/spec/v1',
      'oid sha256:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      'size 123456'
    ].join('\n');
    expect(() => assertNotGitLfsPointer(Buffer.from('RIFF....WAVE', 'utf8'), 'audio')).not.toThrow();
    expect(() => assertNotGitLfsPointer(lfsPointer, 'audio'))
      .toThrow(/audio resolved to Git LFS pointer content/i);
  });

  it('normalizes path collision keys case-insensitively', () => {
    expect(toPathCollisionKey('starter-pack/Strings/Violin'))
      .toBe(toPathCollisionKey('Starter-Pack/strings/violin'));
    expect(toPathCollisionKey('starter-pack\\Strings\\Violin\\'))
      .toBe('starter-pack/strings/violin');
    expect(toPathCollisionKey('starter-pack//Strings///Violin/'))
      .toBe('starter-pack/strings/violin');
  });

  it('checks whether candidate paths remain within prefix', () => {
    expect(isPathWithinPrefix('starter-pack/strings', 'starter-pack/strings/violin/a.wav')).toBe(true);
    expect(isPathWithinPrefix('starter-pack/strings', 'starter-pack/strings')).toBe(true);
    expect(isPathWithinPrefix('starter-pack/strings', 'starter-pack/brass/horn.wav')).toBe(false);
    expect(isPathWithinPrefix('starter-pack/strings', 'starter-pack/string')).toBe(false);
  });

  it('derives stable summary counters from inventory entries', () => {
    const entries = [
      { status: 'downloaded', integrity: 'verified', bytes: 1200 },
      { status: 'skipped', integrity: 'verified', bytes: 800 },
      { status: 'failed', integrity: 'mismatch', bytes: null },
      { status: 'downloaded', integrity: 'unverified', bytes: 1024 },
      { status: 'skipped', integrity: 'skipped', bytes: 512 }
    ];

    expect(summarizeInventoryEntries(entries)).toEqual({
      totalFiles: 5,
      downloaded: 2,
      skipped: 2,
      failed: 1,
      verified: 2,
      unverified: 1,
      mismatched: 1,
      totalBytes: 3536,
      totalMB: Number((3536 / (1024 * 1024)).toFixed(2))
    });

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
      totalPacks: 2,
      totalFiles: 5,
      downloaded: 2,
      skipped: 2,
      failed: 1,
      verified: 2,
      unverified: 1,
      mismatched: 1,
      totalBytes: 3536,
      totalMB: Number((3536 / (1024 * 1024)).toFixed(2))
    });
  });

  it('derives stable summary counters from pack summaries', () => {
    const summary = summarizeInventoryPackSummaries([
      {
        id: 'pack-a',
        summary: {
          totalFiles: 2,
          downloaded: 1,
          skipped: 1,
          failed: 0,
          verified: 1,
          unverified: 1,
          mismatched: 0,
          totalBytes: 2048
        }
      },
      {
        id: 'pack-b',
        summary: {
          totalFiles: 3,
          downloaded: 2,
          skipped: 0,
          failed: 1,
          verified: 1,
          unverified: 1,
          mismatched: 1,
          totalBytes: 1024
        }
      }
    ]);

    expect(summary).toEqual({
      totalPacks: 2,
      totalFiles: 5,
      downloaded: 3,
      skipped: 1,
      failed: 1,
      verified: 2,
      unverified: 2,
      mismatched: 1,
      totalBytes: 3072,
      totalMB: Number((3072 / (1024 * 1024)).toFixed(2))
    });
  });

  it('validates summary arithmetic and numeric fields', () => {
    expect(() => validateInventorySummary({
      totalPacks: 2,
      totalFiles: 3,
      downloaded: 1,
      skipped: 1,
      failed: 1,
      verified: 1,
      unverified: 1,
      mismatched: 1,
      totalBytes: 2048,
      totalMB: Number((2048 / (1024 * 1024)).toFixed(2))
    }, 'summary-a')).not.toThrow();

    expect(() => validateInventorySummary({
      totalPacks: 1,
      totalFiles: 2,
      downloaded: 1,
      skipped: 0,
      failed: 0,
      verified: 0,
      unverified: 0,
      mismatched: 0,
      totalBytes: 1024,
      totalMB: Number((1024 / (1024 * 1024)).toFixed(2))
    }, 'summary-b')).toThrow(/totalFiles must equal downloaded \+ skipped \+ failed/i);

    expect(() => validateInventorySummary({
      totalPacks: 1,
      totalFiles: 1,
      downloaded: 1,
      skipped: 0,
      failed: 0,
      verified: 1,
      unverified: 1,
      mismatched: 1,
      totalBytes: 1024,
      totalMB: Number((1024 / (1024 * 1024)).toFixed(2))
    }, 'summary-c')).toThrow(/integrity totals exceed totalFiles/i);
  });

  it('computes deterministic manifest fingerprint', () => {
    const fingerprintA = computeManifestFingerprint(validManifest);
    const fingerprintB = computeManifestFingerprint(structuredClone(validManifest));
    const fingerprintReordered = computeManifestFingerprint({
      packs: structuredClone(validManifest.packs),
      allowlistedDomains: structuredClone(validManifest.allowlistedDomains),
      licenseNotice: validManifest.licenseNotice,
      description: validManifest.description,
      version: validManifest.version
    });
    const fingerprintC = computeManifestFingerprint({
      ...validManifest,
      description: `${validManifest.description} changed`
    });

    expect(fingerprintA).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprintA).toBe(fingerprintB);
    expect(fingerprintA).toBe(fingerprintReordered);
    expect(fingerprintA).not.toBe(fingerprintC);
  });

  it('builds deterministic manifest snapshot metadata', () => {
    const snapshot = buildManifestSnapshot(validManifest);
    expect(snapshot).toEqual({
      sourceManifestVersion: validManifest.version,
      sourceManifestSha256: computeManifestFingerprint(validManifest),
      sourceManifestDescription: validManifest.description,
      sourceManifestLicenseNotice: validManifest.licenseNotice,
      sourceAllowlistedDomains: validManifest.allowlistedDomains,
      sourcePackCount: validManifest.packs.length,
      sourcePackIds: validManifest.packs.map((pack) => pack.id)
    });
  });

  it('computes deterministic pack metadata signatures', () => {
    const basePack = validManifest.packs[0];
    const signatureA = computePackMetadataSignature(basePack);
    const signatureB = computePackMetadataSignature({
      ...basePack,
      quality: { ...basePack.quality }
    });
    const signatureC = computePackMetadataSignature({
      ...basePack,
      targetDir: 'starter-pack/strings/viola'
    });

    expect(signatureA).toMatch(/^[0-9a-f]{64}$/);
    expect(signatureA).toBe(signatureB);
    expect(signatureA).not.toBe(signatureC);
  });
});
