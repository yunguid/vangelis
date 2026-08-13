import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmUnsavedNavigation,
  registerUnsavedNavigationGuard
} from './unsavedNavigationGuard.js';

let cleanup = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('unsaved navigation guard', () => {
  it('allows navigation when no workspace is dirty', () => {
    expect(confirmUnsavedNavigation()).toBe(true);
  });

  it('blocks or allows navigation according to the active workspace', () => {
    const guard = vi.fn(() => false);
    cleanup = registerUnsavedNavigationGuard(guard);

    expect(confirmUnsavedNavigation()).toBe(false);
    expect(guard).toHaveBeenCalledOnce();
  });

  it('does not let an older cleanup remove a newer guard', () => {
    const cleanupOld = registerUnsavedNavigationGuard(() => false);
    cleanup = registerUnsavedNavigationGuard(() => true);
    cleanupOld();

    expect(confirmUnsavedNavigation()).toBe(true);
  });
});
