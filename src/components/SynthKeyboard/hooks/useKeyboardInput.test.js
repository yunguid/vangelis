import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKeyboardInput } from './useKeyboardInput.js';

const noteMetaFor = (noteId) => ({ noteId, frequency: 440 });

function renderKeyboardInput({ startNote, stopNote } = {}) {
  const props = {
    octaveOffsetRef: { current: 0 },
    setOctaveOffset: vi.fn(),
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
});
