import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMidiPlayback } from './useMidiPlayback.js';
import { audioEngine } from '../utils/audioEngine.js';
import { ensureSoundSetLoaded } from '../utils/instrumentSamples.js';

vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: {
    context: { currentTime: 0 },
    ensureAudioContext: vi.fn(),
    playBufferedSample: vi.fn(),
    playFrequency: vi.fn(),
    stopNote: vi.fn()
  }
}));

vi.mock('../utils/instrumentSamples.js', () => ({
  ensureSoundSetLoaded: vi.fn()
}));

describe('useMidiPlayback layering', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame;
  const originalCancelAnimationFrame = global.cancelAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    audioEngine.context = { currentTime: 0 };
    audioEngine.ensureAudioContext.mockResolvedValue(audioEngine.context);
    audioEngine.playBufferedSample.mockImplementation(({ noteId }) => ({ voiceId: noteId }));
    audioEngine.playFrequency.mockImplementation(({ noteId }) => ({ voiceId: noteId }));
    global.requestAnimationFrame = vi.fn(() => 1);
    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('plays stacked sample layers when a sound set is available', async () => {
    ensureSoundSetLoaded.mockResolvedValue({
      id: 'rachmaninoff-orchestral-lite',
      name: 'Rachmaninoff Concerto No. 2 (Starter Pack)',
      instruments: [{ id: 'piano' }, { id: 'violin' }],
      pickInstruments: () => [
        { id: 'piano', buffer: {}, baseFrequency: 261.63 },
        { id: 'violin', buffer: {}, baseFrequency: 196.0 }
      ]
    });

    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 0.1, velocity: 1, instrumentFamily: 'piano' }],
        soundSetId: 'rachmaninoff-orchestral-lite',
        layerFamilies: ['piano', 'strings']
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.layeringMode).toBe('sample-layered');
    expect(result.current.activeSoundSetName).toBe('Rachmaninoff Concerto No. 2 (Starter Pack)');

    expect(ensureSoundSetLoaded).toHaveBeenCalledWith('rachmaninoff-orchestral-lite');

    await act(async () => {
      vi.runAllTimers();
    });

    expect(audioEngine.playBufferedSample).toHaveBeenCalledTimes(2);
    expect(audioEngine.playFrequency).not.toHaveBeenCalled();
    expect(audioEngine.stopNote).toHaveBeenCalledTimes(2);
  });

  it('falls back to waveform layer families when sample set is unavailable', async () => {
    ensureSoundSetLoaded.mockResolvedValue(null);

    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 64, time: 0, duration: 0.1, velocity: 0.8, instrumentFamily: 'piano' }],
        soundSetId: 'rachmaninoff-orchestral-lite',
        layerFamilies: ['piano', 'strings']
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.layeringMode).toBe('wave-layered');
    expect(result.current.activeSoundSetName).toBeNull();

    expect(ensureSoundSetLoaded).toHaveBeenCalledWith('rachmaninoff-orchestral-lite');

    await act(async () => {
      vi.runAllTimers();
    });

    expect(audioEngine.playBufferedSample).not.toHaveBeenCalled();
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(2);

    const waveforms = audioEngine.playFrequency.mock.calls.map((call) => call[0].waveformType);
    expect(waveforms).toContain('triangle');
    expect(waveforms).toContain('saw');
  });

  it('uses soundset layer families when midi metadata does not provide them', async () => {
    ensureSoundSetLoaded.mockResolvedValue({
      id: 'cinematic-starter-pack',
      name: 'Cinematic Starter Pack',
      layerFamilies: ['piano', 'strings'],
      instruments: [],
      pickInstruments: () => []
    });

    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 67, time: 0, duration: 0.12, velocity: 0.8, instrumentFamily: 'strings' }],
        soundSetId: 'cinematic-starter-pack'
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.layeringMode).toBe('wave-layered');
    expect(result.current.activeSoundSetName).toBe('Cinematic Starter Pack');

    await act(async () => {
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(2);
    const waveforms = audioEngine.playFrequency.mock.calls.map((call) => call[0].waveformType);
    expect(waveforms).toContain('triangle');
    expect(waveforms).toContain('saw');
  });

  it('ignores stale play request that resolves after a newer play starts', async () => {
    const firstLoad = createDeferred();
    ensureSoundSetLoaded
      .mockImplementationOnce(() => firstLoad.promise)
      .mockResolvedValueOnce(null);

    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 60, time: 0, duration: 0.1, velocity: 1 }],
        soundSetId: 'slow-first'
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
      firstLoad.resolve(null);
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(audioEngine.playFrequency.mock.calls[0][0].noteId).toContain('midi-67-');
    expect(result.current.currentMidi?.notes?.[0]?.midi).toBe(67);
  });

  it('does not start playback if stop is called before async soundset load resolves', async () => {
    const slowLoad = createDeferred();
    ensureSoundSetLoaded.mockImplementationOnce(() => slowLoad.promise);

    const { result } = renderHook(() => useMidiPlayback({
      waveformType: 'sine',
      audioParams: { volume: 0.7, attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.3 }
    }));

    await act(async () => {
      result.current.play({
        duration: 1,
        bpm: 120,
        notes: [{ midi: 64, time: 0, duration: 0.1, velocity: 1 }],
        soundSetId: 'slow-stop'
      });
      await Promise.resolve();
    });

    await act(async () => {
      result.current.stop();
    });

    await act(async () => {
      slowLoad.resolve(null);
      await Promise.resolve();
      await Promise.resolve();
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).not.toHaveBeenCalled();
    expect(audioEngine.playBufferedSample).not.toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentMidi).toBeNull();
  });
});
