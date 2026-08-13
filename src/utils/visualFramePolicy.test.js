import { describe, expect, it } from 'vitest';
import {
  SCENE_ACTIVE_FRAME_INTERVAL_MS,
  SCENE_IDLE_FRAME_INTERVAL_MS,
  resolveSceneFrameInterval
} from './visualFramePolicy.js';

describe('visualFramePolicy', () => {
  it('caps the audio-reactive scene at 30 frames per second', () => {
    expect(resolveSceneFrameInterval(true)).toBe(SCENE_ACTIVE_FRAME_INTERVAL_MS);
    expect(1000 / SCENE_ACTIVE_FRAME_INTERVAL_MS).toBeCloseTo(30);
  });

  it('backs the silent ambient scene down to 20 frames per second', () => {
    expect(resolveSceneFrameInterval(false)).toBe(SCENE_IDLE_FRAME_INTERVAL_MS);
    expect(1000 / SCENE_IDLE_FRAME_INTERVAL_MS).toBeCloseTo(20);
  });
});
