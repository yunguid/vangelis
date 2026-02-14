import { describe, expect, it } from 'vitest';
import {
  hasUsableBasePitch,
  isSafeSamplePath,
  isUsableInstrumentDefinition,
  isValidInstrumentRange
} from './instrumentManifestGuards.js';

describe('instrumentManifestGuards', () => {
  it('accepts only safe local starter-pack sample paths', () => {
    expect(isSafeSamplePath('starter-pack/strings/violin/VlnEns_susVib_C4_v1.wav')).toBe(true);
    expect(isSafeSamplePath('/starter-pack/strings/violin/sample.wav')).toBe(false);
    expect(isSafeSamplePath('../starter-pack/strings/violin/sample.wav')).toBe(false);
    expect(isSafeSamplePath('starter-pack/strings/../../etc/passwd')).toBe(false);
    expect(isSafeSamplePath('https://evil.example/sample.wav')).toBe(false);
    expect(isSafeSamplePath('starter-pack/strings/violin/sample.exe')).toBe(false);
  });

  it('validates midi range boundaries and ordering', () => {
    expect(isValidInstrumentRange({ minMidi: 20, maxMidi: 40 })).toBe(true);
    expect(isValidInstrumentRange({ minMidi: 0, maxMidi: 127 })).toBe(true);
    expect(isValidInstrumentRange({ minMidi: -1, maxMidi: 40 })).toBe(false);
    expect(isValidInstrumentRange({ minMidi: 20, maxMidi: 200 })).toBe(false);
    expect(isValidInstrumentRange({ minMidi: 80, maxMidi: 30 })).toBe(false);
  });

  it('requires usable base pitch metadata', () => {
    expect(hasUsableBasePitch({ baseNote: 'C4' })).toBe(true);
    expect(hasUsableBasePitch({ baseMidi: 72 })).toBe(true);
    expect(hasUsableBasePitch({ baseNote: 'bad-note' })).toBe(false);
    expect(hasUsableBasePitch({})).toBe(false);
  });

  it('accepts only instrument definitions passing all safety checks', () => {
    expect(isUsableInstrumentDefinition({
      samplePath: 'starter-pack/piano/UR1_C4_mf_RR1.wav',
      minMidi: 54,
      maxMidi: 77,
      baseNote: 'C4'
    })).toBe(true);

    expect(isUsableInstrumentDefinition({
      samplePath: '../unsafe.wav',
      minMidi: 54,
      maxMidi: 77,
      baseNote: 'C4'
    })).toBe(false);
  });
});
