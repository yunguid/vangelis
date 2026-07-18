import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './index.jsx';
import { MidiTransportContext, SoundControlsContext } from '../../context/SynthContexts.jsx';

const { soundTabRenderSpy } = vi.hoisted(() => ({
  soundTabRenderSpy: vi.fn()
}));

vi.mock('./MidiTab.jsx', () => ({
  default: () => <div data-testid="midi-tab">MIDI content</div>
}));

vi.mock('./SoundTab.jsx', () => ({
  default: () => {
    soundTabRenderSpy();
    return <div data-testid="sound-tab">Sound content</div>;
  }
}));

const buildProps = (overrides = {}) => ({
  isOpen: false,
  onClose: vi.fn(),
  onOpen: vi.fn(),
  activeTab: 'midi',
  onTabChange: vi.fn(),
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
  waveformType: 'Sine',
  onWaveformChange: vi.fn(),
  audioParams: {},
  onParamChange: vi.fn(),
  onParamsChange: vi.fn(),
  transportBpm: 120,
  controlSections: {
    essentials: true,
    delay: false,
    reverb: false,
    color: false,
    modulation: false
  },
  onControlSectionToggle: vi.fn(),
  ...overrides
});

afterEach(() => {
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  vi.restoreAllMocks();
});

describe('Sidebar', () => {
  it('renders rail buttons with labels', () => {
    render(<Sidebar {...buildProps()} />);
    expect(screen.getByRole('button', { name: /open midi browser/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open sound controls/i })).toBeInTheDocument();
  });

  it('renders a rail-level Design nav link to the sound-designer page', () => {
    render(<Sidebar {...buildProps()} />);
    const designLink = screen.getByRole('link', { name: /open the sound design workspace/i });
    expect(designLink).toBeInTheDocument();
    expect(designLink).toHaveAttribute('href', '#/sound-designer');
  });

  it('opens selected tab when rail button clicked', () => {
    const onOpen = vi.fn();
    const onTabChange = vi.fn();
    render(<Sidebar {...buildProps({ onOpen, onTabChange })} />);

    fireEvent.click(screen.getByRole('button', { name: /open midi browser/i }));

    expect(onTabChange).toHaveBeenCalledWith('midi');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('closes panel when active tab button is clicked while open', async () => {
    const onClose = vi.fn();
    render(<Sidebar {...buildProps({ isOpen: true, activeTab: 'midi', onClose })} />);

    expect(await screen.findByTestId('midi-tab')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close midi browser/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the sound tab panel content', async () => {
    render(<Sidebar {...buildProps({ isOpen: true, activeTab: 'sound' })} />);

    expect(screen.getByText('Sound controls')).toBeInTheDocument();
    expect(await screen.findByTestId('sound-tab')).toBeInTheDocument();
  });

  it('does not rerender the sound panel when only MIDI progress changes', async () => {
    const props = buildProps({ isOpen: true, activeTab: 'sound' });
    const soundValue = { waveformType: 'Sine', audioParams: {} };
    const midiValue = { isPlaying: true, progress: 0.1 };
    const view = render(
      <SoundControlsContext.Provider value={soundValue}>
        <MidiTransportContext.Provider value={midiValue}>
          <Sidebar {...props} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );
    expect(await screen.findByTestId('sound-tab')).toBeInTheDocument();
    const renderCount = soundTabRenderSpy.mock.calls.length;

    view.rerender(
      <SoundControlsContext.Provider value={soundValue}>
        <MidiTransportContext.Provider value={{ ...midiValue, progress: 0.2 }}>
          <Sidebar {...props} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );

    expect(soundTabRenderSpy).toHaveBeenCalledTimes(renderCount);
  });

  it('closes when escape is pressed', () => {
    const onClose = vi.fn();
    render(<Sidebar {...buildProps({ isOpen: true, onClose })} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('supports explicit close button in panel header', () => {
    const onClose = vi.fn();
    render(<Sidebar {...buildProps({ isOpen: true, onClose })} />);

    fireEvent.click(screen.getByLabelText('Close sidebar panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll when open on mobile viewport', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: query === '(max-width: 900px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    const { unmount } = render(<Sidebar {...buildProps({ isOpen: true })} />);

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.touchAction).toBe('none');

    unmount();

    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.touchAction).toBe('');
  });
});
