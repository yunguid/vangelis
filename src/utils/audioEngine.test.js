import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_PARAM_DEFAULTS } from './audioParams.js';
import { audioEngine } from './audioEngineRuntime.js';
import { areAudioParamsEqual } from './audioEngine/effects.js';

function createTargetSpy() {
  return {
    cancelScheduledValues: vi.fn(),
    setTargetAtTime: vi.fn()
  };
}

describe('audioEngine effect gating', () => {
  const originalContext = audioEngine.context;
  const originalNodes = audioEngine.globalNodes;
  const originalDelayWorklet = audioEngine.delayWorklet;
  const originalReverbWorklet = audioEngine.reverbWorklet;
  const originalWorklet = audioEngine.worklet;
  const originalSignature = audioEngine.lastParamSignature;
  const originalParams = audioEngine.currentParams;
  const originalEnsureDelayWorklet = audioEngine.ensureDelayWorklet;
  const originalEnsureReverbWorklet = audioEngine.ensureReverbWorklet;

  afterEach(() => {
    audioEngine.context = originalContext;
    audioEngine.globalNodes = originalNodes;
    audioEngine.delayWorklet = originalDelayWorklet;
    audioEngine.reverbWorklet = originalReverbWorklet;
    audioEngine.worklet = originalWorklet;
    audioEngine.lastParamSignature = originalSignature;
    audioEngine.currentParams = originalParams;
    audioEngine.ensureDelayWorklet = originalEnsureDelayWorklet;
    audioEngine.ensureReverbWorklet = originalEnsureReverbWorklet;
  });

  it('keeps reverb-disabled sounds dry even when reverb mix is non-zero', () => {
    const masterGain = createTargetSpy();
    const delaySend = createTargetSpy();
    const delayWet = createTargetSpy();
    const reverbSend = createTargetSpy();
    const reverbWet = createTargetSpy();
    const warmthGain = createTargetSpy();
    const presenceGain = createTargetSpy();
    const postToneGain = createTargetSpy();
    const airGain = createTargetSpy();
    const pan = createTargetSpy();

    audioEngine.context = { currentTime: 0 };
    audioEngine.globalNodes = {
      masterGain: { gain: masterGain },
      delaySend: { gain: delaySend },
      delayWet: { gain: delayWet },
      reverbSend: { gain: reverbSend },
      reverbWet: { gain: reverbWet },
      warmthFilter: { gain: warmthGain },
      presenceFilter: { gain: presenceGain },
      postTone: { gain: postToneGain },
      airFilter: { gain: airGain },
      distortion: { curve: null },
      stereoPanner: { pan }
    };
    audioEngine.delayWorklet = { setParams: vi.fn() };
    audioEngine.reverbWorklet = { setParams: vi.fn() };
    audioEngine.worklet = { ready: false, setParams: vi.fn() };
    audioEngine.lastParamSignature = '';

    audioEngine.applyGlobalParams({
      ...AUDIO_PARAM_DEFAULTS,
      reverbEnabled: false,
      reverbMix: 0.64
    });

    expect(reverbSend.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.08);
    expect(reverbWet.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.12);
    expect(audioEngine.reverbWorklet.setParams).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false
      })
    );
    expect(warmthGain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.12);
    expect(postToneGain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.12);
    expect(Math.abs(presenceGain.setTargetAtTime.mock.calls[0][0])).toBe(0);
    expect(presenceGain.setTargetAtTime.mock.calls[0][1]).toBe(0);
    expect(presenceGain.setTargetAtTime.mock.calls[0][2]).toBe(0.12);
    expect(Math.abs(airGain.setTargetAtTime.mock.calls[0][0])).toBe(0);
    expect(airGain.setTargetAtTime.mock.calls[0][1]).toBe(0);
    expect(airGain.setTargetAtTime.mock.calls[0][2]).toBe(0.12);
  });

  it('keeps delay-disabled sounds dry even when delay mix is non-zero', () => {
    const masterGain = createTargetSpy();
    const delaySend = createTargetSpy();
    const delayWet = createTargetSpy();
    const reverbSend = createTargetSpy();
    const reverbWet = createTargetSpy();
    const warmthGain = createTargetSpy();
    const presenceGain = createTargetSpy();
    const postToneGain = createTargetSpy();
    const airGain = createTargetSpy();
    const pan = createTargetSpy();

    audioEngine.context = { currentTime: 0 };
    audioEngine.globalNodes = {
      masterGain: { gain: masterGain },
      delaySend: { gain: delaySend },
      delayWet: { gain: delayWet },
      reverbSend: { gain: reverbSend },
      reverbWet: { gain: reverbWet },
      warmthFilter: { gain: warmthGain },
      presenceFilter: { gain: presenceGain },
      postTone: { gain: postToneGain },
      airFilter: { gain: airGain },
      distortion: { curve: null },
      stereoPanner: { pan }
    };
    audioEngine.delayWorklet = { setParams: vi.fn() };
    audioEngine.reverbWorklet = { setParams: vi.fn() };
    audioEngine.worklet = { ready: false, setParams: vi.fn() };
    audioEngine.lastParamSignature = '';

    audioEngine.applyGlobalParams({
      ...AUDIO_PARAM_DEFAULTS,
      delayEnabled: false,
      delayMix: 0.57,
      delayFeedback: 0.62,
      delayAge: 0.44,
      delayMotion: 0.51
    });

    expect(delaySend.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.05);
    expect(delayWet.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.05);
    expect(audioEngine.delayWorklet.setParams).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        inputLeft: 0,
        inputRight: 0,
        feedback: 0,
        modDepth: 0,
        drive: 0
      })
    );
  });

  it('retains toggle-gated params before the audio graph exists', () => {
    audioEngine.context = null;
    audioEngine.globalNodes = null;
    audioEngine.lastParamSignature = 'stale';

    audioEngine.applyGlobalParams({
      ...AUDIO_PARAM_DEFAULTS,
      delayEnabled: false,
      delayMix: 0.57,
      reverbEnabled: false,
      reverbMix: 0.44
    });

    expect(audioEngine.currentParams.delayMix).toBe(0);
    expect(audioEngine.currentParams.reverbMix).toBe(0);
    expect(audioEngine.lastParamSignature).toBe('');
  });

  it('loads effect worklets only for effects with an audible wet path', () => {
    const ensureDelay = vi.fn().mockResolvedValue(undefined);
    const ensureReverb = vi.fn().mockResolvedValue(undefined);
    const context = { currentTime: 0 };
    audioEngine.ensureDelayWorklet = ensureDelay;
    audioEngine.ensureReverbWorklet = ensureReverb;

    audioEngine.scheduleEnabledEffectWorklets({
      delayEnabled: false,
      delayMix: 0.7,
      reverbEnabled: true,
      reverbMix: 0
    }, context);
    expect(ensureDelay).not.toHaveBeenCalled();
    expect(ensureReverb).not.toHaveBeenCalled();

    audioEngine.scheduleEnabledEffectWorklets({
      delayEnabled: true,
      delayMix: 0.2,
      reverbEnabled: true,
      reverbMix: 0.3
    }, context);
    expect(ensureDelay).toHaveBeenCalledWith(context);
    expect(ensureReverb).toHaveBeenCalledWith(context);
  });
});

