import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { resolveSafeOutputPath, validateStarterSoundManifest } from '../../scripts/starter_sound_sync_utils.mjs';

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

    const unsafe = structuredClone(validManifest);
    unsafe.packs[0].targetDir = '../outside';
    expect(() => validateStarterSoundManifest(unsafe)).toThrow(/targetDir is unsafe/i);
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
});
