import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './index.jsx';

vi.mock('./MidiTab.jsx', () => ({
  default: () => <div data-testid="midi-tab">MIDI content</div>
}));

vi.mock('./SamplesTab.jsx', () => ({
  default: () => <div data-testid="samples-tab">Samples content</div>
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
  onSampleSelect: vi.fn(),
  activeSampleId: null,
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
    expect(screen.getByRole('button', { name: /open samples browser/i })).toBeInTheDocument();
  });

  it('opens selected tab when rail button clicked', () => {
    const onOpen = vi.fn();
    const onTabChange = vi.fn();
    render(<Sidebar {...buildProps({ onOpen, onTabChange })} />);

    fireEvent.click(screen.getByRole('button', { name: /open samples browser/i }));

    expect(onTabChange).toHaveBeenCalledWith('samples');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('closes panel when active tab button is clicked while open', () => {
    const onClose = vi.fn();
    render(<Sidebar {...buildProps({ isOpen: true, activeTab: 'midi', onClose })} />);

    fireEvent.click(screen.getByRole('button', { name: /close midi browser/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
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
