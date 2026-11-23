// Downhill skiing rules, no drawing. Hold ◀ ▶ to steer down the slope (+x is downhill, +z is right).
// Speed builds on its own; turning scrubs a little speed; hitting a tree nearly stops you.
import { FALSE_START_UNTIL } from './sprint-logic.js';

export const LEN = 500;          // metres to the finish
export const HALF_W = 15;        // piste half-width; the edge slows you
export const ACCEL = 13;         // downhill push, m/s² (steep hill)
export const DRAG = 0.02;        // air drag ×v²; top speed = sqrt(ACCEL/DRAG) ≈ 25 m/s ≈ 92 km/h
export const TURN_DRAG = 3;      // extra slowdown per second while steering
export const SIDE_SPEED = 9;     // sideways speed at full steer, m/s
export const SIDE_RESPONSE = 6;  // how fast sideways speed follows the stick (per second)
export const TREE_R = 0.9;       // collision radius (tree + skier)
export const CRASH_KEEP = 0.25;  // speed kept after hitting a tree
export const CRASH_STUN = 0.8;   // seconds you can't steer after a crash
export const EDGE_DRAG = 6;      // slowdown per second while scraping the edge

// Same trees for everyone and every game: a tiny seeded random generator.
export function makeCourse(seed = 7) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const trees = [];
  for (let x = 40; x < LEN - 15; x += 5 + rand() * 4) {
    const n = 2 + Math.floor(rand() * 3); // 2–4 trees per row on a 30 m piste still leaves gaps to ski through
    for (let i = 0; i < n; i++) trees.push({ x: x + rand() * 3, z: (rand() * 2 - 1) * (HALF_W - 1) });
  }
  return trees;
}

export const newSkier = (slot) => ({
  slot, x: 0, z: (slot - 1.5) * 3, v: 0, vz: 0, left: false, right: false,
  finish: null, stunUntil: 0, falseStart: false, lastHit: null, crashT: -9, crashes: 0,
});

export function input(r, b, down, t) {
  if (b !== 'L' && b !== 'R') return;
  if (t < 0 && down) { r.stunUntil = FALSE_START_UNTIL; r.falseStart = true; }
  if (b === 'L') r.left = down; else r.right = down;
}

export const steer = (r, t) => (t < r.stunUntil || r.finish !== null ? 0 : (r.right ? 1 : 0) - (r.left ? 1 : 0));

// Advance one frame. t is the clock after this frame.
export function step(r, dt, t, trees) {
  if (t < 0) return;
  const s = steer(r, t);
  if (r.finish !== null) { r.v *= Math.exp(-1.5 * dt); r.vz *= Math.exp(-3 * dt); }
  else r.v = Math.max(0, r.v + (ACCEL - DRAG * r.v * r.v - TURN_DRAG * Math.abs(s)) * dt);
  r.vz += (s * SIDE_SPEED * Math.min(1, r.v / 6 + 0.3) - r.vz) * Math.min(1, SIDE_RESPONSE * dt);

  const nx = r.x + r.v * dt;
  r.z += r.vz * dt;
  if (Math.abs(r.z) > HALF_W) { r.z = Math.sign(r.z) * HALF_W; r.vz = 0; r.v *= Math.exp(-EDGE_DRAG * dt); }

  if (r.finish === null) {
    for (const tree of trees) {
      if (tree === r.lastHit || Math.abs(tree.x - nx) > TREE_R) continue;
      if (Math.hypot(tree.x - nx, tree.z - r.z) < TREE_R) {
        r.v *= CRASH_KEEP; r.vz = 0; r.stunUntil = t + CRASH_STUN; r.lastHit = tree; r.crashT = t; r.crashes++;
        break;
      }
    }
    if (nx >= LEN && r.v > 0) r.finish = t - dt + (LEN - r.x) / r.v;
  }
  r.x = nx;
}
