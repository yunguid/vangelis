import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBuiltInMidiFiles } from './midiParser.js';

describe('getBuiltInMidiFiles', () => {
  it('prefixes built-in midi paths with a deployment base', () => {
    const files = getBuiltInMidiFiles('/vangelis/');

    expect(files.length).toBeGreaterThan(0);
    expect(files.every((file) => file.path.startsWith('/vangelis/midi/'))).toBe(true);
  });

  it('keeps root-relative paths when base is root', () => {
    const files = getBuiltInMidiFiles('/');
    const vocalise = files.find((file) => file.id === 'rachmaninoff-vocalise');

    expect(vocalise?.path).toBe('/midi/rachmaninoff-vocalise.mid');
  });

  it('assigns piano+strings layering metadata to Rachmaninoff concerto files', () => {
    const files = getBuiltInMidiFiles('/');
    const rachConcerto = files.filter((file) => file.id.startsWith('rachmaninoff-concerto2-'));

    expect(rachConcerto.length).toBe(3);
    expect(rachConcerto.every((file) => file.soundSetId === 'rachmaninoff-orchestral-lite')).toBe(true);
    expect(rachConcerto.every((file) => Array.isArray(file.layerFamilies))).toBe(true);
    expect(rachConcerto.every((file) => file.layerFamilies.includes('piano'))).toBe(true);
    expect(rachConcerto.every((file) => file.layerFamilies.includes('strings'))).toBe(true);
  });

  it('assigns cinematic starter layering metadata to cello and vocalise pieces', () => {
    const files = getBuiltInMidiFiles('/');
    const cello = files.find((file) => file.id === 'bach-cello-prelude');
    const vocalise = files.find((file) => file.id === 'rachmaninoff-vocalise');

    expect(cello?.soundSetId).toBe('cinematic-starter-pack');
    expect(cello?.layerFamilies).toEqual(['strings']);

    expect(vocalise?.soundSetId).toBe('cinematic-starter-pack');
    expect(vocalise?.layerFamilies).toEqual(['piano', 'strings', 'brass']);
  });

  it('assigns orchestral extended layering metadata to selected Russian library pieces', () => {
    const files = getBuiltInMidiFiles('/');
    const mussorgsky = files.find((file) => file.id === 'mussorgsky-night-on-bald-mountain');
    const alyabyev = files.find((file) => file.id === 'alyabyev-the-nightingale');

    expect(mussorgsky?.soundSetId).toBe('orchestral-extended-starter');
    expect(mussorgsky?.layerFamilies).toEqual(['strings', 'brass', 'reed']);

    expect(alyabyev?.soundSetId).toBe('orchestral-extended-starter');
    expect(alyabyev?.layerFamilies).toEqual(['strings', 'reed', 'piano']);
  });

  it('maps every built-in entry to a committed midi file', () => {
    const files = getBuiltInMidiFiles('/');
    const testDir = path.dirname(fileURLToPath(import.meta.url));
    const publicDir = path.resolve(testDir, '../../public');
    const missing = files.filter((file) => {
      const relativePath = file.path.replace(/^\/+/, '');
      return !fs.existsSync(path.join(publicDir, relativePath));
    });

    expect(missing).toEqual([]);
  });
});
