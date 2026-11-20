const test = require('node:test');
const assert = require('node:assert/strict');
const { createToastEngine, createManualClock } = require('../dist/index.cjs');

test('CommonJS bundle exports functional createToastEngine', () => {
  const clock = createManualClock(0);
  const engine = createToastEngine({ clock, defaultDuration: 1000 });
  const id = engine.push({ data: 'cjs-ok' });

  assert.equal(engine.getToasts().length, 1);
  assert.equal(engine.getToasts()[0].id, id);

  clock.advanceBy(1000);
  assert.equal(engine.getToasts().length, 0);
});
