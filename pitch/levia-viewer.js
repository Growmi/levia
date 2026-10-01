// Levia interactive prototype: a 3D model of the robot and its Hub with demo modes and an exploded view.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

export function mountLevia(host, opts = {}) {
  const labelsEl = opts.labelsEl || document.createElement('div'); let active = true;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0D1A22');
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), .04).texture;
  scene.environmentIntensity = .55;
  const camera = new THREE.PerspectiveCamera(32, 1, .05, 100); camera.position.set(2.0, 1.35, 2.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, .45, 0); controls.enableDamping = true; controls.minDistance = 1.6; controls.maxDistance = 8; controls.maxPolarAngle = Math.PI * .48;
  controls.autoRotate = true; controls.autoRotateSpeed = .7;
  scene.add(new THREE.HemisphereLight('#CFE6F5', '#1A2228', .9));
  const key = new THREE.DirectionalLight('#FFF3E2', 2.2); key.position.set(3, 5, 2.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: .5, far: 15 }); scene.add(key);
  const rim = new THREE.DirectionalLight('#7FC8F0', 1.1); rim.position.set(-3, 2, -3); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: '#16242D', roughness: .55, metalness: .1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.PolarGridHelper(5, 16, 10, 64, '#24404E', '#1B313C'); grid.position.y = .002; scene.add(grid);

  // ---------- materials ----------
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...o });
  const shellM = new THREE.MeshPhysicalMaterial({ color: '#E3E7EA', roughness: .32, clearcoat: .7, clearcoatRoughness: .15 });
  const graph = M('#262C31', { roughness: .45, metalness: .4 }), rubber = M('#141718', { roughness: .9 });
  const smoked = new THREE.MeshPhysicalMaterial({ color: '#17242C', roughness: .06, metalness: .35, clearcoat: 1 });
  const led = new THREE.MeshBasicMaterial({ color: new THREE.Color('#4FC3F7').multiplyScalar(1.6), toneMapped: false });
  const add = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // ---------- robot, built as separable parts for the exploded view ----------
  const robot = new THREE.Group(); scene.add(robot);
  const tilt = new THREE.Group(); robot.add(tilt);
  const parts = [];   // { g, off: Vector3, name, desc, anchor }
  const part = (name, desc, off, anchorY = 0) => { const g = new THREE.Group(); tilt.add(g); parts.push({ g, off: new THREE.Vector3(...off), name, desc, anchor: new THREE.Vector3(0, anchorY, 0) }); return g; };
  { const g = part('Body shell', 'Smooth clearcoat shell with a rubber bumper and a blue status ring.', [0, 0, 0], .3);
    add(new THREE.LatheGeometry([[.001, .1], [.36, .1], [.44, .12], [.475, .17], [.485, .25], [.478, .33], [.45, .39], [.38, .43], [.25, .45], [.001, .455]].map(([r, y]) => new THREE.Vector2(r, y)), 64), shellM, g);
    add(new THREE.TorusGeometry(.482, .022, 10, 72), rubber, g, 0, .2, 0).rotation.x = Math.PI / 2;
    add(new THREE.TorusGeometry(.481, .006, 6, 72), led, g, 0, .31, 0).rotation.x = Math.PI / 2;
    for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(.14, .012, .015), graph, g, -.06, .22 + i * .028, sd * .478); }
  { const g = part('LiDAR + 360° sensors', 'Maps every floor in a fast first scan and detects people and obstacles all around.', [0, .55, 0], .6);
    const d = add(new THREE.SphereGeometry(.25, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), smoked, g, 0, .44, 0); d.scale.y = .42;
    add(new THREE.CylinderGeometry(.085, .095, .06, 32), graph, g, 0, .565, 0); add(new THREE.TorusGeometry(.09, .008, 6, 40), led, g, 0, .575, 0).rotation.x = Math.PI / 2; }
  { const g = part('AI camera', 'Recognises doors, people and lost items. Processing happens on the robot.', [.45, 0, 0], .27);
    const b = add(new THREE.CylinderGeometry(.489, .489, .07, 48, 1, true, -.6, 1.2), smoked, g, 0, .27, 0); b.rotation.y = Math.PI / 2; b.material = smoked.clone(); b.material.side = THREE.DoubleSide;
    const l = add(new THREE.CylinderGeometry(.04, .04, .03, 24), graph, g, .48, .27, 0); l.rotation.z = Math.PI / 2; add(new THREE.TorusGeometry(.044, .007, 6, 30), led, g, .495, .27, 0).rotation.y = Math.PI / 2; }
  const rotors = [], blurs = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, cx = Math.cos(a) * .74, cz = Math.sin(a) * .74;
    const g = part(i === 0 ? 'Guarded ducted fans' : '', 'Four shrouded propellers for safe indoor flight between floors.', [Math.cos(a) * .55, .35, Math.sin(a) * .55], .4);
    const boom = add(new THREE.CylinderGeometry(.03, .045, .34, 16), shellM, g, Math.cos(a) * .52, .36, Math.sin(a) * .52); boom.rotation.set(0, -a, Math.PI / 2);
    const o = add(new THREE.CylinderGeometry(.3, .29, .14, 48, 1, true), shellM.clone(), g, cx, .38, cz); o.material.side = THREE.DoubleSide;
    add(new THREE.CylinderGeometry(.278, .272, .135, 48, 1, true), M('#2A2F33', { side: THREE.BackSide }), g, cx, .38, cz);
    add(new THREE.TorusGeometry(.295, .014, 8, 48), shellM, g, cx, .452, cz).rotation.x = Math.PI / 2;
    for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(.57, .012, .016), graph, g, cx, .456, cz).rotation.y = k * Math.PI / 4;
    const rot = new THREE.Group(); rot.position.set(cx, .4, cz); g.add(rot);
    for (let b = 0; b < 3; b++) { const arm = new THREE.Group(); arm.rotation.y = b * Math.PI * 2 / 3; const bl = new THREE.Mesh(new THREE.BoxGeometry(.24, .006, .055), graph); bl.position.x = .13; bl.rotation.x = .28; arm.add(bl); rot.add(arm); }
    rotors.push(rot);
    const blur = new THREE.Mesh(new THREE.CircleGeometry(.26, 40), new THREE.MeshBasicMaterial({ color: '#C9D6DE', transparent: true, opacity: 0, depthWrite: false })); blur.rotation.x = -Math.PI / 2; blur.position.set(cx, .41, cz); g.add(blur); blurs.push(blur);
    parts[parts.length - 1].anchor.set(cx, .45, cz);
  }
  const wheels = [];
  { const g = part('Wheels', 'Floor mode: Levia cleans mainly on wheels to save energy.', [0, -.32, 0], .08);
    for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + i * Math.PI / 2; const w = add(new THREE.CylinderGeometry(.075, .075, .05, 24), rubber, g, Math.cos(a) * .27, .075, Math.sin(a) * .27); w.rotation.x = Math.PI / 2; wheels.push(w); } }
  const brushes = [];
  { const g = part('Side brushes + suction', 'Brushes sweep edges and corners into a strong suction inlet.', [.35, -.42, 0], .04);
    for (const s of [-1, 1]) { const br = new THREE.Group(); br.position.set(.33, .035, s * .28); g.add(br); add(new THREE.CylinderGeometry(.03, .03, .02, 16), graph, br);
      for (let k = 0; k < 5; k++) { const h = new THREE.Group(); h.rotation.y = k * Math.PI * 2 / 5; const t = new THREE.Mesh(new THREE.ConeGeometry(.012, .13, 6), M('#3A3F44')); t.rotation.z = -Math.PI / 2 - .2; t.position.set(.07, -.012, 0); h.add(t); br.add(h); }
      brushes.push(br); }
    add(new THREE.BoxGeometry(.06, .01, .34), M('#0E1113'), g, .12, .056, 0); }
  let mop;
  { const g = part('Mop pad', 'A rotating, water-fed pad washes hard floors after vacuuming.', [-.1, -.62, 0], .02);
    mop = new THREE.Group(); mop.position.set(-.12, .022, 0); g.add(mop); add(new THREE.CylinderGeometry(.27, .27, .018, 40), M('#5B7F96', { roughness: .95 }), mop);
    for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(.5, .004, .02), M('#47697F'), mop, 0, -.01, 0).rotation.y = k * Math.PI / 6; }
  // UV-C lamp: violet glow on the floor in sanitize mode
  const uvDisc = new THREE.Mesh(new THREE.CircleGeometry(.62, 48), new THREE.MeshBasicMaterial({ color: '#9A5CFF', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  uvDisc.rotation.x = -Math.PI / 2; uvDisc.position.set(-.05, .012, 0); tilt.add(uvDisc);
  const uvBar = new THREE.Mesh(new THREE.BoxGeometry(.32, .012, .06), new THREE.MeshBasicMaterial({ color: new THREE.Color('#B48CFF').multiplyScalar(1.8), toneMapped: false })); uvBar.position.set(-.05, .052, 0); tilt.add(uvBar);
  const uvLight = new THREE.PointLight('#8A4DFF', 0, 2, 2); uvLight.position.set(-.05, .1, 0); tilt.add(uvLight);
  let tankLvl;
  { const g = part('Water tank', 'Carries only a small amount of water to stay light; refilled automatically at the Hub.', [-.6, .1, -.25], .37);
    add(new THREE.BoxGeometry(.05, .11, .22), new THREE.MeshPhysicalMaterial({ color: '#BFE4F5', roughness: .05, transparent: true, opacity: .45, depthWrite: false }), g, -.47, .37, -.02);
    tankLvl = add(new THREE.BoxGeometry(.04, 1, .2), M('#1E8FD0', { emissive: '#1876B0', emissiveIntensity: .6 }), g, -.47, .34, -.02); tankLvl.scale.y = .06; }
  { const g = part('Sorted waste bins', 'Dust, paper and plastic stay apart and are emptied at the Hub.', [-.62, .1, .3], .3);
    ['#8A9298', '#3F7FD1', '#E3B53C'].forEach((c, i) => add(new THREE.BoxGeometry(.03, .1, .085), M(c, { roughness: .4 }), g, -.475, .27, .06 + i * .0 + (i - 1) * .1)); }
  { const g = part('Battery pack', 'Target: 6–8 hours of mixed operation. Flight is used only to move between floors.', [0, .02, -.75], .2);
    add(new RoundedBoxGeometry(.34, .09, .22, 3, .02), M('#2E3A42', { metalness: .5, roughness: .35 }), g, 0, .2, 0); add(new THREE.BoxGeometry(.2, .01, .1), led, g, 0, .247, 0); g.visible = false; parts[parts.length - 1].hidden = true; }
  const armG = part('Robotic arm', 'Opens doors and picks up lost items, then folds away on top.', [0, .45, .55], .7);
  const seg1 = add(new THREE.CylinderGeometry(.03, .035, .42, 14), M('#8A949A', { metalness: .7, roughness: .3 }), armG), seg2 = add(new THREE.CylinderGeometry(.026, .03, .38, 14), M('#8A949A', { metalness: .7, roughness: .3 }), armG);
  const elbow = add(new THREE.SphereGeometry(.045, 14, 10), M('#7A848A', { metalness: .7 }), armG), grip = add(new THREE.BoxGeometry(.07, .05, .1), graph, armG);
  const base = add(new THREE.CylinderGeometry(.06, .07, .05, 20), graph, armG, .12, .6, .14);
  const _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  function seg(m, a, b) { _d.subVectors(b, a); const L = _d.length(); m.position.copy(a).addScaledVector(_d, .5); m.scale.set(1, L / (m.geometry.parameters.height), 1); m.quaternion.setFromUnitVectors(_up, _d.normalize()); }
  function poseArm(ext) {   // 0 folded on the dome, 1 reaching forward
    const S = new THREE.Vector3(.12, .62, .14), H = new THREE.Vector3(lerp(-.2, .95, ext), lerp(.62, .55, ext), lerp(.14, .14, ext));
    const E = S.clone().lerp(H, .5); E.y += lerp(.06, .3, ext); seg(seg1, S, E); seg(seg2, E, H); elbow.position.copy(E); grip.position.copy(H);
  }
  // ---------- Hub ----------
  // the Hub: back tower (bins + clean water) and a covered bay that Levia drives into to charge
  const hub = new THREE.Group(); hub.position.set(-2.5, 0, 0); hub.rotation.y = Math.PI / 2; scene.add(hub);
  const hubM = new THREE.MeshPhysicalMaterial({ color: '#C5CCD1', roughness: .4, clearcoat: .4 });
  add(new RoundedBoxGeometry(2.4, 2.1, .7, 4, .08), hubM, hub, 0, 1.05, -2.55);
  ['#8A9298', '#3F7FD1', '#E3B53C'].forEach((c, i) => add(new RoundedBoxGeometry(.5, .6, .08, 2, .03), M(c), hub, -.62 + i * .62, 1.55, -2.19));
  const hubLed = new THREE.Mesh(new THREE.BoxGeometry(1.9, .05, .02), new THREE.MeshBasicMaterial({ color: new THREE.Color('#4FC3F7').multiplyScalar(1.6), toneMapped: false })); hubLed.position.set(0, 1.15, -2.19); hub.add(hubLed);
  add(new THREE.BoxGeometry(2.4, .04, 2.2), M('#2A3136', { roughness: .7 }), hub, 0, .02, -1.1);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(.08, .86, 2.2), hubM, hub, sx * 1.16, .45, -1.1);
  add(new RoundedBoxGeometry(2.4, .1, 2.24, 3, .04), hubM, hub, 0, .92, -1.1);
  const entr = new THREE.Mesh(new THREE.BoxGeometry(2.1, .03, .02), new THREE.MeshBasicMaterial({ color: new THREE.Color('#4FC3F7').multiplyScalar(1.4), toneMapped: false })); entr.position.set(0, .855, .01); hub.add(entr);
  for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(.2, .06, .03), new THREE.MeshBasicMaterial({ color: new THREE.Color('#5AC878').multiplyScalar(1.3), toneMapped: false })); c.position.set(sx * .28, .24, -2.19); hub.add(c); }
  add(new THREE.BoxGeometry(.04, .7, .55), new THREE.MeshPhysicalMaterial({ color: '#CFE8F4', roughness: .05, transparent: true, opacity: .35, depthWrite: false }), hub, 1.21, 1.35, -2.55);
  const hubWater = add(new THREE.BoxGeometry(.03, 1, .5), M('#1E8FD0', { emissive: '#1876B0', emissiveIntensity: .7 }), hub, 1.205, 1.2, -2.55); hubWater.scale.y = .5;
  const plateTex = (() => { const c = document.createElement('canvas'); c.width = 512; c.height = 96; const g = c.getContext('2d'); g.fillStyle = '#1B2329'; g.font = '700 60px Syne, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LEVIA HUB', 256, 51); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(.8, .12), new THREE.MeshBasicMaterial({ map: plateTex, transparent: true })); plate.position.set(0, .92, .025); hub.add(plate);
  hub.visible = false;
  // water droplets for mopping mode
  const drops = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Array(80 * 3).fill(0), 3)), new THREE.PointsMaterial({ color: '#8FD6FF', size: .025, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(drops);
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(1, .62), new THREE.MeshStandardMaterial({ color: '#0B1418', roughness: .05, metalness: .3, transparent: true, opacity: 0, depthWrite: false }));
  wet.rotation.x = -Math.PI / 2; wet.position.y = .004; scene.add(wet);

  // ---------- labels (HTML, projected each frame) ----------
  const labelDivs = parts.filter(p => p.name && !p.noLabel).map(p => { const d = document.createElement('div'); d.className = 'plabel'; d.textContent = p.name; labelsEl.appendChild(d); return { p, d }; });

  // ---------- modes ----------
  const MODES = {
    floor: { t: 'Floor mode', d: 'Levia cleans mainly on wheels: side brushes, suction and the mop pad work together, while the fans stay off to save energy.' },
    flight: { t: 'Flight mode', d: 'To change floor it lifts off in the atrium, retracts its wheels and flies a short hop. It never flies to clean, only to reach the next area.' },
    uv: { t: 'UV-C sanitizing', d: 'A UV-C lamp under the body sanitizes the floor as Levia passes, after vacuuming and washing. It switches off automatically if a person is detected.' },
    mop: { t: 'Washing with water', d: 'A small water tank feeds the rotating mop pad. After vacuuming, Levia washes hard floors and leaves them to dry.' },
    arm: { t: 'Robotic arm', d: 'The arm unfolds to open doors or pick up lost items, then folds back on top of the robot.' },
    hub: { t: 'Return to the Hub', d: 'Levia drives into the Hub’s charging bay. The waste is emptied into three bins, the water tank is refilled and the battery recharges, all automatically.' },
    explode: { t: 'Exploded view', d: 'Every component separated: click any label to read what it does.' },
  };
  let mode = 'floor', modeAt = 0, explodeK = 0, clock = 0, last = performance.now();
  function setMode(m) {
    mode = m; modeAt = clock; hub.visible = m === 'hub';
    document.querySelectorAll('[data-pmode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pmode === m)));
    opts.onMode && opts.onMode(m, MODES[m]);
    controls.autoRotate = m !== 'hub';
    if (m === 'hub') { controls.target.set(-2.9, .6, 0); camera.position.set(1.4, 2.3, 4.6); }
    else if (m === 'explode') { controls.target.set(0, .55, 0); camera.position.set(2.3, 1.8, 2.8); }
    else { controls.target.set(0, .45, 0); if (camera.position.length() > 4.5) camera.position.set(2.0, 1.35, 2.5); }
  }
  labelsEl.addEventListener('click', e => { const i = [...labelsEl.children].indexOf(e.target); if (i >= 0) opts.onPart && opts.onPart(labelDivs[i].p.name, labelDivs[i].p.desc); });
  setMode('floor');

  function resize() { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();
  const v = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; if (!active) return; clock += dt;
    const u = clock - modeAt;
    explodeK = lerp(explodeK, mode === 'explode' ? 1 : 0, 1 - Math.exp(-dt * 4));
    const fly = mode === 'flight' ? ease(u / 1.2) : 0;
    const back = mode === 'hub' ? ease((u - .3) / 2.8) : 0;
    robot.position.set(mode === 'floor' || mode === 'mop' || mode === 'uv' ? Math.sin(clock * .6) * .35 : lerp(0, -3.6, back), fly * (.75 + Math.sin(clock * 2.2) * .03), 0);
    robot.rotation.y = mode === 'hub' ? lerp(robot.rotation.y, 0, .1) : robot.rotation.y;
    tilt.rotation.z = mode === 'flight' ? Math.sin(clock * 1.1) * .05 * fly : 0;
    const spin = mode === 'flight' ? 1 : 0;
    rotors.forEach((r, i) => { r.rotation.y += dt * (2 + 60 * spin); r.visible = spin < .5; });
    blurs.forEach(b => b.material.opacity = .42 * fly);
    wheels.forEach(w => w.scale.setScalar(1 - .4 * fly));
    const cleaning = mode === 'floor' || mode === 'mop' || mode === 'uv';
    uvDisc.material.opacity = mode === 'uv' ? .3 + .06 * Math.sin(clock * 6) : 0; uvLight.intensity = mode === 'uv' ? 3 : 0;
    brushes.forEach((b, i) => b.rotation.y += dt * (cleaning ? 14 : 0) * (i ? -1 : 1));
    mop.rotation.y += dt * (mode === 'mop' ? 10 : mode === 'floor' ? 4 : 0);
    mop.position.y = mode === 'mop' ? .012 : .022;
    // water: tank drains a little while mopping, refills at the Hub
    tankLvl.scale.y = mode === 'hub' ? lerp(.03, .085, ease((u - 3) / 2)) : mode === 'mop' ? Math.max(.025, .085 - u * .004) : .07;
    tankLvl.position.y = .29 + tankLvl.scale.y / 2;
    hubWater.scale.y = mode === 'hub' ? .5 - .07 * ease((u - 3) / 2) : .5; hubWater.position.y = 1.0 + hubWater.scale.y / 2;
    hubLed.material.color.set(mode === 'hub' && u > 3.1 ? '#5AC878' : '#4FC3F7').multiplyScalar(1.6);
    // mopping effects
    const da = drops.geometry.attributes.position.array, dm = mode === 'mop';
    drops.material.opacity = dm ? .85 : 0; wet.material.opacity = dm ? .45 : 0;
    if (dm) { for (let i = 0; i < 80; i++) { const ph = (clock * 1.3 + i / 80) % 1, a = i * 2.4; da.set([robot.position.x - .12 + Math.cos(a) * .25 * ph, .03 + .05 * Math.sin(ph * Math.PI), Math.sin(a) * .25 * ph], i * 3); } drops.geometry.attributes.position.needsUpdate = true;
      wet.position.x = robot.position.x - .55; wet.scale.x = .6 + .2 * Math.sin(clock); }
    poseArm(mode === 'arm' ? ease(Math.sin(Math.min(u, 6) * .9 - 1.2) * .5 + .5) : 0);
    // exploded view
    parts.forEach(p => { p.g.position.copy(p.off).multiplyScalar(explodeK); if (p.hidden) p.g.visible = explodeK > .05; });
    controls.update();
    renderer.render(scene, camera);
    // labels
    const W = host.clientWidth, H = host.clientHeight;
    labelDivs.forEach(({ p, d }) => { v.copy(p.anchor).add(p.off.clone().multiplyScalar(explodeK)); tilt.localToWorld(v); v.project(camera);
      d.style.transform = `translate(${(v.x * .5 + .5) * W}px, ${(-v.y * .5 + .5) * H}px)`; d.style.opacity = explodeK > .6 && v.z < 1 ? 1 : 0; d.style.pointerEvents = explodeK > .6 ? 'auto' : 'none'; });
    // health alerts: always-visible markers pinned to the affected part
    alertDivs.forEach(({ p, d }) => { v.copy(p.anchor).add(p.off.clone().multiplyScalar(explodeK)); tilt.localToWorld(v); v.project(camera);
      d.style.transform = `translate(${(v.x * .5 + .5) * W}px, ${(-v.y * .5 + .5) * H}px)`; d.style.opacity = v.z < 1 ? 1 : 0; });
    parts.forEach(p => p.flash && p.flash.forEach(m => m.emissiveIntensity = .3 + .3 * Math.sin(clock * 5)));
  }
  requestAnimationFrame(frame);
  let alertDivs = [];
  function setAlerts(list) {
    alertDivs.forEach(a => a.d.remove()); parts.forEach(p => { if (p.flash) { p.flash.forEach(m => { m.emissive.set(0); m.emissiveIntensity = 1; }); p.flash = null; } });
    alertDivs = list.map((a, k) => { const p = parts.find(x => x.name === a.part); if (!p) return null;
      const d = document.createElement('div'); d.className = 'palert ' + (a.level || 'amber'); d.style.marginTop = `${-12 - k * 26}px`;   // stack markers that share a spot d.innerHTML = `<i></i><span></span>`; d.querySelector('span').textContent = a.short || a.part;
      d.addEventListener('click', () => opts.onAlert && opts.onAlert(a)); labelsEl.appendChild(d);
      // tint the part's meshes so the problem is visible on the model itself
      const mats = new Set(); p.g.traverse(o => { if (o.isMesh && o.material && o.material.emissive) { o.material = o.material.clone(); mats.add(o.material); } });
      p.flash = [...mats]; p.flash.forEach(m => m.emissive.set(a.level === 'red' ? '#FF3B30' : '#FFA41B'));
      return { p, d }; }).filter(Boolean);
  }
  return {
    setMode, modes: MODES, setAlerts,
    setActive(v) { active = v; },
    setAccent(hex) { led.color.set(hex).multiplyScalar(1.6); },
    showLabels(v) { labelsEl.style.display = v ? '' : 'none'; },
  };
}
