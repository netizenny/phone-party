// Pole vault rules, no drawing. Run up with A/B like the sprint, press ▲ to plant the pole in the green zone
// before the box, then press ▲ again near the top of the swing to let go. Clear the bar or you're out.
import { newRunner, step as runStep, press as runPress } from './sprint-logic.js';

export const BOX = 30;          // plant box, metres from the start of the run-up
export const ZONE = 4;          // metres before the box where planting counts at all
export const SWEET = 1;         // best plant spot: this many metres before the box
export const BAR_X = BOX + 2;   // the bar stands just past the box
export const MAT_TOP = 1;       // landing mat height, metres
export const START_H = 3;       // first bar height, metres
export const STEP = 0.25;       // bar goes up this much each round
export const G = 9.8;
export const SWING_RATE = 120;  // degrees per second while swinging on the pole
export const REL_IDEAL = [135, 165]; // release window, degrees of swing
export const ROUND_LIMIT = 20;  // seconds after GO before an attempt that hasn't planted is a miss

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const REL_MID = (REL_IDEAL[0] + REL_IDEAL[1]) / 2, REL_HALF = 45;

export const newVaulter = (slot, barH) =>
  ({ ...newRunner(slot), barH, planted: false, plantQ: 0, theta: 0, hBase: 0, vault: null, result: null });

// Height potential from speed at the plant; the pole turns that into a jump.
export const potential = (v) => 1.6 + 0.4 * v;
// Swing visuals: where the vaulter is while hanging on the pole at theta degrees.
export const swingY = (theta, hBase) => 0.65 * hBase * Math.sin(Math.min(theta, 150) / 150 * Math.PI / 2);
export const swingX = (theta) => BOX + (BAR_X - BOX) * 0.6 * Math.min(theta, 150) / 150;

function plant(r) {
  const d = BOX - r.x; // metres before the box
  r.plantQ = clamp01(1 - Math.abs(d - SWEET) / (ZONE - SWEET));
  r.planted = true;
  r.theta = 0;
  r.hBase = potential(r.v);
}

function release(r, t) {
  const relQ = clamp01(1 - Math.abs(r.theta - REL_MID) / REL_HALF);
  const peak = r.hBase * (0.8 + 0.2 * (r.plantQ + relQ) / 2);
  const x0 = swingX(r.theta), y0 = swingY(r.theta, r.hBase);
  const vy = Math.sqrt(2 * G * (peak - y0)), tUp = vy / G;
  r.vault = { t0: t, x0, y0, peak, vy, tUp, vx: (BAR_X - x0) / tUp, total: tUp + Math.sqrt(2 * (peak - MAT_TOP) / G), relTheta: r.theta };
  r.result = peak >= r.barH ? 'clear' : 'miss';
  r.v = 0;
}

// Where the vaulter is tf seconds after letting go.
export function vaultPos(v, tf) {
  const t = Math.min(tf, v.total);
  const y = t <= v.tUp ? v.y0 + v.vy * t - 0.5 * G * t * t : v.peak - 0.5 * G * (t - v.tUp) ** 2;
  return { x: v.x0 + v.vx * t, y: Math.max(MAT_TOP, y), landed: tf >= v.total };
}

export function input(r, b, down, t) {
  if (t < 0 || r.result !== null || !down) return; // taps before GO are ignored
  if (b === 'U') r.planted ? (r.vault || release(r, t)) : plant(r);
  else if (!r.planted) runPress(r, b, t);
}

export function update(r, dt, t) {
  if (t < 0 || r.result !== null) return;
  if (r.planted) {
    r.theta += SWING_RATE * dt;
    if (r.theta >= 180) release(r, t); // never let go: dropped late, worst release
    return;
  }
  runStep(r, dt, t);
  if (r.x > BOX || t > ROUND_LIMIT) r.result = 'miss'; // ran through the box without planting
}

// Metres until the box.
export const toBox = (r) => Math.max(0, BOX - r.x);

// Best cleared height wins; at the same height, whoever went out later ranks higher. place is 1-based.
export const rankVault = (list) =>
  [...list]
    .sort((a, b) => (b.best ?? -1) - (a.best ?? -1) || (b.outRound ?? Infinity) - (a.outRound ?? Infinity))
    .map((r, i) => ({ slot: r.slot, best: r.best, place: i + 1 }));
