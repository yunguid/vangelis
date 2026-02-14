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

    inventory.packs.forEach((pack) => {
      pack.files.forEach((entry) => {
        expect(entry.path.startsWith('starter-pack/')).toBe(true);
        expect(['skipped', 'downloaded']).toContain(entry.status);
        expect(['verified', 'unverified', 'skipped']).toContain(entry.integrity);
        if (entry.integrity === 'verified') {
          expect(entry.sourceBlobSha).toBe(entry.localBlobSha);
        }
      });
    });
  });
});
