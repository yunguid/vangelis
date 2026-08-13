import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMidiPlayback } from './useMidiPlayback.js';
import { audioEngine } from '../utils/audioEngine.js';

vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: {
    context: { currentTime: 0 },
    getStatus: vi.fn(),
    ensureWasm: vi.fn(),
    ensureAudioContext: vi.fn(),
    playBufferedSample: vi.fn(),
    playFrequency: vi.fn(),
    stopNote: vi.fn()
  }
}));

describe('useMidiPlayback', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;
  let consoleWarnSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    audioEngine.context = { currentTime: 0 };
    audioEngine.getStatus.mockReturnValue({ wasmReady: true });
    audioEngine.ensureWasm.mockResolvedValue(undefined);
    audioEngine.ensureAudioContext.mockResolvedValue(audioEngine.context);
    audioEngine.playBufferedSample.mockImplementation(({ noteId }) => ({ voiceId: noteId }));
    audioEngine.playFrequency.mockImplementation(({ noteId }) => ({ voiceId: noteId }));
    global.requestAnimationFrame = vi.fn(() => 1);
    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    delete window.__vangelisPerf;
    vi.useRealTimers();
    consoleWarnSpy.mockRestore();
    global.requestAnimationFrame = originalRequestAnimationFrame;
    global.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  it('plays each note through the current waveform via playFrequency', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 0.1, velocity: 1, instrumentFamily: 'piano' }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(audioEngine.playBufferedSample).not.toHaveBeenCalled();
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(audioEngine.playFrequency.mock.calls[0][0].waveformType).toBe('sine');
    expect(audioEngine.stopNote).toHaveBeenCalledTimes(1);
  });

  it('records opt-in MIDI startup and scheduler lateness samples', async () => {
    const recordInteraction = vi.fn();
    const completePaint = vi.fn();
    window.__vangelisPerf = {
      recordInteraction,
      beginInteractionPaint: vi.fn(() => ({ complete: completePaint, cancel: vi.fn() }))
    };
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 0.1, velocity: 1 }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.runAllTimers();
    });

    expect(recordInteraction).toHaveBeenCalledWith(
      'midi.play.startup.warm',
      expect.any(Number),
      { noteCount: 1 }
    );
    expect(recordInteraction.mock.calls.some(([name, duration, details]) => (
      name === 'midi.scheduler.timeout-lateness'
      && duration >= 0
      && Number.isFinite(details.requestedDelayMs)
    ))).toBe(true);
    expect(completePaint).toHaveBeenCalledTimes(1);
  });

  it('limits React progress updates to the 25 Hz visual budget', async () => {
    const frameCallbacks = [];
    global.requestAnimationFrame = vi.fn((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 0.9, velocity: 1 }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      audioEngine.context.currentTime = 0.1;
      frameCallbacks[0](0);
    });
    expect(result.current.progress).toBeCloseTo(0.1, 5);

    await act(async () => {
      audioEngine.context.currentTime = 0.2;
      frameCallbacks[1](16);
      audioEngine.context.currentTime = 0.3;
      frameCallbacks[2](32);
    });
    expect(result.current.progress).toBeCloseTo(0.1, 5);

    await act(async () => {
      audioEngine.context.currentTime = 0.4;
      frameCallbacks[3](48);
    });
    expect(result.current.progress).toBeCloseTo(0.4, 5);
  });

  it('stops progress animation frames while the document is hidden', async () => {
    const frameCallbacks = [];
    let visibilityState = 'visible';
    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState
    });
    global.requestAnimationFrame = vi.fn((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });

    const { result, unmount } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    try {
      await act(async () => {
        result.current.play({
          duration: 2,
          bpm: 120,
          notes: [{ midi: 60, time: 0, duration: 1, velocity: 1 }]
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(frameCallbacks).toHaveLength(1);
      visibilityState = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      expect(global.cancelAnimationFrame).toHaveBeenCalledWith(1);

      visibilityState = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
      expect(frameCallbacks).toHaveLength(2);

      await act(async () => {
        audioEngine.context.currentTime = 0.5;
        frameCallbacks[1](50);
      });
      expect(result.current.progress).toBeCloseTo(0.25, 5);
    } finally {
      unmount();
      if (originalVisibilityState) {
        Object.defineProperty(document, 'visibilityState', originalVisibilityState);
      } else {
        delete document.visibilityState;
      }
    }
  });

  it('defers active-note React snapshots while hidden and syncs once visible', async () => {
    let visibilityState = 'hidden';
    const originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState
    });

    const { result, unmount } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    try {
      await act(async () => {
        result.current.play({
          duration: 2,
          bpm: 120,
          notes: [{ midi: 60, time: 0, duration: 1, velocity: 1 }]
        });
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
      expect(result.current.activeNotes.size).toBe(0);

      await act(async () => {
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

  it('bounds pending timers with a rolling MIDI lookahead window', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));
    const notes = Array.from({ length: 10_000 }, (_, index) => ({
      midi: 60 + (index % 12),
      time: index,
      duration: 0.1,
      velocity: 0.8
    }));

    await act(async () => {
      result.current.play({ duration: 10_000, bpm: 120, notes });
      await Promise.resolve();
      await Promise.resolve();
    });

    // Three note pairs fit in the inclusive two-second horizon, plus one scheduler
    // pump. The progress RAF is mocked and therefore is not a timer here.
    expect(vi.getTimerCount()).toBeLessThanOrEqual(7);

    await act(async () => {
      result.current.stop();
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resumes sustaining notes without allocating a filtered whole-score queue', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 8,
        bpm: 120,
        notes: [
          { midi: 60, time: 0, duration: 7, velocity: 0.8 },
          { midi: 62, time: 1, duration: 0.1, velocity: 0.8 },
          { midi: 64, time: 6, duration: 0.1, velocity: 0.8 }
        ]
      }, { startAt: 5 });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(audioEngine.playFrequency.mock.calls[0][0].noteId).toContain('midi-60-');

    await act(async () => {
      vi.advanceTimersByTime(999);
    });
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(2);
    expect(audioEngine.playFrequency.mock.calls[1][0].noteId).toContain('midi-64-');
  });

  it('feeds later notes into the rolling MIDI window as playback advances', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 5,
        bpm: 120,
        notes: [{ midi: 67, time: 3, duration: 0.1, velocity: 0.8 }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(audioEngine.playFrequency).not.toHaveBeenCalled();

    await act(async () => {
      audioEngine.context.currentTime = 1;
      vi.advanceTimersByTime(500);
      audioEngine.context.currentTime = 3;
      vi.advanceTimersByTime(2_000);
    });

    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(audioEngine.playFrequency.mock.calls[0][0].noteId).toContain('midi-67-');
  });

  it('caps active-note visualization snapshots without delaying audio events', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [
          { midi: 60, time: 0, duration: 0.5, velocity: 0.8 },
          { midi: 61, time: 0.01, duration: 0.5, velocity: 0.8 }
        ]
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(result.current.activeNotes.size).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(9);
    });
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(2);
    expect(result.current.activeNotes.size).toBe(0);

    await act(async () => {
      vi.advanceTimersByTime(30);
    });
    expect(result.current.activeNotes.size).toBe(2);
  });

  it('stops active MIDI voices when the playback hook unmounts', async () => {
    const { result, unmount } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 2,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 1, velocity: 0.8 }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);

    unmount();
    expect(audioEngine.stopNote).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores stale play request that resolves after a newer play starts', async () => {
    const firstLoad = createDeferred();
    audioEngine.ensureAudioContext
      .mockImplementationOnce(() => firstLoad.promise)
      .mockResolvedValue(audioEngine.context);

    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 0.1, velocity: 1 }]
      });
      await Promise.resolve();
    });

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 67, time: 0, duration: 0.1, velocity: 1 }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      firstLoad.resolve(audioEngine.context);
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(audioEngine.playFrequency.mock.calls[0][0].noteId).toContain('midi-67-');
    expect(result.current.currentMidi?.notes?.[0]?.midi).toBe(67);
  });

  it('does not start playback if stop is called before async context resolution', async () => {
    const slowLoad = createDeferred();
    audioEngine.ensureAudioContext.mockImplementationOnce(() => slowLoad.promise);

    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 64, time: 0, duration: 0.1, velocity: 1 }]
      });
      await Promise.resolve();
    });

    await act(async () => {
      result.current.stop();
    });

    await act(async () => {
      slowLoad.resolve(audioEngine.context);
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).not.toHaveBeenCalled();
    expect(audioEngine.playBufferedSample).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentMidi?.notes?.[0]?.midi).toBe(64);
  });

  it('logs and preserves paused state when resume cannot initialize audio context', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 64, time: 0, duration: 0.1, velocity: 1 }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.runAllTimers();
    });

    await act(async () => {
      result.current.pause();
    });

    audioEngine.ensureAudioContext.mockRejectedValueOnce(new Error('resume blocked'));

    await act(async () => {
      result.current.resume();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.isPaused).toBe(true);
    expect(result.current.isPlaying).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to resume MIDI playback:',
      expect.any(Error)
    );
  });

  it('ignores stale resume request when stop is called before async resume resolves', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 0.1, velocity: 1 }]
      });
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    await act(async () => {
      result.current.pause();
    });

    const playCallsBeforeResume = audioEngine.playFrequency.mock.calls.length;

    const resumeDeferred = createDeferred();
    audioEngine.ensureAudioContext.mockImplementationOnce(() => resumeDeferred.promise);

    await act(async () => {
      result.current.resume();
      await Promise.resolve();
    });

    await act(async () => {
      result.current.stop();
    });

    await act(async () => {
      resumeDeferred.resolve(audioEngine.context);
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.currentMidi?.notes?.[0]?.midi).toBe(60);
    expect(audioEngine.playFrequency.mock.calls.length).toBe(playCallsBeforeResume);
  });

  it('ignores pending async play initialization after hook unmount', async () => {
    const deferredContext = createDeferred();
    audioEngine.ensureAudioContext.mockImplementationOnce(() => deferredContext.promise);

    const { result, unmount } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 0.1, velocity: 1 }]
      });
      await Promise.resolve();
    });

    unmount();

    await act(async () => {
      deferredContext.resolve(audioEngine.context);
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).not.toHaveBeenCalled();
    expect(audioEngine.playBufferedSample).not.toHaveBeenCalled();
  });

  it('derives playback duration from notes when midi duration is missing', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        bpm: 120,
        notes: [{ midi: 62, time: 0, duration: 0.15, velocity: 1 }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(audioEngine.stopNote).toHaveBeenCalledTimes(1);
    expect(result.current.currentMidi?.notes?.[0]?.midi).toBe(62);
    expect(result.current.currentMidi?.duration).toBeCloseTo(0.15, 5);
  });

  it('filters invalid notes before scheduling playback', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [
          { midi: 59.6, time: 0.1, duration: 0.1, velocity: 1.7 },
          { midi: 'bad', time: 0, duration: 0.2, velocity: 0.8 },
          { midi: 130, time: 0, duration: 0.2, velocity: 0.8 },
          { midi: 62, time: -0.2, duration: 0, velocity: 0.7 }
        ]
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.currentMidi?.notes).toHaveLength(1);
    expect(result.current.currentMidi?.notes?.[0]?.midi).toBe(60);
    expect(result.current.currentMidi?.notes?.[0]?.velocity).toBe(1);
  });

  it('sorts unsorted external notes while preserving normalized playback order', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 3,
        notes: [
          { midi: 64, time: 2, duration: 0.1, velocity: 0.8 },
          { midi: 60, time: 0, duration: 0.1, velocity: 0.8 },
          { midi: 62, time: 1, duration: 0.1, velocity: 0.8 }
        ]
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.currentMidi?.notes.map((note) => note.time)).toEqual([0, 1, 2]);
  });

  it('warns and does not start when all notes are invalid', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: null, time: 0, duration: 0 }]
      });
      await Promise.resolve();
    });

    expect(audioEngine.playFrequency).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith('No MIDI data to play');
  });

  it('normalizes instrument family casing without affecting waveform playback', async () => {
    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 64, time: 0, duration: 0.1, velocity: 0.8, instrumentFamily: '  PIANO  ' }]
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(audioEngine.playFrequency.mock.calls[0][0].waveformType).toBe('sine');
    expect(result.current.currentMidi?.notes?.[0]?.instrumentFamily).toBe('piano');
  });
});
