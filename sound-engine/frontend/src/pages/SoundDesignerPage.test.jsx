import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import SoundDesignerPage from './SoundDesignerPage.jsx';

// Mock the audio engine the same way App.test.jsx does, so the page can
// mount without touching real AudioWorklet/Web Audio API in jsdom.
vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: {
    getStatus: () => ({ wasmReady: false, graphWarmed: false }),
    subscribe: vi.fn(() => () => {}),
    subscribeRecording: vi.fn(() => () => {}),
    setGlobalParams: vi.fn(),
    ensureWasm: vi.fn(() => Promise.resolve()),
    ensureAudioContext: vi.fn(() => Promise.resolve()),
    warmGraph: vi.fn()
  }
}));

// SynthKeyboard pulls in AudioWorklet-adjacent hooks that don't play well
// with jsdom; mock it out like App.test.jsx does.
vi.mock('../components/SynthKeyboard', () => ({
  default: () => <div data-testid="keyboard-mock">Synth</div>
}));

// NOTE: like MidiPipelinePage, this page renders a disabled Sidebar rail
// alongside its own workspace (`<Sidebar disabled isOpen={false}
// activeTab="sound" />`). The Sidebar still mounts the matching tab's panel
// content (hidden via aria-hidden/CSS, not unmounted) even while disabled —
// so a *second*, hidden copy of SoundTab (with its own UIOverlay,
// AudioControls, and PresetShelf) exists in the DOM. Assertions about the
// page's own visible workspace must be scoped to `.sound-designer-workspace`
// to avoid matching the hidden duplicate.
const getWorkspace = (container) => {
  const workspace = container.querySelector('.sound-designer-workspace');
  expect(workspace).toBeTruthy();
  return within(workspace);
};

describe('SoundDesignerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders its own header', () => {
    render(<SoundDesignerPage />);
    expect(screen.getByText('Vangelis')).toBeInTheDocument();
  });

  it('renders the full (non-compact) waveform selector', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    expect(workspace.getByRole('radiogroup', { name: 'Waveform selection' })).toBeInTheDocument();
    // Full-size waveform buttons render the raw waveform name, not the
    // compact abbreviation.
    expect(workspace.getByRole('radio', { name: 'Sine' })).toBeInTheDocument();
  });

  it('renders the full AudioControls surface (not compact/embedded, no preset shelf)', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    expect(workspace.getByText('Volume')).toBeInTheDocument();
    // This page must not import/render PresetShelf itself: no "Save" button
    // or its hint text inside the page's own workspace.
    expect(workspace.queryByText(/save/i)).not.toBeInTheDocument();
  });

  it('renders the keyboard test strip', () => {
    render(<SoundDesignerPage />);
    expect(screen.getByRole('region', { name: 'Test keyboard' })).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-mock')).toBeInTheDocument();
  });

  it('renders a disabled sidebar rail', () => {
    render(<SoundDesignerPage />);
    // The disabled Sidebar rail still renders its tab buttons, disabled.
    const soundRailButton = screen.getByRole('button', { name: /Sound panel unavailable/i });
    expect(soundRailButton).toBeDisabled();
  });
});
