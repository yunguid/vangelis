import { describe, it, expect } from 'vitest';
import {
  PIANO_ROLL_ROUTE,
  SOUND_DESIGNER_ROUTE,
  isPianoRollRoute,
  isSoundDesignerRoute
} from './routes.js';

describe('isSoundDesignerRoute', () => {
  it('matches the sound designer route', () => {
    expect(isSoundDesignerRoute(SOUND_DESIGNER_ROUTE)).toBe(true);
    expect(isSoundDesignerRoute('/sound-designer')).toBe(true);
  });

  it('matches the sound designer route with a trailing slash', () => {
    expect(isSoundDesignerRoute(`${SOUND_DESIGNER_ROUTE}/`)).toBe(true);
    expect(isSoundDesignerRoute('/sound-designer/')).toBe(true);
  });

  it('does not match unrelated routes', () => {
    expect(isSoundDesignerRoute('/')).toBe(false);
    expect(isSoundDesignerRoute('/sound-designerz')).toBe(false);
    expect(isSoundDesignerRoute('/studies')).toBe(false);
  });
});

describe('isPianoRollRoute', () => {
  it('matches the editor route, with and without trailing slash', () => {
    expect(isPianoRollRoute(PIANO_ROLL_ROUTE)).toBe(true);
    expect(isPianoRollRoute(`${PIANO_ROLL_ROUTE}/`)).toBe(true);
  });

  it('does not match unrelated routes', () => {
    expect(isPianoRollRoute('/')).toBe(false);
    expect(isPianoRollRoute('/sound-designer')).toBe(false);
    expect(isPianoRollRoute('/editors')).toBe(false);
  });
});
