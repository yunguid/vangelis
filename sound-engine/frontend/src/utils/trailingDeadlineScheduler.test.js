import { describe, expect, it, vi } from 'vitest';
import { createTrailingDeadlineScheduler } from './trailingDeadlineScheduler.js';

function createClock() {
  let now = 0;
  let serial = 0;
  const timers = new Map();
  const setTimeoutFn = vi.fn((callback, delay) => {
    serial += 1;
    timers.set(serial, { callback, due: now + delay });
    return serial;
  });
  const clearTimeoutFn = vi.fn((id) => timers.delete(id));
  const advanceTo = (nextNow) => {
    now = nextNow;
    let dueTimer;
    do {
      dueTimer = [...timers.entries()]
        .filter(([, timer]) => timer.due <= now)
        .sort((left, right) => left[1].due - right[1].due)[0];
      if (dueTimer) {
        timers.delete(dueTimer[0]);
        dueTimer[1].callback();
      }
    } while (dueTimer);
  };
  return { now: () => now, setTimeoutFn, clearTimeoutFn, advanceTo, timers };
}

describe('createTrailingDeadlineScheduler', () => {
  it('keeps one timer chain and commits only after the latest deadline', () => {
    const clock = createClock();
    const run = vi.fn();
    const scheduler = createTrailingDeadlineScheduler({
      delayMs: 200,
      run,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn
    });

    scheduler.schedule();
    clock.advanceTo(150);
    scheduler.schedule();
    clock.advanceTo(200);
    expect(run).not.toHaveBeenCalled();
    expect(clock.setTimeoutFn).toHaveBeenCalledTimes(2);
    expect(clock.clearTimeoutFn).not.toHaveBeenCalled();

    clock.advanceTo(349);
    expect(run).not.toHaveBeenCalled();
    clock.advanceTo(350);
    expect(run).toHaveBeenCalledTimes(1);
    expect(scheduler.isPending()).toBe(false);
  });

  it('cancels pending work without committing', () => {
    const clock = createClock();
    const run = vi.fn();
    const scheduler = createTrailingDeadlineScheduler({
      delayMs: 200,
      run,
      now: clock.now,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn
    });

    scheduler.schedule();
    scheduler.cancel();
    clock.advanceTo(500);

    expect(run).not.toHaveBeenCalled();
    expect(clock.clearTimeoutFn).toHaveBeenCalledTimes(1);
    expect(clock.timers.size).toBe(0);
  });
});
