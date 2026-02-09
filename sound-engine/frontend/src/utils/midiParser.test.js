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
