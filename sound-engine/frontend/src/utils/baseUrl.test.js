import { describe, it, expect } from 'vitest';
import { normalizeBase, withBase } from './baseUrl.js';

describe('normalizeBase', () => {
  it('adds a trailing slash when missing', () => {
    expect(normalizeBase('/vangelis')).toBe('/vangelis/');
  });

  it('keeps existing trailing slash', () => {
    expect(normalizeBase('/vangelis/')).toBe('/vangelis/');
  });

  it('falls back to root when empty', () => {
    expect(normalizeBase('')).toBe('/');
  });
});

describe('withBase', () => {
  it('joins absolute base paths', () => {
    expect(withBase('raylib/wavecandy.js', '/vangelis/'))
      .toBe('/vangelis/raylib/wavecandy.js');
  });

  it('normalizes base before joining', () => {
    expect(withBase('raylib/wavecandy.js', '/vangelis'))
      .toBe('/vangelis/raylib/wavecandy.js');
  });

  it('handles root base', () => {
    expect(withBase('raylib/wavecandy.js', '/'))
      .toBe('/raylib/wavecandy.js');
  });

  it('handles relative base', () => {
    expect(withBase('raylib/wavecandy.js', './'))
      .toBe('./raylib/wavecandy.js');
  });

  it('handles absolute URL base', () => {
    expect(withBase('raylib/wavecandy.js', 'https://example.com/vangelis/'))
      .toBe('https://example.com/vangelis/raylib/wavecandy.js');
  });
});
