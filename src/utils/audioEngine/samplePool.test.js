import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSampleVoicePool } from './samplePool.js';
import { VOICE_STATE } from './constants.js';

/**
 * descent(22): stale async callbacks in SampleVoice killed successor notes.
 * Three paths shared the bug: a retriggered note's old onended fired after
 * the new source started and cleanup()'d it; stop()'s and release()'s recycle
 * timeouts did the same to stolen/reused voices, and also double-booked the
 * voice into freeVoices while it was still active. Every async callback now
 * checks source identity before touching the voice.
 */

const makeCtx = () => ({
  currentTime: 0,
  createGain: () => ({
    gain: {
      value: 0,
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn()
    },
    connect: vi.fn()
  }),
  createBufferSource: () => ({
    buffer: null,
    loop: false,
    playbackRate: { value: 1 },
    onended: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn()
  })
});

const fakeBuffer = {};
const startArgs = (noteId) => ({
  noteId,
  buffer: fakeBuffer,
  frequency: 440,
  baseFrequency: 220,
  velocity: 0.9,
  params: { attack: 0.01, decay: 0.1, sustain: 0.7, volume: 0.7 },
  loop: false
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('sample voice stale-callback guards', () => {
  it('old onended cannot kill a retriggered note', () => {
    const pool = createSampleVoicePool({ ctx: makeCtx(), inputBus: {}, poolSize: 2 });
    const voice = pool.acquire('n1');
    voice.startSample(startArgs('n1'));
    const oldSource = voice.bufferSource;
    const oldOnEnded = oldSource.onended;

    voice.startSample(startArgs('n1')); // retrigger: cleanup() stops oldSource
    const newSource = voice.bufferSource;
    expect(newSource).not.toBe(oldSource);

    oldOnEnded(); // browser fires ended for the stopped old source, async
    expect(voice.bufferSource).toBe(newSource); // new note survives
    expect(voice.state).not.toBe(VOICE_STATE.IDLE);
  });

  it("stop()'s recycle timer cannot kill the note that reused the voice", () => {
    const pool = createSampleVoicePool({ ctx: makeCtx(), inputBus: {}, poolSize: 1 });
    const voice = pool.acquire('n1');
    voice.startSample(startArgs('n1'));

    voice.stop(); // steal path: schedules recycle in ~55ms
    voice.startSample(startArgs('n2')); // voice immediately reused
    const newSource = voice.bufferSource;

    vi.advanceTimersByTime(200); // stale timer fires
    expect(voice.bufferSource).toBe(newSource);
    expect(voice.state).not.toBe(VOICE_STATE.IDLE);
  });

  it("release()'s recycle timer is also identity-guarded and recycles cleanly otherwise", () => {
    const pool = createSampleVoicePool({ ctx: makeCtx(), inputBus: {}, poolSize: 1 });
    const voice = pool.acquire('n1');
    voice.startSample(startArgs('n1'));

    pool.release('n1', 0.1);
    voice.startSample(startArgs('n2')); // reused before the release timer fires
    const newSource = voice.bufferSource;
    vi.advanceTimersByTime(1000);
    expect(voice.bufferSource).toBe(newSource); // guarded: new note intact

    // Normal lifecycle still recycles: release with no reuse afterwards
    // (voice-level API — 'n2' was started directly on the voice above)
    voice.release(0.1);
    vi.advanceTimersByTime(1000);
    expect(voice.state).toBe(VOICE_STATE.IDLE);
    expect(voice.bufferSource).toBeNull();
    expect(pool.acquire('n3')).toBe(voice); // back in the free list exactly once
  });
});

describe('scored start times', () => {
  it('starts the source and its envelope on the audio clock, not when the timer fired', () => {
    const ctx = makeCtx();
    ctx.currentTime = 2;
    const pool = createSampleVoicePool({ ctx, inputBus: {}, poolSize: 1 });
    const voice = pool.acquire('n1');
    voice.startSample({ ...startArgs('n1'), when: 2.06 });
    expect(voice.bufferSource.start).toHaveBeenCalledWith(2.06);
    expect(voice.gainNode.gain.setValueAtTime).toHaveBeenCalledWith(expect.any(Number), 2.06);
    expect(voice.startTime).toBe(2.06);
  });

  it('plays at once when the requested time has already passed', () => {
    const ctx = makeCtx();
    ctx.currentTime = 2;
    const pool = createSampleVoicePool({ ctx, inputBus: {}, poolSize: 1 });
    const voice = pool.acquire('n1');
    voice.startSample({ ...startArgs('n1'), when: 1.9 });
    expect(voice.bufferSource.start).toHaveBeenCalledWith(2);
  });
});

describe('strokes', () => {
  const strokeCtx = () => ({
    ...makeCtx(),
    sampleRate: 48000,
    createGain: () => ({
      gain: {
        value: 0,
        cancelScheduledValues: vi.fn(),
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        setTargetAtTime: vi.fn()
      },
      connect: vi.fn()
    }),
    createBiquadFilter: () => ({
      type: 'lowpass', frequency: { value: 0 }, gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn()
    })
  });

  it('tilts a stroke brighter or darker with a high shelf at three times its note', () => {
    const pool = createSampleVoicePool({ ctx: strokeCtx(), inputBus: {}, poolSize: 1 });
    const voice = pool.acquire('n1');
    voice.startSample({ ...startArgs('n1'), brightness: -6 });
    const shelf = voice.toneFilter;
    expect(shelf).toMatchObject({ type: 'highshelf', frequency: { value: 1320 }, gain: { value: -6 } });
    expect(voice.bufferSource.connect).toHaveBeenCalledWith(shelf);
    expect(shelf.connect).toHaveBeenCalledWith(voice.gainNode);

    voice.startSample(startArgs('n1')); // a plain stroke on the same voice
    expect(shelf.disconnect).toHaveBeenCalled();
    expect(voice.toneFilter).toBeNull();
    expect(voice.bufferSource.connect).toHaveBeenCalledWith(voice.gainNode);
  });

  it('lets a muted stroke die away on the audio clock, 20 ms after the pluck', () => {
    const pool = createSampleVoicePool({ ctx: strokeCtx(), inputBus: {}, poolSize: 1 });
    const voice = pool.acquire('n1');
    voice.startSample({ ...startArgs('n1'), when: 3, mute: 0.08 });
    expect(voice.gainNode.gain.setTargetAtTime).toHaveBeenCalledWith(expect.any(Number), 3.02, 0.08);
    expect(voice.gainNode.gain.setTargetAtTime.mock.calls[0][0]).toBeLessThan(0.001);
  });
});
