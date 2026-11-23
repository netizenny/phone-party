// Shared 3D stage for every event: renderer, lights, stands, athletes, name tags, countdown and results.
import * as THREE from 'three';

export const LANE_W = 1.6;
export const laneZ = (slot) => (slot - 1.5) * LANE_W;
export const SKIN = ['#f1c27d', '#8d5524', '#e0ac69', '#c68642'];
export const MEDAL = ['🥇', '🥈', '🥉'];
export const countdownText = (t) => (t < 0 ? String(Math.ceil(-t)) : t < 0.8 ? 'GO!' : '');

export const flat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });
export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Red track with white lane lines from x = from to x = to.
export function addTrack(scene, from, to) {
  const len = to - from, cx = (from + to) / 2;
  const track = new THREE.Mesh(new THREE.PlaneGeometry(len, LANE_W * 4 + 1.2), flat('#c8553d'));
  track.rotation.x = -Math.PI / 2; track.position.set(cx, 0.01, 0); track.receiveShadow = true; scene.add(track);
  for (let i = 0; i <= 4; i++) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.06), flat('#ffffff'));
    line.rotation.x = -Math.PI / 2; line.position.set(cx, 0.02, (i - 2) * LANE_W); scene.add(line);
  }
}

// A white line across all four lanes at x.
export function addLineAcross(scene, x, width = 0.3, color = '#ffffff') {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(width, LANE_W * 4), flat(color));
  line.rotation.x = -Math.PI / 2; line.position.set(x, 0.025, 0); scene.add(line);
}

// Chunky low-poly athlete facing +x. Limbs hang from pivots so they can swing.
export function makeAthlete(color, skin) {
  const g = new THREE.Group();
  const body = flat(color), skinM = flat(skin), dark = flat(new THREE.Color(color).multiplyScalar(0.55)), shoe = flat('#ffffff');
  g.add(box(0.34, 0.55, 0.5, body, 0, 1.08, 0));          // vest
  g.add(box(0.36, 0.24, 0.52, dark, 0, 0.74, 0));         // shorts
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 1), skinM);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26, 1), dark);
  hair.scale.set(1, 0.6, 1); hair.position.set(-0.03, 1.7, 0); g.add(hair);
  const limb = (y, z, len, thick, mat, end) => {
    const pivot = new THREE.Group();
    pivot.position.set(0, y, z);
    pivot.add(box(thick, len, thick, mat, 0, -len / 2, 0));
    if (end) pivot.add(box(0.26, 0.1, 0.17, end, 0.05, -len, 0));
    g.add(pivot);
    return pivot;
  };
  const legs = [limb(0.66, -0.13, 0.62, 0.17, skinM, shoe), limb(0.66, 0.13, 0.62, 0.17, skinM, shoe)];
  const arms = [limb(1.3, -0.32, 0.5, 0.13, skinM), limb(1.3, 0.32, 0.5, 0.13, skinM)];
  return { g, legs, arms, phase: 0 };
}

// Run cycle scaled by speed. cheer = both arms up.
export function poseAthlete(a, x, v, dt, cheer = false) {
  const speed = Math.min(1, v / 8);
  a.phase += v * dt * 1.7;
  const swing = Math.sin(a.phase) * 0.9 * speed;
  a.g.position.x = x;
  a.g.position.y = Math.abs(Math.sin(a.phase)) * 0.08 * speed;
  a.legs[0].rotation.z = swing; a.legs[1].rotation.z = -swing;
  a.arms[0].rotation.z = cheer ? Math.PI * 0.9 : -swing * 1.1;
  a.arms[1].rotation.z = cheer ? Math.PI * 0.9 : swing * 1.1;
}

