import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from './App';
import { parseMidiFile } from './utils/midiParser.js';

// Opening lifecycle is exercised with the real MIDI scheduler in its integration tests.
// `opening.sound` stands in for the sound of whichever landing piece was picked.
const opening = vi.hoisted(() => ({ sound: null, currentMidi: null }));
vi.mock('./hooks/useOpeningPerformance.js', () => ({
  useOpeningPerformance: () => ({
    activeNotes: new Set(), stop: vi.fn(), sound: opening.sound, currentMidi: opening.currentMidi, piece: null
  })
}));

const recordings = vi.hoisted(() => ({ load: null }));
vi.mock('./data/sampledInstruments.js', () => ({
  loadSampledInstrument: (...args) => recordings.load(...args)
}));

const engineStatus = vi.hoisted(() => ({ current: { wasmReady: false, graphWarmed: false } }));

// Mock the audio engine
vi.mock('./utils/audioEngine.js', () => ({
  audioEngine: {
    getStatus: () => engineStatus.current,
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
    setInstrument: vi.fn(() => Promise.resolve()),
    loadCustomSample: vi.fn(() => Promise.resolve({ duration: 1, channels: 2 })),
    clearCustomSample: vi.fn(),
    setCustomSampleBaseNote: vi.fn(),
    setTransportTempo: vi.fn(),
    toggleRecording: vi.fn()
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
    engineStatus.current = { wasmReady: false, graphWarmed: false };
    opening.sound = null;
    opening.currentMidi = null;
    recordings.load = vi.fn();
  });

  it('swaps the visual row for the notes of the opening piece, and remembers it', async () => {
    opening.currentMidi = { duration: 1, notes: [{ midi: 60, time: 0, duration: 1, velocity: 0.8 }] };
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Show the notes' }));
    expect(await screen.findByRole('region', { name: "Bird's-eye MIDI radar" })).toBeInTheDocument();
    // The landing piece feeds the notes, so there is no "load a MIDI file" prompt.
    expect(screen.queryByText(/Load a MIDI file/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('wave-candy-mock')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show the sound' })).toHaveAttribute('aria-pressed', 'true');

    unmount(); // leaving the page saves the session
    render(<App />);
    expect(await screen.findByRole('region', { name: "Bird's-eye MIDI radar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Show the sound' }));
    expect(screen.queryByRole('region', { name: "Bird's-eye MIDI radar" })).not.toBeInTheDocument();
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

      fireEvent.keyDown(window, { key: '?' });
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

  it('offers to turn sound on while the browser blocks audio, and nothing once it runs', async () => {
    const { audioEngine } = await import('./utils/audioEngine.js');
    const resume = vi.fn(() => Promise.resolve());
    audioEngine.context = { resume };
    engineStatus.current = { wasmReady: true, contextReady: true, graphWarmed: true, audioBlocked: true };
    const { unmount } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn sound on' }));
    delete audioEngine.context; // the engine mock is shared with the other tests
    expect(resume).toHaveBeenCalledTimes(1);
    unmount();

    engineStatus.current = { wasmReady: true, contextReady: true, graphWarmed: true, audioBlocked: false };
    render(<App />);
    expect(screen.queryByRole('button', { name: 'Turn sound on' })).not.toBeInTheDocument();
    expect(screen.queryByText('Audio engine warms now.')).not.toBeInTheDocument();
  });

  it('puts the landing piece\'s instrument under the keys and remembers it', async () => {
    const { audioEngine } = await import('./utils/audioEngine.js');
    const piano = { pick: vi.fn() };
    recordings.load.mockResolvedValue(piano);
    opening.sound = { name: 'Grand Piano', instrument: 'opening-piano', audioParams: { release: 0.45 } };
    const { unmount, rerender } = render(<App />);
    // Nothing is fetched or decoded until the engine has its audio context.
    await act(async () => {});
    expect(recordings.load).not.toHaveBeenCalled();
    expect(audioEngine.ensureAudioContext).not.toHaveBeenCalled();

    audioEngine.context = { state: 'running' };
    engineStatus.current = { wasmReady: true, contextReady: true, graphWarmed: true };
    act(() => audioEngine.subscribe.mock.calls.forEach(([listener]) => listener(engineStatus.current)));
    rerender(<App />);
    await waitFor(() => expect(audioEngine.setInstrument).toHaveBeenLastCalledWith(piano));
    expect(recordings.load).toHaveBeenCalledWith(audioEngine.context, 'opening-piano');
    delete audioEngine.context; // the engine mock is shared with the other tests

    unmount(); // the editor shares the engine, so the instrument leaves with the page
    expect(audioEngine.setInstrument).toHaveBeenLastCalledWith(null);
    const saved = JSON.parse(window.localStorage.getItem('vangelis-ui-session-v2'));
    expect(saved).toMatchObject({ instrument: 'opening-piano', activePresetName: 'Grand Piano' });
  });

  it('says so and returns to the synth when an instrument cannot be loaded', async () => {
    const { audioEngine } = await import('./utils/audioEngine.js');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    recordings.load.mockRejectedValue(new Error('HTTP 404'));
    opening.sound = { name: 'Nylon Guitar', instrument: 'nylon-guitar', audioParams: {} };
    engineStatus.current = { wasmReady: true, contextReady: true, graphWarmed: true };
    try {
      const { unmount } = render(<App />);
      expect(await screen.findByText('That instrument could not be loaded.')).toBeInTheDocument();
      expect(consoleError).toHaveBeenCalled();
      expect(audioEngine.setInstrument).toHaveBeenLastCalledWith(null);
      unmount();
      expect(JSON.parse(window.localStorage.getItem('vangelis-ui-session-v2')).instrument).toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('keeps only Record in the header', () => {
    render(<App />);
    expect(screen.queryByLabelText('View keyboard shortcuts')).not.toBeInTheDocument();
    expect(document.querySelectorAll('header button')).toHaveLength(1);
    expect(screen.getByLabelText('Start recording')).toBeInTheDocument();
  });

  it('opens shortcuts overlay with the keyboard shortcut', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '?' });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('closes shortcuts overlay when close button clicked', () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '?' });

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

    fireEvent.keyDown(window, { key: '?' });
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
