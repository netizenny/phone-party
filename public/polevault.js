// Pole vault: bar goes up each round, one attempt per player per height, miss = out. Highest cleared wins.
import * as THREE from 'three';
import { newVaulter, input, update, vaultPos, swingX, swingY, rankVault, toBox,
         BOX, ZONE, SWEET, BAR_X, MAT_TOP, START_H, STEP, REL_IDEAL } from './polevault-logic.js';
import { createStage, addTrack, addLineAcross, makeAthlete, poseAthlete, laneZ, LANE_W, SKIN, countdownText, flat, box } from './stadium.js';

const COUNTDOWN = 2.5;  // seconds showing whose turn it is before GO
const POLE_LEN = 4.6;
const SPAN = LANE_W * 4 + 1.2;
const pct = (x, a, b) => ((x - a) / (b - a)) * 100;

function makePanel(player) {
  const el = document.createElement('div');
  el.className = 'vpanel';
  el.style.setProperty('--c', player.color);
  el.innerHTML = `<div class="vname">${player.name}</div>
    <div class="vbar"><div class="vzone" style="left:${pct(BOX - ZONE, -15, BOX)}%;width:${ZONE / (BOX + 15) * 100}%"></div><div class="vfill"></div></div>
    <div class="vbar vswing"><div class="vzone" style="left:${REL_IDEAL[0] / 180 * 100}%;width:${(REL_IDEAL[1] - REL_IDEAL[0]) / 180 * 100}%"></div><div class="vfill"></div></div>
    <div class="vstatus"></div><div class="vbest"></div>`;
  const q = (s) => el.querySelector(s);
  return { el, run: q('.vbar .vfill'), swing: q('.vswing .vfill'), status: q('.vstatus'), best: q('.vbest') };
}

