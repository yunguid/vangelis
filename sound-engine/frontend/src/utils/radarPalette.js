import { clamp } from './math.js';

export const RADAR_MIN_MIDI = 21;
export const RADAR_MAX_MIDI = 108;
export const RADAR_PALETTE_STATE_LIMIT = 256;

const paletteCache = new Map();
const interpolateChannel = (start, end, mix) => Math.round(start + (end - start) * mix);

export const getRadarMidiPalette = (midi, isActive = false) => {
  const normalizedMidi = clamp(Math.round(midi), 0, 127);
  const active = Boolean(isActive);
  const cacheKey = normalizedMidi * 2 + Number(active);
  const cached = paletteCache.get(cacheKey);
  if (cached) return cached;

  const mix = clamp(
    (normalizedMidi - RADAR_MIN_MIDI) / (RADAR_MAX_MIDI - RADAR_MIN_MIDI),
    0,
    1
  );
  const red = interpolateChannel(108, 255, mix);
  const green = interpolateChannel(168, 164, mix * 0.8);
  const blue = interpolateChannel(232, 112, mix);
  const palette = {
    glow: `rgba(${red}, ${green}, ${blue}, ${active ? 0.28 : 0.12})`,
    trail: `rgba(${red}, ${green}, ${blue}, ${active ? 0.12 : 0.08})`,
    core: `rgba(${Math.min(255, red + 18)}, ${Math.min(255, green + 16)}, ${Math.min(255, blue + 14)}, ${active ? 0.9 : 0.72})`,
    edge: `rgba(245, 248, 252, ${active ? 0.86 : 0.46})`
  };
  paletteCache.set(cacheKey, palette);
  return palette;
};
