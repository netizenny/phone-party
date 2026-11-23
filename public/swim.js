// 50m freestyle: everyone swims at once. Mash ◀ ▶; when the breath meter appears, press A in the green.
import * as THREE from 'three';
import { newSwimmer, press, step, meter, DIST, ZONES } from './swim-logic.js';
import { rank } from './sprint-logic.js';
import { createStage, makeAthlete, laneZ, SKIN, countdownText, box, flat, LANE_W } from './stadium.js';

const COUNTDOWN = 3;
const AFTER_FIRST = 15;   // race ends this long after the first finisher
const MAX_RACE = 75;      // hard stop if nobody finishes
const POOL_W = LANE_W * 4;

function buildPool(scene) {
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(DIST + 30, POOL_W + 8), flat('#d8dde3'));
  deck.rotation.x = -Math.PI / 2; deck.position.set(DIST / 2, 0.02, 0); deck.receiveShadow = true; scene.add(deck);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(DIST, POOL_W), flat('#2f9fd8'));
  water.rotation.x = -Math.PI / 2; water.position.set(DIST / 2, 0.04, 0); water.receiveShadow = true; scene.add(water);

  // End walls and starting blocks.
  scene.add(box(0.3, 0.3, POOL_W + 0.6, flat('#ffffff'), -0.15, 0.15, 0), box(0.3, 0.3, POOL_W + 0.6, flat('#ffffff'), DIST + 0.15, 0.15, 0));
  for (let s = 0; s < 4; s++) scene.add(box(0.6, 0.7, 0.6, flat('#ffffff'), -0.6, 0.35, laneZ(s)));

  // Lane ropes: rows of floats, red near the walls, white/blue in the middle.
  const gap = 0.35, perRope = Math.floor(DIST / gap), ropes = 5;
  const floats = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 6, 4), flat('#ffffff'), perRope * ropes);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < ropes; i++) for (let k = 0; k < perRope; k++) {
    const x = k * gap + gap / 2, id = i * perRope + k;
    m.setPosition(x, 0.08, (i - 2) * LANE_W);
    floats.setMatrixAt(id, m);
    floats.setColorAt(id, c.set(x < 5 || x > DIST - 5 ? '#e63946' : k % 4 < 2 ? '#ffffff' : '#1d8cf8'));
  }
  scene.add(floats);
}

// Athlete lying face-down along +x, head at the group origin.
function makeSwimmer(color, skin, z) {
  const a = makeAthlete(color, skin);
  a.g.rotation.z = -Math.PI / 2;
  a.g.position.set(-1.65, 0.12, 0);
  const holder = new THREE.Group();
  holder.add(a.g);
  holder.position.z = z;
  const foam = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 }));
  foam.rotation.x = -Math.PI / 2; foam.position.set(-0.6, 0.06, 0);
  holder.add(foam);
  return { holder, a, foam };
}

function poseSwimmer(s, x, v, dt) {
  const { a } = s;
  a.phase += v * dt * 2.8;
  a.arms[0].rotation.z = a.phase;            // windmill freestyle arms
  a.arms[1].rotation.z = a.phase + Math.PI;
  const kick = Math.sin(a.phase * 3) * 0.35 * Math.min(1, v / 1.5);
  a.legs[0].rotation.z = kick; a.legs[1].rotation.z = -kick;
  s.holder.position.x = x;
  s.foam.material.opacity = Math.min(0.75, v / 3);
  s.foam.scale.set(1 + v * 0.4, 1, 1);
}

export function startSwim({ players, container, isPaused, onDone }) {
  const stage = createStage(container);
  buildPool(stage.scene);
  stage.hint.innerHTML = 'Tap <b>◀</b> <b>▶</b> to swim · press <b>A</b> in the <span style="color:#7cdc6b">green</span> to breathe for a boost · don\'t spam A!';

  // Breath meter: zones from ZONES, a marker sweeps left to right while the swimmer must breathe.
  const makeMeter = (color) => {
    const el = stage.addTag(color, 'breath-meter');
    let start = 0;
    el.innerHTML = ZONES.map(([end, zone]) => {
      const html = `<i class="${zone}" style="width:${(end - start) * 100}%"></i>`;
      start = end;
      return html;
    }).join('') + '<b class="marker"></b>';
    return { el, marker: el.querySelector('.marker') };
  };
  const FEEDBACK_ZONE = { 'BOOST!': 'green', 'OK breath': 'yellow', 'Bad breath!': 'red', 'Choking!': 'red', 'Out of breath!': 'red' };

  const swimmers = players.map(p => {
    const s = makeSwimmer(p.color, SKIN[p.slot], laneZ(p.slot));
    stage.scene.add(s.holder);
    return { ...newSwimmer(p.slot), player: p, s, tag: stage.addTag(p.color), meter: makeMeter(p.color) };
  });
  const bySlot = Object.fromEntries(swimmers.map(r => [r.slot, r]));

  let t = -COUNTDOWN, firstFinish = null, ended = false;

  stage.loop((dt) => {
    if (!isPaused() && !ended) {
      t += dt;
      for (const r of swimmers) step(r, dt, t);
      firstFinish ??= swimmers.some(r => r.finish !== null) ? t : null;
      if (swimmers.every(r => r.finish !== null) || (firstFinish !== null && t > firstFinish + AFTER_FIRST) || t > MAX_RACE) {
        ended = true;
        setTimeout(showResults, 1500);
      }
    }
    stage.big.textContent = countdownText(t);
    stage.hint.hidden = t > 4;

    for (const r of swimmers) {
      poseSwimmer(r.s, r.x, r.v, dt);
      const name = r.player.name;
      const breathe = r.needBreath && r.finish === null;
      const showFeedback = t - r.feedbackT < 0.7 && r.finish === null;
      r.tag.classList.toggle('alert', breathe);
      r.tag.dataset.fb = showFeedback && !breathe ? FEEDBACK_ZONE[r.feedback] || '' : '';
      const text = r.finish !== null ? `${name} ${r.finish.toFixed(2)}s`
        : breathe ? `${name} · BREATHE (A)`
        : r.falseStart && t < 1 ? `${name} false start!`
        : showFeedback ? `${name} · ${r.feedback}` : name;
      stage.placeTag(r.tag, r.x - 0.5, 1.2, laneZ(r.slot), text);

      const f = meter(r, t);
      r.meter.el.hidden = !breathe || f >= 1;
      if (!r.meter.el.hidden) {
        r.meter.marker.style.left = f * 100 + '%';
        stage.placeEl(r.meter.el, r.x - 0.5, 1.2, laneZ(r.slot), 40); // just above the name tag
      }
    }
    return { x: Math.min(Math.max(...swimmers.map(r => r.x)), DIST), cheer: t > 0 };
  });

  function showResults() {
    const results = rank(swimmers);
    stage.showResults('50m Freestyle', results.map(res => {
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
