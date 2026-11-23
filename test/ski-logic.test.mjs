import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCourse, newSkier, input, step, LEN, HALF_W, TREE_R } from '../public/ski-logic.js';

const trees = makeCourse();

// Run a skier with a steering brain(r) → -1/0/1, for up to 90 s.
function run(course, brain = () => 0) {
  const r = newSkier(1), dt = 1 / 60;
  let t = 0, held = 0;
  while (t < 90 && r.finish === null) {
    t += dt;
    const want = brain(r);
    if (want !== held) {
      input(r, 'L', want < 0, t); input(r, 'R', want > 0, t);
      held = want;
    }
    step(r, dt, t, course);
  }
  return r;
}

// Looks a little ahead and steers away from the nearest tree in its way.
const dodger = (r) => {
  const ahead = trees.filter(tr => tr.x > r.x && tr.x - r.x < 12 && Math.abs(tr.z - r.z) < TREE_R + 1.2);
  if (!ahead.length) return 0;
  const tr = ahead.sort((a, b) => a.x - b.x)[0];
  return tr.z > r.z ? -1 : 1;
};

test('course is the same every time and stays on the piste', () => {
  assert.deepEqual(makeCourse(), trees);
  assert.ok(trees.length > 50);
  assert.ok(trees.every(tr => Math.abs(tr.z) < HALF_W && tr.x < LEN));
});

test('an empty slope takes a realistic time', () => {
  const r = run([]);
  assert.ok(r.finish > 20 && r.finish < 35, `got ${r.finish}`);
});

test('dodging trees beats skiing straight into them', () => {
  const straight = run(trees), dodge = run(trees, dodger);
  assert.ok(straight.crashes > 0, 'straight line should hit something');
  assert.ok(dodge.crashes < straight.crashes);
  assert.ok((dodge.finish ?? Infinity) < (straight.finish ?? Infinity), `${dodge.finish} vs ${straight.finish}`);
});

test('a crash slows you right down', () => {
  const r = newSkier(1);
  r.x = 10; r.z = 0; r.v = 20;
  step(r, 1 / 60, 5, [{ x: 10.2, z: 0 }]);
  assert.ok(r.v < 6 && r.crashes === 1);
});

test('the same tree only hits once', () => {
  const r = newSkier(1);
  r.x = 10; r.z = 0; r.v = 2;
  const tree = { x: 10.2, z: 0 };
  for (let i = 0; i < 30; i++) step(r, 1 / 60, 5 + i / 60, [tree]);
  assert.equal(r.crashes, 1);
});

test('holding right moves right, and the edge stops you going off', () => {
  const r = run([], () => 1);
  assert.equal(r.z, HALF_W);
});
