import { useEffect, useRef } from 'react';

const isDocumentVisible = () => (
  document.visibilityState
    ? document.visibilityState === 'visible'
    : !document.hidden
);

/**
 * Run non-overlapping foreground polls and refresh immediately when a hidden
 * tab becomes visible again.
 */
export function useVisiblePolling(callback, intervalMs, enabled = true) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return undefined;

    let stopped = false;
    let inFlight = false;
    let timeoutId = null;

    const clearScheduledPoll = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const schedule = (delay = intervalMs) => {
      clearScheduledPoll();
      if (stopped || inFlight || !isDocumentVisible()) return;
      timeoutId = window.setTimeout(run, delay);
    };

    const run = async () => {
      timeoutId = null;
      if (stopped || inFlight || !isDocumentVisible()) return;
      inFlight = true;
      try {
        await callbackRef.current();
      } finally {
        inFlight = false;
        schedule();
      }
    };

    const handleVisibilityChange = () => {
      clearScheduledPoll();
      if (isDocumentVisible()) {
        void run();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    schedule();

    return () => {
      stopped = true;
      clearScheduledPoll();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
