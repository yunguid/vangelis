export function createTrailingDeadlineScheduler({
  delayMs,
  run,
  now = () => Date.now(),
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout
}) {
  let deadline = Number.NEGATIVE_INFINITY;
  let timeoutId = null;

  const commitWhenIdle = () => {
    timeoutId = null;
    const remaining = deadline - now();
    if (remaining > 0) {
      timeoutId = setTimeoutFn(commitWhenIdle, Math.ceil(remaining));
      return;
    }
    run();
  };

  return {
    schedule() {
      deadline = now() + delayMs;
      if (timeoutId === null) {
        timeoutId = setTimeoutFn(commitWhenIdle, delayMs);
      }
    },
    cancel() {
      if (timeoutId !== null) {
        clearTimeoutFn(timeoutId);
        timeoutId = null;
      }
      deadline = Number.NEGATIVE_INFINITY;
    },
    isPending() {
      return timeoutId !== null;
    }
  };
}
