import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});
