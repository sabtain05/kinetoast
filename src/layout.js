import { DEFAULT_CONFIG, TOAST_STATUS } from './constants.js';

export function parsePlacement(placement = DEFAULT_CONFIG.placement) {
  const parts = String(placement).split('-');
  const edge = parts[0] === 'top' ? 'top' : 'bottom';
  const align = parts[1] === 'left' || parts[1] === 'center' || parts[1] === 'right' ? parts[1] : 'right';
  const direction = edge === 'top' ? 1 : -1;
  return { edge, align, direction };
}

function signedOffset(direction, value) {
  return value === 0 ? 0 : direction * value;
}

export function computeStackLayout(toasts, options = {}) {
  const {
    placement = DEFAULT_CONFIG.placement,
    gap = DEFAULT_CONFIG.gap,
    defaultHeight = DEFAULT_CONFIG.defaultHeight,
    collapsedOffset = DEFAULT_CONFIG.collapsedOffset,
    scaleStep = DEFAULT_CONFIG.scaleStep,
    minScale = DEFAULT_CONFIG.minScale,
    opacityStep = DEFAULT_CONFIG.opacityStep,
    minOpacity = DEFAULT_CONFIG.minOpacity,
    baseZIndex = DEFAULT_CONFIG.baseZIndex,
    maxVisible = DEFAULT_CONFIG.maxVisible,
    expanded = false
  } = options;

  const { edge, align, direction } = parsePlacement(placement);
  const layouts = new Map();

  let cumulativeExpandedOffset = 0;
  let frontHeight = 0;
  let activeIndex = 0;

  for (let i = 0; i < toasts.length; i++) {
    const toast = toasts[i];
    const height = typeof toast.height === 'number' && toast.height > 0 ? toast.height : defaultHeight;
    const isExiting = toast.status === TOAST_STATUS.EXITING;
    const visualIndex = activeIndex;
    const isVisible = visualIndex < maxVisible;

    if (visualIndex === 0 && !isExiting) {
      frontHeight = height;
    }

    const expandedOffsetAbs = cumulativeExpandedOffset;
    const collapsedOffsetAbs = visualIndex * collapsedOffset;
    const offsetAbs = expanded ? expandedOffsetAbs : collapsedOffsetAbs;
    const offset = signedOffset(direction, offsetAbs);

    const rawScale = expanded ? 1 : Math.max(minScale, 1 - visualIndex * scaleStep);
    const scale = Number(rawScale.toFixed(4));

    const rawOpacity = !isVisible
      ? 0
      : expanded
        ? 1
        : Math.max(minOpacity, 1 - visualIndex * opacityStep);
    const opacity = Number(rawOpacity.toFixed(4));

    const zIndex = baseZIndex - visualIndex;

    layouts.set(toast.id, Object.freeze({
      index: i,
      visualIndex,
      offset,
      offsetAbs,
      expandedOffset: signedOffset(direction, expandedOffsetAbs),
      collapsedOffset: signedOffset(direction, collapsedOffsetAbs),
      height,
      scale,
      opacity,
      zIndex,
      edge,
      align,
      direction,
      isFront: visualIndex === 0,
      isVisible
    }));

    if (!isExiting) {
      cumulativeExpandedOffset += height + gap;
      activeIndex += 1;
    }
  }

  const activeCount = activeIndex;
  const expandedHeight = activeCount > 0 ? Math.max(0, cumulativeExpandedOffset - gap) : 0;
  const visibleStackedCount = Math.min(activeCount, maxVisible);
  const collapsedHeight = visibleStackedCount > 0
    ? frontHeight + Math.max(0, visibleStackedCount - 1) * collapsedOffset
    : 0;
  const totalHeight = expanded ? expandedHeight : collapsedHeight;

  return {
    layouts,
    expandedHeight,
    collapsedHeight,
    totalHeight,
    edge,
    align,
    direction
  };
}
