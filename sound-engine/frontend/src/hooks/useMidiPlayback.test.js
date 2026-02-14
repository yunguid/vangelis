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

  it('plays stacked sample layers when a sound set is available', async () => {
    ensureSoundSetLoaded.mockResolvedValue({
      id: 'rachmaninoff-orchestral-lite',
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
      layerFamilies: ['piano', 'strings'],
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

    await act(async () => {
      vi.runAllTimers();
    });

    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(2);
    const waveforms = audioEngine.playFrequency.mock.calls.map((call) => call[0].waveformType);
    expect(waveforms).toContain('triangle');
    expect(waveforms).toContain('saw');
  });
});