export function startPoleVault({ players, container, isPaused, onDone }) {
  const stage = createStage(container);
  addTrack(stage.scene, -15, BOX + 1);
  addLineAcross(stage.scene, BOX - ZONE, 0.25, '#ffd166');   // yellow: planting counts from here
  addLineAcross(stage.scene, BOX - SWEET, 0.18, '#7cc36b');  // green: best plant spot
  addLineAcross(stage.scene, BOX, 0.4, '#1b2a3a');           // the plant box
  stage.hint.innerHTML = 'Tap <b>A</b>/<b>B</b> to run · <b>▲</b> to plant in the green · <b>▲</b> again near the top to let go';

  // Landing mat, two uprights and the bar.
  stage.scene.add(box(5, MAT_TOP, SPAN, flat('#1d8cf8'), BAR_X + 1, MAT_TOP / 2, 0));
  for (const s of [-1, 1]) stage.scene.add(box(0.12, 7.5, 0.12, flat('#ffffff'), BAR_X, 3.75, s * SPAN / 2));
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, SPAN, 8).rotateX(Math.PI / 2), flat('#ffd166'));
  bar.position.x = BAR_X;
  bar.castShadow = true;
  stage.scene.add(bar);
  const heightTag = stage.addTag('#1b2a3a');

  const panels = document.createElement('div');
  panels.className = 'vpanels';
  container.appendChild(panels);

  const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6).rotateZ(-Math.PI / 2); // 1 m long along +x, scaled per frame
  const vaulters = players.map(p => {
    const a = makeAthlete(p.color, SKIN[p.slot]);
    a.g.position.z = laneZ(p.slot);
    const pole = new THREE.Mesh(poleGeo, flat('#f0b429'));
    pole.castShadow = true;
    stage.scene.add(a.g, pole);
    const panel = makePanel(p);
    panels.appendChild(panel.el);
    return { ...newVaulter(p.slot, START_H), player: p, a, pole, panel, best: null, outRound: null, tag: stage.addTag(p.color) };
  });
  const bySlot = Object.fromEntries(vaulters.map(r => [r.slot, r]));

  let level = 0, queue = [...vaulters], t = -COUNTDOWN, playing = true, msg = '', barFall = null;
  const barH = () => START_H + level * STEP;
  const active = () => queue[0];

  // Pole from the plant box up to the vaulter's hands, in hand while running, falling after the release.
  function placePole(r) {
    const z = laneZ(r.slot);
    const set = (x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1;
      r.pole.position.set((x1 + x2) / 2, (y1 + y2) / 2, z + 0.35);
      r.pole.rotation.z = Math.atan2(dy, dx);
      r.pole.scale.x = Math.hypot(dx, dy);
    };
    if (!r.planted) return set(r.x - 0.2, 1.0, r.x + POLE_LEN * 0.9, 1.9);
    if (!r.vault) return set(BOX, 0.1, r.a.g.position.x + 0.15, r.a.g.position.y + 1.4);
    // Pole stays planted and tips back after the release.
    const tf = Math.max(0, (r === active() ? t : r.vault.total + r.vault.t0) - r.vault.t0);
    const ang = Math.min(Math.PI * 0.97, Math.atan2(r.vault.y0 + 1.4 - 0.1, r.vault.x0 - BOX) + tf * 1.6);
    set(BOX, 0.1, BOX + Math.cos(ang) * POLE_LEN, 0.1 + Math.sin(ang) * POLE_LEN);
  }

  // Returns the vaulter's position for the camera: { x, y }.
  function poseVaulter(r, dt, isActive) {
    const a = r.a;
    if (!r.planted) {
      poseAthlete(a, r.x, r.v, isActive ? dt : 0);
      a.g.rotation.z = 0;
      return { x: r.x, y: 0 };
    }
    const tf = isActive ? t - (r.vault?.t0 ?? 0) : r.vault.total;
    const { x, y, landed } = r.vault ? vaultPos(r.vault, tf) : { x: swingX(r.theta), y: swingY(r.theta, r.hBase), landed: false };
    poseAthlete(a, x, 0, 0, true);
    // Body swings feet-up on the pole, then rights itself on the way down.
    const flip = r.vault ? 2.4 * (1 - Math.min(1, Math.max(0, (tf - r.vault.tUp * 0.6) / (r.vault.total - r.vault.tUp * 0.6)))) : 2.4 * Math.min(r.theta, 150) / 150;
    a.g.rotation.z = flip;
    a.g.position.y = Math.max(0, y - 0.9) + (landed ? 0.1 : 0);
    return { x, y };
  }

  function drawPanel(r, pos) {
    const { panel } = r, isActive = r === active(), out = r.outRound !== null;
    panel.el.classList.toggle('active', isActive);
    panel.el.classList.toggle('out', out);
    panel.run.style.width = Math.min(100, (r.x + 15) / (BOX + 15) * 100) + '%';
    panel.swing.style.width = (r.planted ? Math.min(180, r.theta) / 180 * 100 : 0) + '%';
    const metres = toBox(r);
    panel.el.dataset.state = r.result === 'clear' ? 'good' : r.result === 'miss' ? 'bad'
      : !r.planted && metres <= ZONE && isActive ? 'go' : '';
    panel.status.textContent =
      out ? 'Out'
      : r.result === 'clear' ? (pos.landed ? 'Cleared!' : 'Vaulting…')
      : r.result === 'miss' ? (pos.landed || !r.vault ? 'Miss' : 'Vaulting…')
      : !isActive ? 'Waiting…'
      : t < 0 ? 'Your turn – get ready'
      : r.planted ? 'Let go near the top!'
      : metres <= ZONE ? 'PLANT ▲ NOW' : `Box in ${metres.toFixed(1)} m`;
    panel.best.textContent = r.best !== null ? `Best ${r.best.toFixed(2)} m` : '';
  }

  stage.loop((dt) => {
    const cur = active();
    if (!isPaused() && playing) {
      t += dt;
      update(cur, dt, t);
      const landed = cur.vault && t - cur.vault.t0 >= cur.vault.total;
      if (cur.result !== null && (landed || !cur.vault)) {
        playing = false;
        if (cur.result === 'clear') { msg = `CLEARED ${barH().toFixed(2)} m!`; cur.best = barH(); }
        else { msg = `MISS! ${cur.player.name} is out`; cur.outRound = level + 1; }
        if (cur.result === 'miss' && cur.vault && cur.vault.peak < barH() + 0.05) barFall = 0; // bar comes down with them
        setTimeout(nextTurn, 2200);
      }
    }
    if (barFall !== null) { barFall += dt; bar.position.y = Math.max(MAT_TOP + 0.05, barH() - 4.9 * barFall * barFall); }
    else bar.position.y = barH();

    let cam = { x: 0, y: 0 };
    for (const r of vaulters) {
      const pos = poseVaulter(r, dt, r === cur);
      placePole(r);
      if (r === cur) cam = pos;
      const name = r.player.name;
      const text = r.outRound !== null ? `${name} ✕` : r.best !== null ? `${name} ${r.best.toFixed(2)} m` : name;
      stage.placeTag(r.tag, pos.x, Math.max(2, pos.y + 0.9) + 0.6, laneZ(r.slot), text);
      drawPanel(r, pos);
    }
    stage.placeTag(heightTag, BAR_X, barH() + 0.2, SPAN / 2, `${barH().toFixed(2)} m`);

    const showMsg = t >= 0 && msg && !playing;
    stage.big.classList.toggle('foul', showMsg && cur.result === 'miss');
    stage.big.textContent = t < 0 ? `${barH().toFixed(2)} m: ${cur.player.name}` : showMsg ? msg : countdownText(t);
    stage.hint.hidden = level > 0 || t > 3;
    return { x: Math.min(cam.x, BOX + 1), lift: Math.max(0, cam.y) * 1.3, cheer: cur.result === 'clear' };
  });

  function nextTurn() {
    queue.shift();
    if (!queue.length) { // round over: bar goes up for whoever is still in
      level++;
      queue = vaulters.filter(r => r.outRound === null);
    }
    if (!queue.length) { panels.hidden = true; return showResults(); }
    const r = active();
    Object.assign(r, newVaulter(r.slot, barH()));
    r.a.g.rotation.z = 0;
    t = -COUNTDOWN;
    msg = '';
    barFall = null;
    playing = true;
  }

  function showResults() {
    const results = rankVault(vaulters);
    stage.showResults('Pole Vault', results.map(res => {
      const p = bySlot[res.slot].player;
      return { place: res.best !== null ? res.place : '–', name: p.name, color: p.color,
               text: res.best !== null ? res.best.toFixed(2) + ' m' : 'No height' };
    }), () => onDone(results));
  }

  return {
    input(slot, b, down) { if (slot === active().slot) input(active(), b, down, t); }, // only the vaulter's phone counts
    stop: stage.dispose,
  };
}
