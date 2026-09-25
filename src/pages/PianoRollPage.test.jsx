import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
  uploadPatternMidi: vi.fn(async () => true),
  deleteCloudPattern: vi.fn(async () => true),
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signOut: vi.fn(async () => {})
}));

vi.mock('../utils/cloudPatternStore.js', () => cloudMocks);

// The editor calls more of the engine than these tests care about: anything
// not listed answers as a no-op.
const engine = vi.hoisted(() => ({
  ensureAudioContext: vi.fn(async () => ({ state: 'running', currentTime: 0 })),
  ensureWasm: vi.fn(async () => {}),
  warmGraph: vi.fn(),
  getStatus: vi.fn(() => ({ wasmReady: true })),
  subscribe: vi.fn(() => () => {}),
  subscribeRecording: vi.fn(() => () => {}),
  playFrequency: vi.fn(({ noteId }) => ({ voiceId: noteId })),
  stopNote: vi.fn()
}));
vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: new Proxy(engine, {
    get: (target, key) => {
      if (!(key in target)) target[key] = vi.fn();
      return target[key];
    }
  })
}));

const SESSION = { user: { id: 'user-1', email: 'player@example.com' } };
const PROJECTS_KEY = 'vangelis.projects.v1';

const cloudEntry = {
  id: 'cloud-1',
  name: 'Cloud loop',
  updatedAt: '2026-09-20T10:00:00Z',
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

const onePattern = (name, notes) => ({
  name,
  bpm: 120,
  bars: 4,
  nextNoteId: notes.length + 1,
  nextTrackId: 2,
  tracks: [{ id: 'track-1', name: 'Lead', instrument: 'Sine' }],
  loopRange: null,
  notes
});

const seedProject = (id, name, notes, extra = {}) => {
  const pattern = onePattern(name, notes);
  const stored = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
  localStorage.setItem(PROJECTS_KEY, JSON.stringify([
    { id, name, pattern, updatedAt: 1, cloudId: null, syncedAt: null, ...extra },
    ...stored
  ]));
  return pattern;
};

const seedProjectDraft = (projectId, pattern) => {
  localStorage.setItem('vangelis.editorDraft.v1', JSON.stringify({ projectId, pattern }));
};

const storedProjects = () => JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');

const renderPage = async () => {
  const { default: PianoRollPage } = await import('./PianoRollPage.jsx');
  const result = render(<PianoRollPage />);
  await act(async () => {});
  return result;
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalPointerCapture = Element.prototype.setPointerCapture;
const originalGetRect = Element.prototype.getBoundingClientRect;

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

// jsdom lays nothing out, so the note grid and the velocity lane get real
// boxes: 96px a beat at 100% zoom, 20px a row from B7 down.
const ROW = 20;
const BEAT = 96;
const rowY = (midi) => (107 - midi) * ROW + ROW / 2;
const stubLayout = () => {
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.classList?.contains('piano-roll__notes')) {
      return { left: 0, top: 0, right: 4000, bottom: 84 * ROW, width: 4000, height: 84 * ROW, x: 0, y: 0 };
    }
    if (this.classList?.contains('velocity-lane')) {
      return { left: 0, top: 0, right: 4000, bottom: 88, width: 4000, height: 88, x: 0, y: 0 };
    }
    return originalGetRect.call(this);
  };
};

// jsdom has no PointerEvent, and the plain Event testing-library falls back to
// drops `button` and the coordinates; a MouseEvent of the same type keeps them.
const pointer = (element, type, { x = 0, y = 0, ...rest } = {}) => {
  fireEvent(element, new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, ...rest }));
};

const noteBoxes = (container) => [...container.querySelectorAll('.piano-roll__note')].map((node) => ({
  left: Number.parseFloat(node.style.left),
  width: Number.parseFloat(node.style.width),
  top: Number.parseFloat(node.style.top),
  muted: node.classList.contains('is-muted'),
  title: node.getAttribute('title')
})).sort((a, b) => a.left - b.left || a.top - b.top);

const resetForTest = () => {
  vi.resetModules();
  localStorage.clear();
  Object.values(cloudMocks).forEach((mock) => mock.mockClear());
  engine.playFrequency.mockClear();
  cloudMocks.isCloudConfigured.mockReturnValue(true);
  cloudMocks.getSession.mockResolvedValue(null);
  cloudMocks.listCloudPatterns.mockResolvedValue([]);
  stubCanvasContext();
  stubLayout();
  Element.prototype.setPointerCapture = () => {};
};

