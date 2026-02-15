import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeManifestFingerprint } from '../../scripts/starter_sound_sync_utils.mjs';

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe('starter sound inventory integrity', () => {
  it('contains only verified or downloaded starter assets', () => {
    const manifestPath = path.join(testDir, 'starterSoundSources.json');
    const inventoryPath = path.join(testDir, 'starterSoundInventory.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const manifestPackById = new Map((manifest.packs || []).map((pack) => [pack.id, pack]));

    expect(Array.isArray(inventory.packs)).toBe(true);
    expect(inventory.packs.length).toBeGreaterThan(0);
    expect(inventory.summary?.failed).toBe(0);
    expect(inventory.sourceManifestVersion).toBe(manifest.version);
    expect(Number.isInteger(inventory.sourceManifestVersion)).toBe(true);
    expect(inventory.sourceManifestVersion).toBeGreaterThan(0);
    expect(inventory.sourceManifestSha256).toBe(computeManifestFingerprint(manifest));
    expect(inventory.sourceManifestSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(inventory.sourceManifestDescription).toBe(manifest.description);
    expect(inventory.sourceManifestLicenseNotice).toBe(manifest.licenseNotice);
    expect(inventory.sourceAllowlistedDomains).toEqual(manifest.allowlistedDomains);
    expect(Array.isArray(inventory.sourcePackIds)).toBe(true);
    expect(inventory.sourcePackCount).toBe(manifest.packs.length);
    expect(Number.isInteger(inventory.sourcePackCount)).toBe(true);
    expect(inventory.sourcePackCount).toBeGreaterThan(0);
    expect(inventory.sourcePackIds).toEqual(manifest.packs.map((pack) => pack.id));
    expect(inventory.sourcePackCount).toBe(inventory.sourcePackIds.length);
    expect(new Set(inventory.sourcePackIds).size).toBe(inventory.sourcePackIds.length);
    expect(inventory.sourcePackIds).toEqual(
      [...inventory.sourcePackIds].sort((a, b) => a.localeCompare(b))
    );
    const packIds = inventory.packs.map((pack) => pack.id);
    expect(packIds).toEqual([...packIds].sort((a, b) => a.localeCompare(b)));
    expect(new Set(packIds).size).toBe(packIds.length);
    expect(inventory.sourcePackIds).toEqual(packIds);

    inventory.packs.forEach((pack) => {
      const manifestPack = manifestPackById.get(pack.id);
      expect(manifestPack).toBeTruthy();
      expect(pack.repo).toBe(manifestPack.repo);
      expect(pack.ref).toBe(manifestPack.ref);
      expect(pack.sourcePathPrefix).toBe(manifestPack.sourcePathPrefix);
      expect(pack.targetDir).toBe(manifestPack.targetDir);
      expect(pack.license).toBe(manifestPack.license);
      expect(pack.attribution).toBe(manifestPack.attribution);
      expect(pack.quality).toEqual(manifestPack.quality);

      const paths = pack.files.map((entry) => entry.path);
      const sorted = [...paths].sort((a, b) => a.localeCompare(b));
      expect(paths).toEqual(sorted);
      expect(new Set(paths).size).toBe(paths.length);
      const packDownloaded = pack.files.filter((entry) => entry.status === 'downloaded').length;
      const packSkipped = pack.files.filter((entry) => entry.status === 'skipped').length;
      const packFailed = pack.files.filter((entry) => entry.status === 'failed').length;
      const packVerified = pack.files.filter((entry) => entry.integrity === 'verified').length;
      const packUnverified = pack.files.filter((entry) => entry.integrity === 'unverified').length;
      const packMismatched = pack.files.filter((entry) => entry.integrity === 'mismatch').length;
      const packTotalBytes = pack.files.reduce(
        (sum, entry) => sum + (Number.isFinite(entry.bytes) ? entry.bytes : 0),
        0
      );
      expect(pack.summary?.totalFiles).toBe(pack.files.length);
      expect(pack.summary?.downloaded).toBe(packDownloaded);
      expect(pack.summary?.skipped).toBe(packSkipped);
      expect(pack.summary?.failed).toBe(packFailed);
      expect(pack.summary?.verified).toBe(packVerified);
      expect(pack.summary?.unverified).toBe(packUnverified);
      expect(pack.summary?.mismatched).toBe(packMismatched);
      expect(pack.summary?.totalBytes).toBe(packTotalBytes);
      expect(pack.summary?.totalMB).toBe(Number((packTotalBytes / (1024 * 1024)).toFixed(2)));

      pack.files.forEach((entry) => {
        expect(entry.path.startsWith('starter-pack/')).toBe(true);
        expect(entry.path.startsWith(`${pack.targetDir}/`)).toBe(true);
        expect(entry.sourcePath.startsWith(`${pack.sourcePathPrefix}/`)).toBe(true);
        const entryExt = path.extname(entry.path).toLowerCase();
        const sourceExt = path.extname(entry.sourcePath).toLowerCase();
        expect(manifestPack.includeExtensions).toContain(entryExt);
        expect(sourceExt).toBe(entryExt);
        expect(['skipped', 'downloaded']).toContain(entry.status);
        expect(['verified', 'unverified', 'skipped']).toContain(entry.integrity);
        expect(Number.isFinite(entry.bytes)).toBe(true);
        expect(entry.bytes).toBeGreaterThan(0);
        if (entry.integrity === 'verified') {
          expect(entry.sourceBlobSha).toBe(entry.localBlobSha);
        }
      });
    });

    const allEntries = inventory.packs.flatMap((pack) => pack.files);
    const allPackSummaries = inventory.packs.map((pack) => pack.summary || {});
    const downloadedCount = allEntries.filter((entry) => entry.status === 'downloaded').length;
    const skippedCount = allEntries.filter((entry) => entry.status === 'skipped').length;
    const failedCount = allEntries.filter((entry) => entry.status === 'failed').length;
    const verifiedCount = allEntries.filter((entry) => entry.integrity === 'verified').length;
    const unverifiedCount = allEntries.filter((entry) => entry.integrity === 'unverified').length;
    const mismatchedCount = allEntries.filter((entry) => entry.integrity === 'mismatch').length;
    const computedTotalBytes = allEntries.reduce(
      (sum, entry) => sum + (Number.isFinite(entry.bytes) ? entry.bytes : 0),
      0
    );
    const summedFromPackSummaries = {
      totalPacks: inventory.packs.length,
      totalFiles: allPackSummaries.reduce((sum, summary) => sum + (Number(summary.totalFiles) || 0), 0),
      downloaded: allPackSummaries.reduce((sum, summary) => sum + (Number(summary.downloaded) || 0), 0),
      skipped: allPackSummaries.reduce((sum, summary) => sum + (Number(summary.skipped) || 0), 0),
      failed: allPackSummaries.reduce((sum, summary) => sum + (Number(summary.failed) || 0), 0),
      verified: allPackSummaries.reduce((sum, summary) => sum + (Number(summary.verified) || 0), 0),
      unverified: allPackSummaries.reduce((sum, summary) => sum + (Number(summary.unverified) || 0), 0),
      mismatched: allPackSummaries.reduce((sum, summary) => sum + (Number(summary.mismatched) || 0), 0),
      totalBytes: allPackSummaries.reduce((sum, summary) => sum + (Number(summary.totalBytes) || 0), 0)
    };

    expect(inventory.summary?.totalPacks).toBe(inventory.packs.length);
    expect(inventory.summary?.totalFiles).toBe(allEntries.length);
    expect(inventory.summary?.downloaded).toBe(downloadedCount);
    expect(inventory.summary?.skipped).toBe(skippedCount);
    expect(inventory.summary?.failed).toBe(failedCount);
    expect(inventory.summary?.verified).toBe(verifiedCount);
    expect(inventory.summary?.unverified).toBe(unverifiedCount);
    expect(inventory.summary?.mismatched).toBe(mismatchedCount);
    expect(inventory.summary?.totalBytes).toBe(computedTotalBytes);
    expect(inventory.summary?.totalMB).toBe(Number((computedTotalBytes / (1024 * 1024)).toFixed(2)));
    expect(inventory.summary?.totalPacks).toBe(summedFromPackSummaries.totalPacks);
    expect(inventory.summary?.totalFiles).toBe(summedFromPackSummaries.totalFiles);
    expect(inventory.summary?.downloaded).toBe(summedFromPackSummaries.downloaded);
    expect(inventory.summary?.skipped).toBe(summedFromPackSummaries.skipped);
    expect(inventory.summary?.failed).toBe(summedFromPackSummaries.failed);
    expect(inventory.summary?.verified).toBe(summedFromPackSummaries.verified);
    expect(inventory.summary?.unverified).toBe(summedFromPackSummaries.unverified);
    expect(inventory.summary?.mismatched).toBe(summedFromPackSummaries.mismatched);
    expect(inventory.summary?.totalBytes).toBe(summedFromPackSummaries.totalBytes);

    expect(typeof inventory.summary?.totalPacks).toBe('number');
    expect(typeof inventory.summary?.totalFiles).toBe('number');
    expect(typeof inventory.summary?.verified).toBe('number');
    expect(typeof inventory.summary?.unverified).toBe('number');
    expect(typeof inventory.summary?.mismatched).toBe('number');
  });
});
