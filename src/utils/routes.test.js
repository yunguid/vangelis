import { describe, it, expect } from 'vitest';
import {
  SOUND_DESIGNER_ROUTE,
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
