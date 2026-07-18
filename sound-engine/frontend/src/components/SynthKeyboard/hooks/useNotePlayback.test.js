import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { audioEngine } from '../../../utils/audioEngine.js';
import { useNotePlayback } from './useNotePlayback.js';

vi.mock('../../../utils/audioEngine.js', () => ({
  audioEngine: {
    context: null,
    getStatus: vi.fn(),
    ensureWasm: vi.fn(),
    ensureAudioContext: vi.fn(),
    playFrequency: vi.fn(),
    stopNote: vi.fn()
  }
}));

const createDeferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
};

const renderPlayback = () => {
  const scheduleVisualUpdate = vi.fn();
  const updateVelocityDisplay = vi.fn();
  const hook = renderHook(() => useNotePlayback({
    waveformRef: { current: 'sine' },
    audioParamsRef: { current: {} },
    wasmReadyRef: { current: false },
    scheduleVisualUpdate,
    updateVelocityDisplay
  }));
  return { ...hook, scheduleVisualUpdate, updateVelocityDisplay };
};

const note = { noteId: 'C4', frequency: 261.63 };

describe('useNotePlayback first-note preparation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audioEngine.context = null;
    audioEngine.getStatus.mockReturnValue({
      wasmReady: false,
      hasCustomSample: false,
      hasVoicePhrase: false
    });
    audioEngine.playFrequency.mockReturnValue({ voiceId: 'C4' });
  });

  it('replays the first requested synth note after worklet preparation', async () => {
    const deferred = createDeferred();
    audioEngine.ensureWasm.mockReturnValue(deferred.promise);
    const { result, scheduleVisualUpdate } = renderPlayback();

    act(() => result.current.startNote(note, { pointerId: 7 }));
    expect(audioEngine.playFrequency).not.toHaveBeenCalled();

    await act(async () => {
      audioEngine.context = { currentTime: 0 };
      audioEngine.getStatus.mockReturnValue({
        wasmReady: true,
        hasCustomSample: false,
        hasVoicePhrase: false
      });
      deferred.resolve();
      await deferred.promise;
    });

    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
    expect(scheduleVisualUpdate).toHaveBeenCalledWith('C4', true);
  });

  it('does not start a pending note that was released during preparation', async () => {
    const deferred = createDeferred();
    audioEngine.ensureWasm.mockReturnValue(deferred.promise);
    const { result } = renderPlayback();

    act(() => {
      result.current.startNote(note, { pointerId: 7 });
      result.current.stopNote('C4', 7);
    });
    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(audioEngine.playFrequency).not.toHaveBeenCalled();
  });

  it('keeps the ready-engine note path synchronous', () => {
    audioEngine.context = { currentTime: 0 };
    audioEngine.getStatus.mockReturnValue({
      wasmReady: true,
      hasCustomSample: false,
      hasVoicePhrase: false
    });
    const { result } = renderPlayback();

    act(() => result.current.startNote(note));

    expect(audioEngine.ensureWasm).not.toHaveBeenCalled();
    expect(audioEngine.playFrequency).toHaveBeenCalledTimes(1);
  });
});
