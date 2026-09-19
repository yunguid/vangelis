import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardInput } from './useKeyboardInput.js';

const noteMetaFor = (noteId) => ({ noteId, frequency: 440 });

function renderKeyboardInput({ startNote, stopNote, keyVelocity = 0.85 } = {}) {
  const props = {
    octaveOffsetRef: { current: 0 },
    setOctaveOffset: vi.fn(),
    keyVelocityRef: { current: keyVelocity },
    setKeyVelocity: vi.fn(),
    startNote: startNote || vi.fn(() => true),
    stopNote: stopNote || vi.fn()
  };
  const hook = renderHook(() => useKeyboardInput(props));
  return { ...props, hook };
}

const keyEvent = (type, init) => {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};

const KEY_A = { key: 'a', code: 'KeyA' };

// Strikes and releases a key at `timeMs` on the clock the hook reads.
const strikeAt = (clock, timeMs, init) => {
  clock.mockReturnValue(timeMs);
  keyEvent('keydown', init);
  keyEvent('keyup', init);
};

const velocitiesOf = (startNote) => startNote.mock.calls.map(([, options]) => options.velocity);

describe('useKeyboardInput', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stops a note whose event.key changed between press and release (Shift on ";")', () => {
    const { startNote, stopNote } = renderKeyboardInput();

    keyEvent('keydown', { key: ';', code: 'Semicolon' });
    expect(startNote).toHaveBeenCalledTimes(1);
    const noteId = startNote.mock.calls[0][0].noteId;

    // Shift goes down while the note is held; keyup now reports ':'.
    keyEvent('keyup', { key: ':', code: 'Semicolon', shiftKey: true });
    expect(stopNote).toHaveBeenCalledWith(noteId);
  });

  it('ignores modifier chords instead of swallowing them into notes or octave jumps', () => {
    const { startNote, setOctaveOffset } = renderKeyboardInput();

    const undo = keyEvent('keydown', { key: 'z', code: 'KeyZ', metaKey: true });
    const selectAll = keyEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true });

    expect(setOctaveOffset).not.toHaveBeenCalled();
    expect(startNote).not.toHaveBeenCalled();
    expect(undo.defaultPrevented).toBe(false);
    expect(selectAll.defaultPrevented).toBe(false);
  });

  it('does not register ownership when startNote rejects, so keyup cannot kill a pointer-held note', () => {
    const startNote = vi.fn(() => false); // note already owned by a pointer
    const { stopNote } = renderKeyboardInput({ startNote });

    keyEvent('keydown', { key: 'a', code: 'KeyA' });
    expect(startNote).toHaveBeenCalledTimes(1);

    keyEvent('keyup', { key: 'a', code: 'KeyA' });
    expect(stopNote).not.toHaveBeenCalled();
  });

  it('keeps normal press/release working end to end', () => {
    const { startNote, stopNote } = renderKeyboardInput();

    keyEvent('keydown', { key: 'a', code: 'KeyA' });
    expect(startNote).toHaveBeenCalledTimes(1);
    const noteId = startNote.mock.calls[0][0].noteId;

    // Auto-repeat of the held key must not restart the note.
    keyEvent('keydown', { key: 'a', code: 'KeyA', repeat: true });
    expect(startNote).toHaveBeenCalledTimes(1);

    keyEvent('keyup', { key: 'a', code: 'KeyA' });
    expect(stopNote).toHaveBeenCalledWith(noteId);
  });

  it('never plays a key quieter for having been played before', () => {
    const clock = vi.spyOn(performance, 'now');
    const { startNote } = renderKeyboardInput();

    strikeAt(clock, 1000, KEY_A);
    strikeAt(clock, 1300, KEY_A); // a melody coming back to the note
    strikeAt(clock, 3300, KEY_A);

    const [first, again, later] = velocitiesOf(startNote);
    expect(first).toBe(0.85);
    expect(again).toBeGreaterThanOrEqual(first);
    expect(later).toBe(first);
  });

  it('accents a fast restrike on top of the key velocity, never past full', () => {
    const clock = vi.spyOn(performance, 'now');
    const { startNote, keyVelocityRef } = renderKeyboardInput({ keyVelocity: 0.55 });

    strikeAt(clock, 1000, KEY_A);
    strikeAt(clock, 1060, KEY_A);
    const [soft, softRestrike] = velocitiesOf(startNote);
    expect(soft).toBe(0.55);
    expect(softRestrike).toBeGreaterThan(soft);
    expect(softRestrike).toBeLessThan(0.85); // an accent, not a jump to the next level

    keyVelocityRef.current = 1;
    strikeAt(clock, 5000, KEY_A);
    strikeAt(clock, 5060, KEY_A);
    expect(velocitiesOf(startNote).slice(2)).toEqual([1, 1]);
  });

  it('steps the key velocity with C and V instead of playing them', () => {
    const { startNote, setKeyVelocity } = renderKeyboardInput();

    const softer = keyEvent('keydown', { key: 'c', code: 'KeyC' });
    const harder = keyEvent('keydown', { key: 'v', code: 'KeyV' });

    expect(softer.defaultPrevented).toBe(true);
    expect(harder.defaultPrevented).toBe(true);
    expect(startNote).not.toHaveBeenCalled();
    const [[stepSofter], [stepHarder]] = setKeyVelocity.mock.calls;
    expect([1, 0.85, 0.55].map((level) => stepSofter(level))).toEqual([0.85, 0.55, 0.55]);
    expect([0.55, 0.85, 1].map((level) => stepHarder(level))).toEqual([0.85, 1, 1]);
  });
});
