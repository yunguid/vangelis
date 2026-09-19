import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  sample: { buffer: {}, baseFrequency: 261.63 },
  context: null,
  load: vi.fn(),
  engine: {
    ensureAudioContext: vi.fn(), ensureWasm: vi.fn(), getStatus: vi.fn(() => ({ wasmReady: true })),
    playBufferedSample: vi.fn(({ noteId }) => ({ voiceId: noteId })),
    playFrequency: vi.fn(({ noteId }) => ({ voiceId: noteId })),
    stopNote: vi.fn(), setGlobalParams: vi.fn()
  }
}));
vi.mock('../utils/audioEngine.js', () => ({ audioEngine: fixture.engine }));
vi.mock('../data/openingPerformance.js', () => ({
  OPENING_PARAMS: { release: 0.025 }, loadOpeningPerformance: fixture.load,
  // Imported by data/sampledInstruments.js, which names the piece's sound.
  loadOpeningSamples: vi.fn(), nearestOpeningSample: vi.fn()
}));

let useOpeningPerformance;
const score = () => ({ duration: 4, notes: [
  { midi: 60, time: 0, duration: 2, velocity: 0.7, sample: fixture.sample },
  { midi: 64, time: 1, duration: 2, velocity: 0.7, sample: fixture.sample }
] });
const flush = async () => act(async () => { await vi.advanceTimersByTimeAsync(50); });

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.useFakeTimers();
  fixture.context = new EventTarget();
  Object.assign(fixture.context, { state: 'running', currentTime: 0, resume: vi.fn(async () => {
    fixture.context.state = 'running';
    fixture.context.dispatchEvent(new Event('statechange'));
  }) });
  fixture.engine.context = fixture.context;
  fixture.engine.ensureAudioContext.mockResolvedValue(fixture.context);
  fixture.engine.ensureWasm.mockResolvedValue(undefined);
  fixture.load.mockResolvedValue(score());
  // The hook plays whichever queued piece is picked; these tests are about the
  // scheduler, so the queue holds only the piano piece the fixture stands in for.
  localStorage.setItem('vangelis.landingQueue.v1', JSON.stringify(['performance-opening-piano']));
  ({ useOpeningPerformance } = await import('./useOpeningPerformance.js'));
  // The hook imports this lazily; fake timers cannot wait on a real module load.
  await import('../data/sampledInstruments.js');
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('opening performance with the real MIDI scheduler', () => {
  it('autoplays sampled notes and clears scheduled notes on takeover, without restarting', async () => {
    const { result, unmount } = renderHook(() => useOpeningPerformance({ audioParams: { volume: 0.6 } }));
    await flush();
    expect(fixture.engine.playBufferedSample).toHaveBeenCalledTimes(1);
    expect(result.current.activeNotes.has('C4')).toBe(true);
    // The page loads this under the keys, so the dial shows what is playing.
    expect(result.current.sound).toMatchObject({ name: 'Grand Piano', instrument: 'opening-piano' });
    act(() => result.current.stop());
    expect(result.current.activeNotes.size).toBe(0);
    expect(fixture.engine.stopNote).toHaveBeenCalled();
    expect(fixture.engine.setGlobalParams).toHaveBeenLastCalledWith({ volume: 0.6 });
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fixture.engine.playBufferedSample).toHaveBeenCalledTimes(1);
    unmount();
    const again = renderHook(() => useOpeningPerformance({ audioParams: {} }));
    await flush();
    expect(again.result.current.activeNotes.size).toBe(0);
    expect(fixture.engine.playBufferedSample).toHaveBeenCalledTimes(1);
  });

  it('keeps playing in the listener\'s sound once they choose another one', async () => {
    const theirs = { waveformType: 'Saw', audioParams: { volume: 0.6, release: 1.2 } };
    const { result, rerender } = renderHook((props) => useOpeningPerformance(props), { initialProps: theirs });
    await flush();
    expect(fixture.engine.playBufferedSample).toHaveBeenCalledTimes(1);

    rerender({ ...theirs, revoice: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(result.current.activeNotes.has('E4')).toBe(true);
    expect(fixture.engine.playBufferedSample).toHaveBeenCalledTimes(1);
    // Their patch and room, at the landing's level; the piano's own release (0.025) is gone.
    expect(fixture.engine.playFrequency).toHaveBeenCalledWith(expect.objectContaining({
      waveformType: 'Saw',
      voiced: false,
      params: { volume: 0.6 * 0.85, release: 1.2, pan: 0 }
    }));
  });

  it('opens silent when the only queued piece was removed from the MIDI library', async () => {
    localStorage.setItem('vangelis.midiLibrary.v1', JSON.stringify({ liked: [], removed: ['performance-opening-piano'] }));
    try {
      const { result } = renderHook(() => useOpeningPerformance({ audioParams: {} }));
      await flush();
      await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
      expect(fixture.load).not.toHaveBeenCalled();
      expect(fixture.engine.playBufferedSample).not.toHaveBeenCalled();
      expect(result.current.sound).toBeNull();
    } finally {
      localStorage.removeItem('vangelis.midiLibrary.v1');
    }
  });

  it('waits for browser activation without advancing the score', async () => {
    fixture.context.state = 'suspended';
    const { result } = renderHook(() => useOpeningPerformance({ audioParams: {} }));
    await flush();
    expect(result.current.activeNotes.size).toBe(0);
    expect(fixture.engine.playBufferedSample).not.toHaveBeenCalled();
    await act(async () => fixture.context.resume());
    await flush();
    expect(result.current.activeNotes.has('C4')).toBe(true);
    expect(fixture.engine.playBufferedSample).toHaveBeenCalledTimes(1);
  });

  it('never starts if the user plays while the score is loading', async () => {
    let resolve;
    fixture.load.mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => useOpeningPerformance({ audioParams: {} }));
    await flush();
    act(() => result.current.stop());
    await act(async () => resolve(score()));
    await flush();
    expect(fixture.engine.playBufferedSample).not.toHaveBeenCalled();
    expect(result.current.activeNotes.size).toBe(0);
  });

  it('hardware MIDI interrupts before sounding the user note', async () => {
    const input = {};
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true,
      value: vi.fn().mockResolvedValue({ inputs: new Map([['test', input]]) }) });
    await import('../utils/webMidiController.js');
    const { useWebMidiInput } = await import('./useWebMidiInput.js');
    fixture.engine.setPitchBend = vi.fn();
    fixture.engine.setModWheel = vi.fn();
    const { result } = renderHook(() => {
      const opening = useOpeningPerformance({ audioParams: {} });
      useWebMidiInput({ waveformType: 'Sine', audioParams: {}, onUserPlay: opening.stop });
      return opening;
    });
    await flush();
    act(() => input.onmidimessage({ data: [0x90, 67, 90] }));
    expect(result.current.activeNotes.size).toBe(0);
    expect(fixture.engine.playFrequency).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'webmidi-67' }));
    expect(fixture.engine.stopNote.mock.invocationCallOrder[0])
      .toBeLessThan(fixture.engine.playFrequency.mock.invocationCallOrder[0]);
    cleanup();
    delete navigator.requestMIDIAccess;
  });

  it('releases voices and cancels pending notes on navigation away', async () => {
    const { unmount } = renderHook(() => useOpeningPerformance({ audioParams: {} }));
    await flush();
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fixture.engine.playBufferedSample).toHaveBeenCalledTimes(1);
    expect(fixture.engine.stopNote).toHaveBeenCalled();
  });
});
