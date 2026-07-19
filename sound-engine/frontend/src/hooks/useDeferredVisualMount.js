import { useEffect, useState } from 'react';

export const PRIMARY_VISUAL_DELAY_MS = 700;
export const AMBIENT_VISUAL_DELAY_MS = 1800;
export const VISUAL_IDLE_TIMEOUT_MS = 250;

const isVisible = (documentRef) => (
  documentRef.visibilityState
    ? documentRef.visibilityState === 'visible'
    : !documentRef.hidden
);

export function scheduleDeferredVisualMount(
  activate,
  {
    windowRef = window,
    documentRef = document,
    delayMs = PRIMARY_VISUAL_DELAY_MS
  } = {}
) {
  let cancelled = false;
  let activated = false;
  let frameId = null;
  let delayId = null;
  let idleId = null;
  let fallbackId = null;

  const clearScheduledWork = () => {
    if (frameId !== null) {
      windowRef.cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (idleId !== null) {
      windowRef.cancelIdleCallback?.(idleId);
      idleId = null;
    }
    if (delayId !== null) {
      windowRef.clearTimeout(delayId);
      delayId = null;
    }
    if (fallbackId !== null) {
      windowRef.clearTimeout(fallbackId);
      fallbackId = null;
    }
  };

  const mount = () => {
    if (cancelled || activated) return;
    if (!isVisible(documentRef)) {
      clearScheduledWork();
      return;
    }
    activated = true;
    clearScheduledWork();
    documentRef.removeEventListener('visibilitychange', syncVisibility);
    activate();
  };

  const scheduleIdle = () => {
    delayId = null;
    if (cancelled || activated || !isVisible(documentRef)) return;
    if (typeof windowRef.requestIdleCallback === 'function') {
      idleId = windowRef.requestIdleCallback(mount, { timeout: VISUAL_IDLE_TIMEOUT_MS });
    } else {
      fallbackId = windowRef.setTimeout(mount, 0);
    }
  };

  const scheduleDelay = () => {
    frameId = null;
    if (cancelled || activated || !isVisible(documentRef)) return;
    delayId = windowRef.setTimeout(scheduleIdle, delayMs);
  };

  function scheduleAfterPaint() {
    if (cancelled || activated || frameId !== null || !isVisible(documentRef)) return;
    frameId = windowRef.requestAnimationFrame(scheduleDelay);
  }

  function syncVisibility() {
    if (!isVisible(documentRef)) {
      clearScheduledWork();
      return;
    }
    scheduleAfterPaint();
  }

  documentRef.addEventListener('visibilitychange', syncVisibility);
  scheduleAfterPaint();

  return () => {
    cancelled = true;
    documentRef.removeEventListener('visibilitychange', syncVisibility);
    clearScheduledWork();
  };
}

export function useDeferredVisualMount(delayMs = PRIMARY_VISUAL_DELAY_MS) {
  const [ready, setReady] = useState(false);
  useEffect(() => scheduleDeferredVisualMount(() => setReady(true), { delayMs }), [delayMs]);
  return ready;
}
