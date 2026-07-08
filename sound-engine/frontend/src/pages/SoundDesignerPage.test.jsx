import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import SoundDesignerPage from './SoundDesignerPage.jsx';
import { loadUserPresets } from '../utils/presetStorage.js';

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

  it('renders the full AudioControls surface (not compact/embedded)', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    expect(workspace.getByText('Volume')).toBeInTheDocument();
  });

  it('renders a preset shelf with a save control between the controls and the keyboard', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    expect(workspace.getByRole('region', { name: 'Save and load sounds' })).toBeInTheDocument();
    expect(workspace.getByRole('button', { name: /save/i })).toBeInTheDocument();

    // Ordering: the presets region must sit after AudioControls (Volume) and
    // before the keyboard test strip, per the mandate's placement.
    const presetsRegion = workspace.getByRole('region', { name: 'Save and load sounds' });
    const keyboardRegion = screen.getByRole('region', { name: 'Test keyboard' });
    // Node.DOCUMENT_POSITION_FOLLOWING (4): presetsRegion comes before keyboardRegion.
    expect(
      presetsRegion.compareDocumentPosition(keyboardRegion) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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

  describe('saving a designed sound', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('persists a new preset to presetStorage (localStorage) on Save', () => {
      const { container } = render(<SoundDesignerPage />);
      const workspace = getWorkspace(container);

      const nameInput = workspace.getByLabelText('New preset name');
      fireEvent.change(nameInput, { target: { value: 'porch light' } });
      fireEvent.click(workspace.getByRole('button', { name: /^save$/i }));

      const stored = loadUserPresets();
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('porch light');
      // This is the same localStorage-backed store the sidebar's Sound tab
      // reads (utils/presetStorage.js STORAGE_KEY) — no page-local copy.
      expect(JSON.parse(localStorage.getItem('vangelis.presets.v1'))[0].name)
        .toBe('porch light');
    });

    it('shows the saved preset in the "Your presets" shelf list immediately after saving', () => {
      const { container } = render(<SoundDesignerPage />);
      const workspace = getWorkspace(container);

      const nameInput = workspace.getByLabelText('New preset name');
      fireEvent.change(nameInput, { target: { value: 'bx-90' } });
      fireEvent.click(workspace.getByRole('button', { name: /^save$/i }));

      expect(workspace.getByRole('button', { name: 'Load preset bx-90' })).toBeInTheDocument();
    });
  });
});
