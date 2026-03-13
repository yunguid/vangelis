import { afterEach, describe, expect, it, vi } from 'vitest';
import { AUDIO_PARAM_DEFAULTS } from './audioParams.js';
import { audioEngine } from './audioEngine.js';

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

  afterEach(() => {
    audioEngine.context = originalContext;
    audioEngine.globalNodes = originalNodes;
    audioEngine.delayWorklet = originalDelayWorklet;
    audioEngine.reverbWorklet = originalReverbWorklet;
    audioEngine.worklet = originalWorklet;
    audioEngine.lastParamSignature = originalSignature;
    audioEngine.currentParams = originalParams;
  });

  it('keeps reverb-disabled sounds dry even when reverb mix is non-zero', () => {
    const masterGain = createTargetSpy();
    const delaySend = createTargetSpy();
    const delayWet = createTargetSpy();
    const reverbSend = createTargetSpy();
    const reverbWet = createTargetSpy();
    const warmthGain = createTargetSpy();
    const presenceGain = createTargetSpy();
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
    expect(presenceGain.setTargetAtTime).toHaveBeenCalledWith(1.5, 0, 0.12);
  });

  it('keeps delay-disabled sounds dry even when delay mix is non-zero', () => {
    const masterGain = createTargetSpy();
    const delaySend = createTargetSpy();
    const delayWet = createTargetSpy();
    const reverbSend = createTargetSpy();
    const reverbWet = createTargetSpy();
    const warmthGain = createTargetSpy();
    const presenceGain = createTargetSpy();
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
});
