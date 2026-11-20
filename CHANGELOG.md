# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-20

### Added

- Core zero-markup headless notification state machine (`createToastEngine`) with zero runtime dependencies.
- Pure mathematical stack layout engine (`computeStackLayout`, `parsePlacement`) supporting expanded and collapsed modes, dynamic height measurement, scale/opacity depth steps, z-index ordering, and signed top/bottom Y-axis coordinates.
- High-precision pauseable countdown timer (`createToastTimer`) with progress/remaining inspection and persistent (`Infinity`) duration support.
- Deterministic clock abstraction (`createSystemClock`, `createManualClock`) for SSR safety and reproducible unit testing.
- Queue management with `maxVisible`, `maxQueueSize`, automatic promotion, and `fifo`, `lifo`, and `priority` eviction policies.
- Compound notification deduplication via `id`, `dedupeKey`, and `groupKey` with occurrence counters.
- First-class interactive toast actions (`invokeAction`) with scoped lifecycle helpers and configurable `dismissOnClick`.
- Promise lifecycle management (`engine.promise`) for seamless loading-to-success/error transitions.
- Multi-reason pause tracking for overlapping hover, window blur, visibility change, and manual pauses.
- Referentially stable immutable snapshots (`subscribe`, `getSnapshot`, `getServerSnapshot`) compatible with React `useSyncExternalStore`.
- Dual ESM (`dist/index.mjs`) and CommonJS (`dist/index.cjs`) builds alongside strict TypeScript declarations (`types/index.d.ts`).
