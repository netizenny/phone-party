// 100m sprint rules, no drawing. Race clock t is in seconds: negative during the countdown, 0 = GO.
export const DIST = 100;      // metres
export const MAX_V = 12;      // top speed, m/s
export const GAIN = 0.9;      // speed added per correct alternate tap
export const DRAG = 0.7;      // speed lost per second (exponential); ~8 taps/s settles near 10 m/s ≈ 10 s race
export const FALSE_START_UNTIL = 1; // a tap before GO freezes the runner until t = 1 s

export const newRunner = (slot) => ({ slot, x: 0, v: 0, last: null, finish: null, stunUntil: 0, falseStart: false });

export function press(r, b, t) {
  if (b !== 'A' && b !== 'B') return;
  if (t < 0) { r.stunUntil = FALSE_START_UNTIL; r.falseStart = true; return; }
  if (r.finish !== null || t < r.stunUntil || b === r.last) return; // must alternate A, B, A, B…
  r.last = b;
  r.v = Math.min(MAX_V, r.v + GAIN);
}

// Advance one frame. t is the clock after this frame.
export function step(r, dt, t) {
  if (t < 0) return;
  if (r.finish !== null) { r.v *= Math.exp(-2.5 * dt); r.x += r.v * dt; return; } // coast after the line
  r.v *= Math.exp(-DRAG * dt);
  const nx = r.x + r.v * dt;
  if (nx >= DIST && r.v > 0) r.finish = t - dt + (DIST - r.x) / r.v; // exact crossing time inside this frame
  r.x = nx;
}

// Finished runners by time, then the rest by distance. place is 1-based.
export function rank(runners) {
  return [...runners]
    .sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.x - a.x)
    .map((r, i) => ({ slot: r.slot, place: i + 1, time: r.finish, dist: Math.min(r.x, DIST) }));
}
