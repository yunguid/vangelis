import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './index.jsx';
import { MidiTransportContext, SoundControlsContext } from '../../context/SynthContexts.jsx';

const { midiTabRenderSpy, soundTabRenderSpy } = vi.hoisted(() => ({
  midiTabRenderSpy: vi.fn(),
  soundTabRenderSpy: vi.fn()
}));

vi.mock('./MidiTab.jsx', () => ({
  default: ({ active = true }) => {
    midiTabRenderSpy();
    return active ? <div data-testid="midi-tab">MIDI content</div> : null;
  }
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

// jsdom has no matchMedia; a test that installs one must not leak it (once
// restoreAllMocks strips its implementation it returns undefined).
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  delete window.__vangelisPerf;
  document.body.style.overflow = '';
  document.body.style.touchAction = '';
  window.matchMedia = originalMatchMedia;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Sidebar', () => {
  it('renders icon-only controls, named by aria-label with a title tooltip', () => {
    const { container } = render(<Sidebar {...buildProps()} />);
    expect(screen.getByRole('button', { name: /open midi browser/i }))
      .toHaveAttribute('title', 'MIDI library');
    expect(screen.getByRole('button', { name: /open sound controls/i }))
      .toHaveAttribute('title', 'Sound controls');
    expect(screen.getByRole('link', { name: 'Open the keyboard player' }))
      .toHaveAttribute('title', 'Keyboard');
    expect(screen.getByRole('link', { name: 'Open the pattern editor' }))
      .toHaveAttribute('title', 'Editor');
    expect(container.querySelector('.sidebar-rail').textContent).toBe('');
    expect(screen.queryByRole('link', { name: /return to keyboard/i })).not.toBeInTheDocument();
  });

  it('keeps the Design and Studies pages out of the rail (their routes still exist)', () => {
    render(<Sidebar {...buildProps()} />);
    expect(screen.queryByRole('link', { name: /sound design/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /song study/i })).not.toBeInTheDocument();
  });

  it('renders a rail-level Editor nav link to the pattern editor', () => {
    render(<Sidebar {...buildProps()} />);
    const editorLink = screen.getByRole('link', { name: /open the pattern editor/i });
    expect(editorLink).toBeInTheDocument();
    expect(editorLink).toHaveAttribute('href', '#/editor');
  });

  it('opens selected tab when rail button clicked', () => {
    const onOpen = vi.fn();
    const onTabChange = vi.fn();
    render(<Sidebar {...buildProps({ onOpen, onTabChange })} />);

    fireEvent.click(screen.getByRole('button', { name: /open midi browser/i }));

    expect(onTabChange).toHaveBeenCalledWith('midi');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('records opt-in sidebar handler and painted-response scenarios', () => {
    const recordInteraction = vi.fn();
    const markInteractionPaint = vi.fn();
    window.__vangelisPerf = { recordInteraction, markInteractionPaint };
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(22);
    render(<Sidebar {...buildProps()} />);

    fireEvent.click(screen.getByRole('button', { name: /open midi browser/i }));

    expect(markInteractionPaint).toHaveBeenCalledWith('ui.sidebar.open.paint', { tab: 'midi' });
    expect(recordInteraction).toHaveBeenCalledWith(
      'ui.sidebar.open.handler',
      expect.any(Number),
      { tab: 'midi' }
    );
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

  it('freezes an opened Sound panel while closed and resyncs it on reopen', async () => {
    const openProps = buildProps({ isOpen: true, activeTab: 'sound' });
    const closedProps = { ...openProps, isOpen: false };
    const midiValue = { isPlaying: false, progress: 0 };
    const firstSoundValue = { waveformType: 'Sine', audioParams: { attack: 0.1 } };
    const view = render(
      <SoundControlsContext.Provider value={firstSoundValue}>
        <MidiTransportContext.Provider value={midiValue}>
          <Sidebar {...openProps} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );
    expect(await screen.findByTestId('sound-tab')).toBeInTheDocument();

    view.rerender(
      <SoundControlsContext.Provider value={firstSoundValue}>
        <MidiTransportContext.Provider value={midiValue}>
          <Sidebar {...closedProps} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );
    const rendersAfterClose = soundTabRenderSpy.mock.calls.length;

    const latestSoundValue = { waveformType: 'Square', audioParams: { attack: 0.9 } };
    view.rerender(
      <SoundControlsContext.Provider value={latestSoundValue}>
        <MidiTransportContext.Provider value={midiValue}>
          <Sidebar {...closedProps} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );
    expect(soundTabRenderSpy).toHaveBeenCalledTimes(rendersAfterClose);
    expect(screen.getByTestId('sound-tab')).toBeInTheDocument();

    view.rerender(
      <SoundControlsContext.Provider value={latestSoundValue}>
        <MidiTransportContext.Provider value={midiValue}>
          <Sidebar {...openProps} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );
    expect(soundTabRenderSpy).toHaveBeenCalledTimes(rendersAfterClose + 1);
  });

  it('freezes an opened MIDI panel during closed progress updates', async () => {
    const openProps = buildProps({ isOpen: true, activeTab: 'midi' });
    const closedProps = { ...openProps, isOpen: false };
    const soundValue = { waveformType: 'Sine', audioParams: {} };
    const firstMidiValue = { isPlaying: true, progress: 0.1 };
    const view = render(
      <SoundControlsContext.Provider value={soundValue}>
        <MidiTransportContext.Provider value={firstMidiValue}>
          <Sidebar {...openProps} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );
    expect(await screen.findByTestId('midi-tab')).toBeInTheDocument();

    view.rerender(
      <SoundControlsContext.Provider value={soundValue}>
        <MidiTransportContext.Provider value={firstMidiValue}>
          <Sidebar {...closedProps} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );
    expect(screen.queryByTestId('midi-tab')).not.toBeInTheDocument();
    const rendersAfterClose = midiTabRenderSpy.mock.calls.length;

    view.rerender(
      <SoundControlsContext.Provider value={soundValue}>
        <MidiTransportContext.Provider value={{ ...firstMidiValue, progress: 0.2 }}>
          <Sidebar {...closedProps} />
        </MidiTransportContext.Provider>
      </SoundControlsContext.Provider>
    );
    expect(midiTabRenderSpy).toHaveBeenCalledTimes(rendersAfterClose);
  });

  it('closes when escape is pressed', () => {
    const onClose = vi.fn();
    render(<Sidebar {...buildProps({ isOpen: true, onClose })} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not attach close behavior while the panel is collapsed', () => {
    const onClose = vi.fn();
    render(<Sidebar {...buildProps({ isOpen: false, onClose })} />);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
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

describe('Sidebar wave dock', () => {
  const renderDock = (overrides) => {
    const view = render(<Sidebar {...buildProps(overrides)} />);
    const dock = view.container.querySelector('.sidebar-rail');
    return {
      ...view,
      dock,
      edge: dock.querySelector('.dock__edge'),
      body: dock.querySelector('.dock__body'),
      notch: dock.querySelector('.dock__notch')
    };
  };

  it('stays hidden until the pointer reaches the left edge', () => {
    const { dock, edge } = renderDock();
    expect(dock).toHaveAttribute('data-dock', 'hidden');

    fireEvent.pointerEnter(edge);
    expect(dock).toHaveAttribute('data-dock', 'shown');
  });

  it('hides 320ms after the pointer leaves the edge and the wave, unless it comes back', () => {
    vi.useFakeTimers();
    const { dock, edge, body } = renderDock();

    fireEvent.pointerEnter(edge);
    fireEvent.pointerLeave(edge);
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerEnter(body);
    act(() => vi.advanceTimersByTime(1000));
    expect(dock).toHaveAttribute('data-dock', 'shown');

    fireEvent.pointerLeave(body);
    act(() => vi.advanceTimersByTime(319));
    expect(dock).toHaveAttribute('data-dock', 'shown');
    act(() => vi.advanceTimersByTime(1));
    expect(dock).toHaveAttribute('data-dock', 'hidden');
  });

  it('stays out while a panel is open and hides once it closes with the pointer away', () => {
    vi.useFakeTimers();
    const { dock, body, rerender } = renderDock({ isOpen: true });
    expect(dock).toHaveAttribute('data-dock', 'shown');

    fireEvent.pointerEnter(body);
    fireEvent.pointerLeave(body);
    act(() => vi.advanceTimersByTime(1000));
    expect(dock).toHaveAttribute('data-dock', 'shown');

    rerender(<Sidebar {...buildProps({ isOpen: false })} />);
    expect(dock).toHaveAttribute('data-dock', 'hidden');
  });

  it('comes out while keyboard focus is inside it', () => {
    const { dock } = renderDock();
    const keyboardLink = screen.getByRole('link', { name: 'Open the keyboard player' });

    act(() => keyboardLink.focus());
    expect(dock).toHaveAttribute('data-dock', 'shown');

    act(() => keyboardLink.blur());
    expect(dock).toHaveAttribute('data-dock', 'hidden');
  });

  it('goes away on Escape, taking keyboard focus out with it', () => {
    const { dock, edge } = renderDock();
    fireEvent.pointerEnter(edge);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dock).toHaveAttribute('data-dock', 'hidden');

    const keyboardLink = screen.getByRole('link', { name: 'Open the keyboard player' });
    act(() => keyboardLink.focus());
    expect(dock).toHaveAttribute('data-dock', 'shown');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(dock).toHaveAttribute('data-dock', 'hidden');
    expect(keyboardLink).not.toHaveFocus();
  });

  it('toggles on a tap of the notch and hides on a tap outside it', () => {
    const { dock, notch } = renderDock();
    fireEvent.click(notch);
    expect(dock).toHaveAttribute('data-dock', 'shown');
    fireEvent.click(notch);
    expect(dock).toHaveAttribute('data-dock', 'hidden');

    fireEvent.click(notch);
    fireEvent.pointerDown(screen.getByRole('button', { name: /open sound controls/i }));
    expect(dock).toHaveAttribute('data-dock', 'shown');
    fireEvent.pointerDown(document.body);
    expect(dock).toHaveAttribute('data-dock', 'hidden');
  });

  it('marks the current page and a playing MIDI file on their controls', () => {
    renderDock({ currentView: 'editor', isMidiPlaying: true });
    expect(screen.getByRole('link', { name: 'Open the pattern editor' }))
      .toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Open the keyboard player' }))
      .not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: /open midi browser/i }))
      .toHaveClass('sidebar-rail__btn--playing');
  });
});
