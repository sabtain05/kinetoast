# kinetoast

Zero-markup, strictly logic-driven headless notification and toast layout engine.

`kinetoast` decouples notification state, queue governance, pauseable countdown timers, compound deduplication, interactive actions, and mathematical stack coordinates from DOM rendering and CSS. Bring your own components, Tailwind utilities, CSS transitions, or spring physics.

## Why kinetoast

- **Zero Markup & Zero CSS**: Ships pure JavaScript logic with zero runtime dependencies and zero injected stylesheets.
- **Mathematical Stack Coordinates**: Computes exact `offset`, `scale`, `opacity`, `zIndex`, `expandedHeight`, and `collapsedHeight` for every active notification across top and bottom placements.
- **Queue Governance**: Enforces `maxVisible` and `maxQueueSize` with `fifo`, `lifo`, and `priority` eviction and automatic queue promotion.
- **Multi-Reason Pause Tracking**: Combines hover, window blur, visibility change, and manual pause states via reason sets so overlapping pauses never resume prematurely.
- **Interactive Compound Notifications**: Supports deduplication via `dedupeKey` / `groupKey`, occurrence counters, inline actions (such as Undo), and promise lifecycle transitions.
- **Framework-Agnostic Reactive Store**: Implements referentially stable snapshots (`subscribe`, `getSnapshot`, `getServerSnapshot`) directly compatible with React `useSyncExternalStore`, Vue, Svelte, Solid, and Vanilla JS.
- **Deterministic Testing**: Inject `createManualClock()` to advance timers and exit transitions deterministically without flaky real-time sleeps.

## Installation

```bash
npm install kinetoast
```

## Quick Start

```js
import { createToastEngine } from 'kinetoast';

const engine = createToastEngine({
  maxVisible: 4,
  defaultDuration: 5000,
  placement: 'bottom-right',
  gap: 12,
  exitDuration: 200
});

const unsubscribe = engine.subscribe((snapshot) => {
  for (const toast of snapshot.toasts) {
    console.log(toast.id, toast.layout.offset, toast.layout.scale, toast.data);
  }
});

engine.push({
  type: 'info',
  data: { title: 'Message archived' },
  actions: [
    {
      id: 'undo',
      label: 'Undo',
      onClick: ({ toast }) => {
        console.log('Restored item from toast', toast.id);
      }
    }
  ]
});

unsubscribe();
```

## React Integration

```jsx
import { useSyncExternalStore } from 'react';
import { createToastEngine } from 'kinetoast';

export const toastEngine = createToastEngine({
  placement: 'bottom-right',
  gap: 12,
  exitDuration: 180
});

export function ToastRegion() {
  const snapshot = useSyncExternalStore(
    toastEngine.subscribe,
    toastEngine.getSnapshot,
    toastEngine.getServerSnapshot
  );

  return (
    <div
      onPointerEnter={() => toastEngine.onStackPointerEnter()}
      onPointerLeave={() => toastEngine.onStackPointerLeave()}
      style={{ position: 'fixed', bottom: 24, right: 24, height: snapshot.totalHeight }}
    >
      {snapshot.toasts.map((toast) => (
        <div
          key={toast.id}
          ref={(el) => {
            if (el) {
              toast.measure(el.getBoundingClientRect().height);
            }
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            transform: `translate3d(0, ${toast.layout.offset}px, 0) scale(${toast.layout.scale})`,
            opacity: toast.status === 'exiting' ? 0 : toast.layout.opacity,
            zIndex: toast.layout.zIndex,
            transition: 'transform 200ms ease, opacity 200ms ease'
          }}
        >
          <span>{toast.data.title}</span>
          {toast.actions.map((action) => (
            <button key={action.id} onClick={() => toast.invokeAction(action.id)}>
              {action.label}
            </button>
          ))}
          <button onClick={() => toast.dismiss()}>Close</button>
        </div>
      ))}
    </div>
  );
}
```

## Promise Lifecycle

```js
await engine.promise(
  () => fetch('/api/export').then((res) => res.json()),
  {
    loading: { title: 'Exporting report...' },
    success: (result) => ({
      data: { title: `Exported ${result.rows} rows` },
      duration: 4000
    }),
    error: (err) => ({
      data: { title: `Export failed: ${err.message}` },
      duration: Infinity
    })
  }
);
```

## Compound Deduplication

```js
engine.push({
  dedupeKey: 'file-upload',
  data: { title: 'Uploading assets' }
});

engine.push({
  dedupeKey: 'file-upload',
  data: { title: 'Uploading assets' }
});
```

Matching `dedupeKey` or `groupKey` updates the existing notification in place, increments `toast.count`, and resets its timer unless `resetTimerOnUpdate: false` is provided.

## Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `maxVisible` | `number` | `5` | Maximum simultaneously active notifications before queueing |
| `maxQueueSize` | `number` | `50` | Maximum queued notifications retained before eviction |
| `defaultDuration` | `number` | `5000` | Default auto-dismiss timeout in milliseconds (`Infinity` for persistent) |
| `exitDuration` | `number` | `0` | Milliseconds a dismissed toast remains in `exiting` status before removal |
| `placement` | `Placement` | `'bottom-right'` | Viewport anchor (`top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`) |
| `order` | `StackOrder` | `'newest-first'` | Visual ordering of active items (`newest-first` or `oldest-first`) |
| `evictionPolicy` | `EvictionPolicy` | `'fifo'` | Queue overflow and promotion strategy (`fifo`, `lifo`, `priority`) |
| `gap` | `number` | `12` | Pixel gap between notifications in expanded stack mode |
| `defaultHeight` | `number` | `64` | Fallback height in pixels prior to DOM measurement via `measure()` |
| `collapsedOffset` | `number` | `14` | Pixel peek offset per stacked item when collapsed |
| `scaleStep` | `number` | `0.05` | Scale decrement per depth level when collapsed |
| `minScale` | `number` | `0.85` | Minimum scale floor when collapsed |
| `opacityStep` | `number` | `0.15` | Opacity decrement per depth level when collapsed |
| `minOpacity` | `number` | `0` | Minimum opacity floor when collapsed |
| `baseZIndex` | `number` | `1000` | Base z-index assigned to the front-most toast |
| `expandedByDefault` | `boolean` | `false` | Initial stack expansion state |
| `pauseOnHover` | `boolean` | `true` | Automatically pauses timers when pointer hover helpers are invoked |
| `pauseOnWindowBlur` | `boolean` | `true` | Automatically pauses timers on window blur and hidden tab visibility |
| `clock` | `Clock` | `createSystemClock()` | Custom or manual clock implementation for deterministic scheduling |

## Layout Geometry Object

Each active toast exposes a frozen `layout` object:

- `index`: Position in the active array.
- `visualIndex`: Position among non-exiting notifications (`0` is front-most).
- `offset`: Signed pixel Y-axis translation (`+` downward for `top-*`, `-` upward for `bottom-*`).
- `offsetAbs`: Unsigned pixel offset distance.
- `expandedOffset`: Signed pixel offset in expanded mode.
- `collapsedOffset`: Signed pixel offset in collapsed mode.
- `height`: Measured height or `defaultHeight`.
- `scale`: Computed scale factor.
- `opacity`: Computed opacity (`0` beyond `maxVisible`).
- `zIndex`: Computed stacking order (`baseZIndex - visualIndex`).
- `edge`: `'top'` or `'bottom'`.
- `align`: `'left'`, `'center'`, or `'right'`.
- `direction`: `1` for top placements, `-1` for bottom placements.
- `isFront`: `true` when `visualIndex === 0`.
- `isVisible`: `true` when `visualIndex < maxVisible`.

## Engine API

- `push(input)`: Enqueues or activates a toast, or merges into an existing toast when `id` or `dedupeKey` matches. Returns toast ID.
- `update(id, patch)`: Updates payload, type, actions, priority, height, or duration in place.
- `dismiss(id, reason?)`: Transitions to `exiting` (when `exitDuration > 0`) or removes immediately, promoting queued items.
- `remove(id, reason?)`: Removes immediately without waiting for `exitDuration`.
- `dismissAll(options?)`: Dismisses all active notifications and optionally clears the queue.
- `clear()`: Immediately disposes all active and queued notifications.
- `pause(id, reason?)` / `resume(id, reason?)`: Per-toast reason-tracked pause control.
- `pauseAll(reason?)` / `resumeAll(reason?)`: Stack-wide reason-tracked pause control.
- `setExpanded(boolean)` / `toggleExpanded()`: Switches between collapsed deck and expanded list coordinates.
- `setPlacement(placement)`: Dynamically switches placement anchor and recalculates signed coordinates.
- `measure(id, height)`: Records measured DOM height and recalculates stack geometry.
- `invokeAction(toastId, actionId)`: Executes an action callback with `{ toast, dismiss, remove, update, pause, resume }`.
- `promise(promiseOrFactory, handlers, baseOptions?)`: Manages loading, success, and error transitions on a single toast.
- `onStackPointerEnter()` / `onStackPointerLeave()`: Coordinates hover pause and stack expansion.
- `onToastPointerEnter(id)` / `onToastPointerLeave(id)`: Coordinates individual toast hover pause.
- `bindWindowEvents(win?, doc?)`: Binds `blur`, `focus`, and `visibilitychange` pause listeners; returns an unbind function.
- `subscribe(listener)`: Subscribes to snapshot updates; returns an unsubscribe function.
- `on(eventName, handler)`: Listens to lifecycle events (`created`, `updated`, `dismissed`, `removed`, `paused`, `resumed`, `action`, `promoted`).
- `getSnapshot()` / `getServerSnapshot()` / `getToasts()` / `getQueued()`: Reads immutable reactive state.
- `destroy()`: Disposes all timers and listeners.

## License

MIT

---

<strong>A Sabtain Ali production</strong>