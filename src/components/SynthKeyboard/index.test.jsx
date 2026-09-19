import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../../utils/audioEngine.js';
import SynthKeyboard from './index.jsx';

vi.mock('../../utils/audioEngine.js', () => ({
  audioEngine: {
    context: {},
    getStatus: vi.fn(() => ({ wasmReady: true, hasCustomSample: false })),
    playFrequency: vi.fn(({ noteId }) => ({ voiceId: noteId })),
    stopNote: vi.fn()
  }
}));

describe('SynthKeyboard render isolation', () => {
  it('reuses key elements when only audio parameters change', () => {
    const activeNotes = { has: vi.fn(() => false) };
    const { rerender } = render(
      <SynthKeyboard
        waveformType="sine"
        audioParams={{ attack: 0.1 }}
        wasmLoaded
        externalActiveNotes={activeNotes}
      />
    );
    const membershipChecksAfterMount = activeNotes.has.mock.calls.length;
    expect(membershipChecksAfterMount).toBeGreaterThan(0);

    rerender(
      <SynthKeyboard
        waveformType="sine"
        audioParams={{ attack: 0.8 }}
        wasmLoaded
        externalActiveNotes={activeNotes}
      />
    );

    expect(activeNotes.has).toHaveBeenCalledTimes(membershipChecksAfterMount);
  });
});

describe('SynthKeyboard key velocity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays typed keys at the one velocity C / V and the touch bar set', () => {
    // Compact layout, so the touch bar is on screen.
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })));
    render(<SynthKeyboard waveformType="sine" wasmLoaded />);
    const isPressed = (name) => screen.getByRole('button', { name }).getAttribute('aria-pressed');
    // A different key each time, so no strike is a restrike.
    const typedVelocity = (key, code) => {
      fireEvent.keyDown(window, { key, code });
      fireEvent.keyUp(window, { key, code });
      return audioEngine.playFrequency.mock.lastCall[0].velocity;
    };

    expect(typedVelocity('a', 'KeyA')).toBe(0.85);

    fireEvent.keyDown(window, { key: 'c', code: 'KeyC' });
    expect(typedVelocity('s', 'KeyS')).toBe(0.55);
    expect(isPressed('Soft')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    expect(typedVelocity('d', 'KeyD')).toBe(1);

    fireEvent.keyDown(window, { key: 'c', code: 'KeyC' });
    expect(isPressed('Med')).toBe('true');
    expect(typedVelocity('f', 'KeyF')).toBe(0.85);
  });
});
