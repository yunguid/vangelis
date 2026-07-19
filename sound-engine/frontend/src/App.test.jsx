import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { parseMidiFile } from './utils/midiParser.js';

// Mock the audio engine
vi.mock('./utils/audioEngine.js', () => ({
  audioEngine: {
    getStatus: () => ({ wasmReady: false, graphWarmed: false }),
    subscribe: vi.fn(() => () => {}),
    subscribeRecording: vi.fn(() => () => {}),
    setGlobalParams: vi.fn(),
    setSanitizedGlobalParams: vi.fn(),
    ensureWasm: vi.fn(() => Promise.resolve()),
    ensureAudioContext: vi.fn(() => Promise.resolve()),
    warmGraph: vi.fn(),
    getActivity: vi.fn(() => ({ isActive: false, lastEventTime: 0 })),
    subscribeActivity: vi.fn(() => () => {}),
    getAnalysisNodes: vi.fn(() => null),
    loadCustomSample: vi.fn(() => Promise.resolve({ duration: 1, channels: 2 })),
    clearCustomSample: vi.fn(),
    setCustomSampleBaseNote: vi.fn(),
    setTransportTempo: vi.fn(),
    toggleRecording: vi.fn(),
    getVoicePhraseStatus: vi.fn(() => ({ enabled: false, nextIndex: 0, lastChunk: null })),
    subscribeVoicePhrase: vi.fn(() => () => {}),
    setVoicePhrase: vi.fn(() => Promise.resolve({ chunkCount: 0 })),
    setVoicePhraseEnabled: vi.fn(),
    clearVoicePhrase: vi.fn()
  },
}));

// Mock the Scene component (Three.js heavy)
vi.mock('./components/Scene', () => ({
  default: () => <div data-testid="scene-mock">Scene</div>,
}));

vi.mock('./components/WaveCandy', () => ({
  default: () => <div data-testid="wave-candy-mock">Wave Candy</div>,
}));

// Mock SynthKeyboard (complex component)
vi.mock('./components/SynthKeyboard', () => ({
  default: () => <div data-testid="keyboard-mock">Synth</div>,
}));

vi.mock('./utils/midiParser.js', () => ({
  getBuiltInMidiFiles: vi.fn(() => []),
  parseMidiFile: vi.fn(),
  preloadMidiFile: vi.fn(),
  preloadMidiParser: vi.fn(() => Promise.resolve())
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('renders the app title', async () => {
    render(<App />);
    expect(screen.getByText('Vangelis')).toBeInTheDocument();
    expect(screen.queryByTestId('scene-mock')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wave-candy-mock')).not.toBeInTheDocument();
    expect(await screen.findByTestId('scene-mock', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByTestId('wave-candy-mock', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('renders keyboard section', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Virtual keyboard' })).toBeInTheDocument();
  });

  it('loads the persisted session only once across App renders', () => {
    const getItemSpy = vi.spyOn(window.localStorage, 'getItem');
    try {
      render(<App />);
      expect(getItemSpy).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByLabelText('View keyboard shortcuts'));
      fireEvent.click(screen.getByLabelText('Close shortcuts'));

      expect(getItemSpy).toHaveBeenCalledTimes(1);
    } finally {
      getItemSpy.mockRestore();
    }
  });

  it('does not render birds-eye performance toggle', () => {
    render(<App />);
    expect(screen.queryByRole('tab', { name: 'Keys' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: "Bird's-Eye" })).not.toBeInTheDocument();
  });

  it('does not render birds-eye radar when midi is not playing', () => {
    render(<App />);
    expect(screen.queryByRole('region', { name: "Bird's-eye MIDI radar" })).not.toBeInTheDocument();
  });

  it('does not show keyboard waveform label', () => {
    render(<App />);
    expect(screen.queryByText(/Waveform:/)).not.toBeInTheDocument();
  });

  it('has keyboard shortcuts button', () => {
    render(<App />);
    const helpButton = screen.getByLabelText('View keyboard shortcuts');
    expect(helpButton).toBeInTheDocument();
  });

  it('opens shortcuts overlay when button clicked', () => {
    render(<App />);
    const helpButton = screen.getByLabelText('View keyboard shortcuts');
    fireEvent.click(helpButton);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('closes shortcuts overlay when close button clicked', () => {
    render(<App />);
    const helpButton = screen.getByLabelText('View keyboard shortcuts');
    fireEvent.click(helpButton);

    const closeButton = screen.getByLabelText('Close shortcuts');
    fireEvent.click(closeButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not show keyboard hints', () => {
    render(<App />);
    expect(screen.queryByText(/Press Shift \+ \/ for keys\./)).not.toBeInTheDocument();
  });

  it('does not show local save reassurance copy', () => {
    render(<App />);
    expect(screen.queryByText('State saves on this device.')).not.toBeInTheDocument();
  });

  it('loads the MIDI parser when a MIDI file is pasted', async () => {
    const midiFile = new File(['midi'], 'pasted.mid', { type: 'audio/midi' });
    const parsedMidi = {
      name: 'Pasted score',
      duration: 10.1,
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      notes: [{ midi: 60, time: 10, duration: 0.1, velocity: 1 }]
    };
    parseMidiFile.mockResolvedValue(parsedMidi);
    render(<App />);

    fireEvent.paste(window, { clipboardData: { files: [midiFile] } });

    await waitFor(() => expect(parseMidiFile).toHaveBeenCalledWith(midiFile));
    expect(await screen.findByText('MIDI pasted.')).toBeInTheDocument();
  });

  it('coalesces rapid session changes into one deferred storage write', () => {
    vi.useFakeTimers();
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem');
    const { unmount } = render(<App />);

    fireEvent.click(screen.getByLabelText('View keyboard shortcuts'));
    fireEvent.click(screen.getByLabelText('Close shortcuts'));
    expect(setItemSpy).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(199));
    expect(setItemSpy).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    unmount();
    vi.useRealTimers();
  });
});
