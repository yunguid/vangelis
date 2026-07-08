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

  it('renders a compact single-row waveform selector', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    expect(workspace.getByRole('radiogroup', { name: 'Waveform selection' })).toBeInTheDocument();
    // Accessible name is always the raw waveform name regardless of the
    // `compact` prop (only the visible label text abbreviates); this page
    // uses the compact row (defect: a huge 2x2 grid dominating the column),
    // scoped to a single row via `.sound-designer-waveform` CSS.
    expect(workspace.getByRole('radio', { name: 'Sine' })).toBeInTheDocument();
    expect(workspace.getByRole('radio', { name: 'Sawtooth' })).toBeInTheDocument();
  });

  it('renders the full AudioControls surface (not compact/embedded), with Essentials and Modulation expanded by default', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    expect(workspace.getByText('Volume')).toBeInTheDocument();

    // Essentials: expanded by default (Volume slider visible, asserted above).
    // Modulation: expanded by default too — this is the working surface for
    // envelope/FM/filter/mod-matrix shaping, the core designer loop, so it
    // must not be collapsed behind an extra click like the sidebar's Sound
    // tab default. The ADSR toggle row only exists in the DOM when the
    // Modulation section is open.
    expect(workspace.getByText('ADSR envelope')).toBeInTheDocument();
  });

  it('renders a compact preset strip (transport + save row) with the full preset browser folded by default', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    const presetsRegion = workspace.getByRole('region', { name: 'Save and load sounds' });
    const scoped = within(presetsRegion);

    // Always-visible strip: prev/next transport, active-name readout, save row.
    expect(scoped.getByRole('button', { name: 'Previous preset' })).toBeInTheDocument();
    expect(scoped.getByRole('button', { name: 'Next preset' })).toBeInTheDocument();
    expect(scoped.getByLabelText('New preset name')).toBeInTheDocument();
    expect(scoped.getByRole('button', { name: /^save$/i })).toBeInTheDocument();

    // The 45-button preset wall is demoted: factory category lists are not
    // in the DOM until the browse disclosure is opened.
    expect(scoped.queryByRole('list', { name: /presets$/i })).not.toBeInTheDocument();
    const browseToggle = scoped.getByRole('button', { name: /Browse all presets/i });
    expect(browseToggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(browseToggle);
    expect(scoped.getAllByRole('list', { name: /presets$/i }).length).toBeGreaterThan(0);
  });

  it('places the preset strip between the waveform row and the AudioControls surface', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    const waveformGroup = workspace.getByRole('radiogroup', { name: 'Waveform selection' });
    const presetsRegion = workspace.getByRole('region', { name: 'Save and load sounds' });
    const volumeLabel = workspace.getByText('Volume');

    expect(
      waveformGroup.compareDocumentPosition(presetsRegion) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      presetsRegion.compareDocumentPosition(volumeLabel) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('renders the keyboard test strip', () => {
    render(<SoundDesignerPage />);
    expect(screen.getByRole('region', { name: 'Test keyboard' })).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-mock')).toBeInTheDocument();
  });

  it('renders live visual feedback (the WaveCandy scope/spectrum suite)', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    const scopeRegion = workspace.getByRole('region', { name: 'Live sound visualization' });
    const scoped = within(scopeRegion);

    // WaveCandy's own internal section, reused wholesale (no reimplementation).
    expect(scoped.getByLabelText('Wave Candy visualizer')).toBeInTheDocument();
    expect(scoped.getByText('Oscilloscope')).toBeInTheDocument();
    expect(scoped.getByText('Spectrum')).toBeInTheDocument();
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

    it('shows the saved preset in the "Your presets" shelf list immediately after saving (once browse is opened)', () => {
      const { container } = render(<SoundDesignerPage />);
      const workspace = getWorkspace(container);

      const nameInput = workspace.getByLabelText('New preset name');
      fireEvent.change(nameInput, { target: { value: 'bx-90' } });
      fireEvent.click(workspace.getByRole('button', { name: /^save$/i }));

      // The strip stays compact after saving — the new preset lives in the
      // folded browser, one click away, not forced back into view.
      expect(workspace.queryByRole('button', { name: 'Load preset bx-90' })).not.toBeInTheDocument();
      fireEvent.click(workspace.getByRole('button', { name: /Browse all presets/i }));
      expect(workspace.getByRole('button', { name: 'Load preset bx-90' })).toBeInTheDocument();
    });
  });
});
