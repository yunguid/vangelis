import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

// Mock the audio engine
vi.mock('./utils/audioEngine.js', () => ({
  audioEngine: {
    getStatus: () => ({ wasmReady: false, graphWarmed: false }),
    subscribe: vi.fn(() => () => {}),
    subscribeRecording: vi.fn(() => () => {}),
    setGlobalParams: vi.fn(),
    ensureWasm: vi.fn(() => Promise.resolve()),
    ensureAudioContext: vi.fn(() => Promise.resolve()),
    warmGraph: vi.fn(),
    getActivity: vi.fn(() => ({ isActive: false, lastEventTime: 0 })),
    subscribeActivity: vi.fn(() => () => {}),
    getAnalysisNodes: vi.fn(() => null),
    loadCustomSample: vi.fn(() => Promise.resolve({ duration: 1, channels: 2 })),
    clearCustomSample: vi.fn(),
    toggleRecording: vi.fn()
  },
}));

// Mock the Scene component (Three.js heavy)
vi.mock('./components/Scene', () => ({
  default: () => <div data-testid="scene-mock">Scene</div>,
}));

// Mock SynthKeyboard (complex component)
vi.mock('./components/SynthKeyboard', () => ({
  default: () => <div data-testid="keyboard-mock">Synth</div>,
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Vangelis')).toBeInTheDocument();
  });

  it('renders keyboard section', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: 'Virtual keyboard' })).toBeInTheDocument();
  });

  it('does not render birds-eye performance toggle', () => {
    render(<App />);
    expect(screen.queryByRole('tab', { name: 'Keys' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: "Bird's-Eye" })).not.toBeInTheDocument();
  });

  it('renders birds-eye radar in the control surface', () => {
    render(<App />);
    expect(screen.getByRole('region', { name: "Bird's-eye MIDI radar" })).toBeInTheDocument();
  });

  it('shows waveform type', () => {
    render(<App />);
    expect(screen.getByText(/Waveform:/)).toBeInTheDocument();
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

  it('shows keyboard hints', () => {
    render(<App />);
    expect(screen.getByText(/Z \/ X for octave/)).toBeInTheDocument();
  });
});
