import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  context: null,
  engine: {
    ensureAudioContext: vi.fn(), ensureWasm: vi.fn(), warmGraph: vi.fn(),
    getStatus: vi.fn(() => ({ wasmReady: true })),
    subscribe: vi.fn(() => () => {}),
    playFrequency: vi.fn(({ noteId }) => ({ voiceId: noteId })),
    playBufferedSample: vi.fn(({ noteId }) => ({ voiceId: noteId })),
    stopNote: vi.fn(), stopAllNotes: vi.fn(), setGlobalParams: vi.fn(),
    startRecording: vi.fn(), stopRecording: vi.fn()
  }
}));
// The editor calls more of the engine than this test cares about: anything not
// listed above answers as a no-op, so the fake never has to track the engine's
// full surface.
vi.mock('../utils/audioEngine.js', () => ({
  audioEngine: new Proxy(fixture.engine, {
    get: (target, key) => {
      if (!(key in target)) target[key] = vi.fn();
      return target[key];
    }
  })
}));
vi.mock('../utils/cloudPatternStore.js', () => ({
  isCloudConfigured: () => false, getSession: async () => null, onAuthChange: () => () => {},
  listCloudPatterns: async () => [], upsertCloudPattern: async () => null,
  deleteCloudPattern: async () => true, signInWithEmail: async () => ({ error: null }), signOut: async () => {}
}));

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const CLICK_DOWNBEAT_HZ = 2093; // C7

const seedDraft = (metronome) => localStorage.setItem('vangelis.editorDraft.v1', JSON.stringify({
  metronome,
  pattern: {
    name: 'One note', bpm: 120, bars: 4, nextNoteId: 2, nextTrackId: 2,
    tracks: [{ id: 'track-1', name: 'Lead', instrument: 'Sine' }],
    loopRange: null,
    notes: [{ id: 'note-1', midi: 60, start: 0, duration: 1, velocity: 0.8, trackId: 'track-1' }]
  }
}));

const playAndCollect = async () => {
  const { default: PianoRollPage } = await import('./PianoRollPage.jsx');
  render(<PianoRollPage />);
  await act(async () => { await vi.advanceTimersByTimeAsync(20); });
  fireEvent.click(screen.getByRole('button', { name: 'Play the loop' }));
  await act(async () => { await vi.advanceTimersByTimeAsync(200); });
  return fixture.engine.playFrequency.mock.calls.map(([call]) => call);
};

const isClick = (call) => call.waveformType === 'Square' && Math.abs(call.frequency - CLICK_DOWNBEAT_HZ) < 2;

describe('PianoRollPage metronome', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    fixture.context = Object.assign(new EventTarget(), { state: 'running', currentTime: 0 });
    fixture.engine.context = fixture.context;
    fixture.engine.ensureAudioContext.mockResolvedValue(fixture.context);
    fixture.engine.ensureWasm.mockResolvedValue(undefined);
    HTMLCanvasElement.prototype.getContext = () => ({
      scale: () => {}, fillRect: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {}
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it('sounds a click on the downbeat when the metronome is on', async () => {
    seedDraft(true);
    const calls = await playAndCollect();
    expect(screen.getByRole('button', { name: 'Metronome' })).toHaveAttribute('aria-pressed', 'true');
    expect(calls.some(isClick)).toBe(true);
    // The pattern's own note still plays, in the track's voice.
    expect(calls.some((call) => call.waveformType === 'Sine')).toBe(true);
  });

  it('stays silent on the beat when the metronome is off', async () => {
    seedDraft(false);
    const calls = await playAndCollect();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.some(isClick)).toBe(false);
  });
});
