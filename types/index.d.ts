export type ToastStatus = 'queued' | 'entering' | 'visible' | 'exiting' | 'dismissed';

export type Placement =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type EvictionPolicy = 'fifo' | 'lifo' | 'priority';

export type StackOrder = 'newest-first' | 'oldest-first';

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, delay: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface ManualClock extends Clock {
  advanceBy(ms: number): void;
  pendingCount(): number;
}

export interface ToastActionContext<TData = unknown> {
  toast: ToastItem<TData>;
  dismiss: () => boolean;
  remove: () => boolean;
  update: (patch: ToastUpdate<TData>) => boolean;
  pause: (reason?: string) => boolean;
  resume: (reason?: string) => boolean;
}

export interface ToastActionInput<TData = unknown> {
  id?: string;
  label: string;
  onClick?: (context: ToastActionContext<TData>) => unknown;
  dismissOnClick?: boolean;
  data?: unknown;
}

export interface ToastAction<TData = unknown> {
  readonly id: string;
  readonly label: string;
  readonly onClick: ((context: ToastActionContext<TData>) => unknown) | null;
  readonly dismissOnClick: boolean;
  readonly data: unknown;
}

export interface ToastLayout {
  readonly index: number;
  readonly visualIndex: number;
  readonly offset: number;
  readonly offsetAbs: number;
  readonly expandedOffset: number;
  readonly collapsedOffset: number;
  readonly height: number;
  readonly scale: number;
  readonly opacity: number;
  readonly zIndex: number;
  readonly edge: 'top' | 'bottom';
  readonly align: 'left' | 'center' | 'right';
  readonly direction: 1 | -1;
  readonly isFront: boolean;
  readonly isVisible: boolean;
}

export interface ToastInput<TData = unknown> {
  id?: string;
  type?: string;
  data?: TData;
  actions?: ToastActionInput<TData>[];
  priority?: number;
  dedupeKey?: string | null;
  groupKey?: string | null;
  duration?: number;
  height?: number;
  dismissible?: boolean;
  resetTimerOnUpdate?: boolean;
}

export interface ToastUpdate<TData = unknown> {
  type?: string;
  data?: TData;
  actions?: ToastActionInput<TData>[];
  priority?: number;
  duration?: number;
  height?: number;
  dismissible?: boolean;
  resetTimer?: boolean;
}

export interface ToastItem<TData = unknown> {
  readonly id: string;
  readonly type: string;
  readonly status: ToastStatus;
  readonly data: TData;
  readonly actions: readonly ToastAction<TData>[];
  readonly priority: number;
  readonly dedupeKey: string | null;
  readonly groupKey: string | null;
  readonly count: number;
  readonly duration: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly height: number | null;
  readonly dismissible: boolean;
  readonly isPaused: boolean;
  readonly isPersistent: boolean;
  readonly remainingMs: number;
  readonly layout: ToastLayout | null;
  dismiss(): boolean;
  remove(): boolean;
  pause(reason?: string): boolean;
  resume(reason?: string): boolean;
  update(patch: ToastUpdate<TData>): boolean;
  measure(height: number): boolean;
  invokeAction(actionId: string): unknown;
  getRemaining(): number;
  getProgress(): number;
}

export interface ToastSnapshot<TData = unknown> {
  readonly version: number;
  readonly toasts: readonly ToastItem<TData>[];
  readonly queued: readonly ToastItem<TData>[];
  readonly all: readonly ToastItem<TData>[];
  readonly expanded: boolean;
  readonly paused: boolean;
  readonly pauseReasons: readonly string[];
  readonly placement: Placement;
  readonly totalHeight: number;
  readonly expandedHeight: number;
  readonly collapsedHeight: number;
  readonly visibleCount: number;
  readonly queuedCount: number;
}

export interface ToastEngineConfig {
  maxVisible?: number;
  maxQueueSize?: number;
  defaultDuration?: number;
  exitDuration?: number;
  placement?: Placement;
  order?: StackOrder;
  evictionPolicy?: EvictionPolicy;
  gap?: number;
  defaultHeight?: number;
  collapsedOffset?: number;
  scaleStep?: number;
  minScale?: number;
  opacityStep?: number;
  minOpacity?: number;
  baseZIndex?: number;
  expandedByDefault?: boolean;
  pauseOnHover?: boolean;
  pauseOnWindowBlur?: boolean;
  clock?: Clock;
}

export interface PromiseToastHandlers<TResult, TData = unknown> {
  loading: TData | Partial<ToastInput<TData>>;
  success: TData | Partial<ToastUpdate<TData>> | ((result: TResult) => TData | Partial<ToastUpdate<TData>>);
  error: TData | Partial<ToastUpdate<TData>> | ((error: unknown) => TData | Partial<ToastUpdate<TData>>);
}

