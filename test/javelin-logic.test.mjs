import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newThrower, input, update, flight, rankBest, toLine, LINE, IDEAL } from '../public/javelin-logic.js';

// Run up tapping 8/s, start holding ▲ at aimAt metres, let go after holdFor seconds.
function attempt(aimAt, holdFor) {
  const r = newThrower(0), dt = 1 / 60;
  let t = 0, n = 0, aimStart = null;
  while (r.result === null && t < 30) {
    t += dt;
    if (aimStart === null && r.x < aimAt && Math.floor(t * 8) > n) input(r, n++ % 2 ? 'A' : 'B', true, t);
    if (aimStart === null && r.x >= aimAt) { input(r, 'U', true, t); aimStart = t; }
    if (aimStart !== null && t - aimStart >= holdFor) input(r, 'U', false, t);
    update(r, dt, t);
  }
  return r;
}

test('around 40 degrees beats a flat or steep throw', () => {
  const d = (a) => flight(10, a, 0).landX;
  assert.ok(d(40) > d(10) && d(40) > d(80));
});

test('faster run-up throws farther', () => {
  assert.ok(flight(10, 40, 0).landX > flight(5, 40, 0).landX);
});

test('a good attempt lands a realistic distance', () => {
  const r = attempt(22, 0.66); // ~40°
  assert.equal(typeof r.result, 'number');
  assert.ok(r.result > 50 && r.result < 100, `got ${r.result}`);
});

test('letting go after the line is a foul', () => {
  assert.equal(attempt(LINE - 1, 1).result, 'foul');
});

test('running past the line without aiming is a foul', () => {
  assert.equal(attempt(999, 0).result, 'foul');
});

test('the ideal band contains the best angle', () => {
  let best = 0;
  for (let a = 1; a < 90; a++) if (flight(9, a, 0).landX > flight(9, best, 0).landX) best = a;
  assert.ok(best >= IDEAL[0] && best <= IDEAL[1], `best ${best}`);
});

test('toLine counts down metres and seconds', () => {
  assert.deepEqual(toLine({ x: LINE - 10, v: 5 }), { metres: 10, seconds: 2 });
  assert.equal(toLine({ x: 0, v: 0 }).seconds, Infinity);
});

test('rankBest puts no-mark players last', () => {
  assert.deepEqual(rankBest([{ slot: 0, best: null }, { slot: 1, best: 60 }, { slot: 2, best: 70 }]).map(r => r.slot), [2, 1, 0]);
});
