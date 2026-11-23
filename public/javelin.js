// Javelin: 3 rounds, players take turns one at a time in their own lane, best throw counts.
import * as THREE from 'three';
import { newThrower, input, update, rankBest, toLine, LINE, G, RELEASE_H, ROUNDS, IDEAL, WARN_AT } from './javelin-logic.js';
import { createStage, addTrack, addLineAcross, makeAthlete, poseAthlete, laneZ, SKIN, countdownText, flat, box } from './stadium.js';

const COUNTDOWN = 2.5; // seconds showing whose turn it is before GO
const DANGER_M = 4;    // panel turns red this close to the line…
const DANGER_S = 0.8;  // …or this many seconds away at current speed

function makeJavelin() {
  const geo = new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6);
  geo.rotateZ(-Math.PI / 2); // lie along +x
  const m = new THREE.Mesh(geo, flat('#d9dee4'));
  m.castShadow = true;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 6).rotateZ(-Math.PI / 2), flat('#e63946'));
  tip.position.x = 1.45;
  m.add(tip);
  return m;
}

// Red flag that pops up on the foul line in a lane.
function makeFlag(z) {
  const g = new THREE.Group();
  g.add(box(0.06, 1.6, 0.06, flat('#ffffff'), 0, 0.8, 0), box(0.04, 0.5, 0.7, flat('#e63946'), 0, 1.35, 0.38));
  g.position.set(LINE, 0, z);
  g.visible = false;
  return g;
}

// Angle meter: quarter circle 0–90°, green band = ideal angles, needle = current angle.
const CX = 8, CY = 92, R = 84;
const pt = (deg) => [CX + R * Math.cos(deg * Math.PI / 180), CY - R * Math.sin(deg * Math.PI / 180)];
const GAUGE = `<svg class="gauge" viewBox="0 0 100 100" aria-hidden="true">
  <path d="M${CX},${CY} L${pt(0)} A${R},${R} 0 0,0 ${pt(90)} Z" fill="#e9eef3"/>
  <path d="M${CX},${CY} L${pt(IDEAL[0])} A${R},${R} 0 0,0 ${pt(IDEAL[1])} Z" fill="#7cc36b"/>
  <line class="needle" x1="${CX}" y1="${CY}" x2="${pt(0)[0]}" y2="${pt(0)[1]}" stroke="#1b2a3a" stroke-width="5" stroke-linecap="round"/>
  <text class="deg" x="96" y="94" text-anchor="end">0°</text>
</svg>`;

function makePanel(player) {
  const el = document.createElement('div');
  el.className = 'jpanel';
  el.style.setProperty('--c', player.color);
  el.innerHTML = `<div class="jname">${player.name}</div>${GAUGE}
    <div class="jbar"><div class="jfill"></div><div class="jwarn" style="left:${(1 - WARN_AT / (LINE + 15)) * 100}%"></div></div>
    <div class="jstatus"></div><div class="jbest"></div>`;
  const q = (s) => el.querySelector(s);
  return { el, needle: q('.needle'), deg: q('.deg'), fill: q('.jfill'), status: q('.jstatus'), best: q('.jbest') };
}