// stadium: false skips the grass and the stands (for events with their own world, like skiing).
// shadows: false for events where players spread far apart (the sun's shadow box only covers ~40 m).
export function createStage(container, { stadium = true, shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = shadows;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#bfe3f5');
  scene.fog = new THREE.Fog('#bfe3f5', 50, 160);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
  scene.add(new THREE.HemisphereLight('#ffffff', '#7a9a6a', 2.4));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, far: 80 });
  scene.add(sun, sun.target);

  let crowd = null;
  if (stadium) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), flat('#7cc36b'));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

    // Stands behind the far side, with a crowd of little blocks.
    const from = -30, len = 170, cx = from + len / 2, standZ = -LANE_W * 2 - 4;
    for (let row = 0; row < 4; row++)
      scene.add(box(len, 0.8 * (row + 1), 1.4, flat('#8fa3b8'), cx, 0.4 * (row + 1), standZ - row * 1.4));
    const crowdColors = ['#e63946', '#1d8cf8', '#2ec4b6', '#ffb703', '#ffffff', '#9b5de5', '#f15bb5'];
    const perRow = Math.floor(len / 0.9), count = perRow * 4;
    crowd = new THREE.InstancedMesh(new THREE.BoxGeometry(0.45, 0.6, 0.45), flat('#ffffff'), count);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / perRow), col = i % perRow;
      m.setPosition(from + col * 0.9 + Math.random() * 0.3, 0.8 * (row + 1) + 0.3, standZ - row * 1.4);
      crowd.setMatrixAt(i, m);
      crowd.setColorAt(i, c.set(crowdColors[(Math.random() * crowdColors.length) | 0]));
    }
    scene.add(crowd);
  }

  const ui = document.createElement('div');
  ui.className = 'event-ui';
  ui.innerHTML = `<div class="big"></div><div class="hint"></div><div class="results" hidden></div>`;
  container.appendChild(ui);
  const big = ui.querySelector('.big'), hint = ui.querySelector('.hint'), resultsBox = ui.querySelector('.results');
  const tags = [];

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  let raf, camX = 0, lift = 0;
  const v3 = new THREE.Vector3();

  function dispose() {
    cancelAnimationFrame(raf);
    removeEventListener('resize', resize);
    renderer.dispose();
    container.innerHTML = '';
  }

  return {
    scene, big, hint,

    // A screen element that follows a 3D point; hidden with the other tags when results show.
    addTag(color, className = 'tag') {
      const tag = document.createElement('div');
      tag.className = className;
      tag.style.setProperty('--c', color);
      ui.appendChild(tag);
      tags.push(tag);
      return tag;
    },

    // Bottom-centre of el sits on the 3D point. offsetY lifts it further, in pixels.
    placeEl(el, x, y, z, offsetY = 0) {
      v3.set(x, y, z).project(camera);
      el.style.transform = `translate(${(v3.x + 1) / 2 * container.clientWidth}px, ${(1 - v3.y) / 2 * container.clientHeight - offsetY}px) translate(-50%, -100%)`;
    },

    placeTag(tag, x, y, z, text) {
      this.placeEl(tag, x, y, z);
      tag.textContent = text;
    },

    // update(dt, now) runs each frame and returns where the camera should look: { x, lift, cheer }.
    // lift > 0 pulls the camera back and up (for things in the air).
    // Split screen: return { x, views: [{ camera, rect: [left, top, width, height] }] } with rect in 0..1
    // fractions of the screen; each view is drawn with its own camera.
    loop(update) {
      let last = performance.now();
      const frame = (now) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const target = update(dt, now);
        const k = Math.min(1, dt * 3);
        camX += (target.x - camX) * k;
        lift += ((target.lift || 0) - lift) * k;
        sun.position.set(camX - 15, 30, 20);
        sun.target.position.set(camX, 0, 0);
        if (crowd) crowd.position.y = target.cheer ? Math.abs(Math.sin(now / 120)) * 0.08 : 0;

        if (target.views) {
          const W = container.clientWidth, H = container.clientHeight;
          renderer.setScissorTest(true);
          for (const { camera: cam, rect: [x, y, w, h] } of target.views) {
            const px = [x * W, (1 - y - h) * H, w * W, h * H]; // WebGL counts y from the bottom
            renderer.setViewport(...px);
            renderer.setScissor(...px);
            cam.aspect = px[2] / px[3];
            cam.updateProjectionMatrix();
            renderer.render(scene, cam);
          }
          renderer.setScissorTest(false);
          return;
        }
        camera.position.set(camX - 3 - lift * 0.3, 6.5 + lift * 0.5, 9.5 + lift * 1.3);
        camera.lookAt(camX + 2, 0.6 + lift * 0.4, 0);
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);
    },

    // rows: [{ place, name, color, text }] in finishing order. Names are cleaned by the server.
    showResults(title, rows, onBack) {
      resultsBox.innerHTML = `<h2>${title}</h2>` + rows.map(r =>
        `<div class="row" style="--c:${r.color}"><span>${MEDAL[r.place - 1] || r.place}</span><b>${r.name}</b><span>${r.text}</span></div>`
      ).join('') + `<button>Back to lobby</button>`;
      resultsBox.hidden = false;
      tags.forEach(t => t.hidden = true);
      resultsBox.querySelector('button').onclick = () => { dispose(); onBack(); };
    },

    dispose,
  };
}
