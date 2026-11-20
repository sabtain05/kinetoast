import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStackLayout, parsePlacement, PLACEMENTS, TOAST_STATUS } from '../src/index.js';

test('parsePlacement extracts edge, align, and signed direction', () => {
  assert.deepEqual(parsePlacement(PLACEMENTS.TOP_LEFT), { edge: 'top', align: 'left', direction: 1 });
  assert.deepEqual(parsePlacement(PLACEMENTS.BOTTOM_CENTER), { edge: 'bottom', align: 'center', direction: -1 });
  assert.deepEqual(parsePlacement(PLACEMENTS.BOTTOM_RIGHT), { edge: 'bottom', align: 'right', direction: -1 });
});

test('computeStackLayout calculates expanded coordinates for bottom placement with variable heights', () => {
  const toasts = [
    { id: 't1', height: 80, status: TOAST_STATUS.VISIBLE },
    { id: 't2', height: 50, status: TOAST_STATUS.VISIBLE },
    { id: 't3', height: null, status: TOAST_STATUS.VISIBLE }
  ];

  const result = computeStackLayout(toasts, {
    placement: PLACEMENTS.BOTTOM_RIGHT,
    gap: 10,
    defaultHeight: 60,
    expanded: true,
    baseZIndex: 100
  });

  const l1 = result.layouts.get('t1');
  const l2 = result.layouts.get('t2');
  const l3 = result.layouts.get('t3');

  assert.equal(l1.offset, 0);
  assert.equal(l2.offset, -90);
  assert.equal(l3.offset, -150);
  assert.equal(l1.scale, 1);
  assert.equal(l2.scale, 1);
  assert.equal(l3.scale, 1);
  assert.equal(l1.zIndex, 100);
  assert.equal(l2.zIndex, 99);
  assert.equal(l3.zIndex, 98);
  assert.equal(result.expandedHeight, 210);
  assert.equal(result.totalHeight, 210);
});

test('computeStackLayout calculates collapsed deck scale, opacity, and signed top offsets', () => {
  const toasts = [
    { id: 't1', height: 70, status: TOAST_STATUS.VISIBLE },
    { id: 't2', height: 70, status: TOAST_STATUS.VISIBLE },
    { id: 't3', height: 70, status: TOAST_STATUS.VISIBLE }
  ];

  const result = computeStackLayout(toasts, {
    placement: PLACEMENTS.TOP_CENTER,
    collapsedOffset: 16,
    scaleStep: 0.05,
    opacityStep: 0.2,
    expanded: false
  });

  assert.equal(result.layouts.get('t1').offset, 0);
  assert.equal(result.layouts.get('t2').offset, 16);
  assert.equal(result.layouts.get('t3').offset, 32);
  assert.equal(result.layouts.get('t1').scale, 1);
  assert.equal(result.layouts.get('t2').scale, 0.95);
  assert.equal(result.layouts.get('t3').scale, 0.9);
  assert.equal(result.layouts.get('t3').opacity, 0.6);
  assert.equal(result.collapsedHeight, 102);
  assert.equal(result.totalHeight, 102);
});

test('computeStackLayout ignores exiting items when accumulating active stack offsets', () => {
  const toasts = [
    { id: 't1', height: 60, status: TOAST_STATUS.EXITING },
    { id: 't2', height: 60, status: TOAST_STATUS.VISIBLE },
    { id: 't3', height: 60, status: TOAST_STATUS.VISIBLE }
  ];

  const result = computeStackLayout(toasts, {
    placement: PLACEMENTS.TOP_RIGHT,
    gap: 10,
    expanded: true
  });

  assert.equal(result.layouts.get('t2').visualIndex, 0);
  assert.equal(result.layouts.get('t2').offset, 0);
  assert.equal(result.layouts.get('t3').visualIndex, 1);
  assert.equal(result.layouts.get('t3').offset, 70);
  assert.equal(result.expandedHeight, 130);
});
