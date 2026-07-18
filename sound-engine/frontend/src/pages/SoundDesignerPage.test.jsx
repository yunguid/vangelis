import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import SoundDesignerPage from './SoundDesignerPage.jsx';
import { loadUserPresets } from '../utils/userPresetStorage.js';

// Mock the audio engine the same way App.test.jsx does, so the page can
// mount without touching real AudioWorklet/Web Audio API in jsdom.
vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: {
    getStatus: () => ({ wasmReady: false, graphWarmed: false }),
    getAnalysisNodes: () => null,
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

// The page renders the shared interactive Sidebar rail alongside its own
// workspace. The Sidebar mounts the matching tab's panel content even while
// closed —
// so a *second*, hidden copy of SoundTab (with its own UIOverlay,
// AudioControls, and PresetShelf) exists in the DOM. Assertions about the
// page's own visible workspace must be scoped to `.sound-designer-workspace`
// to avoid matching the hidden duplicate.
const getWorkspace = (container) => {
  const workspace = container.querySelector('.sound-designer-workspace');
  expect(workspace).toBeTruthy();
  return within(workspace);
};

const goToStage = async (workspace, label) => {
  fireEvent.click(workspace.getByRole('button', { name: label }));
  if (label !== 'Base') {
    await waitFor(() => {
      expect(workspace.queryByText('Loading controls…')).not.toBeInTheDocument();
    });
  }
};

describe('SoundDesignerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders its own header', () => {
    render(<SoundDesignerPage />);
    expect(screen.getByText('Vangelis')).toBeInTheDocument();
  });

  it('renders a five-stage rail: Base, Tone, Motion, Space, Mint', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    const rail = workspace.getByRole('navigation', { name: 'Sound design stages' });
    const railScoped = within(rail);
    ['Base', 'Tone', 'Motion', 'Space', 'Mint'].forEach((label) => {
      expect(railScoped.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('defaults to the Base stage, showing the waveform cards and folded preset strip', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    expect(workspace.getByRole('radiogroup', { name: 'Waveform selection' })).toBeInTheDocument();
    expect(workspace.getByRole('radio', { name: 'Sine' })).toBeInTheDocument();
    expect(workspace.getByRole('radio', { name: 'Sawtooth' })).toBeInTheDocument();
    expect(workspace.getByRole('radio', { name: 'Square' })).toBeInTheDocument();
    expect(workspace.getByRole('radio', { name: 'Triangle' })).toBeInTheDocument();

    // Preset browse is folded and saving is reserved for the Mint stage.
    expect(workspace.getByRole('button', { name: 'Previous preset' })).toBeInTheDocument();
    expect(workspace.queryByRole('button', { name: /^save$/i })).not.toBeInTheDocument();
    expect(workspace.queryByRole('list', { name: /presets$/i })).not.toBeInTheDocument();
  });

  it('allows free navigation: any stage is clickable at any time', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);

    await goToStage(workspace, 'Space');
    expect(workspace.getByText('Delay')).toBeInTheDocument();

    await goToStage(workspace, 'Base');
    expect(workspace.getByRole('radiogroup', { name: 'Waveform selection' })).toBeInTheDocument();
  });

  it('marks the active stage and tracks visited stages via a class, not a pill/dot', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    const rail = workspace.getByRole('navigation', { name: 'Sound design stages' });
    const railScoped = within(rail);

    const baseTab = railScoped.getByRole('button', { name: 'Base' });
    expect(baseTab.className).toMatch(/is-active/);
    expect(baseTab.className).toMatch(/is-visited/);

    const toneTab = railScoped.getByRole('button', { name: 'Tone' });
    expect(toneTab.className).not.toMatch(/is-visited/);

    fireEvent.click(toneTab);
    expect(toneTab.className).toMatch(/is-active/);
    expect(toneTab.className).toMatch(/is-visited/);
    expect(baseTab.className).not.toMatch(/is-active/);
    expect(baseTab.className).toMatch(/is-visited/);
  });

  it('the Tone stage shows filter and color (distortion) controls', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    await goToStage(workspace, 'Tone');
    expect(workspace.getByText('Tone filter')).toBeInTheDocument();
    expect(workspace.getByText('Color')).toBeInTheDocument();
    expect(workspace.getByText('Distortion')).toBeInTheDocument();
  });

  it('the Motion stage shows the ADSR envelope, FM toggle, LFOs, and mod routes', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    await goToStage(workspace, 'Motion');
    expect(workspace.getByText('Amplitude envelope')).toBeInTheDocument();
    expect(workspace.getByText('Attack')).toBeInTheDocument();
    expect(workspace.getByText('Frequency modulation')).toBeInTheDocument();
    expect(workspace.getByText('LFOs')).toBeInTheDocument();
    expect(workspace.getByRole('group', { name: 'Modulation matrix' })).toBeInTheDocument();
  });

  it('the Space stage shows delay, reverb, and unison controls', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    await goToStage(workspace, 'Space');
    expect(workspace.getByText('Delay')).toBeInTheDocument();
    expect(workspace.getByText('Reverb')).toBeInTheDocument();
    expect(workspace.getByText('Unison')).toBeInTheDocument();
  });

  it('a "next" affordance on each stage card advances the wizard thread in order', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);

    fireEvent.click(workspace.getByRole('button', { name: /next: Tone/i }));
    expect(await workspace.findByText('Tone filter')).toBeInTheDocument();

    fireEvent.click(workspace.getByRole('button', { name: /next: Motion/i }));
    expect(workspace.getByText('Amplitude envelope')).toBeInTheDocument();

    fireEvent.click(workspace.getByRole('button', { name: /next: Space/i }));
    expect(workspace.getByText('Delay')).toBeInTheDocument();

    fireEvent.click(workspace.getByRole('button', { name: /next: Mint/i }));
    expect(workspace.getByLabelText('Name this sound')).toBeInTheDocument();
  });

  it('the Mint stage has no further "next" affordance', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    await goToStage(workspace, 'Mint');
    expect(workspace.queryByRole('button', { name: /^next:/i })).not.toBeInTheDocument();
  });

  it('the Base stage has no "back" affordance (it is the first stage)', () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    expect(workspace.queryByRole('button', { name: /^← back:/i })).not.toBeInTheDocument();
    expect(workspace.getByRole('button', { name: /^next:/i })).toBeInTheDocument();
  });

  it('every stage after Base has a "back" affordance that steps backward in order', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);

    await goToStage(workspace, 'Tone');
    expect(workspace.getByRole('button', { name: '← back: Base' })).toBeInTheDocument();

    await goToStage(workspace, 'Motion');
    expect(workspace.getByRole('button', { name: '← back: Tone' })).toBeInTheDocument();

    await goToStage(workspace, 'Space');
    expect(workspace.getByRole('button', { name: '← back: Motion' })).toBeInTheDocument();

    await goToStage(workspace, 'Mint');
    expect(workspace.getByRole('button', { name: '← back: Space' })).toBeInTheDocument();

    // Clicking back actually navigates (not just decorative).
    fireEvent.click(workspace.getByRole('button', { name: '← back: Space' }));
    expect(workspace.getByText('Delay')).toBeInTheDocument();
  });

  it('the Mint stage keeps its "back" affordance alongside having no "next"', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);
    await goToStage(workspace, 'Mint');
    expect(workspace.getByRole('button', { name: '← back: Space' })).toBeInTheDocument();
    expect(workspace.queryByRole('button', { name: /^next:/i })).not.toBeInTheDocument();
  });

  it('renders the keyboard test strip, always docked', () => {
    render(<SoundDesignerPage />);
    expect(screen.getByRole('region', { name: 'Test keyboard' })).toBeInTheDocument();
    expect(screen.getByTestId('keyboard-mock')).toBeInTheDocument();
  });

  it('renders the persistent live scope strip at every stage', async () => {
    const { container } = render(<SoundDesignerPage />);
    const workspace = getWorkspace(container);

    const assertScopeVisible = async () => {
      const scopeRegion = workspace.getByRole('region', { name: 'Live sound visualization' });
      const scoped = within(scopeRegion);
      expect(await scoped.findByLabelText('Wave Candy visualizer')).toBeInTheDocument();
      expect(scoped.getByText('Oscilloscope')).toBeInTheDocument();
      expect(scoped.getByText('Spectrum')).toBeInTheDocument();
    };

    await assertScopeVisible();
    await goToStage(workspace, 'Motion');
    await assertScopeVisible();
    await goToStage(workspace, 'Mint');
    await assertScopeVisible();
  });

  it('renders an interactive sidebar rail', () => {
    render(<SoundDesignerPage />);
    const soundRailButton = screen.getByRole('button', { name: 'Open Sound controls' });
    expect(soundRailButton).toBeEnabled();
    fireEvent.click(soundRailButton);
    expect(screen.getByRole('complementary', { name: 'Sound controls' })).toBeVisible();
  });

  describe('minting a sound', () => {
    it('shows a summary of what was shaped on the Mint stage', async () => {
      const { container } = render(<SoundDesignerPage />);
      const workspace = getWorkspace(container);
      await goToStage(workspace, 'Mint');
      expect(workspace.getByText(/Sine base/i)).toBeInTheDocument();
      expect(workspace.getByText(/filter off/i)).toBeInTheDocument();
      expect(workspace.getByText(/delay off/i)).toBeInTheDocument();
      expect(workspace.getByText(/reverb off/i)).toBeInTheDocument();
    });

    it('persists a new preset to userPresetStorage (localStorage) on Mint', async () => {
      const { container } = render(<SoundDesignerPage />);
      const workspace = getWorkspace(container);
      await goToStage(workspace, 'Mint');

      const nameInput = workspace.getByLabelText('Name this sound');
      fireEvent.change(nameInput, { target: { value: 'porch light' } });
      fireEvent.click(workspace.getByRole('button', { name: 'Mint sound' }));

      const stored = loadUserPresets();
      expect(stored).toHaveLength(1);
      expect(stored[0].name).toBe('porch light');
      // This is the same localStorage-backed store the sidebar's Sound tab
      // reads (utils/userPresetStorage.js STORAGE_KEY) — no page-local copy.
      expect(JSON.parse(localStorage.getItem('vangelis.presets.v1'))[0].name)
        .toBe('porch light');
    });

    it('shows a confirmation with a link to use the sound on the main page after minting', async () => {
      const { container } = render(<SoundDesignerPage />);
      const workspace = getWorkspace(container);
      await goToStage(workspace, 'Mint');

      const nameInput = workspace.getByLabelText('Name this sound');
      fireEvent.change(nameInput, { target: { value: 'bx-90' } });
      fireEvent.click(workspace.getByRole('button', { name: 'Mint sound' }));

      expect(workspace.getByText(/bx-90.*minted/i)).toBeInTheDocument();
      const link = workspace.getByRole('link', { name: /use it on the main page/i });
      expect(link).toHaveAttribute('href', '#/');
    });

    it('the minted preset appears in the "Your presets" shelf on the Base stage (once browse is opened)', async () => {
      const { container } = render(<SoundDesignerPage />);
      const workspace = getWorkspace(container);
      await goToStage(workspace, 'Mint');

      const nameInput = workspace.getByLabelText('Name this sound');
      fireEvent.change(nameInput, { target: { value: 'bx-90' } });
      fireEvent.click(workspace.getByRole('button', { name: 'Mint sound' }));

      await goToStage(workspace, 'Base');
      fireEvent.click(workspace.getByRole('button', { name: /Browse all presets/i }));
      expect(await workspace.findByRole('button', { name: 'Load preset bx-90' })).toBeInTheDocument();
    });
  });
});