export type ToastEventName =
  | 'created'
  | 'updated'
  | 'dismissed'
  | 'removed'
  | 'paused'
  | 'resumed'
  | 'action'
  | 'promoted';

export interface ToastEngine<TData = unknown> {
  push(input?: ToastInput<TData>): string | null;
  update(id: string, patch?: ToastUpdate<TData>): boolean;
  dismiss(id: string, reason?: string): boolean;
  remove(id: string, reason?: string): boolean;
  dismissAll(options?: { includeQueued?: boolean; reason?: string }): void;
  clear(): void;
  pause(id: string, reason?: string): boolean;
  resume(id: string, reason?: string): boolean;
  pauseAll(reason?: string): void;
  resumeAll(reason?: string): void;
  setExpanded(expanded: boolean): void;
  toggleExpanded(): void;
  setPlacement(placement: Placement): void;
  measure(id: string, height: number): boolean;
  invokeAction(toastId: string, actionId: string): unknown;
  promise<TResult>(
    promiseOrFactory: Promise<TResult> | (() => Promise<TResult>),
    handlers: PromiseToastHandlers<TResult, TData>,
    baseOptions?: ToastInput<TData>
  ): Promise<TResult>;
  onStackPointerEnter(): void;
  onStackPointerLeave(): void;
  onToastPointerEnter(id: string): void;
  onToastPointerLeave(id: string): void;
  bindWindowEvents(win?: EventTarget | null, doc?: EventTarget | null): () => void;
  subscribe(listener: (snapshot: ToastSnapshot<TData>) => void): () => void;
  on(eventName: ToastEventName, handler: (payload: Record<string, unknown>) => void): () => void;
  getSnapshot(): ToastSnapshot<TData>;
  getServerSnapshot(): ToastSnapshot<TData>;
  getToasts(): readonly ToastItem<TData>[];
  getQueued(): readonly ToastItem<TData>[];
  destroy(): void;
}

export interface StackLayoutOptions {
  placement?: Placement;
  gap?: number;
  defaultHeight?: number;
  collapsedOffset?: number;
  scaleStep?: number;
  minScale?: number;
  opacityStep?: number;
  minOpacity?: number;
  baseZIndex?: number;
  maxVisible?: number;
  expanded?: boolean;
}

export interface StackLayoutResult {
  layouts: Map<string, ToastLayout>;
  expandedHeight: number;
  collapsedHeight: number;
  totalHeight: number;
  edge: 'top' | 'bottom';
  align: 'left' | 'center' | 'right';
  direction: 1 | -1;
}

export interface ToastTimer {
  start(): void;
  pause(): void;
  resume(): void;
  reset(nextDuration?: number): void;
  getRemaining(): number;
  getProgress(): number;
  isPaused(): boolean;
  isPersistent(): boolean;
  getDuration(): number;
  dispose(): void;
}

export declare const TOAST_STATUS: Readonly<{
  QUEUED: 'queued';
  ENTERING: 'entering';
  VISIBLE: 'visible';
  EXITING: 'exiting';
  DISMISSED: 'dismissed';
}>;

export declare const PLACEMENTS: Readonly<{
  TOP_LEFT: 'top-left';
  TOP_CENTER: 'top-center';
  TOP_RIGHT: 'top-right';
  BOTTOM_LEFT: 'bottom-left';
  BOTTOM_CENTER: 'bottom-center';
  BOTTOM_RIGHT: 'bottom-right';
}>;

export declare const EVICTION_POLICIES: Readonly<{
  FIFO: 'fifo';
  LIFO: 'lifo';
  PRIORITY: 'priority';
}>;

export declare const STACK_ORDER: Readonly<{
  NEWEST_FIRST: 'newest-first';
  OLDEST_FIRST: 'oldest-first';
}>;

export declare const DEFAULT_CONFIG: Readonly<Required<Omit<ToastEngineConfig, 'clock'>>>;

export declare function createSystemClock(): Clock;
export declare function createManualClock(initialTime?: number): ManualClock;
export declare function createToastTimer(options: {
  duration?: number;
  clock: Clock;
  onExpire?: () => void;
}): ToastTimer;
export declare function parsePlacement(placement?: Placement): {
  edge: 'top' | 'bottom';
  align: 'left' | 'center' | 'right';
  direction: 1 | -1;
};
export declare function computeStackLayout(
  toasts: ReadonlyArray<{ id: string; height?: number | null; status?: ToastStatus }>,
  options?: StackLayoutOptions
): StackLayoutResult;
export declare function createToastEngine<TData = unknown>(
  config?: ToastEngineConfig
): ToastEngine<TData>;
