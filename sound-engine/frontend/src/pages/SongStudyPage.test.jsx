import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SongStudyPage from './SongStudyPage.jsx';
import { parseMidiFile } from '../utils/midiParser.js';

const playback = {
  isPlaying: false,
  isPaused: false,
  progress: 0,
  currentMidi: null,
  tempoFactor: 1,
  play: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn(),
  seekTo: vi.fn(),
  setTempo: vi.fn()
};

vi.mock('../hooks/useMidiPlayback.js', () => ({
  useMidiPlayback: () => playback
}));

vi.mock('../hooks/useAudioEngineWarmup.js', () => ({
  useAudioEngineWarmup: vi.fn()
}));

vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: {
    getStatus: () => ({ wasmReady: true, graphWarmed: true }),
    subscribe: vi.fn(() => () => {}),
    setTransportTempo: vi.fn()
  }
}));

vi.mock('../utils/midiParser.js', () => ({
  parseMidiFile: vi.fn()
}));

vi.mock('../components/Sidebar/SidebarNavigation.jsx', () => ({
  default: () => <nav aria-label="Study navigation" />,
  BrandHeader: () => <div>Vangelis</div>
}));

vi.mock('../components/BirdsEyeRadar.jsx', () => ({
  default: () => <div data-testid="radar" />
}));

vi.mock('../components/SynthKeyboard', () => ({
  default: () => <div data-testid="keyboard" />
}));

const study = {
  id: 'study:test',
  title: 'Test Study',
  eyebrow: 'Performance fixture',
  midiUrl: '/midi/test.mid',
  waveformType: 'triangle',
  audioParams: {}
};

describe('SongStudyPage deferred MIDI loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playback.isPlaying = false;
    playback.isPaused = false;
    playback.progress = 0;
    playback.currentMidi = null;
    playback.tempoFactor = 1;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps transport disabled until the deferred parser resolves', async () => {
    parseMidiFile.mockResolvedValue({
      name: 'fixture',
      duration: 2,
      bpm: 120,
      notes: [{
        midi: 60,
        time: 0,
        duration: 1,
        velocity: 0.8,
        channel: 0,
        instrumentFamily: 'piano'
      }]
    });

    render(<SongStudyPage study={study} />);
    expect(screen.getByText('Loading MIDI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    expect(screen.queryByTestId('radar')).not.toBeInTheDocument();

    expect(await screen.findByText('120 BPM')).toBeInTheDocument();
    expect(parseMidiFile).toHaveBeenCalledWith('/midi/test.mid');
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(await screen.findByTestId('radar')).toBeInTheDocument();
  });

  it('preserves the existing load error state when deferred parsing fails', async () => {
    parseMidiFile.mockRejectedValue(new Error('bad MIDI'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<SongStudyPage study={study} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The study MIDI could not be loaded.');
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled();
    consoleError.mockRestore();
  });

  it('previews pointer scrubs by frame and seeks the engine only on release', async () => {
    playback.isPaused = true;
    parseMidiFile.mockResolvedValue({
      name: 'fixture',
      duration: 2,
      bpm: 120,
      notes: [{
        midi: 60,
        time: 0,
        duration: 2,
        velocity: 0.8,
        channel: 0,
        instrumentFamily: 'piano'
      }]
    });

    const { unmount } = render(<SongStudyPage study={study} />);
    await screen.findByText('120 BPM');
    const scrubber = screen.getByRole('slider', { name: 'Study transport' });
    vi.useFakeTimers();
    const cancelFrameSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

    fireEvent.pointerDown(scrubber, { pointerId: 4 });
    fireEvent.change(scrubber, { target: { value: '0.5' } });
    fireEvent.change(scrubber, { target: { value: '0.8' } });
    fireEvent.change(scrubber, { target: { value: '1.1' } });
    fireEvent.change(scrubber, { target: { value: '1.4' } });
    expect(playback.seekTo).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(16));
    expect(scrubber).toHaveValue('1.4');
    expect(playback.seekTo).not.toHaveBeenCalled();

    fireEvent.change(scrubber, { target: { value: '1.5' } });
    fireEvent.pointerUp(scrubber, { pointerId: 4 });
    expect(playback.seekTo).toHaveBeenCalledTimes(1);
    expect(playback.seekTo).toHaveBeenLastCalledWith(1.5);
    act(() => vi.advanceTimersByTime(16));
    expect(playback.seekTo).toHaveBeenCalledTimes(1);

    playback.seekTo.mockClear();
    fireEvent.change(scrubber, { target: { value: '1.6' } });
    expect(playback.seekTo).toHaveBeenCalledTimes(1);
    expect(playback.seekTo).toHaveBeenLastCalledWith(1.6);

    fireEvent.pointerDown(scrubber, { pointerId: 5 });
    fireEvent.change(scrubber, { target: { value: '1.7' } });
    unmount();
    expect(cancelFrameSpy).toHaveBeenCalled();
  });
});
