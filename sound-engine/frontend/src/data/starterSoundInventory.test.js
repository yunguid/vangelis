import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));

describe('starter sound inventory integrity', () => {
  it('contains only verified or downloaded starter assets', () => {
    const inventoryPath = path.join(testDir, 'starterSoundInventory.json');
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));

    expect(Array.isArray(inventory.packs)).toBe(true);
    expect(inventory.packs.length).toBeGreaterThan(0);
    expect(inventory.summary?.failed).toBe(0);
    const packIds = inventory.packs.map((pack) => pack.id);
    expect(packIds).toEqual([...packIds].sort((a, b) => a.localeCompare(b)));
    expect(new Set(packIds).size).toBe(packIds.length);

    inventory.packs.forEach((pack) => {
      const paths = pack.files.map((entry) => entry.path);
      const sorted = [...paths].sort((a, b) => a.localeCompare(b));
      expect(paths).toEqual(sorted);
      expect(new Set(paths).size).toBe(paths.length);

      pack.files.forEach((entry) => {
        expect(entry.path.startsWith('starter-pack/')).toBe(true);
        expect(['skipped', 'downloaded']).toContain(entry.status);
        expect(['verified', 'unverified', 'skipped']).toContain(entry.integrity);
        if (entry.integrity === 'verified') {
          expect(entry.sourceBlobSha).toBe(entry.localBlobSha);
        }
      });
    });

    const allEntries = inventory.packs.flatMap((pack) => pack.files);
    const downloadedCount = allEntries.filter((entry) => entry.status === 'downloaded').length;
    const skippedCount = allEntries.filter((entry) => entry.status === 'skipped').length;
    const failedCount = allEntries.filter((entry) => entry.status === 'failed').length;
    const verifiedCount = allEntries.filter((entry) => entry.integrity === 'verified').length;
    const mismatchedCount = allEntries.filter((entry) => entry.integrity === 'mismatch').length;
    const computedTotalBytes = allEntries.reduce(
      (sum, entry) => sum + (Number.isFinite(entry.bytes) ? entry.bytes : 0),
      0
    );

    expect(inventory.summary?.downloaded).toBe(downloadedCount);
    expect(inventory.summary?.skipped).toBe(skippedCount);
    expect(inventory.summary?.failed).toBe(failedCount);
    expect(inventory.summary?.verified).toBe(verifiedCount);
    expect(inventory.summary?.mismatched).toBe(mismatchedCount);
    expect(inventory.summary?.totalBytes).toBe(computedTotalBytes);
    expect(inventory.summary?.totalMB).toBe(Number((computedTotalBytes / (1024 * 1024)).toFixed(2)));

    expect(typeof inventory.summary?.verified).toBe('number');
    expect(typeof inventory.summary?.mismatched).toBe('number');
  });
});
