import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newSwimmer, press, step, zoneAt, BREATH_WINDOW } from '../public/swim-logic.js';

// Mash `rate` strokes/s. Breathes `at` (fraction of the meter sweep) after being asked, or never if null.
// spamA: also press A every n-th stroke regardless.
function swim(rate, { same = false, at = 0.57, spamA = 0 } = {}) {
  const r = newSwimmer(0), dt = 1 / 60;
  let t = 0, next = 0, n = 0, breatheAt = null;
  while (t < 90 && r.finish === null) {
    t += dt;
    while (t >= next) {
      press(r, same || n % 2 ? 'L' : 'R', t); n++; next += 1 / rate;
      if (spamA && n % spamA === 0) press(r, 'A', t);
    }
    if (r.needBreath && at !== null && breatheAt === null) breatheAt = r.breathAsked + at * BREATH_WINDOW;
    if (breatheAt !== null && t >= breatheAt) { press(r, 'A', t); breatheAt = null; }
    step(r, dt, t);
  }
  return r;
}
const time = (r) => r.finish ?? Infinity;

test('meter zones: red, yellow, green, yellow, red, then late', () => {
  assert.deepEqual([0.1, 0.3, 0.5, 0.8, 0.9, 1.2].map(zoneAt), ['red', 'yellow', 'green', 'yellow', 'red', 'late']);
});

test('green breaths with fast strokes swim 50m in a realistic time', () => {
  const r = swim(8);
  assert.ok(r.finish > 15 && r.finish < 28, `got ${r.finish}`);
});

test('green beats yellow beats red', () => {
  const green = time(swim(8, { at: 0.57 })), yellow = time(swim(8, { at: 0.35 })), red = time(swim(8, { at: 0.1 }));
  assert.ok(green < yellow && yellow < red, `${green} ${yellow} ${red}`);
});

test('never breathing costs a lot of time', () => {
  assert.ok(time(swim(8, { at: null })) > time(swim(8)) + 5);
});

test('spamming A slows you to a stop', () => {
  const r = swim(8, { spamA: 1 }); // A after every stroke, for 90 s
  assert.equal(r.finish, null);
  assert.ok(r.x < 15 && r.v < 0.5, `got ${r.x} m at ${r.v} m/s`); // a normal swimmer does 50 m in ~18 s
});

test('a double tap on a breath is not punished', () => {
  const r = newSwimmer(0);
  r.v = 2; r.needBreath = true; r.breathAsked = 1;
  press(r, 'A', 1.6); // green
  const v = r.v;
  press(r, 'A', 1.7); // bounce
  assert.equal(r.v, v);
  assert.equal(r.feedback, 'BOOST!');
});

test('faster mashing wins', () => {
  assert.ok(time(swim(10)) < time(swim(6)));
});

test('same arm every time goes nowhere', () => {
  assert.ok(swim(8, { same: true }).x < 1);
});

test('B does nothing in the pool', () => {
  const r = newSwimmer(0);
  press(r, 'B', 1); press(r, 'B', 1.1);
  assert.equal(r.v, 0);
});
