export function createToastTimer({ duration, clock, onExpire }) {
  const normalizedDuration = normalizeDuration(duration);
  let totalDuration = normalizedDuration;
  let remainingMs = normalizedDuration;
  let startedAt = null;
  let handle = null;
  let paused = false;
  let expired = false;
  let disposed = false;

  function normalizeDuration(value) {
    if (value === Infinity || value === null || value === undefined) {
      return Infinity;
    }
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return Infinity;
    }
    return num;
  }

  function clearNativeTimer() {
    if (handle !== null) {
      clock.clearTimeout(handle);
      handle = null;
    }
  }

  function schedule() {
    clearNativeTimer();
    if (disposed || expired || paused || !Number.isFinite(remainingMs)) {
      return;
    }
    startedAt = clock.now();
    handle = clock.setTimeout(() => {
      handle = null;
      startedAt = null;
      remainingMs = 0;
      expired = true;
      if (!disposed && typeof onExpire === 'function') {
        onExpire();
      }
    }, remainingMs);
  }

  function start() {
    if (disposed || expired) {
      return;
    }
    paused = false;
    schedule();
  }

  function pause() {
    if (disposed || expired || paused) {
      return;
    }
    if (startedAt !== null && Number.isFinite(remainingMs)) {
      const elapsed = Math.max(0, clock.now() - startedAt);
      remainingMs = Math.max(0, remainingMs - elapsed);
    }
    startedAt = null;
    paused = true;
    clearNativeTimer();
  }

  function resume() {
    if (disposed || expired || !paused) {
      return;
    }
    paused = false;
    if (remainingMs <= 0 && Number.isFinite(totalDuration)) {
      expired = true;
      if (typeof onExpire === 'function') {
        onExpire();
      }
      return;
    }
    schedule();
  }

  function reset(nextDuration = totalDuration) {
    if (disposed) {
      return;
    }
    clearNativeTimer();
    totalDuration = normalizeDuration(nextDuration);
    remainingMs = totalDuration;
    startedAt = null;
    expired = false;
    if (!paused) {
      schedule();
    }
  }

  function getRemaining() {
    if (expired) {
      return 0;
    }
    if (!Number.isFinite(remainingMs)) {
      return Infinity;
    }
    if (paused || startedAt === null) {
      return remainingMs;
    }
    const elapsed = Math.max(0, clock.now() - startedAt);
    return Math.max(0, remainingMs - elapsed);
  }

  function getProgress() {
    if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
      return 0;
    }
    const currentRemaining = getRemaining();
    const ratio = 1 - currentRemaining / totalDuration;
    return Math.min(1, Math.max(0, ratio));
  }

  function isPaused() {
    return paused;
  }

  function isPersistent() {
    return !Number.isFinite(totalDuration);
  }

  function getDuration() {
    return totalDuration;
  }

  function dispose() {
    disposed = true;
    clearNativeTimer();
    startedAt = null;
  }

  return {
    start,
    pause,
    resume,
    reset,
    getRemaining,
    getProgress,
    isPaused,
    isPersistent,
    getDuration,
    dispose
  };
}
