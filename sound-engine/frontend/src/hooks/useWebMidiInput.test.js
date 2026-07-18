import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebMidiInput } from './useWebMidiInput.js';
import { audioEngine } from '../utils/audioEngine.js';

vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: {
    context: { currentTime: 0 },
    getStatus: vi.fn(() => ({ wasmReady: true })),
    ensureWasm: vi.fn(() => Promise.resolve()),
    playFrequency: vi.fn(),
    stopNote: vi.fn(),
    setPitchBend: vi.fn(),
    setModWheel: vi.fn()
  }
}));

describe('useWebMidiInput', () => {
  const originalRequestMidiAccess = Object.getOwnPropertyDescriptor(navigator, 'requestMIDIAccess');
  let input;
  let access;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    audioEngine.context = { currentTime: 0 };
    audioEngine.getStatus.mockReturnValue({ wasmReady: true });
    audioEngine.ensureWasm.mockResolvedValue(undefined);
    input = { state: 'connected', name: 'Test controller', onmidimessage: null };
    access = {
      inputs: new Map([['test', input]]),
      onstatechange: null
    };
    Object.defineProperty(navigator, 'requestMIDIAccess', {
      configurable: true,
      value: vi.fn().mockResolvedValue(access)
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalRequestMidiAccess) {
      Object.defineProperty(navigator, 'requestMIDIAccess', originalRequestMidiAccess);
    } else {
      delete navigator.requestMIDIAccess;
    }
  });

  const mountMidi = async () => {
    const hook = renderHook(() => useWebMidiInput({
      waveformType: 'sine',
      audioParams: { volume: 0.7 }
    }));
    await act(async () => {
      await import('../utils/webMidiController.js');
      await Promise.resolve();
      await Promise.resolve();
    });
    return hook;
  };

  it('caps visual snapshots while keeping hardware note events immediate', async () => {
    const { result, unmount } = await mountMidi();

    act(() => input.onmidimessage({ data: [0x90, 60, 127] }));
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(result.current.activeNotes).toEqual(new Set(['C4']));

    act(() => input.onmidimessage({ data: [0x90, 62, 100] }));
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(2);
    expect(result.current.activeNotes).toEqual(new Set(['C4']));

    act(() => vi.advanceTimersByTime(40));
    expect(result.current.activeNotes).toEqual(new Set(['C4', 'D4']));
    unmount();
  });

  it('suppresses hidden snapshots and synchronizes on visibility return', async () => {
    let visibilityState = 'hidden';
    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState
    });
    const { result, unmount } = await mountMidi();

    try {
      act(() => input.onmidimessage({ data: [0x90, 60, 127] }));
      expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
      expect(result.current.activeNotes.size).toBe(0);

      act(() => {
        visibilityState = 'visible';
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current.activeNotes).toEqual(new Set(['C4']));
    } finally {
      unmount();
      if (originalVisibilityState) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityState);
      } else {
        delete document.visibilityState;
      }
    }
  });
});
