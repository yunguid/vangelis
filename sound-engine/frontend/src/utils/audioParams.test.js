import { describe, expect, it } from 'vitest';
import { getDelayPresetPatch, sanitizeAudioParams } from './audioParams.js';

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
});