describe('audioEngine sampled instrument', () => {
  const original = {
    context: audioEngine.context,
    samplePool: audioEngine.samplePool,
    worklet: audioEngine.worklet,
    nodes: audioEngine.globalNodes
  };

  afterEach(() => {
    audioEngine.setInstrument(null);
    audioEngine.context = original.context;
    audioEngine.samplePool = original.samplePool;
    audioEngine.worklet = original.worklet;
    audioEngine.globalNodes = original.nodes;
  });

  it('plays the keys from its recordings, but leaves a note with its own voice to the synth', () => {
    const voice = { startSample: vi.fn() };
    const take = { buffer: { duration: 9 }, baseFrequency: 440, velocity: 0.5 };
    const instrument = { pick: vi.fn(() => take) };
    audioEngine.context = { currentTime: 12 };
    audioEngine.globalNodes = null;
    audioEngine.samplePool = { acquire: vi.fn(() => voice) };
    audioEngine.worklet = { ready: true, noteOn: vi.fn(), setParams: vi.fn() };

    audioEngine.setInstrument(instrument);
    expect(audioEngine.getStatus().hasCustomSample).toBe(true); // the keyboard need not wait for the worklet

    audioEngine.playFrequency({ noteId: 'A4', frequency: 466.16, velocity: 0.8 });
    expect(instrument.pick).toHaveBeenCalledWith(466.16, 0.8, 12);
    expect(voice.startSample).toHaveBeenCalledWith(expect.objectContaining({
      noteId: 'A4', frequency: 466.16, buffer: take.buffer, baseFrequency: 440, velocity: 0.5
    }));
    expect(audioEngine.worklet.noteOn).not.toHaveBeenCalled();

    audioEngine.playFrequency({ noteId: 'lead', frequency: 220, waveformType: 'Square', voiced: true });
    expect(audioEngine.worklet.noteOn).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'lead' }));
    expect(voice.startSample).toHaveBeenCalledTimes(1);

    audioEngine.setInstrument(null);
    audioEngine.playFrequency({ noteId: 'B4', frequency: 493.88 });
    expect(audioEngine.worklet.noteOn).toHaveBeenCalledWith(expect.objectContaining({ noteId: 'B4' }));
  });
});

describe('audio parameter equality', () => {
  it('compares normalized scalars and modulation routes without serialization', () => {
    const baseline = {
      ...AUDIO_PARAM_DEFAULTS,
      modRoutes: [{ src: 0, dst: 1, depth: 0.25 }]
    };

    expect(areAudioParamsEqual(baseline, {
      ...baseline,
      modRoutes: [{ src: 0, dst: 1, depth: 0.25 }]
    })).toBe(true);
    expect(areAudioParamsEqual(baseline, {
      ...baseline,
      filterCutoff: baseline.filterCutoff + 1
    })).toBe(false);
    expect(areAudioParamsEqual(baseline, {
      ...baseline,
      modRoutes: [{ src: 0, dst: 1, depth: 0.5 }]
    })).toBe(false);
  });
});
