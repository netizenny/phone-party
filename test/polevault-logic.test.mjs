import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newVaulter, input, update, vaultPos, rankVault, BOX, BAR_X, SWEET, MAT_TOP } from '../public/polevault-logic.js';

// Tap A/B at 8/s until x reaches plantAt, press ▲, then press ▲ again once theta reaches releaseAt degrees.
function attempt(barH, plantAt, releaseAt) {
  const r = newVaulter(0, barH), dt = 1 / 60;
  let t = 0, n = 0;
  while (r.result === null && t < 30) {
    t += dt;
    if (!r.planted && r.x < plantAt && Math.floor(t * 8) > n) input(r, n++ % 2 ? 'A' : 'B', true, t);
    if (!r.planted && r.x >= plantAt) input(r, 'U', true, t);
    if (r.planted && !r.vault && r.theta >= releaseAt) input(r, 'U', true, t);
    update(r, dt, t);
  }
  return r;
}

test('a clean vault clears a normal height', () => {
  assert.equal(attempt(3, BOX - SWEET, 150).result, 'clear');
});

test('a clean vault cannot clear an impossible height', () => {
  assert.equal(attempt(9, BOX - SWEET, 150).result, 'miss');
});

test('better timing jumps higher', () => {
  assert.ok(attempt(3, BOX - SWEET, 150).vault.peak > attempt(3, BOX - 4, 100).vault.peak);
});

test('running through the box without planting is a miss', () => {
  assert.equal(attempt(3, 999, 0).result, 'miss');
});

test('never releasing still ends the attempt', () => {
  assert.notEqual(attempt(3, BOX - SWEET, 999).result, null);
});

test('the jump peaks over the bar and lands on the mat', () => {
  const v = attempt(3, BOX - SWEET, 150).vault;
  assert.ok(Math.abs(vaultPos(v, v.tUp).x - BAR_X) < 1e-6);
  assert.equal(vaultPos(v, v.total).y, MAT_TOP);
  assert.ok(vaultPos(v, v.total).landed);
});

test('rankVault: highest wins, later knock-out breaks ties, no height last', () => {
  const rows = [{ slot: 0, best: null, outRound: 1 }, { slot: 1, best: 4, outRound: 3 }, { slot: 2, best: 4, outRound: 5 }];
  assert.deepEqual(rankVault(rows).map(r => r.slot), [2, 1, 0]);
});
