import { useEffect } from 'react';
import { audioEngine } from '../utils/audioEngine.js';

export const AUDIO_WARMUP_IDLE_TIMEOUT_MS = 1200;

export function scheduleAudioEngineWarmup({
  engine = audioEngine,
  windowRef = window,
  timeoutMs = AUDIO_WARMUP_IDLE_TIMEOUT_MS,
  scheduleIdle = true
} = {}) {
  let cancelled = false;
  let started = false;
  let idleId = null;
  let fallbackId = null;
  const events = ['pointerdown', 'touchstart', 'keydown'];

  const removeInteractionListeners = () => {
    events.forEach((eventName) => {
      windowRef.removeEventListener(eventName, warm, true);
    });
  };

  const cancelScheduledWarmup = () => {
    if (idleId !== null) {
      windowRef.cancelIdleCallback?.(idleId);
      idleId = null;
    }
    if (fallbackId !== null) {
      windowRef.clearTimeout(fallbackId);
      fallbackId = null;
    }
  };

  const warm = () => {
    if (cancelled || started) return;
    started = true;
    removeInteractionListeners();
    cancelScheduledWarmup();

    try {
      Promise.resolve(engine.ensureWasm())
        .then(() => engine.warmGraph())
        .catch(() => {});
    } catch (_) {
      // Audio support and user-activation failures remain reflected by the
      // engine's status channel; warmup must never break the visual shell.
    }
  };

  events.forEach((eventName) => {
    windowRef.addEventListener(eventName, warm, {
      capture: true,
      passive: true
    });
  });

  if (scheduleIdle) {
    if (typeof windowRef.requestIdleCallback === 'function') {
      idleId = windowRef.requestIdleCallback(warm, { timeout: timeoutMs });
    } else {
      fallbackId = windowRef.setTimeout(warm, 0);
    }
  }

  return () => {
    cancelled = true;
    removeInteractionListeners();
    cancelScheduledWarmup();
  };
}

export function useAudioEngineWarmup() {
  const profileMode = new URLSearchParams(window.location.search).get('profile');
  const scheduleIdle = profileMode !== 'interactions-cold';
  useEffect(() => scheduleAudioEngineWarmup({ scheduleIdle }), [scheduleIdle]);
}
