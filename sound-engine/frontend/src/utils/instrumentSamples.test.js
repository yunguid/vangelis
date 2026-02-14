import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBuiltInSoundSet, listBuiltInSoundSets } from './instrumentSamples.js';

describe('instrumentSamples manifest', () => {
  it('returns null for unknown soundsets', () => {
    expect(getBuiltInSoundSet('missing-soundset')).toBeNull();
  });

  it('materializes sample URLs from sample paths', () => {
    const soundSet = getBuiltInSoundSet('rachmaninoff-orchestral-lite');
    expect(soundSet).toBeTruthy();
    expect(soundSet.instruments.length).toBeGreaterThan(0);
    expect(soundSet.instruments.every((instrument) => instrument.sampleUrl.includes('samples/'))).toBe(true);
  });

  it('lists all built-in soundsets with ids', () => {
    const soundSets = listBuiltInSoundSets();
    expect(soundSets.length).toBeGreaterThan(0);
    expect(soundSets.every((soundSet) => typeof soundSet.id === 'string' && soundSet.id.length > 0)).toBe(true);
  });

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
