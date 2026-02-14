import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAllSoundSetManifests } from './soundSets.js';
import { isUsableInstrumentDefinition } from '../utils/instrumentManifestGuards.js';

describe('sound set manifest quality and integrity', () => {
  it('ensures every sample path points to a committed starter-pack file', () => {
    const soundSets = getAllSoundSetManifests();
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const publicDir = path.resolve(testDir, '../../public');
    const missing = [];

    soundSets.forEach((soundSet) => {
      soundSet.instruments.forEach((instrument) => {
        const relativePath = `samples/${instrument.samplePath}`;
        const absolutePath = path.join(publicDir, relativePath);
        if (!fs.existsSync(absolutePath)) {
          missing.push({
            soundSetId: soundSet.id,
            instrumentId: instrument.id,
            samplePath: instrument.samplePath
          });
        }
      });
    });

    expect(missing).toEqual([]);
  });

  it('ensures each layered family has at least one ranged instrument zone', () => {
    const soundSets = getAllSoundSetManifests();

    soundSets.forEach((soundSet) => {
      const families = new Set(soundSet.layerFamilies || []);
      families.forEach((family) => {
        const candidates = soundSet.instruments.filter((instrument) =>
          Array.isArray(instrument.families) && instrument.families.includes(family)
        );
        expect(candidates.length).toBeGreaterThan(0);
      });
    });
  });

  it('ensures every instrument entry passes runtime safety guards', () => {
    const soundSets = getAllSoundSetManifests();
    const invalid = [];

    soundSets.forEach((soundSet) => {
      soundSet.instruments.forEach((instrument) => {
        if (!isUsableInstrumentDefinition(instrument)) {
          invalid.push({
            soundSetId: soundSet.id,
            instrumentId: instrument.id
          });
        }
      });
    });

    expect(invalid).toEqual([]);
  });
});
