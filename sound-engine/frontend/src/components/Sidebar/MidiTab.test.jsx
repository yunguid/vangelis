import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MidiTab from './MidiTab.jsx';
import { parseMidiFile, getBuiltInMidiFiles } from '../../utils/midiParser.js';

vi.mock('../../utils/midiParser.js', () => ({
  parseMidiFile: vi.fn(),
  getBuiltInMidiFiles: vi.fn()
}));

const defaultProps = (overrides = {}) => ({
  isPlaying: false,
  isPaused: false,
  progress: 0,
  currentMidi: null,
  tempoFactor: 1,
  onPlay: vi.fn(),
  onPause: vi.fn(),
  onResume: vi.fn(),
  onStop: vi.fn(),
  onTempoChange: vi.fn(),
  ...overrides
});

describe('MidiTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBuiltInMidiFiles.mockReturnValue([
      {
        id: 'rachmaninoff-concerto2-mov1',
        name: 'Piano Concerto No. 2 - I. Moderato',
        path: '/midi/rachmaninoff-concerto2-mov1.mid',
        composer: 'Sergei Rachmaninoff',
        soundSetId: 'rachmaninoff-orchestral-lite',
        layerFamilies: ['piano', 'strings']
      }
    ]);
    parseMidiFile.mockResolvedValue({
      name: 'Embedded MIDI Name',
      duration: 1.2,
      bpm: 110,
      notes: [{ midi: 60, time: 0, duration: 0.3, velocity: 0.9 }]
    });
  });

  it('forwards built-in layering metadata into playback payload', async () => {
    const onPlay = vi.fn();
    render(<MidiTab {...defaultProps({ onPlay })} />);

    expect(screen.getByText('rachmaninoff-orchestral-lite')).toBeInTheDocument();
    expect(screen.getByText('piano + strings')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /piano concerto no\. 2 - i\. moderato/i }));

    await waitFor(() => {
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    expect(parseMidiFile).toHaveBeenCalledWith('/midi/rachmaninoff-concerto2-mov1.mid');
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Piano Concerto No. 2 - I. Moderato',
      sourceFileId: 'rachmaninoff-concerto2-mov1',
      composer: 'Sergei Rachmaninoff',
      soundSetId: 'rachmaninoff-orchestral-lite',
      layerFamilies: ['piano', 'strings']
    }));
  });

  it('plays uploaded MIDI files without forcing library metadata', async () => {
    const onPlay = vi.fn();
    render(<MidiTab {...defaultProps({ onPlay })} />);

    const input = screen.getByLabelText(/choose midi file/i);
    const upload = new File([new Uint8Array([0x4d, 0x54, 0x68, 0x64])], 'custom.mid', { type: 'audio/midi' });
    fireEvent.change(input, { target: { files: [upload] } });

    await waitFor(() => {
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    expect(parseMidiFile).toHaveBeenCalledWith(upload);
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Embedded MIDI Name'
    }));
    expect(onPlay.mock.calls[0][0].soundSetId).toBeUndefined();
    expect(onPlay.mock.calls[0][0].layerFamilies).toBeUndefined();
  });
});
