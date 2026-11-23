import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRunner, press, step, rank } from '../public/sprint-logic.js';

// Simulate a runner tapping `rate` times per second, alternating unless `same` is set.
function race(rate, { same = false, earlyTap = false } = {}) {
  const r = newRunner(0);
  const dt = 1 / 60;
  let t = -3, nextTap = 0, n = 0;
  if (earlyTap) press(r, 'A', -0.5);
  while (t < 30 && r.finish === null) {
    t += dt;
    while (t >= nextTap) { press(r, same || n % 2 ? 'A' : 'B', t); n++; nextTap += 1 / rate; }
    step(r, dt, t);
  }
  return r;
}

test('fast alternating taps finish in a realistic time', () => {
  const r = race(8);
  assert.ok(r.finish > 9 && r.finish < 14, `got ${r.finish}`);
});

test('faster tapping wins', () => {
  assert.ok(race(10).finish < race(6).finish);
});

test('mashing one button does not move you', () => {
  const r = race(10, { same: true });
  assert.equal(r.finish, null);
  assert.ok(r.x < 2); // only the very first tap counts
});

test('false start costs time', () => {
  assert.ok(race(8, { earlyTap: true }).finish > race(8).finish + 0.5);
});

test('rank puts finishers by time, then others by distance', () => {
  const a = { slot: 0, finish: 11, x: 100 }, b = { slot: 1, finish: 10, x: 100 }, c = { slot: 2, finish: null, x: 80 }, d = { slot: 3, finish: null, x: 90 };
  assert.deepEqual(rank([a, b, c, d]).map(r => r.slot), [1, 0, 3, 2]);
});
