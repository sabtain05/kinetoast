import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createManualClock,
  createToastEngine,
  EVICTION_POLICIES,
  PLACEMENTS,
  TOAST_STATUS
} from '../src/index.js';

test('engine enforces maxVisible, queues overflow, and promotes automatically on timeout', () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({
    clock,
    maxVisible: 2,
    defaultDuration: 3000
  });

  const id1 = engine.push({ data: 'first' });
  const id2 = engine.push({ data: 'second' });
  const id3 = engine.push({ data: 'third' });

  assert.equal(engine.getToasts().length, 2);
  assert.equal(engine.getQueued().length, 1);
  assert.equal(engine.getQueued()[0].id, id3);

  clock.advanceBy(3000);
  assert.equal(engine.getToasts().length, 1);
  assert.equal(engine.getToasts()[0].id, id3);
  assert.equal(engine.getQueued().length, 0);

  clock.advanceBy(3000);
  assert.equal(engine.getToasts().length, 0);
  assert.equal(clock.pendingCount(), 0);
  assert.notEqual(id1, id2);
});

test('engine handles priority eviction and priority queue promotion', () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({
    clock,
    maxVisible: 1,
    maxQueueSize: 2,
    evictionPolicy: EVICTION_POLICIES.PRIORITY,
    defaultDuration: 5000
  });

  const activeId = engine.push({ data: 'active', priority: 1 });
  engine.push({ data: 'low', priority: 1 });
  const highId = engine.push({ data: 'high', priority: 10 });
  const midId = engine.push({ data: 'mid', priority: 5 });

  assert.equal(engine.getQueued().length, 2);
  assert.deepEqual(engine.getQueued().map((t) => t.id), [highId, midId]);

  engine.dismiss(activeId);
  assert.equal(engine.getToasts()[0].id, highId);
  assert.equal(engine.getQueued()[0].id, midId);
});

test('engine deduplicates compound notifications and increments count', () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({ clock, defaultDuration: 4000 });

  const id1 = engine.push({ dedupeKey: 'sync', data: { msg: 'Synced' } });
  clock.advanceBy(2500);
  const id2 = engine.push({ dedupeKey: 'sync', data: { msg: 'Synced again' } });

  assert.equal(id1, id2);
  assert.equal(engine.getToasts().length, 1);
  assert.equal(engine.getToasts()[0].count, 2);
  assert.equal(engine.getToasts()[0].data.msg, 'Synced again');

  clock.advanceBy(3000);
  assert.equal(engine.getToasts().length, 1);
  clock.advanceBy(1000);
  assert.equal(engine.getToasts().length, 0);
});

test('engine executes interactive Undo action and respects dismissOnClick', () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({ clock, defaultDuration: 5000 });
  let undone = false;

  const id = engine.push({
    data: { title: 'Item deleted' },
    actions: [
      {
        id: 'undo',
        label: 'Undo',
        onClick: ({ toast }) => {
          undone = toast.data.title === 'Item deleted';
          return 'restored';
        }
      }
    ]
  });

  const returnValue = engine.invokeAction(id, 'undo');
  assert.equal(undone, true);
  assert.equal(returnValue, 'restored');
  assert.equal(engine.getToasts().length, 0);
});

test('engine tracks overlapping hover and blur pause reasons independently', () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({ clock, defaultDuration: 4000 });

  engine.push({ data: 'toast' });
  clock.advanceBy(1000);

  engine.onStackPointerEnter();
  engine.pauseAll('blur');
  assert.equal(engine.getSnapshot().paused, true);
  assert.equal(engine.getSnapshot().expanded, true);

  clock.advanceBy(5000);
  assert.equal(engine.getToasts().length, 1);

  engine.resumeAll('blur');
  assert.equal(engine.getSnapshot().paused, true);
  clock.advanceBy(5000);
  assert.equal(engine.getToasts().length, 1);

  engine.onStackPointerLeave();
  assert.equal(engine.getSnapshot().paused, false);
  assert.equal(engine.getSnapshot().expanded, false);

  clock.advanceBy(2999);
  assert.equal(engine.getToasts().length, 1);
  clock.advanceBy(1);
  assert.equal(engine.getToasts().length, 0);
});

test('engine handles exitDuration transitions and immediate queue promotion', () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({
    clock,
    maxVisible: 1,
    defaultDuration: 2000,
    exitDuration: 300
  });

  const id1 = engine.push({ data: 'one' });
  const id2 = engine.push({ data: 'two' });

  engine.dismiss(id1);
  const visible = engine.getToasts();
  assert.equal(visible.length, 2);
  assert.equal(visible.find((t) => t.id === id1).status, TOAST_STATUS.EXITING);
  assert.equal(visible.find((t) => t.id === id2).status, TOAST_STATUS.VISIBLE);

  clock.advanceBy(300);
  assert.equal(engine.getToasts().length, 1);
  assert.equal(engine.getToasts()[0].id, id2);
});

test('engine promise helper transitions loading toast to success and error states', async () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({ clock, defaultDuration: 3000 });

  const resolved = await engine.promise(
    () => Promise.resolve({ count: 7 }),
    {
      loading: 'Loading...',
      success: (res) => `Loaded ${res.count}`,
      error: 'Failed'
    }
  );

  assert.deepEqual(resolved, { count: 7 });
  assert.equal(engine.getToasts().length, 1);
  assert.equal(engine.getToasts()[0].type, 'success');
  assert.equal(engine.getToasts()[0].data, 'Loaded 7');

  clock.advanceBy(3000);
  assert.equal(engine.getToasts().length, 0);

  await assert.rejects(
    () =>
      engine.promise(Promise.reject(new Error('network')), {
        loading: 'Saving...',
        success: 'Saved',
        error: (err) => ({ data: err.message, duration: Infinity })
      }),
    /network/
  );

  assert.equal(engine.getToasts().length, 1);
  assert.equal(engine.getToasts()[0].type, 'error');
  assert.equal(engine.getToasts()[0].data, 'network');
  assert.equal(engine.getToasts()[0].isPersistent, true);
});

test('engine recalculates layout on measure and maintains referential snapshot stability', () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({
    clock,
    placement: PLACEMENTS.TOP_RIGHT,
    gap: 10,
    expandedByDefault: true
  });

  const id1 = engine.push({ data: 'first' });
  const id2 = engine.push({ data: 'second' });

  const snapBefore = engine.getSnapshot();
  assert.equal(engine.getSnapshot(), snapBefore);

  engine.measure(id2, 100);
  const snapAfter = engine.getSnapshot();
  assert.notEqual(snapAfter, snapBefore);
  assert.equal(snapAfter.toasts[0].id, id2);
  assert.equal(snapAfter.toasts[0].layout.offset, 0);
  assert.equal(snapAfter.toasts[1].id, id1);
  assert.equal(snapAfter.toasts[1].layout.offset, 110);

  engine.measure(id2, 100);
  assert.equal(engine.getSnapshot(), snapAfter);
});
