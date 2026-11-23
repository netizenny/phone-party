// Downhill skiing: everyone races at once, each player gets their own split-screen view.
// 1 player = full screen, 2 = left/right halves, 3–4 = quarters (with 3, the spare quarter shows the leaderboard).
import * as THREE from 'three';
import { makeCourse, newSkier, input, step, steer, LEN, HALF_W, CRASH_STUN } from './ski-logic.js';
import { rank } from './sprint-logic.js';
import { createStage, makeAthlete, SKIN, countdownText, box, flat } from './stadium.js';

const COUNTDOWN = 3;
const AFTER_FIRST = 20;  // race ends this long after the first finisher
const MAX_RACE = 90;     // hard stop
const SLOPE = 0.55;      // how steep the mountain looks (~29°)
const SNOW = '#dfeaf3';

const VIEWS = {
  1: [[0, 0, 1, 1]],
  2: [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]],
  3: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  4: [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
};

// All pine trees (course + forest beside the piste) as two instanced meshes.
function addTrees(group, spots) {
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 5), flat('#7a5230'), spots.length);
  const leaves = new THREE.InstancedMesh(new THREE.ConeGeometry(1.1, 2.8, 6), flat('#2f7d4a'), spots.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  spots.forEach(({ x, z, s = 1 }, i) => {
    trunk.setMatrixAt(i, m.makeScale(s, s, s).setPosition(x, 0.4 * s, z));
    leaves.setMatrixAt(i, m.makeScale(s, s, s).setPosition(x, 2.1 * s, z));
    leaves.setColorAt(i, c.set(i % 3 ? '#2f7d4a' : '#3c9a5b'));
  });
  group.add(trunk, leaves);
}

function buildMountain(group, course) {
  const snow = new THREE.Mesh(new THREE.PlaneGeometry(LEN + 300, 200), flat('#f7fafc'));
  snow.rotation.x = -Math.PI / 2; snow.position.x = LEN / 2; group.add(snow);

  // Piste edge markers, start and finish lines, finish arch.
  for (let x = 0; x <= LEN; x += 10)
    for (const z of [-HALF_W - 0.6, HALF_W + 0.6]) group.add(box(0.12, 1.2, 0.12, flat(x % 20 ? '#1d8cf8' : '#e63946'), x, 0.6, z));
  for (const [x, col] of [[0, '#1d8cf8'], [LEN, '#e63946']]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, HALF_W * 2), flat(col));
    line.rotation.x = -Math.PI / 2; line.position.set(x, 0.02, 0); group.add(line);
  }
  group.add(box(0.4, 5, 0.4, flat('#1b2a3a'), LEN, 2.5, -HALF_W), box(0.4, 5, 0.4, flat('#1b2a3a'), LEN, 2.5, HALF_W),
            box(0.4, 1, HALF_W * 2, flat('#e63946'), LEN, 5, 0));

  // Forest beside the piste so it reads as a mountain run, then the course trees.
  const forest = [];
  for (let x = -20; x < LEN + 120; x += 3) for (const side of [-1, 1])
    forest.push({ x: x + Math.random() * 3, z: side * (HALF_W + 3 + Math.random() * 30), s: 1 + Math.random() * 0.8 });
  addTrees(group, [...course, ...forest]);
}

function makeSkier(color, skin) {
  const a = makeAthlete(color, skin);
  a.g.rotation.z = -0.35;                 // tucked forward
  a.legs[0].rotation.z = a.legs[1].rotation.z = 0.5;
  a.arms[0].rotation.z = a.arms[1].rotation.z = 0.9;
  const holder = new THREE.Group();
  holder.add(a.g);
  for (const z of [-0.14, 0.14]) holder.add(box(1.7, 0.05, 0.12, flat(color), 0.1, 0.03, z));
  return { holder, a };
}

function makeHud(container, rect, player) {
  const el = document.createElement('div');
  el.className = 'ski-view';
  Object.assign(el.style, { left: rect[0] * 100 + '%', top: rect[1] * 100 + '%', width: rect[2] * 100 + '%', height: rect[3] * 100 + '%' });
  if (player) {
    el.style.setProperty('--c', player.color);
    el.innerHTML = `<div class="ski-top"><b>${player.name}</b><span class="time"></span><span class="speed"></span></div>
      <div class="ski-bar"><div></div></div><div class="ski-msg"></div>`;
  } else el.innerHTML = '<div class="ski-board"></div>';
  container.appendChild(el);
  return el;
}

