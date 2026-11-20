import {
  DEFAULT_CONFIG,
  EVICTION_POLICIES,
  STACK_ORDER,
  TOAST_STATUS
} from './constants.js';
import { createSystemClock } from './clock.js';
import { computeStackLayout } from './layout.js';
import { createToastTimer } from './timer.js';

export function createToastEngine(userConfig = {}) {
  const config = {
    ...DEFAULT_CONFIG,
    ...userConfig
  };

  const clock = config.clock || createSystemClock();
  const subscribers = new Set();
  const eventListeners = new Map();
  const globalPauseReasons = new Set();

  let activeRecords = [];
  let queuedRecords = [];
  let expanded = Boolean(config.expandedByDefault);
  let idSequence = 0;
  let version = 0;
  let destroyed = false;

  const emptyServerSnapshot = Object.freeze({
    version: 0,
    toasts: Object.freeze([]),
    queued: Object.freeze([]),
    all: Object.freeze([]),
    expanded,
    paused: false,
    pauseReasons: Object.freeze([]),
    placement: config.placement,
    totalHeight: 0,
    expandedHeight: 0,
    collapsedHeight: 0,
    visibleCount: 0,
    queuedCount: 0
  });

  let cachedSnapshot = emptyServerSnapshot;

  function emit(eventName, payload) {
    const handlers = eventListeners.get(eventName);
    if (!handlers || handlers.size === 0) {
      return;
    }
    for (const handler of Array.from(handlers)) {
      handler(payload);
    }
  }

  function on(eventName, handler) {
    if (typeof handler !== 'function') {
      return () => {};
    }
    let handlers = eventListeners.get(eventName);
    if (!handlers) {
      handlers = new Set();
      eventListeners.set(eventName, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        eventListeners.delete(eventName);
      }
    };
  }

  function nextId() {
    idSequence += 1;
    return `kt-${idSequence}`;
  }

  function normalizeActions(actions) {
    if (!Array.isArray(actions)) {
      return Object.freeze([]);
    }
    return Object.freeze(
      actions.map((action, index) =>
        Object.freeze({
          id: action.id !== undefined ? String(action.id) : `action-${index}`,
          label: action.label !== undefined ? String(action.label) : '',
          onClick: typeof action.onClick === 'function' ? action.onClick : null,
          dismissOnClick: action.dismissOnClick !== false,
          data: action.data
        })
      )
    );
  }

  function isRecordEffectivelyPaused(record) {
    return globalPauseReasons.size > 0 || record.pauseReasons.size > 0;
  }

  function syncRecordTimer(record) {
    if (!record.timer) {
      return;
    }
    if (record.status === TOAST_STATUS.EXITING || record.status === TOAST_STATUS.DISMISSED) {
      record.timer.pause();
      return;
    }
    if (isRecordEffectivelyPaused(record)) {
      record.timer.pause();
    } else {
      record.timer.resume();
    }
  }

  function findRecordById(id) {
    for (let i = 0; i < activeRecords.length; i++) {
      if (activeRecords[i].id === id) {
        return { list: 'active', index: i, record: activeRecords[i] };
      }
    }
    for (let i = 0; i < queuedRecords.length; i++) {
      if (queuedRecords[i].id === id) {
        return { list: 'queued', index: i, record: queuedRecords[i] };
      }
    }
    return null;
  }

  function findRecordByDedupeKey(dedupeKey) {
    if (dedupeKey === undefined || dedupeKey === null || dedupeKey === '') {
      return null;
    }
    for (let i = 0; i < activeRecords.length; i++) {
      const rec = activeRecords[i];
      if (rec.dedupeKey === dedupeKey && rec.status !== TOAST_STATUS.EXITING) {
        return { list: 'active', index: i, record: rec };
      }
    }
    for (let i = 0; i < queuedRecords.length; i++) {
      if (queuedRecords[i].dedupeKey === dedupeKey) {
        return { list: 'queued', index: i, record: queuedRecords[i] };
      }
    }
    return null;
  }

  function getOrderedActiveRecords() {
    if (config.order === STACK_ORDER.OLDEST_FIRST) {
      return activeRecords.slice();
    }
    return activeRecords.slice().reverse();
  }

  function nonExitingActiveCount() {
    let count = 0;
    for (let i = 0; i < activeRecords.length; i++) {
      if (activeRecords[i].status !== TOAST_STATUS.EXITING) {
        count += 1;
      }
    }
    return count;
  }

  function createPublicToast(record, layout) {
    const id = record.id;
    const toastObj = {
      id,
      type: record.type,
      status: record.status,
      data: record.data,
      actions: record.actions,
      priority: record.priority,
      dedupeKey: record.dedupeKey,
      groupKey: record.groupKey,
      count: record.count,
      duration: record.duration,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      height: record.height,
      dismissible: record.dismissible,
      isPaused: isRecordEffectivelyPaused(record),
      isPersistent: record.timer ? record.timer.isPersistent() : !Number.isFinite(record.duration),
      remainingMs: record.timer ? record.timer.getRemaining() : record.duration,
      layout: layout || null,
      dismiss: () => dismiss(id),
      remove: () => remove(id),
      pause: (reason = 'manual') => pause(id, reason),
      resume: (reason = 'manual') => resume(id, reason),
      update: (patch) => update(id, patch),
      measure: (height) => measure(id, height),
      invokeAction: (actionId) => invokeAction(id, actionId),
      getRemaining: () => (record.timer ? record.timer.getRemaining() : record.duration),
      getProgress: () => (record.timer ? record.timer.getProgress() : 0)
    };
    return Object.freeze(toastObj);
  }

  function rebuildSnapshot() {
    version += 1;
    const orderedActive = getOrderedActiveRecords();
    const layoutResult = computeStackLayout(orderedActive, {
      placement: config.placement,
      gap: config.gap,
      defaultHeight: config.defaultHeight,
      collapsedOffset: config.collapsedOffset,
      scaleStep: config.scaleStep,
      minScale: config.minScale,
      opacityStep: config.opacityStep,
      minOpacity: config.minOpacity,
      baseZIndex: config.baseZIndex,
      maxVisible: config.maxVisible,
      expanded
    });

    const publicActive = Object.freeze(
      orderedActive.map((record) => createPublicToast(record, layoutResult.layouts.get(record.id)))
    );

    const publicQueued = Object.freeze(
      queuedRecords.map((record) => createPublicToast(record, null))
    );

    const publicAll = Object.freeze([...publicActive, ...publicQueued]);

    cachedSnapshot = Object.freeze({
      version,
      toasts: publicActive,
      queued: publicQueued,
      all: publicAll,
      expanded,
      paused: globalPauseReasons.size > 0,
      pauseReasons: Object.freeze(Array.from(globalPauseReasons)),
      placement: config.placement,
      totalHeight: layoutResult.totalHeight,
      expandedHeight: layoutResult.expandedHeight,
      collapsedHeight: layoutResult.collapsedHeight,
      visibleCount: publicActive.length,
      queuedCount: publicQueued.length
    });
  }

  function commit() {
    if (destroyed) {
      return;
    }
    rebuildSnapshot();
    for (const listener of Array.from(subscribers)) {
      listener(cachedSnapshot);
    }
  }

  function attachTimer(record) {
    if (record.timer) {
      record.timer.dispose();
    }
    record.timer = createToastTimer({
      duration: record.duration,
      clock,
      onExpire: () => {
        dismiss(record.id, 'timeout');
      }
    });
    if (isRecordEffectivelyPaused(record)) {
      record.timer.pause();
    } else {
      record.timer.start();
    }
  }

  function disposeRecordTimers(record) {
    if (record.timer) {
      record.timer.dispose();
      record.timer = null;
    }
    if (record.exitHandle !== null) {
      clock.clearTimeout(record.exitHandle);
      record.exitHandle = null;
    }
  }

  function selectNextQueuedIndex() {
    if (queuedRecords.length === 0) {
      return -1;
    }
    if (config.evictionPolicy === EVICTION_POLICIES.PRIORITY) {
      let bestIndex = 0;
      for (let i = 1; i < queuedRecords.length; i++) {
        if (queuedRecords[i].priority > queuedRecords[bestIndex].priority) {
          bestIndex = i;
        }
      }
      return bestIndex;
    }
    return 0;
  }

  function promoteFromQueue() {
    let promoted = [];
    while (nonExitingActiveCount() < config.maxVisible && queuedRecords.length > 0) {
      const idx = selectNextQueuedIndex();
      if (idx < 0) {
        break;
      }
      const [record] = queuedRecords.splice(idx, 1);
      record.status = TOAST_STATUS.VISIBLE;
      record.updatedAt = clock.now();
      activeRecords.push(record);
      attachTimer(record);
      promoted.push(record.id);
    }
    return promoted;
  }

  function enforceQueueCapacity() {
    while (queuedRecords.length > config.maxQueueSize) {
      let dropIndex = 0;
      if (config.evictionPolicy === EVICTION_POLICIES.LIFO) {
        dropIndex = queuedRecords.length - 1;
      } else if (config.evictionPolicy === EVICTION_POLICIES.PRIORITY) {
        dropIndex = 0;
        for (let i = 1; i < queuedRecords.length; i++) {
          if (queuedRecords[i].priority < queuedRecords[dropIndex].priority) {
            dropIndex = i;
          }
        }
      }
      const [dropped] = queuedRecords.splice(dropIndex, 1);
      disposeRecordTimers(dropped);
      emit('removed', { id: dropped.id, reason: 'evicted' });
    }
  }

  function push(input = {}) {
    if (destroyed) {
      return null;
    }

    const explicitId = input.id !== undefined && input.id !== null ? String(input.id) : null;
    const dedupeKey = input.dedupeKey !== undefined ? input.dedupeKey : input.groupKey;

    let existingMatch = null;
    if (explicitId !== null) {
      existingMatch = findRecordById(explicitId);
    }
    if (!existingMatch && dedupeKey !== undefined && dedupeKey !== null && dedupeKey !== '') {
      existingMatch = findRecordByDedupeKey(dedupeKey);
    }

    if (existingMatch && existingMatch.record.status !== TOAST_STATUS.EXITING) {
      const record = existingMatch.record;
      record.count += 1;
      record.updatedAt = clock.now();
      if (input.type !== undefined) {
        record.type = input.type;
      }
      if (input.data !== undefined) {
        record.data = input.data;
      }
      if (input.actions !== undefined) {
        record.actions = normalizeActions(input.actions);
      }
      if (input.priority !== undefined) {
        record.priority = Number(input.priority) || 0;
      }
      if (input.dismissible !== undefined) {
        record.dismissible = Boolean(input.dismissible);
      }
      if (input.duration !== undefined) {
        record.duration = input.duration;
      }
      if (record.timer && input.resetTimerOnUpdate !== false) {
        record.timer.reset(record.duration);
        syncRecordTimer(record);
      }
      commit();
      emit('updated', { id: record.id, count: record.count });
      return record.id;
    }

    const now = clock.now();
    const id = explicitId || nextId();
    const duration = input.duration !== undefined ? input.duration : config.defaultDuration;
    const record = {
      id,
      type: input.type || 'default',
      status: TOAST_STATUS.QUEUED,
      data: input.data !== undefined ? input.data : null,
      actions: normalizeActions(input.actions),
      priority: Number(input.priority) || 0,
      dedupeKey: dedupeKey !== undefined ? dedupeKey : null,
      groupKey: input.groupKey !== undefined ? input.groupKey : null,
      count: 1,
      duration,
      createdAt: now,
      updatedAt: now,
      height: typeof input.height === 'number' && input.height > 0 ? input.height : null,
      dismissible: input.dismissible !== false,
      pauseReasons: new Set(),
      timer: null,
      exitHandle: null
    };

    if (nonExitingActiveCount() < config.maxVisible) {
      record.status = TOAST_STATUS.VISIBLE;
      activeRecords.push(record);
      attachTimer(record);
    } else {
      queuedRecords.push(record);
      enforceQueueCapacity();
    }

    commit();
    emit('created', { id: record.id, status: record.status });
    return record.id;
  }

  function update(id, patch = {}) {
    if (destroyed) {
      return false;
    }
    const found = findRecordById(id);
    if (!found) {
      return false;
    }
    const { record } = found;
    if (patch.type !== undefined) {
      record.type = patch.type;
    }
    if (patch.data !== undefined) {
      record.data = patch.data;
    }
    if (patch.actions !== undefined) {
      record.actions = normalizeActions(patch.actions);
    }
    if (patch.priority !== undefined) {
      record.priority = Number(patch.priority) || 0;
    }
    if (patch.dismissible !== undefined) {
      record.dismissible = Boolean(patch.dismissible);
    }
    if (patch.height !== undefined && typeof patch.height === 'number' && patch.height > 0) {
      record.height = patch.height;
    }
    if (patch.duration !== undefined) {
      record.duration = patch.duration;
      if (record.timer) {
        record.timer.reset(record.duration);
        syncRecordTimer(record);
      }
    } else if (patch.resetTimer && record.timer) {
      record.timer.reset(record.duration);
      syncRecordTimer(record);
    }
    record.updatedAt = clock.now();
    commit();
    emit('updated', { id: record.id, count: record.count });
    return true;
  }

  function remove(id, reason = 'manual') {
    if (destroyed) {
      return false;
    }
    const found = findRecordById(id);
    if (!found) {
      return false;
    }
    const { list, index, record } = found;
    disposeRecordTimers(record);
    record.status = TOAST_STATUS.DISMISSED;

    if (list === 'active') {
      activeRecords.splice(index, 1);
    } else {
      queuedRecords.splice(index, 1);
    }

    const promoted = promoteFromQueue();
    commit();
    emit('removed', { id, reason });
    for (const promotedId of promoted) {
      emit('promoted', { id: promotedId });
    }
    return true;
  }

  function dismiss(id, reason = 'manual') {
    if (destroyed) {
      return false;
    }
    const found = findRecordById(id);
    if (!found) {
      return false;
    }
    const { list, record } = found;
    if (list === 'queued') {
      return remove(id, reason);
    }
    if (record.status === TOAST_STATUS.EXITING) {
      return true;
    }
    if (config.exitDuration <= 0) {
      emit('dismissed', { id, reason });
      return remove(id, reason);
    }

    if (record.timer) {
      record.timer.dispose();
      record.timer = null;
    }
    record.status = TOAST_STATUS.EXITING;
    record.updatedAt = clock.now();
    record.exitHandle = clock.setTimeout(() => {
      record.exitHandle = null;
      remove(id, reason);
    }, config.exitDuration);

    const promoted = promoteFromQueue();
    commit();
    emit('dismissed', { id, reason });
    for (const promotedId of promoted) {
      emit('promoted', { id: promotedId });
    }
    return true;
  }

  function dismissAll(options = {}) {
    if (destroyed) {
      return;
    }
    const { includeQueued = true, reason = 'manual' } = options;
    if (includeQueued) {
      for (const rec of queuedRecords) {
        disposeRecordTimers(rec);
      }
      queuedRecords = [];
    }
    const activeIds = activeRecords.map((rec) => rec.id);
    for (const id of activeIds) {
      dismiss(id, reason);
    }
    if (activeIds.length === 0 && includeQueued) {
      commit();
    }
  }

  function clear() {
    if (destroyed) {
      return;
    }
    for (const rec of activeRecords) {
      disposeRecordTimers(rec);
    }
    for (const rec of queuedRecords) {
      disposeRecordTimers(rec);
    }
    activeRecords = [];
    queuedRecords = [];
    commit();
  }

  function pause(id, reason = 'manual') {
    if (destroyed) {
      return false;
    }
    const found = findRecordById(id);
    if (!found) {
      return false;
    }
    const { record } = found;
    const wasPaused = isRecordEffectivelyPaused(record);
    record.pauseReasons.add(reason);
    syncRecordTimer(record);
    if (!wasPaused && isRecordEffectivelyPaused(record)) {
      commit();
      emit('paused', { id, reason });
    }
    return true;
  }

  function resume(id, reason = 'manual') {
    if (destroyed) {
      return false;
    }
    const found = findRecordById(id);
    if (!found) {
      return false;
    }
    const { record } = found;
    const wasPaused = isRecordEffectivelyPaused(record);
    record.pauseReasons.delete(reason);
    syncRecordTimer(record);
    if (wasPaused && !isRecordEffectivelyPaused(record)) {
      commit();
      emit('resumed', { id, reason });
    }
    return true;
  }

  function pauseAll(reason = 'manual') {
    if (destroyed) {
      return;
    }
    const wasGlobalPaused = globalPauseReasons.size > 0;
    globalPauseReasons.add(reason);
    for (const rec of activeRecords) {
      syncRecordTimer(rec);
    }
    if (!wasGlobalPaused) {
      commit();
      emit('paused', { id: null, reason });
    }
  }

  function resumeAll(reason = 'manual') {
    if (destroyed) {
      return;
    }
    const hadReason = globalPauseReasons.has(reason);
    if (!hadReason) {
      return;
    }
    globalPauseReasons.delete(reason);
    for (const rec of activeRecords) {
      syncRecordTimer(rec);
    }
    if (globalPauseReasons.size === 0) {
      commit();
      emit('resumed', { id: null, reason });
    }
  }

  function setExpanded(nextExpanded) {
    if (destroyed) {
      return;
    }
    const value = Boolean(nextExpanded);
    if (expanded === value) {
      return;
    }
    expanded = value;
    commit();
  }

  function toggleExpanded() {
    setExpanded(!expanded);
  }

  function setPlacement(nextPlacement) {
    if (destroyed || !nextPlacement || config.placement === nextPlacement) {
      return;
    }
    config.placement = nextPlacement;
    commit();
  }

  function measure(id, height) {
    if (destroyed) {
      return false;
    }
    const numericHeight = Number(height);
    if (!Number.isFinite(numericHeight) || numericHeight <= 0) {
      return false;
    }
    const found = findRecordById(id);
    if (!found) {
      return false;
    }
    if (found.record.height === numericHeight) {
      return true;
    }
    found.record.height = numericHeight;
    commit();
    return true;
  }

  function invokeAction(toastId, actionId) {
    if (destroyed) {
      return undefined;
    }
    const found = findRecordById(toastId);
    if (!found) {
      return undefined;
    }
    const { record } = found;
    const action = record.actions.find((item) => item.id === String(actionId));
    if (!action) {
      return undefined;
    }
    const publicToast = cachedSnapshot.all.find((t) => t.id === toastId) || createPublicToast(record, null);
    let result;
    if (typeof action.onClick === 'function') {
      result = action.onClick({
        toast: publicToast,
        dismiss: () => dismiss(toastId, 'action'),
        remove: () => remove(toastId, 'action'),
        update: (patch) => update(toastId, patch),
        pause: (reason = 'action') => pause(toastId, reason),
        resume: (reason = 'action') => resume(toastId, reason)
      });
    }
    emit('action', { toastId, actionId: action.id, action });
    if (action.dismissOnClick) {
      dismiss(toastId, 'action');
    }
    return result;
  }

  function promise(promiseOrFactory, handlers = {}, baseOptions = {}) {
    const loadingSpec = typeof handlers.loading === 'object' && handlers.loading !== null && ('data' in handlers.loading || 'type' in handlers.loading || 'actions' in handlers.loading)
      ? handlers.loading
      : { data: handlers.loading };

    const id = push({
      ...baseOptions,
      ...loadingSpec,
      type: loadingSpec.type || 'loading',
      duration: Infinity
    });

    const targetPromise = typeof promiseOrFactory === 'function' ? promiseOrFactory() : promiseOrFactory;

    return Promise.resolve(targetPromise).then(
      (value) => {
        const resolvedSpec = typeof handlers.success === 'function' ? handlers.success(value) : handlers.success;
        const normalized = typeof resolvedSpec === 'object' && resolvedSpec !== null && ('data' in resolvedSpec || 'type' in resolvedSpec || 'duration' in resolvedSpec || 'actions' in resolvedSpec)
          ? resolvedSpec
          : { data: resolvedSpec };
        update(id, {
          type: normalized.type || 'success',
          data: normalized.data,
          actions: normalized.actions !== undefined ? normalized.actions : [],
          duration: normalized.duration !== undefined ? normalized.duration : config.defaultDuration
        });
        return value;
      },
      (err) => {
        const rejectedSpec = typeof handlers.error === 'function' ? handlers.error(err) : handlers.error;
        const normalized = typeof rejectedSpec === 'object' && rejectedSpec !== null && ('data' in rejectedSpec || 'type' in rejectedSpec || 'duration' in rejectedSpec || 'actions' in rejectedSpec)
          ? rejectedSpec
          : { data: rejectedSpec };
        update(id, {
          type: normalized.type || 'error',
          data: normalized.data,
          actions: normalized.actions !== undefined ? normalized.actions : [],
          duration: normalized.duration !== undefined ? normalized.duration : config.defaultDuration
        });
        throw err;
      }
    );
  }

  function onStackPointerEnter() {
    if (config.pauseOnHover) {
      pauseAll('hover');
    }
    setExpanded(true);
  }

  function onStackPointerLeave() {
    if (config.pauseOnHover) {
      resumeAll('hover');
    }
    if (!config.expandedByDefault) {
      setExpanded(false);
    }
  }

  function onToastPointerEnter(id) {
    if (config.pauseOnHover) {
      pause(id, 'hover');
    }
  }

  function onToastPointerLeave(id) {
    if (config.pauseOnHover) {
      resume(id, 'hover');
    }
  }

  function bindWindowEvents(win = typeof window !== 'undefined' ? window : null, doc = typeof document !== 'undefined' ? document : null) {
    if (!config.pauseOnWindowBlur || !win) {
      return () => {};
    }
    const handleBlur = () => pauseAll('blur');
    const handleFocus = () => resumeAll('blur');
    const handleVisibility = () => {
      if (doc && doc.visibilityState === 'hidden') {
        pauseAll('visibility');
      } else {
        resumeAll('visibility');
      }
    };

    if (typeof win.addEventListener === 'function') {
      win.addEventListener('blur', handleBlur);
      win.addEventListener('focus', handleFocus);
    }
    if (doc && typeof doc.addEventListener === 'function') {
      doc.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (typeof win.removeEventListener === 'function') {
        win.removeEventListener('blur', handleBlur);
        win.removeEventListener('focus', handleFocus);
      }
      if (doc && typeof doc.removeEventListener === 'function') {
        doc.removeEventListener('visibilitychange', handleVisibility);
      }
      resumeAll('blur');
      resumeAll('visibility');
    };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }

  function getSnapshot() {
    return cachedSnapshot;
  }

  function getServerSnapshot() {
    return emptyServerSnapshot;
  }

  function getToasts() {
    return cachedSnapshot.toasts;
  }

  function getQueued() {
    return cachedSnapshot.queued;
  }

  function destroy() {
    if (destroyed) {
      return;
    }
    destroyed = true;
    for (const rec of activeRecords) {
      disposeRecordTimers(rec);
    }
    for (const rec of queuedRecords) {
      disposeRecordTimers(rec);
    }
    activeRecords = [];
    queuedRecords = [];
    subscribers.clear();
    eventListeners.clear();
    globalPauseReasons.clear();
  }

  return {
    push,
    update,
    dismiss,
    remove,
    dismissAll,
    clear,
    pause,
    resume,
    pauseAll,
    resumeAll,
    setExpanded,
    toggleExpanded,
    setPlacement,
    measure,
    invokeAction,
    promise,
    onStackPointerEnter,
    onStackPointerLeave,
    onToastPointerEnter,
    onToastPointerLeave,
    bindWindowEvents,
    subscribe,
    on,
    getSnapshot,
    getServerSnapshot,
    getToasts,
    getQueued,
    destroy
  };
}
