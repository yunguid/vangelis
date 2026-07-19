import React from 'react';
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

const createAudioContextHarness = () => {
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
  return {
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
};

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
    const context = createAudioContextHarness();
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

  it('advances score-cell feedback without committing the page', async () => {
    vi.useFakeTimers();
    const context = createAudioContextHarness();
    globalThis.AudioContext = vi.fn(() => context);
    let commitCount = 0;

    const { container } = render(
      <React.Profiler id="voice-loop" onRender={() => { commitCount += 1; }}>
        <VoiceLoopLabPage />
      </React.Profiler>
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Play' }));
      await Promise.resolve();
    });
    const commitsAfterPlay = commitCount;
    const scoreCells = container.querySelectorAll('.voice-loop-cell');

    context.currentTime = 0.5;
    act(() => vi.advanceTimersByTime(400));

    expect(commitCount).toBe(commitsAfterPlay);
    expect(container.querySelectorAll('.voice-loop-cell.is-active')).toHaveLength(1);
    expect(scoreCells[14]).toHaveClass('is-active');
    expect(scoreCells[14]).toHaveAttribute('aria-current', 'true');
  });
});