const restoreAfterTest = () => {
  cleanup();
  vi.useRealTimers();
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  Element.prototype.setPointerCapture = originalPointerCapture;
  Element.prototype.getBoundingClientRect = originalGetRect;
};

const LEAD_NOTE = { id: 'note-1', midi: 60, start: 0, duration: 1, velocity: 0.8, trackId: 'track-1' };

describe('PianoRollPage projects on this device', () => {
  beforeEach(() => {
    resetForTest();
    cloudMocks.isCloudConfigured.mockReturnValue(false);
  });
  afterEach(restoreAfterTest);

  it('never mentions an account when the cloud is not configured', async () => {
    await renderPage();
    expect(screen.queryByRole('button', { name: /^Account/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'On this device' })).toBeTruthy();
    expect(cloudMocks.getSession).not.toHaveBeenCalled();
  });

  it('saves drawn notes as a project without being asked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container } = await renderPage();
    expect(storedProjects()).toEqual([]);
    fireEvent.doubleClick(container.querySelector('.piano-roll__notes'), { clientX: 10, clientY: rowY(60) });
    await act(async () => {
      vi.advanceTimersByTime(450);
    });
    const [project] = storedProjects();
    expect(project.name).toBe('Untitled');
    expect(project.pattern.notes).toHaveLength(1);
    expect(project.pattern.notes[0].midi).toBe(60);
  });

  it('starts a new project at once and keeps the last one to go back to', async () => {
    seedProject('p-old', 'Night drive', [LEAD_NOTE]);
    seedProjectDraft('p-old', onePattern('Night drive', [
      LEAD_NOTE,
      { ...LEAD_NOTE, id: 'note-2', midi: 64, start: 1 }
    ]));
    const { container } = await renderPage();
    expect(noteBoxes(container)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /New/ }));
    expect(screen.getByLabelText('Project name').value).toBe('Untitled');
    expect(noteBoxes(container)).toHaveLength(0);
    // The project being left was saved first, with its latest edit.
    expect(storedProjects().find((entry) => entry.id === 'p-old').pattern.notes).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    const list = await screen.findByRole('dialog', { name: 'Projects' });
    await act(async () => {
      fireEvent.click(within(list).getByText('Night drive'));
    });
    expect(screen.getByLabelText('Project name').value).toBe('Night drive');
    expect(noteBoxes(container)).toHaveLength(2);
  });

  it('deletes a project only after the delete is confirmed', async () => {
    seedProject('p-keep', 'Keeper', [LEAD_NOTE]);
    seedProject('p-gone', 'Goner', [{ ...LEAD_NOTE, midi: 62 }]);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    const list = await screen.findByRole('dialog', { name: 'Projects' });
    fireEvent.click(within(list).getByRole('button', { name: 'Delete Goner' }));
    expect(storedProjects()).toHaveLength(2);
    fireEvent.click(within(list).getByRole('button', { name: 'Delete' }));
    expect(storedProjects().map((entry) => entry.id)).toEqual(['p-keep']);
    expect(within(list).queryByText('Goner')).toBeNull();
  });
});

