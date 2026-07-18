import { describe, expect, it } from 'vitest';
import {
  RADAR_MAX_MIDI,
  RADAR_MIN_MIDI,
  RADAR_PALETTE_STATE_LIMIT,
  getRadarMidiPalette
} from './radarPalette.js';

describe('radarPalette', () => {
  it('reuses the same palette object for a MIDI/active state', () => {
    expect(getRadarMidiPalette(60, false)).toBe(getRadarMidiPalette(60, false));
    expect(getRadarMidiPalette(60, true)).toBe(getRadarMidiPalette(60, true));
    expect(getRadarMidiPalette(60, true)).not.toBe(getRadarMidiPalette(60, false));
  });

  it('preserves the blue-to-orange endpoint colors', () => {
    expect(getRadarMidiPalette(RADAR_MIN_MIDI, false)).toEqual({
      glow: 'rgba(108, 168, 232, 0.12)',
      trail: 'rgba(108, 168, 232, 0.08)',
      core: 'rgba(126, 184, 246, 0.72)',
      edge: 'rgba(245, 248, 252, 0.46)'
    });
    expect(getRadarMidiPalette(RADAR_MAX_MIDI, true).glow).toBe('rgba(255, 165, 112, 0.28)');
    expect(RADAR_PALETTE_STATE_LIMIT).toBe(256);
  });
});