export function startJavelin({ players, container, isPaused, onDone }) {
  const stage = createStage(container);
  addTrack(stage.scene, -15, LINE);
  addLineAcross(stage.scene, LINE - WARN_AT, 0.25, '#ffd166'); // yellow warning line
  addLineAcross(stage.scene, LINE, 0.4);
  for (let d = 10; d <= 100; d += 10) addLineAcross(stage.scene, LINE + d, 0.08, d % 50 ? '#e8f5e0' : '#ffffff');
  stage.hint.innerHTML = 'Tap <b>A</b>/<b>B</b> to run · hold <b>▲</b> to aim · let go before the line!';

  const panels = document.createElement('div');
  panels.className = 'jpanels';
  container.appendChild(panels);

  const throwers = players.map(p => {
    const a = makeAthlete(p.color, SKIN[p.slot]);
    a.g.position.z = laneZ(p.slot);
    const jav = makeJavelin(), flag = makeFlag(laneZ(p.slot));
    stage.scene.add(a.g, jav, flag);
    const panel = makePanel(p);
    panels.appendChild(panel.el);
    return { ...newThrower(p.slot), player: p, a, jav, flag, panel, best: null, foulShown: false, tag: stage.addTag(p.color) };
  });
  const bySlot = Object.fromEntries(throwers.map(r => [r.slot, r]));

  // Turn-based: one thrower at a time in slot order, everyone once per round.
  let round = 1, turn = 0, t = -COUNTDOWN, playing = true, foulMsg = '', foulUntil = 0;
  const active = () => throwers[turn];

  // Javelin position and tilt: in hand, flying, or stuck in the grass.
  function placeJavelin(r) {
    const z = laneZ(r.slot) + 0.35;
    if (!r.flight) {
      r.jav.position.set(r.x - 0.2, 1.8, z);
      r.jav.rotation.z = r.aiming ? r.angle * Math.PI / 180 : 0.15;
      return { x: r.x, y: 0, landed: false };
    }
    // Only the active throw is in the air; earlier throws stay stuck where they landed.
    const f = r.flight, tf = r === active() ? Math.min(t - f.t0, f.time) : f.time;
    const y = Math.max(0.3, RELEASE_H + f.vy * tf - 0.5 * G * tf * tf);
    r.jav.position.set(f.x0 + f.vx * tf, y, z);
    r.jav.rotation.z = Math.atan2(f.vy - G * tf, f.vx);
    return { x: r.jav.position.x, y, landed: tf >= f.time };
  }

  function drawPanel(r, landed) {
    const { panel } = r, isActive = r === active();
    panel.el.classList.toggle('active', isActive);
    const [nx, ny] = pt(r.angle);
    panel.needle.setAttribute('x2', nx);
    panel.needle.setAttribute('y2', ny);
    panel.deg.textContent = Math.round(r.angle) + '°';
    panel.fill.style.width = Math.min(100, (r.x + 15) / (LINE + 15) * 100) + '%';

    const { metres, seconds } = toLine(r);
    const state = r.result === 'foul' ? 'foul'
      : r.result !== null ? 'done'
      : metres < DANGER_M || seconds < DANGER_S ? 'danger'
      : metres < WARN_AT ? 'warn' : '';
    panel.el.dataset.state = state;
    panel.el.classList.toggle('ideal', r.angle >= IDEAL[0] && r.angle <= IDEAL[1]);
    panel.status.textContent =
      state === 'foul' ? 'FOUL!'
      : state === 'done' ? (landed ? r.result.toFixed(2) + ' m' : 'Throwing…')
      : !isActive ? 'Waiting…'
      : t < 0 ? 'Your turn – get ready'
      : `Line in ${metres.toFixed(1)} m` + (seconds < 9 ? ` · ${seconds.toFixed(1)} s` : '');
    panel.best.textContent = r.best !== null ? `Best ${r.best.toFixed(2)} m` : '';
  }

  stage.loop((dt) => {
    const cur = active();
    if (!isPaused() && playing) {
      t += dt;
      update(cur, dt, t);
      if (cur.result !== null && (!cur.flight || t - cur.flight.t0 > cur.flight.time)) {
        playing = false;
        setTimeout(nextTurn, 2000);
      }
    }
    if (cur.result === 'foul' && !cur.foulShown) {
      cur.foulShown = true;
      cur.flag.visible = true;
      foulMsg = `FOUL! ${cur.player.name}`;
      foulUntil = t + 1.5;
    }

    let camX = 0, lift = 0;
    for (const r of throwers) {
      poseAthlete(r.a, r.x, r.v, r === cur ? dt : 0, typeof r.result === 'number' && r.v < 2);
      const j = placeJavelin(r);
      if (r === cur) { camX = j.x; if (r.flight && !j.landed) lift = j.y; }
      const name = r.player.name;
      const text = r.result === 'foul' ? `${name} FOUL`
        : r.result !== null && j.landed ? `${name} ${r.result.toFixed(2)} m` : name;
      stage.placeTag(r.tag, j.x, (r.flight ? j.y : 2) + 0.6, laneZ(r.slot), text);
      drawPanel(r, j.landed);
    }

    const showFoul = t >= 0 && t < foulUntil;
    stage.big.classList.toggle('foul', showFoul);
    stage.big.textContent = t < 0 ? `Round ${round}/${ROUNDS}: ${cur.player.name}` : showFoul ? foulMsg : countdownText(t);
    stage.hint.hidden = round > 1 || t > 3;
    return { x: camX, lift, cheer: typeof cur.result === 'number' };
  });

  function nextTurn() {
    const done = active();
    if (typeof done.result === 'number') done.best = Math.max(done.best ?? 0, done.result);
    if (++turn === throwers.length) { turn = 0; round++; }
    if (round > ROUNDS) { panels.hidden = true; return showResults(); }
    const r = active();
    Object.assign(r, newThrower(r.slot), { foulShown: false }); // their old javelin comes back to hand
    r.flag.visible = false;
    t = -COUNTDOWN;
    foulUntil = 0;
    playing = true;
  }

  function showResults() {
    const results = rankBest(throwers);
    stage.showResults('Javelin', results.map(res => {
      const p = bySlot[res.slot].player;
      return { place: res.best !== null ? res.place : '–', name: p.name, color: p.color,
               text: res.best !== null ? res.best.toFixed(2) + ' m' : 'No mark' };
    }), () => onDone(results));
  }

  return {
    input(slot, b, down) { if (slot === active().slot) input(active(), b, down, t); }, // only the thrower's phone counts
    stop: stage.dispose,
  };
}
