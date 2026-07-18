import { useEffect, useState } from 'react';

export const PRIMARY_VISUAL_IDLE_TIMEOUT_MS = 700;
export const AMBIENT_VISUAL_IDLE_TIMEOUT_MS = 1800;

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
    timeoutMs = PRIMARY_VISUAL_IDLE_TIMEOUT_MS
  } = {}
) {
  let cancelled = false;
  let activated = false;
  let frameId = null;
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
    frameId = null;
    if (cancelled || activated || !isVisible(documentRef)) return;
    if (typeof windowRef.requestIdleCallback === 'function') {
      idleId = windowRef.requestIdleCallback(mount, { timeout: timeoutMs });
    } else {
      fallbackId = windowRef.setTimeout(mount, 0);
    }
  };

  function scheduleAfterPaint() {
    if (cancelled || activated || frameId !== null || !isVisible(documentRef)) return;
    frameId = windowRef.requestAnimationFrame(scheduleIdle);
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

export function useDeferredVisualMount(timeoutMs = PRIMARY_VISUAL_IDLE_TIMEOUT_MS) {
  const [ready, setReady] = useState(false);
  useEffect(() => scheduleDeferredVisualMount(() => setReady(true), { timeoutMs }), [timeoutMs]);
  return ready;
}