describe('PianoRollPage account', () => {
  beforeEach(resetForTest);
  afterEach(restoreAfterTest);

  it('signs in to the one account with a password', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Account: sign in' }));
    const email = await screen.findByLabelText('Email');
    cloudMocks.getSession.mockResolvedValue(SESSION);
    fireEvent.change(email, { target: { value: 'player@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    });
    expect(cloudMocks.signInWithPassword).toHaveBeenCalledWith('player@example.com', 'secret');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Account: signed in' })).toBeTruthy());
  });

  it('says so when the password is refused', async () => {
    cloudMocks.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Account: sign in' }));
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'player@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    });
    expect(screen.getByRole('alert').textContent).toMatch(/did not match/);
  });

  it('sends device projects to the account, with their MIDI files, and keeps the row in step', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const pattern = seedProject('p-1', 'Offline idea', [LEAD_NOTE]);
    seedProjectDraft('p-1', pattern);
    cloudMocks.getSession.mockResolvedValue(SESSION);
    await renderPage();

    await waitFor(() => expect(cloudMocks.uploadPatternMidi).toHaveBeenCalledTimes(1));
    expect(cloudMocks.upsertCloudPattern.mock.calls[0][0]).toMatchObject({ id: null, name: 'Offline idea' });
    const [rowId, bytes] = cloudMocks.uploadPatternMidi.mock.calls[0];
    expect(rowId).toBe('cloud-new');
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd');
    expect(storedProjects()[0]).toMatchObject({ cloudId: 'cloud-new' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Renamed' } });
    await act(async () => {
      vi.advanceTimersByTime(450 + 1600);
    });
    await waitFor(() => expect(cloudMocks.upsertCloudPattern).toHaveBeenCalledTimes(2));
    expect(cloudMocks.upsertCloudPattern.mock.calls[1][0]).toMatchObject({ id: 'cloud-new', name: 'Renamed' });
  });

  it('offers to retry when the account refuses a save', async () => {
    cloudMocks.upsertCloudPattern.mockResolvedValueOnce(null);
    seedProject('p-1', 'Stuck', [LEAD_NOTE]);
    cloudMocks.getSession.mockResolvedValue(SESSION);
    await renderPage();
    const retry = await screen.findByRole('button', { name: 'Retry save' });
    expect(storedProjects()[0].cloudId).toBeNull();
    await act(async () => {
      fireEvent.click(retry);
    });
    await waitFor(() => expect(storedProjects()[0].cloudId).toBe('cloud-new'));
  });

  it('lists account projects this device has not opened, and opens them', async () => {
    cloudMocks.getSession.mockResolvedValue(SESSION);
    cloudMocks.listCloudPatterns.mockResolvedValue([cloudEntry]);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    const list = await screen.findByRole('dialog', { name: 'Projects' });
    await waitFor(() => expect(within(list).getByText('Cloud loop')).toBeTruthy());
    expect(within(list).getByText('Account')).toBeTruthy();
    await act(async () => {
      fireEvent.click(within(list).getByText('Cloud loop'));
    });
    expect(screen.getByLabelText('Project name').value).toBe('Cloud loop');
    expect(storedProjects()[0]).toMatchObject({ name: 'Cloud loop', cloudId: 'cloud-1' });
  });

  it('signs out: account projects leave the list, device projects stay', async () => {
    seedProject('p-1', 'On the laptop', [LEAD_NOTE]);
    cloudMocks.getSession.mockResolvedValue(SESSION);
    cloudMocks.listCloudPatterns.mockResolvedValue([cloudEntry]);
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Account: signed in' }));
    // Found outside act: inside it the lazy panel could not render.
    const signOutButton = await screen.findByRole('button', { name: 'Sign out' });
    await act(async () => {
      fireEvent.click(signOutButton);
    });
    expect(cloudMocks.signOut).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    const list = await screen.findByRole('dialog', { name: 'Projects' });
    expect(within(list).queryByText('Cloud loop')).toBeNull();
    expect(within(list).getByText('On the laptop')).toBeTruthy();
  });
});

describe('PianoRollPage tools', () => {
  beforeEach(() => {
    resetForTest();
    cloudMocks.isCloudConfigured.mockReturnValue(false);
  });
  afterEach(restoreAfterTest);

  const renderWith = async (notes) => {
    seedProjectDraft('p-tools', onePattern('Tools', notes));
    const result = await renderPage();
    return { ...result, grid: result.container.querySelector('.piano-roll__notes') };
  };

  it('draws a note where it is pressed and as long as it is dragged, one undo step in all', async () => {
    const { container, grid } = await renderWith([]);
    fireEvent.keyDown(window, { key: 'b' });
    expect(screen.getByRole('radio', { name: 'Draw' })).toHaveAttribute('aria-checked', 'true');

    pointer(grid, 'pointerdown', { x: 100, y: rowY(62) });
    pointer(grid, 'pointermove', { x: 300, y: rowY(62) });
    pointer(grid, 'pointerup', { x: 300, y: rowY(62) });
    // Starts on the sixteenth under the press (beat 1) and ends on the one
    // past the pointer (beat 3.25).
    expect(noteBoxes(container)).toEqual([expect.objectContaining({ left: BEAT, width: 2.25 * BEAT - 1 })]);

    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(noteBoxes(container)).toHaveLength(0);
  });

  it('paints a note on every grid step the drag crosses, following the pointer\'s pitch', async () => {
    const { container, grid } = await renderWith([]);
    fireEvent.keyDown(window, { key: 'p' });
    pointer(grid, 'pointerdown', { x: 5, y: rowY(60) });
    pointer(grid, 'pointermove', { x: 1.1 * BEAT, y: rowY(64) });
    pointer(grid, 'pointerup', { x: 1.1 * BEAT, y: rowY(64) });
    const boxes = noteBoxes(container);
    expect(boxes.map((box) => box.left)).toEqual([0, 24, 48, 72, 96]);
    expect(boxes.every((box) => box.width === BEAT / 4 - 1)).toBe(true);
    // Pitch climbs from C4 to E4 along the stroke.
    expect(boxes[0].top).toBe((107 - 60) * ROW + 1);
    expect(boxes[4].top).toBe((107 - 64) * ROW + 1);
  });

  it('slices a note in two on the grid line nearest the press', async () => {
    const { container, grid } = await renderWith([LEAD_NOTE]);
    fireEvent.keyDown(window, { key: 'c' });
    pointer(grid, 'pointerdown', { x: 50, y: rowY(60) });
    pointer(grid, 'pointerup', { x: 50, y: rowY(60) });
    expect(noteBoxes(container).map((box) => [box.left, box.width])).toEqual([
      [0, BEAT / 2 - 1],
      [BEAT / 2, BEAT / 2 - 1]
    ]);
  });

  it('erases every note the eraser is dragged across', async () => {
    const { container, grid } = await renderWith([
      LEAD_NOTE,
      { ...LEAD_NOTE, id: 'note-2', start: 1 },
      { ...LEAD_NOTE, id: 'note-3', midi: 72, start: 2 }
    ]);
    fireEvent.keyDown(window, { key: 'e' });
    pointer(grid, 'pointerdown', { x: 10, y: rowY(60) });
    pointer(grid, 'pointermove', { x: BEAT + 10, y: rowY(60) });
    pointer(grid, 'pointerup', { x: BEAT + 10, y: rowY(60) });
    expect(noteBoxes(container).map((box) => box.left)).toEqual([2 * BEAT]);
  });

  it('copies notes on an option-drag and leaves the originals in place', async () => {
    const { container, grid } = await renderWith([LEAD_NOTE]);
    const note = container.querySelector('[data-note-id="note-1"]');
    pointer(note, 'pointerdown', { x: 40, y: rowY(60), altKey: true });
    pointer(grid, 'pointermove', { x: 40 + BEAT, y: rowY(60), altKey: true });
    pointer(grid, 'pointerup', { x: 40 + BEAT, y: rowY(60) });
    expect(noteBoxes(container).map((box) => box.left)).toEqual([0, BEAT]);
  });

  it('resizes from the left edge, keeping the note\'s end', async () => {
    const { container, grid } = await renderWith([{ ...LEAD_NOTE, start: 1, duration: 2 }]);
    const note = container.querySelector('[data-note-id="note-1"]');
    pointer(note, 'pointerdown', { x: BEAT + 2, y: rowY(60) });
    pointer(grid, 'pointermove', { x: 0.5 * BEAT, y: rowY(60) });
    pointer(grid, 'pointerup', { x: 0.5 * BEAT, y: rowY(60) });
    expect(noteBoxes(container)).toEqual([expect.objectContaining({ left: 0.5 * BEAT, width: 2.5 * BEAT - 1 })]);
  });

  it('sets velocity from the lane, and shows it in the note', async () => {
    const { container } = await renderWith([LEAD_NOTE]);
    const lane = container.querySelector('.velocity-lane');
    // The stem's head sits at 8 + (1 - 0.8) * 72 = 22.4px; drag it to the top.
    pointer(lane, 'pointerdown', { x: 0, y: 22 });
    pointer(lane, 'pointermove', { x: 0, y: -40 });
    pointer(lane, 'pointerup', { x: 0, y: -40 });
    expect(noteBoxes(container)[0].title).toMatch(/velocity 127/);
    fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(noteBoxes(container)[0].title).toMatch(/velocity 102/);
  });

  it('mutes the selected notes with 0', async () => {
    const { container } = await renderWith([LEAD_NOTE, { ...LEAD_NOTE, id: 'note-2', midi: 64, start: 1 }]);
    const note = container.querySelector('[data-note-id="note-2"]');
    pointer(note, 'pointerdown', { x: BEAT + 40, y: rowY(64) });
    pointer(note, 'pointerup', { x: BEAT + 40, y: rowY(64) });
    fireEvent.keyDown(window, { key: '0' });
    expect(noteBoxes(container).map((box) => box.muted)).toEqual([false, true]);
  });

  it('reverses the whole track from Transform when nothing is selected', async () => {
    const { container } = await renderWith([LEAD_NOTE, { ...LEAD_NOTE, id: 'note-2', midi: 64, start: 2, duration: 0.5 }]);
    fireEvent.click(screen.getByText('Reverse'));
    // Span 0..2.5 beats: the E4 now opens it and the C4 closes it.
    expect(noteBoxes(container).map((box) => [box.left, box.top])).toEqual([
      [0, (107 - 64) * ROW + 1],
      [1.5 * BEAT, (107 - 60) * ROW + 1]
    ]);
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
