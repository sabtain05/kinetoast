import test from 'node:test';
import assert from 'node:assert/strict';
import { createManualClock, createToastTimer } from '../src/index.js';

test('toast timer expires accurately and tracks remaining time and progress', () => {
  const clock = createManualClock(1000);
  let expired = 0;

  const timer = createToastTimer({
    duration: 4000,
    clock,
    onExpire: () => {
      expired += 1;
    }
  });

  timer.start();
  clock.advanceBy(1000);
  assert.equal(timer.getRemaining(), 3000);
  assert.equal(timer.getProgress(), 0.25);
  assert.equal(expired, 0);

  clock.advanceBy(3000);
  assert.equal(timer.getRemaining(), 0);
  assert.equal(timer.getProgress(), 1);
  assert.equal(expired, 1);
});

test('toast timer preserves exact remaining time across pause and resume cycles', () => {
  const clock = createManualClock(0);
  let expired = 0;

  const timer = createToastTimer({
    duration: 5000,
    clock,
    onExpire: () => {
      expired += 1;
    }
  });

  timer.start();
  clock.advanceBy(1500);
  timer.pause();
  assert.equal(timer.isPaused(), true);
  assert.equal(timer.getRemaining(), 3500);

  clock.advanceBy(10000);
  assert.equal(expired, 0);
  assert.equal(timer.getRemaining(), 3500);

  timer.resume();
  assert.equal(timer.isPaused(), false);
  clock.advanceBy(3499);
  assert.equal(expired, 0);
  assert.equal(timer.getRemaining(), 1);

  clock.advanceBy(1);
  assert.equal(expired, 1);
  assert.equal(timer.getRemaining(), 0);
});

test('toast timer supports persistent Infinity duration and reset', () => {
  const clock = createManualClock(0);
  let expired = 0;

  const timer = createToastTimer({
    duration: Infinity,
    clock,
    onExpire: () => {
      expired += 1;
    }
  });

  timer.start();
  assert.equal(timer.isPersistent(), true);
  clock.advanceBy(60000);
  assert.equal(expired, 0);
  assert.equal(timer.getRemaining(), Infinity);
  assert.equal(timer.getProgress(), 0);

  timer.reset(2000);
  assert.equal(timer.isPersistent(), false);
  clock.advanceBy(2000);
  assert.equal(expired, 1);
});
