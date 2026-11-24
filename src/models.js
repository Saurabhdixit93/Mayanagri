import * as THREE from 'three';
import { pick } from './utils.js';
import { ASSETS, CharModel, MALE_ARCH, FEMALE_ARCH } from './assets.js';

// ---------- shared geometry / material caches ----------
const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const CONE = new THREE.ConeGeometry(1, 1, 10);

export function box(w, h, d, color, x = 0, y = 0, z = 0, parent = null, opts) {
  const m = new THREE.Mesh(BOX, opts ? mat(color, opts) : mat(color));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function cyl(r, h, color, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(CYL, mat(color));
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function cone(r, h, color, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(CONE, mat(color));
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}
// ---------------------------------------------------------------------------
// Instancer: every untextured box/cylinder/cone of every person, cow and vehicle
// is drawn through 3 InstancedMeshes (3 draw calls instead of ~1500).
// Models keep their normal Object3D hierarchy for animation; their meshes are
// hidden and their world matrices are copied into instances each frame.
// ---------------------------------------------------------------------------
class Instancer {
  constructor() {
    this.sets = new Map();
    const caps = [[BOX, 9000], [CYL, 2500], [CONE, 1500]];
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (const [geo, max] of caps) {
      const im = new THREE.InstancedMesh(geo, this.mat, max);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.setColorAt(0, new THREE.Color());
      im.instanceColor.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      im.frustumCulled = false;
      im.castShadow = true;
      im.receiveShadow = true;
      this.sets.set(geo, { im, list: [], max });
    }
  }
  attach(scene) { for (const s of this.sets.values()) scene.add(s.im); }
  register(root) {
    root.traverse((o) => {
      if (!o.isMesh || o.userData.inst || o.userData.noInst || o.material.map || o.material.transparent && o.material.opacity < 0.3) return;
      const set = this.sets.get(o.geometry);
      if (!set) return;
      o.visible = false;
      o.userData.inst = true;
      set.list.push(o);
    });
  }
  unregister(root) {
    const gone = new Set();
    root.traverse((o) => { if (o.userData.inst) gone.add(o); });
    if (!gone.size) return;
    for (const s of this.sets.values()) s.list = s.list.filter((m) => !gone.has(m));
  }
  update(cam, maxDist = 360) {
    const md2 = maxDist * maxDist;
    for (const s of this.sets.values()) {
      const { im, list, max } = s;
      let n = 0;
      for (const m of list) {
        // visible only if every ancestor is visible and it is attached to the scene
        let o = m.parent, vis = false;
        while (o) { if (!o.visible) break; if (o.isScene) { vis = true; break; } o = o.parent; }
        if (!vis) continue;
        const e = m.matrixWorld.elements;
        const dx = e[12] - cam.x, dz = e[14] - cam.z;
        if (dx * dx + dz * dz > md2) continue;
        if (n >= max) break;
        im.setMatrixAt(n, m.matrixWorld);
        im.setColorAt(n, m.material.color);
        n++;
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      im.instanceColor.needsUpdate = true;
    }
  }
}
export const INST = new Instancer();

function wheel(parent, x, y, z, r, w = 0.28) {
  const m = cyl(r, w, 0x161616, x, y, z, parent);
  m.rotation.z = Math.PI / 2;
  return m;
}

// ---------- text textures (signs, labels) ----------
const texCache = new Map();
export function textTexture(text, { bg = '#ffffff', fg = '#111111', w = 512, h = 128, font = 'bold 64px "Arial Black", Arial, sans-serif', border = null } = {}) {
  const key = [text, bg, fg, w, h, font, border].join('|');
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
  g.fillStyle = fg;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = String(text).split('\n');
  const lh = h / (lines.length + 0.3);
  lines.forEach((ln, i) => {
    let size = parseInt(font.match(/(\d+)px/)[1], 10);
    let f = font;
    g.font = f;
    while (g.measureText(ln).width > w * 0.92 && size > 10) {
      size -= 2; f = font.replace(/\d+px/, size + 'px'); g.font = f;
    }
    g.fillText(ln, w / 2, lh * (i + 0.65));
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
const PLANE = new THREE.PlaneGeometry(1, 1);
export function textPlane(text, w, h, opts = {}) {
  const tex = textTexture(text, opts);
  const m = new THREE.Mesh(PLANE, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: !!opts.transparent }));
  m.scale.set(w, h, 1);
  return m;
}

// ---------- people ----------
const SKIN = [0x8d5524, 0xc68642, 0xa0662f, 0x7a4a22, 0xe0ac69, 0x9c6b3e];
const SHIRT = [0xffffff, 0xe63946, 0x2a9d8f, 0xf4a261, 0x457b9d, 0xffd166, 0x6a4c93, 0x8ac926, 0xff70a6, 0xdddddd, 0x1d3557];
const PANTS = [0x22223b, 0x4a4e69, 0x3d405b, 0x2b2d42, 0x6b705c, 0xeeeeee];
const SAREE = [0xe63946, 0xff006e, 0xffbe0b, 0x8338ec, 0x06d6a0, 0xfb5607, 0x3a86ff, 0xc9184a];

// Animated glTF person (preferred) or low-poly box person (fallback / tiny background people).
export function makeHuman(opt = {}) {
  if (ASSETS.ready && !opt.box) {
    const female = opt.female ?? Math.random() < 0.4;
    const key = opt.arch || (female ? pick(FEMALE_ARCH) : pick(MALE_ARCH));
    const char = new CharModel(key);
    const g = new THREE.Group();
    g.add(char.group);
    g.userData.char = char;
    g.userData.female = female;
    return g;
  }
  return makeBoxHuman(opt);
}

export function makeBoxHuman(opt = {}) {
  const g = new THREE.Group();
  const skin = opt.skin ?? pick(SKIN);
  const female = opt.female ?? Math.random() < 0.4;
  const shirt = opt.shirt ?? (female ? pick(SAREE) : pick(SHIRT));
  const pants = opt.pants ?? pick(PANTS);
  const parts = {};

  const mkLimb = (x, y, w, h, color) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    box(w, h, w + 0.02, color, 0, -h / 2, 0, pivot);
    g.add(pivot);
    return pivot;
  };
  parts.legL = mkLimb(-0.14, 0.9, 0.18, 0.9, pants);
  parts.legR = mkLimb(0.14, 0.9, 0.18, 0.9, pants);
  box(0.56, 0.72, 0.32, shirt, 0, 1.26, 0, g);
  if (female) {
    box(0.6, 0.88, 0.42, shirt, 0, 0.46, 0, g);      // saree drape
    box(0.2, 0.75, 0.34, shirt, 0.18, 1.3, 0.02, g); // pallu
    box(0.34, 0.5, 0.12, 0x111111, 0, 1.7, -0.18, g); // long hair
  } else if (opt.kurta || Math.random() < 0.25) {
    box(0.58, 0.45, 0.34, shirt, 0, 0.82, 0, g);     // kurta length
  }
  parts.armL = mkLimb(-0.36, 1.58, 0.14, 0.66, shirt);
  parts.armR = mkLimb(0.36, 1.58, 0.14, 0.66, shirt);
  box(0.32, 0.36, 0.32, skin, 0, 1.84, 0, g);
  box(0.34, 0.1, 0.34, 0x151515, 0, 2.05, -0.01, g); // hair
  if (opt.cap) box(0.36, 0.12, 0.36, opt.cap, 0, 2.1, 0, g);
  if (opt.shades) box(0.3, 0.07, 0.04, 0x050505, 0, 1.88, 0.17, g);
  if (opt.mustache || (!female && Math.random() < 0.5)) box(0.18, 0.04, 0.03, 0x151515, 0, 1.76, 0.17, g);
  g.userData.parts = parts;
  INST.register(g);
  return g;
}

export function animateHuman(g, phase, amt) {
  const ch = g.userData.char;
  if (ch) {
    if (g.userData.lockAnim) return;
    if (amt <= 0.01) ch.play('Idle');
    else if (amt > 1.15) ch.play('Run');
    else ch.play('Walk', { speed: Math.max(0.7, amt) });
    return;
  }
  const p = g.userData.parts;
  const s = Math.sin(phase) * 0.7 * amt;
  p.legL.rotation.x = s;
  p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8;
  p.armR.rotation.x = s * 0.8;
}

export function seatHuman(g) {
  const p = g.userData.parts;
  if (!p) return;
  p.legL.rotation.x = -1.4;
  p.legR.rotation.x = -1.4;
  p.armL.rotation.x = -1.1;
  p.armR.rotation.x = -1.1;
}

// ---------- cow ----------
export function makeCow() {
  const g = new THREE.Group();
  const c = pick([0xf2efe6, 0xe8e0d0, 0xd9cbb3, 0xf7f7f2]);
  box(0.95, 0.85, 1.9, c, 0, 1.15, 0, g);
  box(0.6, 0.4, 0.5, c, 0, 1.7, 0.55, g); // hump
  const head = new THREE.Group();
  head.position.set(0, 1.4, 1.1);
  box(0.42, 0.45, 0.65, c, 0, 0, 0.25, head);
  box(0.36, 0.25, 0.2, 0xd8a0a0, 0, -0.1, 0.6, head);
  const hc = pick([0xc0392b, 0x2980b9, 0xf39c12, 0x8e44ad, 0x7f6a4f]);
  const h1 = cone(0.06, 0.4, hc, -0.17, 0.33, 0.15, head); h1.rotation.z = 0.5;
  const h2 = cone(0.06, 0.4, hc, 0.17, 0.33, 0.15, head); h2.rotation.z = -0.5;
  box(0.1, 0.25, 0.08, c, -0.27, 0.05, 0.1, head);
  box(0.1, 0.25, 0.08, c, 0.27, 0.05, 0.1, head);
  g.add(head);
  for (const [x, z] of [[-0.3, 0.7], [0.3, 0.7], [-0.3, -0.7], [0.3, -0.7]]) box(0.18, 0.8, 0.18, c, x, 0.4, z, g);
  box(0.06, 0.8, 0.06, c, 0, 1.0, -0.98, g);
  // marigold garland on some cows
  if (Math.random() < 0.4) box(0.75, 0.12, 0.12, 0xff9f1c, 0, 1.25, 0.95, g);
  g.userData.head = head;
  INST.register(g);
  return g;
}

// ---------- vehicles (built facing +z) ----------
export function makeVehicleModel(type) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const wheels = [];
  const beacons = [];
  let driverSeat = null;

  const glbKey = type === 'car' ? (Math.random() < 0.35 ? 'suv' : 'car') : type;
  if (['car', 'taxi', 'police'].includes(type) && ASSETS.cars[glbKey]) {
    // body comes from the CC0 glTF model, drawn by CarInstancer; keep lights/beacons here
    g.userData.glb = glbKey;
    const h = ASSETS.cars[glbKey].height;
    if (type === 'police') {
      const bl = box(0.45, 0.18, 0.3, 0xff0000, -0.3, h + 0.1, -0.2, body, { emissive: 0xff0000 });
      const br = box(0.45, 0.18, 0.3, 0x0044ff, 0.3, h + 0.1, -0.2, body, { emissive: 0x0044ff });
      bl.userData.noInst = br.userData.noInst = true;
      beacons.push(bl, br);
    }
    if (type === 'taxi') {
      const s = textPlane('TAXI', 0.8, 0.25, { bg: '#f5c400', fg: '#000' });
      s.position.set(0, h + 0.2, -0.2); body.add(s);
    }
  } else if (type === 'fishboat') {
    // Koli fishing boat: long painted wooden hull, raised prow, flags
    const c = pick([0x1d4ed8, 0xe63946, 0x2a9d8f, 0x6a4c93]);
    box(2.4, 1.1, 8.4, c, 0, 0.15, -0.3, body);
    box(2.45, 0.22, 8.45, 0xffbe0b, 0, 0.62, -0.3, body);
    box(2.45, 0.15, 8.45, 0xffffff, 0, 0.35, -0.3, body);
    const bow = box(1.7, 1.3, 1.7, c, 0, 0.3, 3.9, body); bow.rotation.y = Math.PI / 4;
    const prow = box(0.3, 1.6, 1.2, 0xffbe0b, 0, 1.0, 4.7, body); prow.rotation.x = -0.4;
    box(2.0, 0.08, 7.6, 0x8b6b45, 0, 0.62, -0.3, body);                 // deck
    box(1.8, 1.4, 2.0, 0xf1f1f1, 0, 1.35, -2.6, body);                  // little wheelhouse
    box(1.9, 0.12, 2.1, 0xe63946, 0, 2.1, -2.6, body);
    cyl(0.07, 5, 0x6b4f2e, 0, 3, 0.8, body);                             // mast
    for (let i = 0; i < 4; i++) { const f = cone(0.35, 0.7, pick([0xff9f1c, 0xe63946, 0x06d6a0, 0xffd60a]), 0.3, 3.6 + i * 0.5, 0.8, body); f.rotation.z = -Math.PI / 2; }
    box(1.6, 0.4, 1.6, 0x2a9d8f, 0, 0.85, 1.6, body);                    // nets
    driverSeat = null;
  } else if (type === 'speedboat' || type === 'policeboat') {
    const cop = type === 'policeboat';
    const L = cop ? 8 : 6.5, W = cop ? 2.6 : 2.2;
    box(W, 0.9, L, 0xf4f4f4, 0, 0.2, 0, body);
    const nose = box(W * 0.71, 0.9, W * 0.71, 0xf4f4f4, 0, 0.2, L / 2, body); nose.rotation.y = Math.PI / 4;
    box(W + 0.05, 0.22, L, cop ? 0xff7b00 : 0xe63946, 0, 0.45, 0, body);
    box(W * 0.9, 0.5, 0.06, 0x9fd3ff, 0, 1.0, L * 0.12, body, { transparent: true, opacity: 0.5 });
    box(W * 0.8, 0.35, L * 0.35, 0x2b2d42, 0, 0.8, -L * 0.1, body);    // seats
    box(0.5, 1.0, 0.6, 0x111111, 0, 0.6, -L / 2 - 0.2, body);           // outboard motor
    if (cop) {
      box(W * 0.8, 1.2, 2.2, 0xf4f4f4, 0, 1.3, -0.6, body);
      box(W * 0.82, 0.5, 2.22, 0x1b2a3a, 0, 1.55, -0.6, body);
      const bl = box(0.4, 0.2, 0.3, 0xff0000, -0.3, 2.05, -0.6, body, { emissive: 0xff0000 });
      const br = box(0.4, 0.2, 0.3, 0x0044ff, 0.3, 2.05, -0.6, body, { emissive: 0x0044ff });
      bl.userData.noInst = br.userData.noInst = true;
      beacons.push(bl, br);
      const s1 = textPlane('COAST GUARD', 3.6, 0.5, { bg: '#f4f4f4', fg: '#ff7b00' });
      s1.position.set(W / 2 + 0.04, 0.35, 0); s1.rotation.y = Math.PI / 2; body.add(s1);
      const s2 = s1.clone(); s2.position.x = -W / 2 - 0.04; s2.rotation.y = -Math.PI / 2; body.add(s2);
    }
    driverSeat = null;
  } else if (type === 'jetski') {
    box(0.9, 0.55, 2.6, 0xffd60a, 0, 0.2, 0, body);
    const nose = box(0.64, 0.5, 0.64, 0xffd60a, 0, 0.22, 1.3, body); nose.rotation.y = Math.PI / 4;
    box(0.92, 0.15, 2.62, 0x111111, 0, 0.42, 0, body);
    box(0.45, 0.3, 1.0, 0x111111, 0, 0.65, -0.4, body);                 // seat
    box(0.7, 0.06, 0.06, 0x333333, 0, 1.0, 0.45, body);                 // handlebar
    driverSeat = [0, -0.05, -0.35];
  } else if (type === 'ferry') {
    box(6, 2.4, 22, 0xf1faee, 0, 0.5, 0, body);
    const nose = box(4.2, 2.4, 4.2, 0xf1faee, 0, 0.5, 11, body); nose.rotation.y = Math.PI / 4;
    box(6.05, 0.5, 22.05, 0x1d3557, 0, -0.5, 0, body);
    box(5.4, 2.4, 15, 0x1d3557, 0, 2.9, -1.5, body);                    // lower deck cabin
    box(5.45, 0.9, 15.05, 0x9fd3ff, 0, 3.1, -1.5, body);                // windows
    box(5.6, 0.2, 16, 0xf1faee, 0, 4.2, -1.5, body);                    // upper deck
    box(3, 1.8, 3, 0xf1faee, 0, 5.2, -6, body);                         // bridge
    cyl(0.4, 2.5, 0xe63946, 0, 6.5, -8, body);
    const s = textPlane('MAYANAGRI FERRY · किला ⇄ जेट्टी', 10, 1.0, { bg: '#1d3557', fg: '#ffd60a' });
    s.position.set(3.06, 1.5, 0); s.rotation.y = Math.PI / 2; body.add(s);
    const s2 = s.clone(); s2.position.x = -3.06; s2.rotation.y = -Math.PI / 2; body.add(s2);
    driverSeat = null;
  } else if (type === 'scooter') {
    const c = pick([0xf1f1f1, 0x8ecae6, 0xffafcc, 0xe63946, 0x90be6d, 0xffd166]);
    box(0.5, 0.75, 0.25, c, 0, 0.75, 0.62, body);          // front apron
    box(0.45, 0.08, 0.7, 0x333333, 0, 0.42, 0.15, body);    // floorboard
    box(0.55, 0.45, 0.8, c, 0, 0.75, -0.4, body);           // rear body
    box(0.45, 0.12, 0.8, 0x222222, 0, 1.03, -0.35, body);   // long seat
    box(0.7, 0.05, 0.05, 0xcccccc, 0, 1.3, 0.72, body);     // handlebar
    box(0.18, 0.18, 0.1, 0xfffbe0, 0, 1.25, 0.78, body, { emissive: 0x555533 });
    wheels.push(wheel(g, 0, 0.25, 0.65, 0.25, 0.12));
    wheels.push(wheel(g, 0, 0.25, -0.6, 0.25, 0.12));
    driverSeat = [0, 0.18, 0.05];
    // the classic Indian family-of-four on one scooter
    if (Math.random() < 0.6) {
      const wife = makeBoxHuman({ female: true });
      seatHuman(wife); wife.position.set(0.12, 0.15, -0.55); wife.rotation.y = Math.PI / 2; wife.scale.setScalar(0.95);
      body.add(wife);
      if (Math.random() < 0.6) { const kid = makeBoxHuman({ female: false }); seatHuman(kid); kid.scale.setScalar(0.55); kid.position.set(0, 0.55, 0.45); body.add(kid); }
    }
  } else if (type === 'tractor') {
    const c = pick([0xc1121f, 0x1d4ed8, 0x2b9348]);
    box(1.0, 0.9, 2.0, c, 0, 1.2, 0.6, body);              // hood
    box(1.2, 0.2, 1.0, c, 0, 1.25, -0.6, body);             // fenders base
    box(0.5, 0.5, 0.4, 0x222222, 0, 1.6, -0.7, body);       // seat
    box(0.08, 1.2, 0.08, 0x333333, 0.4, 2.0, 1.2, body);    // exhaust
    box(1.1, 0.06, 0.06, 0x111111, 0, 2.6, -0.4, body);
    wheels.push(wheel(g, -0.85, 0.75, -0.7, 0.75, 0.45));
    wheels.push(wheel(g, 0.85, 0.75, -0.7, 0.75, 0.45));
    wheels.push(wheel(g, -0.6, 0.4, 1.3, 0.4, 0.25));
    wheels.push(wheel(g, 0.6, 0.4, 1.3, 0.4, 0.25));
    driverSeat = [0, 0.75, -0.75];
  } else if (type === 'tempo') {
    box(1.7, 1.4, 1.5, 0xf1f1f1, 0, 1.2, 1.6, body);        // cab
    box(1.6, 0.6, 0.06, 0x223344, 0, 1.55, 2.36, body);
    box(1.75, 0.3, 0.1, 0xffd60a, 0, 0.7, 2.36, body);
    box(1.8, 0.2, 2.8, 0x8d6e4f, 0, 0.75, -0.6, body);      // open bed
    for (const sx of [-0.88, 0.88]) box(0.06, 0.6, 2.8, 0x2a9d8f, sx, 1.1, -0.6, body);
    box(1.8, 0.6, 0.06, 0x2a9d8f, 0, 1.1, -2.0, body);
    for (let i = 0; i < 4; i++) box(0.6, 0.45, 0.6, pick([0xc68642, 0x9c6b3e, 0xf4a261]), (i % 2 ? 0.4 : -0.4), 1.1, -0.2 - Math.floor(i / 2) * 0.9, body); // goods
    for (const [x, z] of [[-0.75, 1.5], [0.75, 1.5], [-0.75, -1.3], [0.75, -1.3]]) wheels.push(wheel(g, x, 0.35, z, 0.35));
    driverSeat = null;
  } else if (type === 'ambassador') {
    const c = pick([0xf8f8f2, 0xf8f8f2, 0x111111, 0xd9d0b4]);
    box(1.75, 0.75, 4.2, c, 0, 0.7, 0, body);
    box(1.6, 0.25, 1.5, c, 0, 1.15, 1.3, body);             // rounded bonnet hump
    box(1.55, 0.7, 2.0, c, 0, 1.4, -0.3, body);
    box(1.58, 0.45, 1.9, 0x1b2a3a, 0, 1.4, -0.3, body);
    box(1.6, 0.25, 0.25, 0xcccccc, 0, 0.55, 2.12, body);    // chrome bumper
    box(1.6, 0.25, 0.25, 0xcccccc, 0, 0.55, -2.12, body);
    box(0.25, 0.25, 0.05, 0xfffbe0, -0.55, 0.9, 2.11, body, { emissive: 0x555533 });
    box(0.25, 0.25, 0.05, 0xfffbe0, 0.55, 0.9, 2.11, body, { emissive: 0x555533 });
    if (c === 0xf8f8f2) { // VIP "neta ji" car with the red beacon
      const b = box(0.3, 0.2, 0.3, 0xff0000, 0, 1.85, 0.3, body, { emissive: 0xff0000 }); b.userData.noInst = true; beacons.push(b, b);
      const s = textPlane('भारत सरकार', 0.9, 0.22, { bg: '#ffffff', fg: '#c1121f' }); s.position.set(0, 0.7, 2.14); body.add(s);
    }
    for (const [x, z] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) wheels.push(wheel(g, x, 0.38, z, 0.38));
    driverSeat = null;
  } else if (type === 'erick') {
    const c = pick([0x2b9348, 0x1d4ed8, 0x7209b7]);
    box(1.3, 0.6, 2.4, c, 0, 0.7, 0, body);
    box(1.35, 0.08, 2.5, 0xeeeeee, 0, 2.1, -0.1, body);     // roof
    for (const [x, z] of [[-0.6, 1.0], [0.6, 1.0], [-0.6, -1.15], [0.6, -1.15]]) box(0.06, 1.35, 0.06, 0x999999, x, 1.4, z, body);
    box(1.2, 0.55, 0.06, 0x9fd3ff, 0, 1.6, 1.05, body, { transparent: true, opacity: 0.5 });
    box(0.9, 0.12, 0.6, 0x222222, 0, 1.05, -0.6, body);
    wheels.push(wheel(g, 0, 0.3, 1.0, 0.3));
    wheels.push(wheel(g, -0.62, 0.3, -0.9, 0.3));
    wheels.push(wheel(g, 0.62, 0.3, -0.9, 0.3));
    driverSeat = [0, 0.1, 0.5];
  } else if (type === 'supercar') {
    const c = pick([0xff6d00, 0xffd60a, 0x00b4d8, 0xd00000]);
    box(1.95, 0.5, 4.4, c, 0, 0.5, 0, body);
    const nose = box(1.9, 0.25, 1.3, c, 0, 0.72, 1.4, body); nose.rotation.x = 0.18;
    box(1.6, 0.42, 1.7, 0x111111, 0, 0.95, -0.25, body);    // glass canopy
    box(1.7, 0.3, 1.0, c, 0, 0.85, -1.5, body);
    box(2.0, 0.08, 0.45, 0x111111, 0, 1.25, -2.05, body);   // wing
    for (const sx of [-0.8, 0.8]) box(0.08, 0.35, 0.1, 0x111111, sx, 1.05, -2.05, body);
    box(0.5, 0.1, 0.05, 0xfffbe0, -0.6, 0.62, 2.2, body, { emissive: 0x777755 });
    box(0.5, 0.1, 0.05, 0xfffbe0, 0.6, 0.62, 2.2, body, { emissive: 0x777755 });
    box(1.6, 0.1, 0.05, 0xff2222, 0, 0.7, -2.21, body, { emissive: 0x550000 });
    for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) wheels.push(wheel(g, x, 0.36, z, 0.36, 0.34));
    driverSeat = null;
  } else if (type === 'auto') {
    box(1.45, 0.75, 2.5, 0x1f7a3a, 0, 0.75, -0.1, body);            // green body
    box(1.5, 0.12, 2.3, 0x111111, 0, 1.18, -0.2, body);
    box(1.55, 0.85, 2.15, 0xf5c400, 0, 1.75, -0.25, body);          // yellow canopy
    box(1.45, 0.7, 2.05, 0x2a2a2a, 0, 1.6, -0.25, body).scale.set(1.3, 0.62, 1.9); // dark inside
    box(0.9, 0.95, 0.45, 0x1f7a3a, 0, 1.0, 1.25, body);             // front cowl
    box(1.2, 0.55, 0.06, 0x9fd3ff, 0, 1.65, 0.86, body, { transparent: true, opacity: 0.6 });
    box(0.25, 0.18, 0.06, 0xfff6c0, 0, 1.25, 1.49, body, { emissive: 0x665500 });
    box(1.6, 0.06, 0.06, 0x111111, 0, 2.2, 0.9, body);
    wheels.push(wheel(g, 0, 0.32, 1.15, 0.32));
    wheels.push(wheel(g, -0.68, 0.32, -0.9, 0.32));
    wheels.push(wheel(g, 0.68, 0.32, -0.9, 0.32));
    driverSeat = [0, 0.0, 0.45];
  } else if (type === 'car' || type === 'taxi') {
    const color = type === 'taxi' ? 0x111111 : pick([0xf1f1f1, 0xc0c0c0, 0xb5121b, 0x1e3a8a, 0x8b8b8b, 0x3a5a40, 0xf5f5dc]);
    box(1.8, 0.7, 4.0, color, 0, 0.65, 0, body);
    box(1.62, 0.6, 2.1, type === 'taxi' ? 0xf5c400 : color, 0, 1.28, -0.25, body);
    box(1.5, 0.45, 2.15, 0x223344, 0, 1.25, -0.25, body).scale.set(1.66, 0.45, 2.0);
    box(1.64, 0.08, 2.0, type === 'taxi' ? 0xf5c400 : color, 0, 1.6, -0.25, body);
    box(0.35, 0.18, 0.05, 0xfffbe0, -0.6, 0.75, 2.01, body, { emissive: 0x555533 });
    box(0.35, 0.18, 0.05, 0xfffbe0, 0.6, 0.75, 2.01, body, { emissive: 0x555533 });
    box(0.35, 0.16, 0.05, 0xd00000, -0.6, 0.78, -2.01, body, { emissive: 0x330000 });
    box(0.35, 0.16, 0.05, 0xd00000, 0.6, 0.78, -2.01, body, { emissive: 0x330000 });
    if (type === 'taxi') {
      const s = textPlane('TAXI', 0.8, 0.25, { bg: '#f5c400', fg: '#000' });
      s.position.set(0, 1.82, -0.25); body.add(s);
      box(0.85, 0.28, 0.25, 0xf5c400, 0, 1.78, -0.25, body);
    }
    for (const [x, z] of [[-0.9, 1.3], [0.9, 1.3], [-0.9, -1.3], [0.9, -1.3]]) wheels.push(wheel(g, x, 0.35, z, 0.35));
    driverSeat = null;
  } else if (type === 'police') {
    box(1.9, 0.8, 4.2, 0xf4f4f4, 0, 0.75, 0, body);
    box(1.8, 0.75, 2.6, 0xf4f4f4, 0, 1.5, -0.4, body);
    box(1.82, 0.4, 2.62, 0x1b2a3a, 0, 1.5, -0.4, body);
    box(1.92, 0.22, 4.22, 0x1d4ed8, 0, 0.85, 0, body); // blue stripe
    const bl = box(0.45, 0.18, 0.3, 0xff0000, -0.3, 2.0, -0.2, body, { emissive: 0xff0000 });
    const br = box(0.45, 0.18, 0.3, 0x0044ff, 0.3, 2.0, -0.2, body, { emissive: 0x0044ff });
    beacons.push(bl, br);
    bl.userData.noInst = br.userData.noInst = true;
    const s1 = textPlane('POLICE', 2.2, 0.45, { bg: '#f4f4f4', fg: '#1d4ed8' });
    s1.position.set(0.97, 1.2, 0); s1.rotation.y = Math.PI / 2; body.add(s1);
    const s2 = s1.clone(); s2.position.x = -0.97; s2.rotation.y = -Math.PI / 2; body.add(s2);
    box(0.35, 0.18, 0.05, 0xfffbe0, -0.6, 0.85, 2.11, body, { emissive: 0x555533 });
    box(0.35, 0.18, 0.05, 0xfffbe0, 0.6, 0.85, 2.11, body, { emissive: 0x555533 });
    for (const [x, z] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) wheels.push(wheel(g, x, 0.4, z, 0.4, 0.32));
    driverSeat = null;
  } else if (type === 'bus') {
    const c = pick([0xc1121f, 0xc1121f, 0x2b9348]);
    box(2.5, 2.4, 10, c, 0, 1.75, 0, body);
    box(2.54, 0.8, 9.2, 0x1b263b, 0, 2.2, -0.2, body);
    box(2.3, 1.0, 0.06, 0x1b263b, 0, 2.2, 5.01, body);
    const sign = textPlane('ROUTE 21  STATION', 2.2, 0.35, { bg: '#111', fg: '#ffb703' });
    sign.position.set(0, 2.85, 5.02); body.add(sign);
    for (const [x, z] of [[-1.15, 3.4], [1.15, 3.4], [-1.15, -3.4], [1.15, -3.4]]) wheels.push(wheel(g, x, 0.5, z, 0.5, 0.35));
    driverSeat = null;
  } else if (type === 'truck') {
    box(2.3, 1.9, 2.0, 0xff7b00, 0, 1.55, 3.0, body);
    box(2.0, 0.6, 0.06, 0x223344, 0, 2.0, 4.01, body);
    box(2.0, 0.3, 0.1, 0x0077b6, 0, 2.65, 4.0, body);
    box(2.4, 2.4, 5.8, pick([0xffbe0b, 0x2a9d8f, 0xe63946, 0x8338ec]), 0, 2.0, -0.9, body);
    box(2.45, 0.4, 5.85, 0xff006e, 0, 3.0, -0.9, body);
    box(2.45, 0.3, 5.85, 0x06d6a0, 0, 1.0, -0.9, body);
    const back = textPlane('HORN OK\nPLEASE', 2.2, 1.6, { bg: '#ffbe0b', fg: '#c1121f', h: 256, w: 384, border: '#3a0ca3' });
    back.position.set(0, 2.0, -3.82); back.rotation.y = Math.PI; body.add(back);
    const side = textPlane('🇮🇳 JAI HIND TRANSPORT 🛺', 5.0, 0.8, { bg: '#ffffff', fg: '#3a0ca3' });
    side.position.set(1.23, 2.0, -0.9); side.rotation.y = Math.PI / 2; body.add(side);
    const side2 = side.clone(); side2.position.x = -1.23; side2.rotation.y = -Math.PI / 2; body.add(side2);
    box(0.3, 0.3, 0.3, 0x111111, -0.6, 0.7, -3.9, body); // nimbu-mirchi tassel anchor
    box(0.1, 0.35, 0.1, 0x7cb518, -0.6, 0.4, -3.9, body);
    for (const [x, z] of [[-1.1, 3.0], [1.1, 3.0], [-1.1, -0.5], [1.1, -0.5], [-1.1, -2.4], [1.1, -2.4]]) wheels.push(wheel(g, x, 0.5, z, 0.5, 0.35));
    driverSeat = null;
  } else if (type === 'bike') {
    const c = pick([0x111111, 0x7a0000, 0x00296b, 0x333333]);
    box(0.3, 0.45, 1.5, c, 0, 0.75, 0, body);
    box(0.4, 0.25, 0.7, c, 0, 1.0, 0.25, body);  // tank
    box(0.35, 0.12, 0.7, 0x2b2b2b, 0, 1.0, -0.35, body); // seat
    box(0.8, 0.05, 0.05, 0xcccccc, 0, 1.25, 0.75, body); // handlebar
    box(0.2, 0.2, 0.1, 0xfffbe0, 0, 1.0, 0.9, body, { emissive: 0x555533 });
    wheels.push(wheel(g, 0, 0.35, 0.8, 0.35, 0.12));
    wheels.push(wheel(g, 0, 0.35, -0.8, 0.35, 0.12));
    driverSeat = [0, 0.2, -0.25];
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData = { ...g.userData, wheels, beacons, body, driverSeat };
  INST.register(g);
  return g;
}
