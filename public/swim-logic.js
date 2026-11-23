// 50m freestyle rules, no drawing. Mash ◀ ▶ one after the other to swim (A = breathe).
// Every BREATH_EVERY strokes a timing meter sweeps across: press A in the green for a boost, yellow is a
// plain breath, red slows you down. Miss it and your strokes go weak until you breathe.
// Pressing A when you weren't asked slows you a lot, so spamming A stops you dead.
import { newRunner, FALSE_START_UNTIL } from './sprint-logic.js';

export const DIST = 50;            // metres, one length
export const PUSH = 0.27;          // speed added per stroke
export const DRAG = 0.9;           // speed lost per second (exponential); 8 strokes/s ≈ 2.4 m/s ≈ 22 s
export const BREATH_EVERY = 16;    // strokes between breaths (~2 s at full speed)
export const BREATH_WINDOW = 1.2;  // seconds the meter takes to sweep across
export const TIRED = 0.4;          // stroke strength while out of breath
export const BOOST = 1.0;          // speed added by a green breath
export const RED_SLOW = 0.6;       // speed kept after a red breath
export const SPAM_SLOW = 0.5;      // speed kept after pressing A when not asked…
export const CHOKE = 0.5;          // …and seconds you can't stroke after it
export const DOUBLE_TAP = 0.3;     // extra A presses this soon after a breath are ignored
// Meter zones left to right: [end of zone as fraction of the sweep, colour].
export const ZONES = [[0.25, 'red'], [0.45, 'yellow'], [0.7, 'green'], [0.85, 'yellow'], [1, 'red']];

export const zoneAt = (f) => (f >= 1 ? 'late' : ZONES.find(([end]) => f < end)[1]);
// How far the meter has swept (0..1+) for a swimmer who has been asked to breathe.
export const meter = (r, t) => (t - r.breathAsked) / BREATH_WINDOW;

export const newSwimmer = (slot) => ({
  ...newRunner(slot), strokes: 0, needBreath: false, breathAsked: 0, lastBreathT: -9, tired: false, feedback: '', feedbackT: -9,
});

const say = (r, text, t) => { r.feedback = text; r.feedbackT = t; };

function breathe(r, t) {
  const zone = zoneAt(meter(r, t));
  r.needBreath = false;
  r.tired = false;
  if (zone === 'green') { r.v += BOOST; say(r, 'BOOST!', t); }
  else if (zone === 'yellow') say(r, 'OK breath', t);
  else if (zone === 'red') { r.v *= RED_SLOW; say(r, 'Bad breath!', t); }
  else say(r, 'Phew', t); // late: no boost, but strokes are strong again
  return zone;
}

export function press(r, b, t) {
  if (b !== 'L' && b !== 'R' && b !== 'A') return;
  if (t < 0) { r.stunUntil = FALSE_START_UNTIL; r.falseStart = true; return; }
  if (r.finish !== null || t < r.stunUntil) return;

  if (b === 'A') {
    if (r.needBreath) { breathe(r, t); r.lastBreathT = t; }
    else if (t - r.lastBreathT < DOUBLE_TAP) return; // an accidental double tap isn't spam
    else { r.v *= SPAM_SLOW; r.stunUntil = t + CHOKE; say(r, 'Choking!', t); }
    return;
  }

  if (b === r.last) return; // must alternate arms
  r.last = b;
  if (r.needBreath && meter(r, t) >= 1 && !r.tired) { r.tired = true; say(r, 'Out of breath!', t); }
  r.v += PUSH * (r.tired ? TIRED : 1);
  if (++r.strokes % BREATH_EVERY === 0 && !r.needBreath) { r.needBreath = true; r.breathAsked = t; }
}

// Advance one frame. t is the clock after this frame.
export function step(r, dt, t) {
  if (t < 0) return;
  if (r.finish !== null) { r.v *= Math.exp(-2 * dt); r.x = Math.min(r.x + r.v * dt, DIST); return; } // touch the wall
  r.v *= Math.exp(-DRAG * dt);
  const nx = r.x + r.v * dt;
  if (nx >= DIST && r.v > 0) r.finish = t - dt + (DIST - r.x) / r.v;
  r.x = Math.min(nx, DIST);
}
