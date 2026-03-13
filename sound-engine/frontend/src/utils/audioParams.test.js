import { describe, expect, it } from 'vitest';
import {
  applyEffectToggleState,
  getDelayPresetPatch,
  sanitizeAudioParams
} from './audioParams.js';

describe('audioParams effect source of truth', () => {
  it('does not infer enabled FX state from wet values alone', () => {
    const sanitized = sanitizeAudioParams({
      delayMix: 0.42,
      delayTime: 480,
      reverbMix: 0.35,
      reverbPreDelay: 40
    });

    expect(sanitized.delayEnabled).toBe(false);
    expect(sanitized.reverbEnabled).toBe(false);
    expect(sanitized.delayMix).toBe(0.42);
    expect(sanitized.reverbMix).toBe(0.35);
  });

  it('keeps delay presets from implicitly enabling the effect toggle', () => {
    const patch = getDelayPresetPatch('tape-echo');

    expect(patch).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(patch, 'delayEnabled')).toBe(false);
  });

  it('zeros wet engine params when the effect toggles are off', () => {
    const engineParams = applyEffectToggleState(sanitizeAudioParams({
      delayEnabled: false,
      delayMix: 0.42,
      delayFeedback: 0.61,
      delayAge: 0.5,
      delayMotion: 0.7,
      reverbEnabled: false,
      reverb: 0.35,
      reverbMix: 0.35
    }));

    expect(engineParams.delayEnabled).toBe(false);
    expect(engineParams.delayMix).toBe(0);
    expect(engineParams.delayFeedback).toBe(0);
    expect(engineParams.delayAge).toBe(0);
    expect(engineParams.delayMotion).toBe(0);
    expect(engineParams.reverbEnabled).toBe(false);
    expect(engineParams.reverb).toBe(0);
    expect(engineParams.reverbMix).toBe(0);
  });
});
