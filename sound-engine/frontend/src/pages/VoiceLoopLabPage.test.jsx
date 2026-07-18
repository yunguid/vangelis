import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VoiceLoopLabPage from './VoiceLoopLabPage.jsx';

const { renderVoiceScoreMock } = vi.hoisted(() => ({
  renderVoiceScoreMock: vi.fn(() => ({
    buffer: {},
    duration: 1,
    warnings: []
  }))
}));

vi.mock('../utils/voicePhrase.js', () => ({
  renderVoiceScore: renderVoiceScoreMock
}));

describe('VoiceLoopLabPage', () => {
  const originalAudioContext = globalThis.AudioContext;

  afterEach(() => {
    globalThis.AudioContext = originalAudioContext;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not create an audio context or render audio before interaction', () => {
    vi.useFakeTimers();
    const AudioContextConstructor = vi.fn();
    globalThis.AudioContext = AudioContextConstructor;

    render(<VoiceLoopLabPage />);
    act(() => vi.advanceTimersByTime(2_000));

    expect(AudioContextConstructor).not.toHaveBeenCalled();
  });

  it('renders once on first play without a duplicate debounced render', async () => {
    vi.useFakeTimers();
    const parameter = { value: 0, setTargetAtTime: vi.fn() };
    const createNode = () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { ...parameter },
      frequency: { ...parameter },
      Q: { ...parameter },
      delayTime: { ...parameter },
      playbackRate: { ...parameter }
    });
    const context = {
      state: 'running',
      currentTime: 0,
      destination: {},
      createGain: vi.fn(createNode),
      createBiquadFilter: vi.fn(createNode),
      createDelay: vi.fn(createNode),
      createBufferSource: vi.fn(() => ({
        ...createNode(),
        start: vi.fn(),
        stop: vi.fn(),
        loop: false,
        buffer: null
      }))
    };
    globalThis.AudioContext = vi.fn(() => context);

    render(<VoiceLoopLabPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      await Promise.resolve();
    });

    expect(renderVoiceScoreMock).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(300));
    expect(renderVoiceScoreMock).toHaveBeenCalledTimes(1);
  });
});
