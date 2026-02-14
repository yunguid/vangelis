import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBuiltInSoundSet } from './instrumentSamples.js';

describe('getBuiltInSoundSet', () => {
  it('maps Rachmaninoff sound set samples to committed public assets', () => {
    const soundSet = getBuiltInSoundSet('rachmaninoff-orchestral-lite');
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const publicDir = path.resolve(testDir, '../../public');

    expect(soundSet).not.toBeNull();
    expect(soundSet?.instruments?.length).toBeGreaterThan(0);

    const missing = soundSet.instruments.filter((instrument) => {
      const relativePath = instrument.sampleUrl.replace(/^\/+/, '');
      return !fs.existsSync(path.join(publicDir, relativePath));
    });

    expect(missing).toEqual([]);
  });
});
