export function createSystemClock() {
  const now = () => {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  };

  return {
    now,
    setTimeout: (fn, delay) => globalThis.setTimeout(fn, delay),
    clearTimeout: (handle) => globalThis.clearTimeout(handle)
  };
}

export function createManualClock(initialTime = 0) {
  let currentTime = initialTime;
  let nextHandle = 1;
  const timers = new Map();

  function now() {
    return currentTime;
  }

  function setTimeout(fn, delay) {
    const handle = nextHandle++;
    const safeDelay = Math.max(0, Number(delay) || 0);
    timers.set(handle, {
      handle,
      fn,
      triggerAt: currentTime + safeDelay
    });
    return handle;
  }

  function clearTimeout(handle) {
    timers.delete(handle);
  }

  function advanceBy(ms) {
    const delta = Math.max(0, Number(ms) || 0);
    const targetTime = currentTime + delta;

    while (true) {
      let earliest = null;
      for (const timer of timers.values()) {
        if (timer.triggerAt <= targetTime) {
          if (earliest === null || timer.triggerAt < earliest.triggerAt || (timer.triggerAt === earliest.triggerAt && timer.handle < earliest.handle)) {
            earliest = timer;
          }
        }
      }

      if (earliest === null) {
        break;
      }

      timers.delete(earliest.handle);
      currentTime = earliest.triggerAt;
      earliest.fn();
    }

    currentTime = targetTime;
  }

  function pendingCount() {
    return timers.size;
  }

  return {
    now,
    setTimeout,
    clearTimeout,
    advanceBy,
    pendingCount
  };
}
