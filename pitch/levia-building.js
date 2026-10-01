// Levia building preview: a 3D model of a prospect's building, generated from the trial chat answers.
// Floors come from the same floor-plan data as the app; live state (cleaned rooms, robot, lost items) is read every frame.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const K = .04, FH = 3.2;              // plan units → metres-ish, floor spacing
const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

export function mountBuilding(host, opts) {
  const { floors, labelsEl, getState } = opts;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0D1A22');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), .04).texture;
  scene.environmentIntensity = .5;
  scene.add(new THREE.HemisphereLight('#CFE6F2', '#0D1A22', .9));
  const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(6, 14, 9); scene.add(sun);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = .45; controls.minDistance = 8; controls.maxDistance = 45; controls.maxPolarAngle = Math.PI * .48;
  const homeCam = () => { const n = keys.length; camera.position.set(12 + n * 1.3, 8 + n * 2.6, 17 + n * 1.6); controls.target.set(0, (n - 1) * FH / 2, 0); };
  const keys = Object.keys(floors), W = 350, D = 200;
  const X = x => (x - W / 2) * K, Z = y => (y - D / 2) * K;
  const wallM = new THREE.MeshStandardMaterial({ color: '#C9D6DD', roughness: .6, transparent: true, opacity: .55 });
  const glassM = new THREE.MeshStandardMaterial({ color: '#8FD6FF', roughness: .1, transparent: true, opacity: .22 });
  const stairM = new THREE.MeshStandardMaterial({ color: '#7E909A', roughness: .7 });
  const groups = {}, roomMeshes = {}, labels = [], fadeMats = new Set([wallM, glassM, stairM]);
  const pts = [];                       // scan point cloud samples
  const sample = (n, f) => { for (let i = 0; i < n; i++) pts.push(f()); };

  keys.forEach((fk, i) => {
    const g = new THREE.Group(); g.position.y = i * FH; scene.add(g); groups[fk] = g;
    for (const r of floors[fk].rooms) {
      const atrium = r.id.startsWith('atr'), cx = X(r.x + r.w / 2), cz = Z(r.y + r.h / 2), w = r.w * K, d = r.h * K;
      if (!(atrium && i > 0)) {         // the atrium is a void above the ground floor
        const m = new THREE.MeshStandardMaterial({ color: '#2B3A44', roughness: .8, transparent: true }); fadeMats.add(m);
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w - .04, .14, d - .04), m); slab.position.set(cx, -.07, cz); g.add(slab);
        roomMeshes[r.id] = m;
        sample(Math.round(w * d * 9), () => [cx + (Math.random() - .5) * w, i * FH + .01, cz + (Math.random() - .5) * d]);
      } else {                          // glass railing around the void
        for (const [px, pz, rw, rd] of [[cx, Z(r.y) + .02, w, .04], [cx, Z(r.y + r.h) - .02, w, .04], [X(r.x + r.w) - .02, cz, .04, d]]) {
          const rail = new THREE.Mesh(new THREE.BoxGeometry(rw, .9, rd), glassM); rail.position.set(px, .45, pz); g.add(rail); }
      }
      if (atrium && i < keys.length - 1) {  // stairs rising through the atrium
        for (let s = 0; s < 14; s++) { const st = new THREE.Mesh(new THREE.BoxGeometry(w * .55, .08, .32), stairM); st.position.set(cx + w * .15, (s + 1) * FH / 15 - .04, Z(r.y + 12) + s * .4); g.add(st); }
      }
      if (r.name) { const lab = document.createElement('div'); lab.className = 'rlabel'; lab.textContent = r.name; labelsEl.appendChild(lab);
        labels.push({ d: lab, fk, v: new THREE.Vector3(cx, i * FH + .5, cz) }); }
    }
    // walls: back, sides, partitions with a door gap; the front wall stays low so you can see in (cutaway)
    const wall = (x1, z1, x2, z2, h) => { const len = Math.hypot(x2 - x1, z2 - z1), m = new THREE.Mesh(new THREE.BoxGeometry(len, h, .08), wallM);
      m.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2); m.rotation.y = -Math.atan2(z2 - z1, x2 - x1); g.add(m);
      sample(Math.round(len * h * 7), () => { const t = Math.random(); return [x1 + (x2 - x1) * t, i * FH + Math.random() * h, z1 + (z2 - z1) * t]; }); };
    wall(X(0), Z(0), X(W), Z(0), 1.1); wall(X(0), Z(0), X(0), Z(D), 1.1); wall(X(W), Z(0), X(W), Z(D), 1.1); wall(X(0), Z(D), X(W), Z(D), .25);
    for (const r of floors[fk].rooms.slice(1)) { wall(X(r.x), Z(0), X(r.x), Z(80), 1.1); wall(X(r.x), Z(120), X(r.x), Z(D), 1.1); }
    const tag = document.createElement('div'); tag.className = 'rlabel floor'; tag.textContent = floors[fk].name; labelsEl.appendChild(tag);
    labels.push({ d: tag, fk, v: new THREE.Vector3(X(0) - .4, i * FH + .2, Z(D)) });
  });
  homeCam();
  // the Hub on the ground floor
  const hub = new THREE.Mesh(new THREE.BoxGeometry(.7, .9, .55), new THREE.MeshStandardMaterial({ color: '#E8EEF1', roughness: .35 })); hub.position.set(X(137), .45, Z(163)); groups[keys[0]].add(hub);
  const hubLed = new THREE.Mesh(new THREE.BoxGeometry(.5, .04, .02), new THREE.MeshBasicMaterial({ color: '#4FC3F7' })); hubLed.position.set(X(137), .8, Z(163) + .28); groups[keys[0]].add(hubLed);
  fadeMats.add(hub.material);
  // robot marker + lost item marker
  const accent = new THREE.Color('#4FC3F7');
  const bot = new THREE.Group(); scene.add(bot);
  const botBody = new THREE.Mesh(new THREE.CylinderGeometry(.28, .3, .16, 32), new THREE.MeshStandardMaterial({ color: '#F4F7F9', roughness: .3 })); botBody.position.y = .1; bot.add(botBody);
  const botRing = new THREE.Mesh(new THREE.TorusGeometry(.3, .03, 8, 40), new THREE.MeshBasicMaterial({ color: accent })); botRing.rotation.x = Math.PI / 2; botRing.position.y = .14; bot.add(botRing);
  const halo = new THREE.Mesh(new THREE.RingGeometry(.4, .7, 40), new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false })); halo.rotation.x = -Math.PI / 2; halo.position.y = .02; bot.add(halo);
  const botLight = new THREE.PointLight(accent, 4, 4); botLight.position.y = .6; bot.add(botLight);
  const lost = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), new THREE.MeshBasicMaterial({ color: '#F2B24A' })); scene.add(lost);
  const botTag = document.createElement('div'); botTag.className = 'rlabel bot'; labelsEl.appendChild(botTag);

  // scan point cloud: revealed as an expanding LiDAR sphere from the Hub
  const origin = new THREE.Vector3(X(137), .5, Z(163));
  pts.sort((a, b) => origin.distanceToSquared(new THREE.Vector3(...a)) - origin.distanceToSquared(new THREE.Vector3(...b)));
  const cloud = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3)),
    new THREE.PointsMaterial({ color: '#4FC3F7', size: .06, transparent: true, opacity: .9, depthWrite: false }));
  scene.add(cloud);
  let scanT = 0, floorSel = 'all', active = true, last = performance.now();
  const BASE = new THREE.Color('#2B3A44'), CLEAN = new THREE.Color('#2E8A55'), BOOK = new THREE.Color('#8A2F2A'), tmp = new THREE.Color();

  function setFloor(f) {
    floorSel = f;
    keys.forEach((k, i) => { groups[k].visible = f === 'all' || f === k; });
    if (f === 'all') homeCam(); else { const y = keys.indexOf(f) * FH; controls.target.set(0, y, 0); camera.position.set(10, y + 12, 15); }
  }
  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();
  const v = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const real = (now - last) / 1000; last = now; if (!active) return;
    scanT += Math.min(real, .5);          // wall-clock based, so the scan finishes on time even at a low frame rate
    const scan = ease(scanT / 3.2), built = ease((scanT - 2.6) / 1.2);
    cloud.geometry.setDrawRange(0, Math.floor(pts.length * scan));
    cloud.material.opacity = .9 - .72 * built;
    fadeMats.forEach(m => { m.opacity = (m === wallM ? .55 : m === glassM ? .22 : 1) * built; m.transparent = true; });
    // live state from the app
    const st = getState();
    for (const id in roomMeshes) {
      const p = st.progress[id] || 0;
      tmp.copy(BASE).lerp(CLEAN, p); if (st.booked[id]) tmp.copy(BOOK);
      roomMeshes[id].color.copy(tmp);
    }
    const fi = keys.indexOf(st.robot.floor);
    bot.position.set(X(st.robot.x), fi * FH + (st.robot.state === 'flying' ? 1.4 + Math.sin(now / 300) * .1 : 0), Z(st.robot.y));
    bot.visible = built > .5 && (floorSel === 'all' || floorSel === st.robot.floor);
    halo.scale.setScalar(1 + .25 * Math.sin(now / 250));
    lost.visible = !!st.lost && built > .5 && (floorSel === 'all' || floorSel === st.lost.floor);
    if (st.lost) lost.position.set(X(st.lost.x), keys.indexOf(st.lost.floor) * FH + .15 + Math.sin(now / 300) * .05, Z(st.lost.y));
    botTag.textContent = st.robot.name;
    controls.update(); renderer.render(scene, camera);
    const Wd = host.clientWidth, Hd = host.clientHeight;
    const place = (d, vec, show) => { v.copy(vec).project(camera); d.style.transform = `translate(${(v.x * .5 + .5) * Wd}px, ${(-v.y * .5 + .5) * Hd}px)`; d.style.opacity = show && v.z < 1 ? 1 : 0; };
    labels.forEach(l => place(l.d, l.v, built > .8 && (floorSel === 'all' ? l.d.classList.contains('floor') : floorSel === l.fk)));
    place(botTag, bot.position.clone().add(new THREE.Vector3(0, .6, 0)), bot.visible);
  }
  requestAnimationFrame(frame);
  return {
    setFloor,
    replayScan() { scanT = 0; },
    setActive(b) { active = b; last = performance.now(); },
    setAccent(hex) { accent.set(hex); botRing.material.color.set(hex); halo.material.color.set(hex); botLight.color.set(hex); },
    get scanning() { return scanT < 3.8; },
  };
}
