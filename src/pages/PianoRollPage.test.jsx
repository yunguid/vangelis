import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const cloudMocks = vi.hoisted(() => ({
  isCloudConfigured: vi.fn(() => true),
  getSession: vi.fn(async () => null),
  onAuthChange: vi.fn(() => () => {}),
  listCloudPatterns: vi.fn(async () => []),
  upsertCloudPattern: vi.fn(async ({ id, name, pattern }) => ({
    id: id || 'cloud-new',
    name,
    pattern,
    updatedAt: 't1'
  })),
  deleteCloudPattern: vi.fn(async () => true),
  signInWithEmail: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => {})
}));

vi.mock('../utils/cloudPatternStore.js', () => cloudMocks);

const SESSION = { user: { id: 'user-1', email: 'luke@example.com' } };

const cloudEntry = {
  id: 'cloud-1',
  name: 'Cloud loop',
  updatedAt: 't0',
  pattern: {
    name: 'Cloud loop',
    bpm: 128,
    bars: 4,
    nextNoteId: 2,
    nextTrackId: 2,
    tracks: [{ id: 'track-1', name: 'Lead', instrument: 'Sine', color: '#fff' }],
    loopRange: null,
    notes: [{ id: 'note-1', midi: 60, start: 0, duration: 1, velocity: 0.8, trackId: 'track-1' }]
  }
};

const renderPage = async () => {
  const { default: PianoRollPage } = await import('./PianoRollPage.jsx');
  const result = render(<PianoRollPage />);
  await act(async () => {});
  return result;
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;

const stubCanvasContext = () => {
  HTMLCanvasElement.prototype.getContext = function getContext(type) {
    if (type !== '2d') return null;
    return {
      canvas: this,
      scale: () => {},
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {}
    };
  };
};

describe('PianoRollPage cloud saves', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    Object.values(cloudMocks).forEach((mock) => mock.mockClear());
    cloudMocks.isCloudConfigured.mockReturnValue(true);
    cloudMocks.getSession.mockResolvedValue(null);
    cloudMocks.listCloudPatterns.mockResolvedValue([]);
    stubCanvasContext();
  });

  afterEach(() => {
    cleanup();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('renders nothing cloud-related when unconfigured', async () => {
    cloudMocks.isCloudConfigured.mockReturnValue(false);
    await renderPage();
    expect(screen.queryByLabelText('Email address for the sign-in link')).toBeNull();
    expect(cloudMocks.getSession).not.toHaveBeenCalled();
  });

  it('sends a magic link and reports the sent state', async () => {
    await renderPage();
    const input = screen.getByLabelText('Email address for the sign-in link');
    fireEvent.change(input, { target: { value: 'luke@example.com' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Send sign-in link'));
    });
    expect(cloudMocks.signInWithEmail).toHaveBeenCalledWith('luke@example.com');
    expect(screen.getByText('Link sent — check your email')).toBeTruthy();
  });

  it('merges cloud patterns into the library and loads them', async () => {
    cloudMocks.getSession.mockResolvedValue(SESSION);
    cloudMocks.listCloudPatterns.mockResolvedValue([cloudEntry]);
    await renderPage();
    expect(screen.getByText(/Signed in/)).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Cloud loop')).toBeTruthy());
    expect(screen.getByText(/Cloud ·/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('Cloud loop'));
    });
    expect(screen.getByLabelText('Pattern name').value).toBe('Cloud loop');
  });

  it('saves to the cloud and auto-syncs later edits to the same row', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    cloudMocks.getSession.mockResolvedValue(SESSION);
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    expect(cloudMocks.upsertCloudPattern).toHaveBeenCalledTimes(1);
    expect(cloudMocks.upsertCloudPattern.mock.calls[0][0].id).toBeNull();

    fireEvent.change(screen.getByLabelText('Pattern name'), { target: { value: 'Renamed' } });
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });
    await waitFor(() => expect(cloudMocks.upsertCloudPattern).toHaveBeenCalledTimes(2));
    expect(cloudMocks.upsertCloudPattern.mock.calls[1][0]).toMatchObject({
      id: 'cloud-new',
      name: 'Renamed'
    });
    expect(localStorage.getItem('vangelis.editorCloudPattern.v1')).toBe('cloud-new');
    vi.useRealTimers();
  });

  it('signs out and forgets the cloud library', async () => {
    cloudMocks.getSession.mockResolvedValue(SESSION);
    cloudMocks.listCloudPatterns.mockResolvedValue([cloudEntry]);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Cloud loop')).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByText('Sign out'));
    });
    expect(cloudMocks.signOut).toHaveBeenCalled();
    expect(screen.queryByText('Cloud loop')).toBeNull();
    expect(screen.getByLabelText('Email address for the sign-in link')).toBeTruthy();
  });
});

