// 100m sprint: countdown, race and results on the big screen.
import { newRunner, press, step, rank, DIST } from './sprint-logic.js';
import { createStage, addTrack, addLineAcross, makeAthlete, poseAthlete, laneZ, SKIN, countdownText, box, flat, LANE_W } from './stadium.js';

const COUNTDOWN = 3;      // seconds of 3-2-1 before GO
const AFTER_FIRST = 12;   // race ends this long after the first finisher
const MAX_RACE = 45;      // hard stop if nobody finishes

export function startSprint({ players, container, isPaused, onDone }) {
  const stage = createStage(container);
  addTrack(stage.scene, -15, DIST + 45);
  addLineAcross(stage.scene, 0);
  addLineAcross(stage.scene, DIST);
  // Finish post with a board, on the far side only so it never blocks the camera.
  stage.scene.add(box(0.3, 4, 0.3, flat('#1b2a3a'), DIST, 2, -LANE_W * 2 - 0.8));
  stage.scene.add(box(0.3, 1.2, 2.4, flat('#ffffff'), DIST, 4.2, -LANE_W * 2 - 0.8));
  stage.hint.innerHTML = 'Tap <b>A</b> and <b>B</b> one after the other to run!';

  const runners = players.map(p => {
    const a = makeAthlete(p.color, SKIN[p.slot]);
    a.g.position.z = laneZ(p.slot);
    stage.scene.add(a.g);
    return { ...newRunner(p.slot), player: p, a, tag: stage.addTag(p.color) };
  });
  const bySlot = Object.fromEntries(runners.map(r => [r.slot, r]));

  let t = -COUNTDOWN, firstFinish = null, ended = false;

  stage.loop((dt) => {
    if (!isPaused() && !ended) {
      t += dt;
      for (const r of runners) step(r, dt, t);
      firstFinish ??= runners.some(r => r.finish !== null) ? t : null;
      if (runners.every(r => r.finish !== null) || (firstFinish !== null && t > firstFinish + AFTER_FIRST) || t > MAX_RACE) {
        ended = true;
        setTimeout(showResults, 1500);
      }
    }
    stage.big.textContent = countdownText(t);
    stage.hint.hidden = t > 2;

    for (const r of runners) {
      poseAthlete(r.a, r.x, r.v, dt, r.finish !== null && r.v < 3);
      stage.placeTag(r.tag, r.x, 2.2, laneZ(r.slot),
        r.player.name + (r.finish !== null ? ` ${r.finish.toFixed(2)}s` : r.falseStart && t < 1 ? ' false start!' : ''));
    }
    return { x: Math.min(Math.max(...runners.map(r => r.x)), DIST + 4), cheer: t > 0 };
  });

  function showResults() {
    const results = rank(runners);
    stage.showResults('100m Sprint', results.map(res => {
      const p = bySlot[res.slot].player;
      return { place: res.place, name: p.name, color: p.color,
               text: res.time !== null ? res.time.toFixed(2) + ' s' : `DNF (${res.dist.toFixed(0)} m)` };
    }), () => onDone(results));
  }

  return {
    input(slot, b, down) { if (down && bySlot[slot]) press(bySlot[slot], b, t); },
    stop: stage.dispose,
  };
}
