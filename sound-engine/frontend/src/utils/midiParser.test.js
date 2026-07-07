import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBuiltInMidiFiles } from './midiParser.js';
import {
  ORIGINAL_CUE_IDS,
  ORIGINAL_CUE_NAMES,
  WORD_STEM_CAP,
  buildOriginalCueNameMap,
  wordStemsOf
} from '../data/originalCueNames.js';

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

  it('assigns layered playback metadata to cello and vocalise pieces', () => {
    const files = getBuiltInMidiFiles('/');
    const cello = files.find((file) => file.id === 'bach-cello-prelude');
    const vocalise = files.find((file) => file.id === 'rachmaninoff-vocalise');

    expect(cello?.soundSetId).toBe('cinematic-starter-pack');
    expect(cello?.layerFamilies).toEqual(['strings']);

    expect(vocalise?.soundSetId).toBe('orchestral-extended-starter');
    expect(vocalise?.layerFamilies).toEqual(['strings', 'reed', 'piano']);
  });

  it('assigns orchestral extended layering metadata to selected Russian library pieces', () => {
    const files = getBuiltInMidiFiles('/');
    const mussorgsky = files.find((file) => file.id === 'mussorgsky-night-on-bald-mountain');
    const alyabyev = files.find((file) => file.id === 'alyabyev-the-nightingale');
    const tchaikovskyMarch = files.find((file) => file.id === 'tchaikovsky-op39-05-march-wooden-soldiers');
    const scriabin = files.find((file) => file.id === 'scriabin-op11-13-prelude');

    expect(mussorgsky?.soundSetId).toBe('orchestral-extended-starter');
    expect(mussorgsky?.layerFamilies).toEqual(['strings', 'brass', 'reed']);

    expect(alyabyev?.soundSetId).toBe('orchestral-extended-starter');
    expect(alyabyev?.layerFamilies).toEqual(['strings', 'reed', 'piano']);

    expect(tchaikovskyMarch?.soundSetId).toBe('orchestral-extended-starter');
    expect(tchaikovskyMarch?.layerFamilies).toEqual(['strings', 'brass', 'piano']);

    expect(scriabin?.soundSetId).toBe('cinematic-starter-pack');
    expect(scriabin?.layerFamilies).toEqual(['piano', 'strings']);
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

describe('original cues corpus', () => {
  const originalsDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..', '..', 'public', 'midi', 'originals'
  );
  const originals = getBuiltInMidiFiles('/').filter((file) => file.id.startsWith('original-'));

  it('registers a full corpus of 58 cues', () => {
    expect(originals.length).toBe(58);
  });

  it('names all 58 originals with unique, parenthesis-free code names', () => {
    expect(originals.length).toBe(58);

    const names = originals.map((file) => file.name);
    expect(new Set(names).size).toBe(names.length);

    for (const name of names) {
      expect(name).not.toContain('(');
      expect(name).not.toContain(')');
    }

    // The old cringe names (epic/genre words) must not survive as display
    // names — this is the concrete regression check for the P5 rename.
    const cringeWords = [
      'Neon', 'Replicants', 'Anthem', 'Hyperpop', 'Rage', 'Cathedral',
      'Chase', 'Elegy', 'Ballad'
    ];
    for (const name of names) {
      for (const word of cringeWords) {
        expect(name, `"${name}" should not contain "${word}"`).not.toContain(word);
      }
    }
  });

  it('agrees with the shared name map on every original cue', () => {
    // midiParser.js derives display names from originalCueNames.js; this
    // pins that midiParser's output and the shared map never drift apart.
    expect(originals.length).toBe(ORIGINAL_CUE_IDS.length);
    for (const file of originals) {
      expect(file.name).toBe(ORIGINAL_CUE_NAMES[file.id]);
    }
  });

  it('regenerates the exact same names from the committed id list (deterministic, no re-roll drift)', () => {
    const fresh = buildOriginalCueNameMap(ORIGINAL_CUE_IDS);
    for (const id of ORIGINAL_CUE_IDS) {
      expect(fresh[id], id).toBe(ORIGINAL_CUE_NAMES[id]);
    }
  });

  it(`never reuses a word stem more than ${WORD_STEM_CAP} times across the corpus`, () => {
    // Repeated odd words (krill x4, HUSK x3...) betray a small-wordlist
    // PRNG; a human naming files weirdly doesn't do that. Numbers are
    // exempt — the cap applies to the word part only.
    const stemCounts = new Map();
    for (const name of Object.values(ORIGINAL_CUE_NAMES)) {
      for (const stem of wordStemsOf(name)) {
        stemCounts.set(stem, (stemCounts.get(stem) || 0) + 1);
      }
    }
    for (const [stem, count] of stemCounts) {
      expect(count, `stem "${stem}" used ${count} times`).toBeLessThanOrEqual(WORD_STEM_CAP);
    }
  });

  it('every registered original cue exists on disk and parses as real MIDI', async () => {
    const { Midi } = await import('@tonejs/midi');
    for (const file of originals) {
      const diskPath = path.join(originalsDir, `${file.id}.mid`);
      expect(fs.existsSync(diskPath), file.id).toBe(true);
      const midi = new Midi(fs.readFileSync(diskPath));
      const noteCount = midi.tracks.reduce((sum, track) => sum + track.notes.length, 0);
      expect(noteCount, file.id).toBeGreaterThan(10);
      expect(midi.duration, file.id).toBeGreaterThan(10);
    }
  });

  it('every .mid file on disk embeds the same name scripts/generate_original_midis.mjs wrote from the shared map (midiParser and the generator agree)', async () => {
    // scripts/generate_original_midis.mjs's writeMidi() sets
    // midi.header.name from getOriginalCueName(id) — the same function
    // midiParser.js uses. Reading the embedded name back off the committed
    // .mid files and comparing to midiParser's output pins that the two
    // consumers never drift, without re-running the generator (which has
    // file-writing side effects) inside the test suite.
    const { Midi } = await import('@tonejs/midi');
    for (const file of originals) {
      const diskPath = path.join(originalsDir, `${file.id}.mid`);
      const midi = new Midi(fs.readFileSync(diskPath));
      expect(midi.header.name, file.id).toBe(file.name);
      expect(midi.header.name, file.id).toBe(ORIGINAL_CUE_NAMES[file.id]);
    }
  });
});
