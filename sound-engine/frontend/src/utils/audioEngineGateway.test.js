import { describe, expect, it, vi } from 'vitest';
import { LazyAudioEngineGateway } from './audioEngine.js';

function createRuntime() {
  const listeners = {
    status: null,
    recording: null,
    activity: null,
    voicePhrase: null
  };
  const runtime = {
    context: null,
    getStatus: vi.fn(() => ({ wasmReady: true, contextReady: true })),
    getActivity: vi.fn(() => ({ isActive: false, activeVoices: 0 })),
    getVoicePhraseStatus: vi.fn(() => ({ enabled: false, chunkCount: 0 })),
    subscribe: vi.fn((listener) => {
      listeners.status = listener;
      return vi.fn();
    }),
    subscribeRecording: vi.fn((listener) => {
      listeners.recording = listener;
      return vi.fn();
    }),
    subscribeActivity: vi.fn((listener) => {
      listeners.activity = listener;
      listener(runtime.getActivity());
      return vi.fn();
    }),
    subscribeVoicePhrase: vi.fn((listener) => {
      listeners.voicePhrase = listener;
      listener(runtime.getVoicePhraseStatus());
      return vi.fn();
    }),
    setGlobalParams: vi.fn(),
    setTransportTempo: vi.fn(),
    ensureWasm: vi.fn(() => Promise.resolve('worklet')),
    ensureAudioContext: vi.fn(() => Promise.resolve('context')),
    warmGraph: vi.fn(() => Promise.resolve()),
    playFrequency: vi.fn(() => ({ voiceId: 'C4' })),
    stopNote: vi.fn()
  };
  return { runtime, listeners };
}

describe('LazyAudioEngineGateway', () => {
  it('keeps status and parameter reads cold until audio readiness is requested', async () => {
    const { runtime } = createRuntime();
    const loadRuntime = vi.fn(() => Promise.resolve(runtime));
    const gateway = new LazyAudioEngineGateway({ loadRuntime });
    const statusListener = vi.fn();

    gateway.subscribe(statusListener);
    gateway.setGlobalParams({ attack: 0.2 });
    gateway.setTransportTempo(96);

    expect(gateway.getStatus()).toMatchObject({ wasmReady: false, contextReady: false });
    expect(loadRuntime).not.toHaveBeenCalled();
    expect(statusListener).not.toHaveBeenCalled();

    await gateway.ensureWasm();

    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(runtime.setGlobalParams).toHaveBeenCalledWith({ attack: 0.2 });
    expect(runtime.setTransportTempo).toHaveBeenCalledWith(96);
    expect(runtime.ensureWasm).toHaveBeenCalledTimes(1);
    expect(statusListener).toHaveBeenCalledWith(expect.objectContaining({ wasmReady: true }));
  });

  it('coalesces concurrent runtime imports and exposes synchronous playback afterward', async () => {
    const { runtime } = createRuntime();
    let resolveRuntime;
    const runtimePromise = new Promise((resolve) => {
      resolveRuntime = resolve;
    });
    const loadRuntime = vi.fn(() => runtimePromise);
    const gateway = new LazyAudioEngineGateway({ loadRuntime });

    const first = gateway.ensureAudioContext();
    const second = gateway.warmGraph();
    expect(gateway.playFrequency({ noteId: 'C4' })).toBeNull();
    await Promise.resolve();
    resolveRuntime(runtime);
    await Promise.all([first, second]);

    expect(loadRuntime).toHaveBeenCalledTimes(1);
    expect(gateway.playFrequency({ noteId: 'C4' })).toEqual({ voiceId: 'C4' });
    expect(runtime.playFrequency).toHaveBeenCalledWith({ noteId: 'C4' });
  });

  it('forwards runtime status and activity subscriptions after the split loads', async () => {
    const { runtime, listeners } = createRuntime();
    const gateway = new LazyAudioEngineGateway({ loadRuntime: () => Promise.resolve(runtime) });
    const statusListener = vi.fn();
    const activityListener = vi.fn();

    gateway.subscribe(statusListener);
    gateway.subscribeActivity(activityListener);
    expect(activityListener).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));

    await gateway.ensureWasm();
    listeners.status({ wasmReady: true, graphWarmed: true });
    listeners.activity({ isActive: true, activeVoices: 2 });

    expect(statusListener).toHaveBeenLastCalledWith({ wasmReady: true, graphWarmed: true });
    expect(activityListener).toHaveBeenLastCalledWith({ isActive: true, activeVoices: 2 });
  });
});