describe('PianoRollPage layers', () => {
  const originalSetPointerCapture = Element.prototype.setPointerCapture;

  const seedDraft = (tracks) => {
    localStorage.setItem('vangelis.editorDraft.v1', JSON.stringify({
      activeTrackId: tracks[tracks.length - 1].id,
      pattern: {
        name: 'Layered loop',
        bpm: 120,
        bars: 4,
        nextNoteId: 2,
        nextTrackId: tracks.length + 1,
        tracks,
        loopRange: null,
        notes: [{ id: 'note-1', midi: 60, start: 0, duration: 1, velocity: 0.8, trackId: 'track-1' }]
      }
    }));
  };

  const TWO_TRACKS = [
    { id: 'track-1', name: 'Lead', instrument: 'Sine' },
    { id: 'track-2', name: 'Layer 2', instrument: 'Square' }
  ];

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    cloudMocks.isCloudConfigured.mockReturnValue(false);
    stubCanvasContext();
    Element.prototype.setPointerCapture = () => {};
    seedDraft(TWO_TRACKS);
  });

  afterEach(() => {
    cleanup();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    Element.prototype.setPointerCapture = originalSetPointerCapture;
  });

  it('switches to a note\'s layer when it is clicked, so Add chord can build on it', async () => {
    const { container } = await renderPage();
    expect(screen.getByRole('button', { name: /^Edit Layer 2/ })).toHaveAttribute('aria-pressed', 'true');

    const leadNote = container.querySelector('[data-note-id="note-1"]');
    // jsdom has no PointerEvent, and the plain Event testing-library falls back
    // to drops `button`; a MouseEvent of the same type carries it.
    fireEvent(leadNote, new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
    fireEvent(leadNote, new MouseEvent('pointerup', { bubbles: true, button: 0 }));

    expect(screen.getByRole('button', { name: /^Edit Lead/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Add chord' }));
    expect(screen.getByRole('button', { name: /^Edit Lead: 3 notes/ })).toBeInTheDocument();
  });

  it('turns a track off from its activator', async () => {
    await renderPage();
    const activator = screen.getByRole('button', { name: 'Turn Lead off' });
    expect(activator).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(activator);

    expect(screen.queryByRole('button', { name: 'Turn Lead off' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Turn Lead on' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('offers solo only once there is a second track', async () => {
    seedDraft([{ id: 'track-1', name: 'Lead', instrument: 'Sine' }]);
    const { unmount } = await renderPage();
    expect(screen.getByRole('button', { name: 'Edit Lead: 1 notes' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Solo Lead' })).toBeNull();
    unmount();

    seedDraft(TWO_TRACKS);
    await renderPage();
    expect(screen.getByRole('button', { name: 'Solo Lead' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solo Layer 2' })).toBeTruthy();
  });

  it('gives every track its own sound button, not just the one being edited', async () => {
    await renderPage();
    expect(screen.getByRole('button', { name: /^Choose sound for Lead/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Choose sound for Layer 2/ })).toBeTruthy();
  });

  it('renames a track in place, reverting on Escape', async () => {
    await renderPage();
    fireEvent.doubleClick(screen.getByRole('button', { name: 'Edit Lead: 1 notes' }));
    // Typing must land in the field straight away.
    expect(screen.getByRole('textbox', { name: 'Rename Lead' })).toHaveFocus();
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename Lead' }), { target: { value: 'Bass' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename Lead' }), { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Edit Lead: 1 notes' })).toBeTruthy();

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Edit Lead: 1 notes' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename Lead' }), { target: { value: 'Bass' } });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Rename Lead' }));
    expect(screen.getByRole('button', { name: 'Edit Bass: 1 notes' })).toBeTruthy();
  });
});

