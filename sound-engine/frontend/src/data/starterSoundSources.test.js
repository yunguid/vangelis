import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStarterSoundManifest } from '../../scripts/starter_sound_sync_utils.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe('starter sound source manifest', () => {
  const manifestPath = path.join(testDir, 'starterSoundSources.json');
  const readManifest = () => JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  it('passes strict sync-manifest validation', () => {
    const manifest = readManifest();
    expect(() => validateStarterSoundManifest(manifest)).not.toThrow();
  });

  it('contains only expected manifest and pack keys', () => {
    const manifest = readManifest();
    expect(Object.keys(manifest).sort()).toEqual([
      'allowlistedDomains',
      'description',
      'licenseNotice',
      'packs',
      'version'
    ]);

    manifest.packs.forEach((pack) => {
      expect(Object.keys(pack).sort()).toEqual([
        'attribution',
        'id',
        'includeExtensions',
        'license',
        'quality',
        'ref',
        'repo',
        'sourcePathPrefix',
        'targetDir'
      ]);
      expect(Object.keys(pack.quality || {}).sort()).toEqual(['bitDepth', 'sampleRate']);
    });
  });

  it('enforces secure allowlisted source domains', () => {
    const manifest = readManifest();

    expect(Number.isInteger(manifest.version)).toBe(true);
    expect(manifest.version).toBeGreaterThan(0);
    expect(typeof manifest.description).toBe('string');
    expect(manifest.description.trim()).toBe(manifest.description);
    expect(manifest.description.length).toBeGreaterThan(0);
    expect(typeof manifest.licenseNotice).toBe('string');
    expect(manifest.licenseNotice.trim()).toBe(manifest.licenseNotice);
    expect(manifest.licenseNotice.length).toBeGreaterThan(0);
    expect(Array.isArray(manifest.allowlistedDomains)).toBe(true);
    expect(manifest.allowlistedDomains.length).toBeGreaterThan(0);
    expect(manifest.allowlistedDomains.every((domain) => typeof domain === 'string' && domain.length > 0)).toBe(true);
    expect(manifest.allowlistedDomains).toContain('raw.githubusercontent.com');
    expect(manifest.allowlistedDomains).toContain('api.github.com');
    expect(new Set(manifest.allowlistedDomains).size).toBe(manifest.allowlistedDomains.length);
    expect(manifest.allowlistedDomains).toEqual(
      [...manifest.allowlistedDomains].sort((a, b) => a.localeCompare(b))
    );
  });

  it('declares complete metadata for every starter pack source', () => {
    const manifest = readManifest();

    expect(Array.isArray(manifest.packs)).toBe(true);
    expect(manifest.packs.length).toBeGreaterThan(0);

    manifest.packs.forEach((pack) => {
      expect(typeof pack.id).toBe('string');
      expect(typeof pack.repo).toBe('string');
      expect(typeof pack.ref).toBe('string');
      expect(pack.ref).toMatch(/^[0-9a-f]{40}$/);
      expect(typeof pack.sourcePathPrefix).toBe('string');
      expect(typeof pack.targetDir).toBe('string');
      expect(pack.targetDir.startsWith('starter-pack/')).toBe(true);
      expect(pack.targetDir).toBe(pack.targetDir.toLowerCase());
      expect(pack.targetDir).toMatch(/^starter-pack\/[a-z0-9][a-z0-9/_-]*$/);
      expect(typeof pack.license).toBe('string');
      expect(typeof pack.attribution).toBe('string');
      expect(Array.isArray(pack.includeExtensions)).toBe(true);
      expect(pack.includeExtensions.length).toBeGreaterThan(0);
      expect(pack.includeExtensions.every((ext) => ext === ext.toLowerCase())).toBe(true);
      expect(pack.includeExtensions).toEqual(
        [...pack.includeExtensions].sort((a, b) => a.localeCompare(b))
      );
      expect(typeof pack.quality?.sampleRate).toBe('number');
      expect(typeof pack.quality?.bitDepth).toBe('number');
    });
  });
});
