import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import classicalCatalog from './classicalCatalog.json';
import { BUILT_IN_STUDIES } from './songStudies.js';

const publicDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../public'
);

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

describe('classical catalog manifest', () => {
  const entries = classicalCatalog.entries;

  it('has a schema version and at least the featured entry', () => {
    expect(classicalCatalog.schemaVersion).toBe(1);
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('uses deterministic kebab-case ids with no duplicates', () => {
    for (const entry of entries) {
      expect(entry.id, entry.id).toMatch(ID_PATTERN);
    }
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(new Set(entries.map((entry) => entry.file)).size).toBe(entries.length);
  });

  it('carries complete musicological metadata on every entry', () => {
    for (const entry of entries) {
      expect(entry.title, entry.id).toBeTruthy();
      expect(entry.composer, entry.id).toBeTruthy();
      expect(entry.key, entry.id).toBeTruthy();
      expect(entry.genre, entry.id).toBeTruthy();
      expect(entry.period, entry.id).toBeTruthy();
      expect(entry.catalog, entry.id).toBeTruthy();
      expect(Array.isArray(entry.searchTokens), entry.id).toBe(true);
      expect(entry.searchTokens.length, entry.id).toBeGreaterThan(3);
    }
  });

  it('carries complete provenance + license on every entry', () => {
    for (const entry of entries) {
      const provenance = entry.provenance;
      expect(provenance?.source, entry.id).toBeTruthy();
      expect(provenance?.sourceUrl, entry.id).toMatch(/^https?:\/\//);
      expect(provenance?.encoder, entry.id).toBeTruthy();
      expect(provenance?.license, entry.id).toBeTruthy();
      expect(provenance?.licenseUrl, entry.id).toMatch(/^https?:\/\//);
      expect(provenance?.attribution, entry.id).toBeTruthy();
      expect(provenance?.retrieved, entry.id).toMatch(DATE_PATTERN);
    }
  });

  it('ships every entry as a committed file whose sha256 and size match', () => {
    for (const entry of entries) {
      expect(entry.sha256, entry.id).toMatch(SHA256_PATTERN);
      const diskPath = path.join(publicDir, entry.file);
      expect(fs.existsSync(diskPath), `${entry.id} missing ${entry.file}`).toBe(true);

      const bytes = fs.readFileSync(diskPath);
      expect(bytes.byteLength, `${entry.id} byteSize`).toBe(entry.byteSize);
      const digest = crypto.createHash('sha256').update(bytes).digest('hex');
      expect(digest, `${entry.id} sha256`).toBe(entry.sha256);
    }
  });

  it('keeps featured ranks unique and includes exactly one rank-1 flagship', () => {
    const ranks = entries
      .map((entry) => entry.featuredRank)
      .filter((rank) => rank !== null && rank !== undefined);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(ranks.filter((rank) => rank === 1).length).toBe(1);
  });

  it('features the Schubert G-flat Impromptu D.899 No. 3 as rank 1', () => {
    const flagship = entries.find((entry) => entry.featuredRank === 1);
    expect(flagship.id).toBe('schubert-d899-3-impromptu-gflat');
    expect(flagship.composer).toBe('Franz Schubert');
    expect(flagship.key).toBe('G-flat major');
    expect(flagship.catalog).toEqual({ d: 'D.899', op: 'Op. 90', no: 3 });
  });
});

describe('classical studies wiring', () => {
  it('lists the featured classical study first with metadata + provenance', () => {
    const [first] = BUILT_IN_STUDIES;
    expect(first.slug).toBe('schubert-d899-3-impromptu-gflat');
    expect(first.featuredRank).toBe(1);
    expect(first.title).toBe('Impromptu in G-flat major');
    expect(first.artist).toBe('Franz Schubert');
    expect(first.eyebrow).toContain('Op. 90');
    expect(first.eyebrow).toContain('D.899');
    expect(first.meta.key).toBe('G-flat major');
    expect(first.provenance.license).toContain('CC BY-SA');
    expect(first.midiUrl).toContain('midi/classical/');
  });

  it('keeps every study slug routable and unique', () => {
    const slugs = BUILT_IN_STUDIES.map((study) => study.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(ID_PATTERN);
    }
  });
});
