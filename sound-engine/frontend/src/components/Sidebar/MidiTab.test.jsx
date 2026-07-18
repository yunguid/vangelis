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
        composer: 'Sergei Rachmaninoff'
      }
    ]);
    parseMidiFile.mockResolvedValue({
      name: 'Embedded MIDI Name',
      duration: 1.2,
      bpm: 110,
      notes: [{ midi: 60, time: 0, duration: 0.3, velocity: 0.9 }]
    });
  });

  it('forwards built-in metadata into playback payload', async () => {
    const onPlay = vi.fn();
    render(<MidiTab {...defaultProps({ onPlay })} />);

    fireEvent.click(screen.getByRole('button', { name: /^\d{6} sergei rachmaninoff$/i }));

    await waitFor(() => {
      expect(onPlay).toHaveBeenCalledTimes(1);
    });

    expect(parseMidiFile).toHaveBeenCalledWith('/midi/rachmaninoff-concerto2-mov1.mid');
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({
      name: expect.stringMatching(/^\d{6}$/),
      sourceFileId: 'rachmaninoff-concerto2-mov1',
      composer: 'Sergei Rachmaninoff'
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
  });

  it('renders original cues with a numeric title, no tag badge, and no composer byline', () => {
    getBuiltInMidiFiles.mockReturnValue([
      {
        id: 'original-neon-rain',
        name: 'dial_51',
        path: '/midi/originals/original-neon-rain.mid'
      }
    ]);

    render(<MidiTab {...defaultProps()} />);

    expect(screen.getByText(/^\d{6}$/)).toBeInTheDocument();
    expect(screen.queryByText('Originals')).not.toBeInTheDocument();
    expect(document.querySelector('.midi-tab__badge')).not.toBeInTheDocument();
    expect(document.querySelector('.midi-tab__file-composer')).not.toBeInTheDocument();
  });

  it('does not rebuild the MIDI library when only playback progress changes', () => {
    const props = defaultProps({
      currentMidi: { name: 'Test', duration: 10, bpm: 120 }
    });
    const view = render(<MidiTab {...props} />);
    expect(getBuiltInMidiFiles).toHaveBeenCalledTimes(1);

    view.rerender(<MidiTab {...props} progress={0.5} />);
    expect(getBuiltInMidiFiles).toHaveBeenCalledTimes(1);
  });
});
