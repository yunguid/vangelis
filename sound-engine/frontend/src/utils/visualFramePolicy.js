export const SCENE_ACTIVE_FRAME_INTERVAL_MS = 1000 / 30;
export const SCENE_IDLE_FRAME_INTERVAL_MS = 1000 / 20;

export const resolveSceneFrameInterval = (hasSignal) => (
  hasSignal ? SCENE_ACTIVE_FRAME_INTERVAL_MS : SCENE_IDLE_FRAME_INTERVAL_MS
);
