// Javelin rules, no drawing. Run up with A/B like the sprint, hold ▲ to raise the angle, let go to throw.
// Distance is measured from the foul line; crossing the line before letting go is a foul.
import { newRunner, press as runPress, step as runStep } from './sprint-logic.js';

export const LINE = 30;        // foul line, metres from the start of the run-up
export const G = 9.8;
export const RELEASE_H = 1.9;  // hand height at release, metres
export const AIM_RATE = 60;    // degrees per second while ▲ is held
export const MAX_AIM = 85;
export const ROUNDS = 3;
export const IDEAL = [38, 50]; // angle band within ~3% of the best throw (best is ~44°)
export const WARN_AT = 12;     // metres before the line where the warning starts
export const ROUND_LIMIT = 20; // seconds after GO before anyone who hasn't thrown gets a foul

export const newThrower = (slot) => ({ ...newRunner(slot), aiming: false, angle: 0, flight: null, result: null });

// Where a throw lands, plus launch velocity for drawing it. Faster run-up = faster javelin.
export function flight(vRun, angleDeg, x0, t0 = 0) {
  const v = 1.3 * vRun + 14, a = angleDeg * Math.PI / 180;
  const vx = v * Math.cos(a), vy = v * Math.sin(a);
  const time = (vy + Math.sqrt(vy * vy + 2 * G * RELEASE_H)) / G;
  return { x0, t0, vx, vy, time, landX: x0 + vx * time };
}

function release(r, t) {
  r.aiming = false;
  r.flight = flight(r.v, r.angle, r.x, t);
  r.result = r.x > LINE ? 'foul' : Math.max(0, r.flight.landX - LINE);
}

export function input(r, b, down, t) {
  if (t < 0 || r.result !== null) return; // taps before GO are ignored (no false starts here)
  if (b === 'U') {
    if (down && !r.aiming) { r.aiming = true; r.angle = 0; }
    else if (!down && r.aiming) release(r, t);
  } else if (down && !r.aiming && (b === 'A' || b === 'B')) runPress(r, b, t);
}

export function update(r, dt, t) {
  if (t < 0) return;
  if (r.aiming) r.angle = Math.min(MAX_AIM, r.angle + AIM_RATE * dt);
  if (r.flight) r.v *= Math.exp(-3 * dt); // pull up after the throw
  const v = r.v;
  runStep(r, dt, t);
  if (r.aiming) r.v = v; // keep run-up speed while aiming (can't tap then)
  if (r.result === null && r.x > LINE) r.aiming ? release(r, t) : (r.result = 'foul'); // touching the line = foul
  if (r.result === null && t > ROUND_LIMIT) r.aiming ? release(r, t) : (r.result = 'foul');
}

// Metres and seconds (at current speed) until the foul line.
export function toLine(r) {
  const metres = Math.max(0, LINE - r.x);
  return { metres, seconds: r.v > 0.1 ? metres / r.v : Infinity };
}

// Players by best throw; no valid throw goes last. place is 1-based.
export const rankBest = (list) =>
  [...list].sort((a, b) => (b.best ?? -1) - (a.best ?? -1)).map((r, i) => ({ slot: r.slot, best: r.best, place: i + 1 }));