export function startSki({ players, container, isPaused, onDone }) {
  const stage = createStage(container, { stadium: false, shadows: false });
  stage.scene.background = new THREE.Color(SNOW);
  stage.scene.fog = new THREE.Fog(SNOW, 40, 170);
  stage.hint.innerHTML = 'Hold <b>◀</b> <b>▶</b> to steer · dodge the trees!';

  // Everything sits in one group tilted down the mountain; game coords stay flat inside it.
  const world = new THREE.Group();
  world.rotation.z = -Math.atan(SLOPE);
  stage.scene.add(world);
  const course = makeCourse();
  buildMountain(world, course);
  world.updateMatrixWorld(true);
  const toWorld = (x, y, z) => world.localToWorld(new THREE.Vector3(x, y, z));

  // Snowy peaks across the valley below the finish, outside the fog, so the drop reads as a mountain.
  const bottom = toWorld(LEN, 0, 0);
  for (let i = 0; i < 9; i++) {
    const h = 160 + (i % 3) * 60, x = bottom.x + 600 + (i % 2) * 150, z = (i - 4) * 160, y = bottom.y - 150;
    const rock = new THREE.Mesh(new THREE.ConeGeometry(h * 0.8, h, 6), new THREE.MeshLambertMaterial({ color: '#8fa3b8', flatShading: true, fog: false }));
    const cap = new THREE.Mesh(new THREE.ConeGeometry(h * 0.32, h * 0.4, 6), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, fog: false }));
    rock.position.set(x, y + h / 2, z);
    cap.position.set(x, y + h * 0.8 + 0.5, z);
    stage.scene.add(rock, cap);
  }

  const rects = VIEWS[Math.min(players.length, 4)] || VIEWS[1];
  const skiers = players.map((p, i) => {
    const s = makeSkier(p.color, SKIN[p.slot]);
    world.add(s.holder);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1500); // far enough to see the peaks
    stage.scene.add(camera);
    const r = { ...newSkier(p.slot), player: p, s, camera, rect: rects[i], hud: makeHud(container, rects[i], p) };
    r.camZ = r.z; // start the chase camera right behind its own skier
    return r;
  });
  const bySlot = Object.fromEntries(skiers.map(r => [r.slot, r]));
  const board = players.length === 3 ? { camera: new THREE.PerspectiveCamera(45, 1, 0.1, 600), rect: rects[3], hud: makeHud(container, rects[3]) } : null;

  let t = -COUNTDOWN, firstFinish = null, ended = false;

  stage.loop((dt) => {
    if (!isPaused() && !ended) {
      t += dt;
      for (const r of skiers) step(r, dt, t, course);
      firstFinish ??= skiers.some(r => r.finish !== null) ? t : null;
      if (skiers.every(r => r.finish !== null) || (firstFinish !== null && t > firstFinish + AFTER_FIRST) || t > MAX_RACE) {
        ended = true;
        setTimeout(showResults, 1500);
      }
    }
    stage.big.textContent = countdownText(t);
    stage.hint.hidden = t > 3;

    const order = [...skiers].sort((a, b) => (a.finish ?? Infinity) - (b.finish ?? Infinity) || b.x - a.x);
    for (const r of skiers) {
      const { holder, a } = r.s;
      holder.position.set(r.x, 0, r.z);
      holder.rotation.y = -Math.atan2(r.vz, Math.max(r.v, 1));       // point where you're going
      const crashed = t - r.crashT < CRASH_STUN;
      a.g.rotation.x = crashed ? 1.3 : -steer(r, t) * 0.35;           // fall over, or lean into the turn

      // Chase camera behind and above, kept upright (world up) so the hill visibly drops away ahead.
      r.camZ += (r.z - r.camZ) * Math.min(1, dt * 4);
      r.camera.position.copy(toWorld(r.x - 7, 0, r.camZ)).y += 4.5;
      r.camera.lookAt(toWorld(r.x + 10, 0, r.camZ));

      const q = (s) => r.hud.querySelector(s);
      const time = r.finish ?? Math.max(0, t);
      q('.time').textContent = time.toFixed(2) + 's';
      q('.speed').textContent = Math.round(r.v * 3.6) + ' km/h · ' + (order.indexOf(r) + 1) + getOrdinal(order.indexOf(r) + 1);
      q('.ski-bar div').style.width = Math.min(100, r.x / LEN * 100) + '%';
      const msg = r.finish !== null ? `FINISH! ${r.finish.toFixed(2)}s` : crashed ? 'CRASH!' : r.falseStart && t < 1 ? 'False start!' : '';
      q('.ski-msg').textContent = msg;
      q('.ski-msg').dataset.kind = r.finish !== null ? 'finish' : crashed ? 'crash' : '';
    }

    const views = skiers.map(r => ({ camera: r.camera, rect: r.rect }));
    if (board) {
      const lead = order[0];
      board.camera.position.copy(toWorld(lead.x - 18, 22, 22));
      board.camera.lookAt(toWorld(lead.x + 8, 0, 0));
      views.push(board);
      board.hud.firstElementChild.innerHTML = '<b>Standings</b>' + order.map((r, i) =>
        `<div style="--c:${r.player.color}">${i + 1}. ${r.player.name} <span>${r.finish !== null ? r.finish.toFixed(2) + 's' : Math.round(r.x) + ' m'}</span></div>`).join('');
    }
    return { x: order[0].x, views };
  });

  function showResults() {
    const results = rank(skiers);
    container.querySelectorAll('.ski-view').forEach(el => el.hidden = true);
    stage.showResults('Downhill', results.map(res => {
      const r = bySlot[res.slot];
      return { place: res.place, name: r.player.name, color: r.player.color,
               text: r.finish !== null ? r.finish.toFixed(2) + ' s' : `DNF (${Math.round(r.x)} m)` };
    }), () => onDone(results));
  }

  return {
    input(slot, b, down) { if (bySlot[slot]) input(bySlot[slot], b, down, t); },
    stop: stage.dispose,
  };
}

const getOrdinal = (n) => (['th', 'st', 'nd', 'rd'][n] || 'th');
