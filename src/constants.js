export const TOAST_STATUS = Object.freeze({
  QUEUED: 'queued',
  ENTERING: 'entering',
  VISIBLE: 'visible',
  EXITING: 'exiting',
  DISMISSED: 'dismissed'
});

export const PLACEMENTS = Object.freeze({
  TOP_LEFT: 'top-left',
  TOP_CENTER: 'top-center',
  TOP_RIGHT: 'top-right',
  BOTTOM_LEFT: 'bottom-left',
  BOTTOM_CENTER: 'bottom-center',
  BOTTOM_RIGHT: 'bottom-right'
});

export const EVICTION_POLICIES = Object.freeze({
  FIFO: 'fifo',
  LIFO: 'lifo',
  PRIORITY: 'priority'
});

export const STACK_ORDER = Object.freeze({
  NEWEST_FIRST: 'newest-first',
  OLDEST_FIRST: 'oldest-first'
});

export const DEFAULT_CONFIG = Object.freeze({
  maxVisible: 5,
  maxQueueSize: 50,
  defaultDuration: 5000,
  exitDuration: 0,
  placement: PLACEMENTS.BOTTOM_RIGHT,
  order: STACK_ORDER.NEWEST_FIRST,
  evictionPolicy: EVICTION_POLICIES.FIFO,
  gap: 12,
  defaultHeight: 64,
  collapsedOffset: 14,
  scaleStep: 0.05,
  minScale: 0.85,
  opacityStep: 0.15,
  minOpacity: 0,
  baseZIndex: 1000,
  expandedByDefault: false,
  pauseOnHover: true,
  pauseOnWindowBlur: true
});
