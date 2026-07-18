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
    expect(withBase('assets/favicon.svg', '/vangelis/'))
      .toBe('/vangelis/assets/favicon.svg');
  });

  it('normalizes base before joining', () => {
    expect(withBase('assets/favicon.svg', '/vangelis'))
      .toBe('/vangelis/assets/favicon.svg');
  });

  it('handles root base', () => {
    expect(withBase('assets/favicon.svg', '/'))
      .toBe('/assets/favicon.svg');
  });

  it('handles relative base', () => {
    expect(withBase('assets/favicon.svg', './'))
      .toBe('./assets/favicon.svg');
  });

  it('handles absolute URL base', () => {
    expect(withBase('assets/favicon.svg', 'https://example.com/vangelis/'))
      .toBe('https://example.com/vangelis/assets/favicon.svg');
  });
});
