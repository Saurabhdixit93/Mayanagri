import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HALF, BLOCK, ROAD, LINES, NB, line, RAIL_Z, SEA_X, BOUND, district, cellOf } from './config.js';
import { seeded, clamp } from './utils.js';
import { textPlane, box, makeBoxHuman as makeHuman, INST } from './models.js';

const R = seeded(20261119);

// ---------------------------------------------------------------------------
// Static geometry merger: thousands of boxes -> one draw call with vertex colours
// ---------------------------------------------------------------------------
class Merger {
  constructor() { this.geos = []; }
  add(geo, matrix, color) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const c = new THREE.Color(color);
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    this.geos.push(g);
  }
  box(w, h, d, x, y, z, color, ry = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
      new THREE.Vector3(w, h, d));
    this.add(UNIT_BOX, m, color);
  }
  geo(geo, x, y, z, color, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz));
    this.add(geo, m, color);
  }
  build(material) {
    if (!this.geos.length) return null;
    const merged = mergeGeometries(this.geos, false);
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL8 = new THREE.CylinderGeometry(1, 1, 1, 8);
const CONE8 = new THREE.ConeGeometry(1, 1, 8);
const ICO = new THREE.IcosahedronGeometry(1, 0);

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
function windowTextures() {
  const S = 128;
  const make = (lit) => {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = lit ? '#000' : '#fff'; g.fillRect(0, 0, S, S);
    for (let iy = 0; iy < 4; iy++) for (let ix = 0; ix < 4; ix++) {
      const x = ix * 32 + 8, y = iy * 32 + 7;
      if (lit) {
        g.fillStyle = Math.random() < 0.45 ? (Math.random() < 0.5 ? '#ffd27a' : '#cfe8ff') : '#000';
        g.fillRect(x, y, 16, 18);
      } else {
        g.fillStyle = '#3d4a55'; g.fillRect(x, y, 16, 18);
        g.fillStyle = '#c9c2b5'; g.fillRect(x - 2, y + 18, 20, 3); // sill
        if (Math.random() < 0.35) { g.fillStyle = '#5c5c5c'; g.fillRect(x + 3, y + 2, 2, 14); g.fillRect(x + 11, y + 2, 2, 14); } // grills
        if (Math.random() < 0.2) { g.fillStyle = ['#e63946', '#2a9d8f', '#ffbe0b'][ix % 3]; g.fillRect(x - 2, y + 12, 20, 4); } // clothes drying
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { map: make(false), emissive: make(true) };
}

export function makeGroundCanvas() {
  const S = 4096, W = 1400;
  const k = S / W;
  const P = (v) => (v + 700) * k;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#1f6f8b'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#9c8f74'; g.fillRect(P(SEA_X), 0, S, S);
  g.fillStyle = '#e3cf9a'; g.fillRect(P(SEA_X), 0, (-609 - SEA_X) * k, S);

  const blockCol = { maidan: '#6a9a3f', bazaar: '#b9a27d', chawl: '#8f8169', towers: '#a3a39c', mandir: '#d6c08f', plaza: '#d8ccb0', police: '#a9a9a2', hospital: '#b8b8b0', rail: '#9a8d76', promenade: '#b0a284', residential: '#a99a7d' };
  for (let bx = 0; bx < NB; bx++) for (let bz = 0; bz < NB; bz++) {
    const x0 = line(bx), z0 = line(bz);
    g.fillStyle = '#c4bba8'; g.fillRect(P(x0 + 9), P(z0 + 9), 82 * k, 82 * k);  // sidewalk
    g.fillStyle = blockCol[district(bx, bz)]; g.fillRect(P(x0 + 13), P(z0 + 13), 74 * k, 74 * k);
  }
  // roads
  g.fillStyle = '#3a3a3c';
  for (let i = 0; i < LINES; i++) {
    const L = line(i);
    g.fillRect(P(L - 9), P(-HALF - 9), ROAD * k, (2 * HALF + 18) * k);
    g.fillRect(P(-HALF - 9), P(L - 9), (2 * HALF + 18) * k, ROAD * k);
  }
  // potholes & patches
  for (let n = 0; n < 900; n++) {
    const i = Math.floor(R() * LINES); const along = R.range(-HALF, HALF); const off = R.range(-8, 8);
    const [x, z] = R() < 0.5 ? [line(i) + off, along] : [along, line(i) + off];
    g.fillStyle = R() < 0.5 ? '#2c2b2a' : '#4a463f';
    g.beginPath(); g.ellipse(P(x), P(z), R.range(0.6, 2.2) * k, R.range(0.5, 1.6) * k, R() * 3, 0, Math.PI * 2); g.fill();
  }
  // lane markings
  g.strokeStyle = '#e8e2c8'; g.lineWidth = 0.35 * k; g.setLineDash([3 * k, 4 * k]);
  for (let i = 0; i < LINES; i++) {
    const L = line(i);
    for (let j = 0; j < NB; j++) {
      const a = line(j) + 10, b = line(j + 1) - 10;
      g.beginPath(); g.moveTo(P(L), P(a)); g.lineTo(P(L), P(b)); g.stroke();
      g.beginPath(); g.moveTo(P(a), P(L)); g.lineTo(P(b), P(L)); g.stroke();
    }
  }
  g.setLineDash([]);
  // zebra crossings
  g.fillStyle = '#e8e2c8';
  for (let i = 0; i < LINES; i++) for (let j = 0; j < LINES; j++) {
    const X = line(i), Z = line(j);
    for (let s = -7; s <= 7; s += 2.2) {
      g.fillRect(P(X + s), P(Z + 10), 1.1 * k, 3 * k);
      g.fillRect(P(X + s), P(Z - 13), 1.1 * k, 3 * k);
      g.fillRect(P(X + 10), P(Z + s), 3 * k, 1.1 * k);
      g.fillRect(P(X - 13), P(Z + s), 3 * k, 1.1 * k);
    }
  }
  // railway gravel
  g.fillStyle = '#6b6156'; g.fillRect(P(SEA_X), P(RAIL_Z - 5), (700 - SEA_X) * k, 10 * k);
  // cricket pitch
  const pc = [line(2) + 50, line(10) + 50];
  g.fillStyle = '#d4bd84'; g.fillRect(P(pc[0] - 1.6), P(pc[1] - 11), 3.2 * k, 22 * k);
  g.strokeStyle = '#f4f1e6'; g.lineWidth = 0.3 * k;
  g.beginPath(); g.ellipse(P(line(3)), P(line(10) + 50), 70 * k, 40 * k, 0, 0, Math.PI * 2); g.stroke();
  // plaza tiling
  g.strokeStyle = 'rgba(120,100,70,0.35)'; g.lineWidth = 1;
  for (let t = 13; t <= 87; t += 4) {
    g.beginPath(); g.moveTo(P(line(0) + t), P(line(2) + 13)); g.lineTo(P(line(0) + t), P(line(2) + 87)); g.stroke();
    g.beginPath(); g.moveTo(P(line(0) + 13), P(line(2) + t)); g.lineTo(P(line(0) + 87), P(line(2) + t)); g.stroke();
  }
  // grain / dirt overlay so flat colours don't look like plastic
  const n = document.createElement('canvas'); n.width = n.height = 256;
  const ng = n.getContext('2d');
  const img = ng.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.random() * 40;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  ng.putImageData(img, 0, 0);
  for (let i = 0; i < 40; i++) {
    ng.fillStyle = `rgba(${Math.random() < 0.5 ? '60,50,40' : '200,190,170'},0.12)`;
    ng.beginPath(); ng.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 18, 0, Math.PI * 2); ng.fill();
  }
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.55;
  g.fillStyle = g.createPattern(n, 'repeat');
  g.fillRect(P(SEA_X), 0, S, S);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  // tyre marks / oil stains on roads
  for (let n2 = 0; n2 < 1500; n2++) {
    const i = Math.floor(R() * LINES); const along = R.range(-HALF, HALF);
    const off = R() < 0.5 ? -4.5 : 4.5;
    const [x, z] = R() < 0.5 ? [line(i) + off + R.range(-1, 1), along] : [along, line(i) + off + R.range(-1, 1)];
    g.fillStyle = 'rgba(15,15,15,0.18)';
    g.beginPath(); g.ellipse(P(x), P(z), R.range(0.5, 1.4) * k, R.range(0.5, 1.4) * k, 0, 0, Math.PI * 2); g.fill();
  }
  return c;
}

// ---------------------------------------------------------------------------
// Colliders
// ---------------------------------------------------------------------------
export class World {
  constructor() {
    this.cells = Array.from({ length: NB * NB }, () => []);
    this.all = [];
  }
  addBox(minX, maxX, minZ, maxZ, h = 10) {
    const b = { minX, maxX, minZ, maxZ, h };
    const [bx, bz] = cellOf((minX + maxX) / 2, (minZ + maxZ) / 2);
    this.cells[bz * NB + bx].push(b);
    this.all.push(b);
    return b;
  }
  query(x, z) {
    const [bx, bz] = cellOf(x, z);
    return this.cells[bz * NB + bx];
  }
  // Push a circle (ent.x, ent.z, r) out of all static colliders. Returns collision normal or null.
  resolve(ent, r, opts = {}) {
    let hit = null;
    const ey = ent.y || 0;
    for (const b of this.query(ent.x, ent.z)) {
      if (b.h <= ey + 0.3) continue; // jumping over / driving on top of it
      const cx = clamp(ent.x, b.minX, b.maxX), cz = clamp(ent.z, b.minZ, b.maxZ);
      let dx = ent.x - cx, dz = ent.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      let nx, nz, pen;
      if (d2 < 1e-8) {
        const l = ent.x - b.minX, rr = b.maxX - ent.x, t = ent.z - b.minZ, bb = b.maxZ - ent.z;
        const m = Math.min(l, rr, t, bb);
        if (m === l) { nx = -1; nz = 0; } else if (m === rr) { nx = 1; nz = 0; } else if (m === t) { nx = 0; nz = -1; } else { nx = 0; nz = 1; }
        pen = m + r;
      } else {
        const d = Math.sqrt(d2); nx = dx / d; nz = dz / d; pen = r - d;
      }
      ent.x += nx * pen; ent.z += nz * pen;
      hit = { nx, nz };
    }
    if (!opts.amph && ent.x < SEA_X + 4) { ent.x = SEA_X + 4; hit = { nx: 1, nz: 0 }; }
    if (opts.amph && ent.x < SEA_X - 650) { ent.x = SEA_X - 650; hit = { nx: 1, nz: 0 }; }
    if (opts.amph && ent.x < SEA_X) return hit; // out at sea: z bounds are handled by the sea
    if (ent.x > BOUND) { ent.x = BOUND; hit = { nx: -1, nz: 0 }; }
    if (ent.z < -BOUND) { ent.z = -BOUND; hit = { nx: 0, nz: 1 }; }
    if (ent.z > BOUND) { ent.z = BOUND; hit = { nx: 0, nz: -1 }; }
    return hit;
  }
  pointBlocked(x, y, z) {
    for (const b of this.query(x, z)) {
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && y < b.h) return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// City builder
// ---------------------------------------------------------------------------
const PASTEL = [0xf6e7c1, 0xf2c6b4, 0xbfe3d0, 0xf7d794, 0xd6e4f0, 0xf5b7b1, 0xe8daef, 0xfadbd8, 0xd5f5e3, 0xfcf3cf, 0xe5e8e8];
const BRIGHT = [0xff70a6, 0xff9770, 0x70d6ff, 0xffd670, 0x9ef01a, 0xe9ff70, 0xff595e, 0x8ac926, 0x6a4c93, 0x1982c4, 0xf15bb5];
const GLASS = [0x7aa6c2, 0x5d8aa8, 0x9fb7c8, 0x6c8ea4, 0x8fb3c9, 0xb7c9d6];
const FADED = [0xb8a99a, 0xa3b1a8, 0xc9b79c, 0x9fa8a3, 0xbfae9b, 0x8ea3b0];

const SHOP_SIGNS = [
  ['SHARMA SWEETS', '#ff9f1c', '#3a0ca3'], ['GUPTA KIRANA STORE', '#ffbe0b', '#9d0208'], ['VADA PAV CENTRE', '#e63946', '#fff'],
  ['CHAI TAPRI ☕', '#6f1d1b', '#ffe6a7'], ['MOBILE REPAIR', '#3a86ff', '#fff'], ['RAJU PAAN BHANDAR', '#2b9348', '#fff'],
  ['LAKSHMI SAREES', '#9d0208', '#ffd60a'], ['AGARWAL MEDICAL ✚', '#06d6a0', '#073b4c'], ['BOMBAY TAILORS', '#118ab2', '#fff'],
  ['CYBER CAFE ₹20/hr', '#000', '#39ff14'], ['JAI HIND HOTEL', '#ffd60a', '#9d0208'], ['STD ISD PCO', '#ffef00', '#d00000'],
  ['DOSA CORNER', '#fb8500', '#fff'], ['XEROX & LAMINATION', '#fff', '#023047'], ['चाय नाश्ता', '#d00000', '#fff'],
  ['मिठाई भंडार', '#ff006e', '#fff'], ['किराना स्टोर', '#ffb703', '#023047'], ['PANI PURI WALA', '#8338ec', '#fff'],
  ['BHAIYA JI JUICE', '#80b918', '#fff'], ['JUGAAD ELECTRONICS', '#212529', '#ffd60a'],
];
const WALL_SIGNS = [
  ['यहाँ थूकना मना है', '#fff', '#c1121f'], ['THOOKNA MANA HAI', '#fff', '#c1121f'], ['NO PARKING\n(lol)', '#1d4ed8', '#fff'],
  ['PAANI BACHAO', '#48cae4', '#03045e'], ['HORN NOT OK\nPLEASE', '#ffd60a', '#000'],
];
const BILLBOARDS = [
  ['MAYANAGRI METRO\nComing Soon Since 2009', '#1d3557', '#f1faee'], ['CHAI BREAK?\nALWAYS.', '#6f1d1b', '#ffe6a7'],
  ['2BHK @ ₹9 CRORE\nSea View* (*from terrace)', '#ffbe0b', '#000'], ['JUGAAD INSURANCE\nSab Theek Ho Jayega', '#2a9d8f', '#fff'],
  ['MANGO SEASON\nIS HERE 🥭', '#fb8500', '#fff'], ['SAMOSA COIN\nTo the Moon 🚀', '#8338ec', '#fff'],
];

export function buildCity(scene) {
  const world = new World();
  const groundCanvas = makeGroundCanvas();
  const pois = { stalls: [], offices: [], hospital: null, police: null, mandir: null, station: null, plaza: null, chai: null, autoStand: null, chawl: null };

  // ---- ground ----
  const gtex = new THREE.CanvasTexture(groundCanvas);
  gtex.colorSpace = THREE.SRGBColorSpace;
  gtex.anisotropy = 8;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ color: 0x8d8068 }));
  outer.rotation.x = -Math.PI / 2; outer.position.set(1200, -0.05, 0);
  scene.add(outer);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 6000), new THREE.MeshPhongMaterial({ color: 0x1f6f8b, shininess: 80, specular: 0x88bbcc, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(SEA_X - 1500 + 8, 0.12, 0);
  scene.add(sea);

  const tex = windowTextures();
  const bMat = new THREE.MeshStandardMaterial({ map: tex.map, emissiveMap: tex.emissive, emissive: 0xffe0a0, emissiveIntensity: 0, vertexColors: true, roughness: 0.9 });
  const bm = new Merger();
  const props = new Merger();
  const lamps = new Merger();
  const signs = new THREE.Group();
  scene.add(signs);

  // building with UVs scaled so 16x16 world units = one 4x4 window tile
  const addBuilding = (cx, cz, w, d, h, color, opts = {}) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        if (f === 2 || f === 3) { uv.setXY(i, 0.01, 0.99); continue; }
        const width = f < 2 ? d : w;
        uv.setXY(i, uv.getX(i) * width / 16, uv.getY(i) * h / 16);
      }
    }
    const m = new THREE.Matrix4().makeTranslation(cx, h / 2, cz);
    bm.add(geo, m, color);
    world.addBox(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, h);
    // roof clutter: water tanks, parapet
    if (!opts.noRoof) {
      props.box(w + 0.4, 0.8, d + 0.4, cx, h + 0.4, cz, 0xd8d2c4);
      props.box(w - 0.6, 0.9, d - 0.6, cx, h + 0.46, cz, 0x8f8a80);
      const tanks = Math.max(1, Math.floor(w * d / 300));
      for (let t = 0; t < tanks && t < 4; t++) {
        props.geo(CYL8, cx + R.range(-w / 3, w / 3), h + 1.9, cz + R.range(-d / 3, d / 3), 0x1a1a1a, 1.1, 2.2, 1.1);
      }
      if (R() < 0.3) props.geo(CYL8, cx + R.range(-w / 3, w / 3), h + 3, cz, 0x666666, 0.08, 5, 0.08); // antenna
    }
    return geo;
  };

  const addTree = (x, z, kind) => {
    if (kind === 'palm') {
      const tilt = R.range(-0.15, 0.15);
      props.geo(CYL8, x, 4, z, 0x8b6b45, 0.35, 8, 0.35, tilt, 0, tilt);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        props.geo(UNIT_BOX, x + Math.sin(a) * 1.6, 8.0, z + Math.cos(a) * 1.6, 0x2d7a2d, 0.8, 0.15, 3.6, 0.35, a, 0);
      }
    } else {
      props.geo(CYL8, x, 2, z, 0x6b4f2e, 0.5, 4, 0.5);
      props.geo(ICO, x, 5.5, z, R() < 0.5 ? 0x3f7d20 : 0x4f8f2f, R.range(2.6, 3.6), R.range(2.2, 3.0), R.range(2.6, 3.6));
    }
    world.addBox(x - 0.5, x + 0.5, z - 0.5, z + 0.5, 8);
  };

  const signReqs = [];
  const addSign = (text, bg, fg, x, y, z, ry, w, h) => {
    signReqs.push({ text, bg, fg, x, y, z, ry, w, h });
  };
  const addStall = (x, z, ry, sign) => {
    // cart with umbrella
    props.box(2.4, 1.0, 1.4, x, 0.9, z, 0x8b5a2b, ry);
    props.box(2.5, 0.1, 1.5, x, 1.45, z, 0xc0c0c0, ry);
    props.geo(CYL8, x, 2.2, z, 0x444444, 0.05, 1.6, 0.05);
    props.geo(CONE8, x, 3.2, z, R.pick([0xe63946, 0x2a9d8f, 0xffbe0b, 0x3a86ff]), 1.8, 0.7, 1.8);
    for (let i = 0; i < 4; i++) props.geo(ICO, x + R.range(-0.8, 0.8), 1.65, z + R.range(-0.4, 0.4), R.pick([0xff9f1c, 0x9ef01a, 0xe63946, 0xffd60a]), 0.25, 0.25, 0.25);
    world.addBox(x - 1.2, x + 1.2, z - 1.2, z + 1.2, 2);
    pois.stalls.push({ x, z, sign });
  };

  const addLamp = (x, z, ry) => {
    props.geo(CYL8, x, 3.5, z, 0x555555, 0.1, 7, 0.1);
    props.box(0.12, 0.12, 1.6, x + Math.sin(ry) * 0.8, 7, z + Math.cos(ry) * 0.8, 0x555555, ry);
    lamps.box(0.6, 0.18, 0.4, x + Math.sin(ry) * 1.5, 6.9, z + Math.cos(ry) * 1.5, 0xfff2c4, ry);
  };

  const AWN = [0xe63946, 0x2a9d8f, 0xffbe0b, 0x3a86ff, 0x8338ec, 0x06d6a0];
  const addFacade = (x, z, w, d, h, faces, groundShop, startFloor = 1, plinth = true) => {
    const floors = Math.floor(h / 4);
    for (const [fx, fz] of faces) {
      const along = fx !== 0 ? d : w;      // facade width
      const ry = Math.atan2(fx, fz);
      const ox = x + fx * (w / 2), oz = z + fz * (d / 2);
      const tx = Math.abs(fz), tz = Math.abs(fx); // tangent along facade
      const rail = R.pick([0x444444, 0xffffff, 0x2a9d8f, 0x8d99ae]);
      // ground floor plinth / shop band
      if (plinth) props.box(along + 0.1, 3.2, 0.25, ox + fx * 0.1, 1.6, oz + fz * 0.1, groundShop ? R.pick(AWN) : 0x8d8172, ry);
      if (groundShop && R() < 0.5) props.box(Math.min(along * 0.6, 10), 0.15, 1.8, ox + fx * 0.9, 3.1, oz + fz * 0.9, R.pick(AWN), ry);
      for (let fl = startFloor; fl < floors; fl++) {
        const y = fl * 4;
        for (let c = -along / 2 + 4; c < along / 2 - 2; c += 8) {
          const px = ox + tx * c, pz = oz + tz * c;
          const r = R();
          if (r < 0.45) {
            // balcony: slab + railing + side rails
            props.box(5, 0.25, 1.4, px + fx * 0.7, y, pz + fz * 0.7, 0xd8d2c4, ry);
            props.box(5, 1.0, 0.08, px + fx * 1.38, y + 0.6, pz + fz * 1.38, rail, ry);
            if (R() < 0.35) props.box(4, 0.06, 0.06, px + fx * 1.0, y + 2.2, pz + fz * 1.0, 0x222222, ry); // clothes line
            if (R() < 0.35) props.box(0.9, 1.1, 0.06, px + fx * 1.05 + tx * R.range(-1.5, 1.5), y + 1.6, pz + fz * 1.05 + tz * R.range(-1.5, 1.5), R.pick([0xe63946, 0xffbe0b, 0x3a86ff, 0xff70a6, 0xffffff]), ry); // drying clothes
            if (R() < 0.3) props.geo(ICO, px + fx * 1.0 + tx * 1.8, y + 0.6, pz + fz * 1.0 + tz * 1.8, 0x3f7d20, 0.4, 0.4, 0.4); // tulsi pot
          } else if (r < 0.75) {
            // split AC unit
            props.box(1.0, 0.7, 0.5, px + fx * 0.3 + tx * 1.4, y + 1.0, pz + fz * 0.3 + tz * 1.4, 0xf2f2f2, ry);
            props.box(0.6, 0.5, 0.05, px + fx * 0.56 + tx * 1.4, y + 1.0, pz + fz * 0.56 + tz * 1.4, 0x999999, ry);
          } else {
            // window sunshade (chajja)
            props.box(3.5, 0.15, 0.8, px + fx * 0.4, y + 2.9, pz + fz * 0.4, 0xbfb6a6, ry);
          }
        }
        // floor ledge
        props.box(along + 0.2, 0.18, 0.3, ox + fx * 0.15, y - 0.1, oz + fz * 0.15, 0xe0dacb, ry);
      }
    }
  };

  // overhead tangled electric wires (cheap line segments)
  const wirePts = [];
  const sagWire = (ax, ay, az, bx, by, bz, sag) => {
    const N = 6;
    let px = ax, py = ay, pz = az;
    for (let s2 = 1; s2 <= N; s2++) {
      const t = s2 / N;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const y = ay + (by - ay) * t - sag * 4 * t * (1 - t);
      wirePts.push(px, py, pz, x, y, z);
      px = x; py = y; pz = z;
    }
  };
  const addPoleLine = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n2 = Math.max(1, Math.round(len / 22));
    let prev = null;
    for (let s2 = 0; s2 <= n2; s2++) {
      const x = x0 + (x1 - x0) * s2 / n2, z = z0 + (z1 - z0) * s2 / n2;
      props.geo(CYL8, x, 4.5, z, 0x6b6b6b, 0.13, 9, 0.13);
      props.box(1.6, 0.12, 0.12, x, 8.6, z, 0x555555, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2);
      if (R() < 0.25) props.box(0.6, 0.8, 0.5, x, 7.6, z, 0x777777); // transformer box
      if (prev) {
        for (let wi = 0; wi < 3; wi++) {
          const off = (wi - 1) * 0.6;
          const ox = Math.cos(Math.atan2(x1 - x0, z1 - z0)) * off, oz = -Math.sin(Math.atan2(x1 - x0, z1 - z0)) * off;
          sagWire(prev[0] + ox, 8.6, prev[1] + oz, x + ox, 8.6, z + oz, R.range(0.6, 1.8));
        }
      }
      prev = [x, z];
    }
    return prev;
  };

  const curb = (x0, z0, x1, z1, painted) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0);
    if (!painted) { props.box(0.35, 0.28, len, (x0 + x1) / 2, 0.14, (z0 + z1) / 2, 0x9d978a, ry); return; }
    const n2 = Math.floor(len / 2);
    for (let s2 = 0; s2 < n2; s2++) {
      const t = (s2 + 0.5) / n2;
      props.box(0.35, 0.28, len / n2, x0 + (x1 - x0) * t, 0.14, z0 + (z1 - z0) * t, s2 % 2 ? 0x111111 : 0xffd60a, ry);
    }
  };

  const lampSpots = [];
  // ---- per block ----
  for (let bx = 0; bx < NB; bx++) for (let bz = 0; bz < NB; bz++) {
    const x0 = line(bx), z0 = line(bz);
    const cx = x0 + 50, cz = z0 + 50;
    const dname = district(bx, bz);
    const A = x0 + 14, B = x0 + 86; // buildable x range
    const C = z0 + 14, D = z0 + 86;

    const lots = (n, m, hRange, palette, gap = 4, opts = {}) => {
      const lw = (B - A) / n, ld = (D - C) / m;
      for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
        if (opts.skip && opts.skip(i, j)) continue;
        if (R() < (opts.empty ?? 0.06)) continue;
        const w = lw - gap - R.range(0, opts.jitter ?? 3), d = ld - gap - R.range(0, opts.jitter ?? 3);
        const x = A + lw * (i + 0.5), z = C + ld * (j + 0.5);
        const h = R.range(hRange[0], hRange[1]);
        addBuilding(x, z, w, d, h, R.pick(palette), opts);
        if (opts.facade !== false && h > 7) {
          const faces = [];
          if (j === 0) faces.push([0, -1]);
          if (j === m - 1) faces.push([0, 1]);
          if (i === 0) faces.push([-1, 0]);
          if (i === n - 1) faces.push([1, 0]);
          addFacade(x, z, w, d, h, faces, opts.groundShop, opts.startFloor || 1, opts.plinth !== false);
        }
        if (opts.onBuilding) opts.onBuilding(x, z, w, d, h, i, j, n, m);
      }
    };

    switch (dname) {
      case 'residential':
        lots(2, 2, [10, 32], PASTEL, 5, {
          groundShop: true,
          onBuilding: (x, z, w, d, h) => {
            if (R() < 0.15) {
              const ws = R.pick(WALL_SIGNS);
              addSign(ws[0], ws[1], ws[2], x, 2.5, z + d / 2 + 0.05, 0, 5, 1.6);
            }
          },
        });
        break;
      case 'bazaar':
        lots(3, 3, [7, 16], BRIGHT, 3, {
          jitter: 1,
          startFloor: 2,
          plinth: false,
          empty: 0.03,
          onBuilding: (x, z, w, d, h, i, j, n, m) => {
            const faces = [];
            if (j === 0) faces.push([0, -1]);
            if (j === m - 1) faces.push([0, 1]);
            if (i === 0) faces.push([-1, 0]);
            if (i === n - 1) faces.push([1, 0]);
            for (const [fx, fz] of faces) {
              const s = R.pick(SHOP_SIGNS);
              const sx = x + fx * (w / 2 + 0.06), sz = z + fz * (d / 2 + 0.06);
              const ry = Math.atan2(fx, fz);
              addSign(s[0], s[1], s[2], sx, 4.2, sz, ry, Math.min(w, d) * 0.85, 1.6);
              // awning
              props.box(Math.min(w, d) * 0.9, 0.15, 2.2, sx + fx * 1.1, 3.0, sz + fz * 1.1, R.pick([0xe63946, 0x2a9d8f, 0xffbe0b, 0x3a86ff, 0x8338ec]), ry);
              // shutter
              props.box(Math.min(w, d) * 0.7, 2.6, 0.1, sx + fx * 0.02, 1.3, sz + fz * 0.02, R() < 0.5 ? 0x7d8597 : 0x3b3b3b, ry);
            }
          },
        });
        // carts on sidewalks
        for (let s = 0; s < 3; s++) {
          const side = Math.floor(R() * 4);
          const t = R.range(20, 80);
          const p = [[x0 + t, z0 + 11.5, 0], [x0 + t, z0 + 88.5, 0], [x0 + 11.5, z0 + t, Math.PI / 2], [x0 + 88.5, z0 + t, Math.PI / 2]][side];
          addStall(p[0], p[1], p[2], R.pick(SHOP_SIGNS)[0]);
        }
        // bunting strings across roads
        for (let s = 0; s < 2; s++) {
          const z = z0 + R.range(25, 75);
          for (let k = 0; k < 10; k++) {
            props.geo(CONE8, x0 - 8 + k * 1.8, 7.2, z, R.pick([0xff9933, 0xffffff, 0x138808, 0xe63946, 0xffd60a]), 0.4, 0.8, 0.05, Math.PI, 0, 0);
          }
        }
        break;
      case 'towers': {
        const n = R() < 0.5 ? 1 : 2;
        lots(n, 2, [40, 95], GLASS, 8, { empty: 0.1, facade: false, onBuilding: (x, z, w, d, h) => {
          // glass tower: vertical fins + crown
          for (let f = -w / 2 + 2; f < w / 2; f += 6) {
            props.box(0.5, h, 0.6, x + f, h / 2, z + d / 2 + 0.3, 0xe5e5e5);
            props.box(0.5, h, 0.6, x + f, h / 2, z - d / 2 - 0.3, 0xe5e5e5);
          }
          props.box(w * 0.6, 4, d * 0.6, x, h + 2, z, 0xdddddd);
          props.geo(CYL8, x, h + 9, z, 0xcc2222, 0.15, 10, 0.15);
        } });
        const bb = R.pick(BILLBOARDS);
        props.geo(CYL8, x0 + 16, 7, z0 + 16, 0x555555, 0.3, 14, 0.3);
        addSign(bb[0], bb[1], bb[2], x0 + 16, 15, z0 + 16, Math.PI / 4, 14, 6);
        pois.offices.push({ x: x0 + 11, z: z0 + 50 }, { x: x0 + 50, z: z0 + 89 });
        break;
      }
      case 'chawl':
        lots(4, 4, [3.5, 7], FADED, 2.5, {
          facade: false,
          jitter: 2, empty: 0.08, noRoof: true,
          onBuilding: (x, z, w, d, h) => {
            props.box(w + 0.8, 0.15, d + 0.8, x, h + 0.1, z, R() < 0.6 ? 0x1e6fd9 : 0x8a8f94); // blue tarp / tin roof
            if (R() < 0.4) props.geo(CYL8, x, h + 1, z, 0x111111, 0.7, 1.6, 0.7);
          },
        });
        if (!pois.chawl) pois.chawl = { x: x0 + 11, z: z0 + 11 };
        break;
      case 'promenade':
        lots(1, 3, [12, 20], [0xf4f1de, 0xe9edc9, 0xf2e8cf, 0xfefae0], 6, { empty: 0.0 });
        break;
      case 'rail': {
        const isStation = bx === 5;
        if (!isStation) {
          for (const lx of [x0 + 32, x0 + 68]) for (const lz of [z0 + 28, z0 + 72]) {
            if (R() < 0.1) continue;
            addBuilding(lx, lz, R.range(26, 32), R.range(18, 24), R.range(6, 14), R.pick(FADED.concat(PASTEL)));
          }
        } else {
          props.box(70, 1.0, 5, cx, 0.5, RAIL_Z - 7.5, 0xb0a99f);
          props.box(70, 1.0, 5, cx, 0.5, RAIL_Z + 7.5, 0xb0a99f);
          world.addBox(cx - 35, cx + 35, RAIL_Z - 10, RAIL_Z - 5, 1);
          world.addBox(cx - 35, cx + 35, RAIL_Z + 5, RAIL_Z + 10, 1);
          for (let t = -30; t <= 30; t += 10) {
            props.geo(CYL8, cx + t, 3, RAIL_Z - 8.5, 0x666666, 0.15, 5, 0.15);
            props.geo(CYL8, cx + t, 3, RAIL_Z + 8.5, 0x666666, 0.15, 5, 0.15);
          }
          props.box(72, 0.3, 6, cx, 5.6, RAIL_Z - 7.5, 0x2a9d8f);
          props.box(72, 0.3, 6, cx, 5.6, RAIL_Z + 7.5, 0x2a9d8f);
          addBuilding(cx, z0 + 24, 40, 16, 10, 0xc65d3b);
          addSign('MAYANAGRI LOCAL STATION\nमायानगरी', '#ffd60a', '#000', cx, 7.5, z0 + 32.1, 0, 22, 4);
          pois.station = { x: cx - 28, z: z0 + 11 };
          pois.autoStand = { x: cx + 20, z: z0 + 11 };
        }
        break;
      }
      case 'maidan':
        for (let t = 0; t < 10; t++) {
          const a = (t / 10) * Math.PI * 2;
          addTree(cx + Math.sin(a) * 33, cz + Math.cos(a) * 33, 'neem');
        }
        if (bx === 2) {
          for (const dz of [-10, 10]) for (const dx of [-0.25, 0, 0.25]) props.geo(CYL8, cx + dx, 0.4, cz + dz, 0xf1e3c6, 0.04, 0.8, 0.04);
          addSign('GULLY CRICKET CLUB\nOne Tip One Hand', '#2b9348', '#fff', cx, 3, z0 + 13.5, 0, 12, 3);
        } else {
          // big banyan
          props.geo(CYL8, cx, 3, cz, 0x5a4026, 2.2, 6, 2.2);
          props.geo(ICO, cx, 9, cz, 0x2f6b1f, 12, 6, 12);
          for (let r = 0; r < 10; r++) props.geo(CYL8, cx + R.range(-9, 9), 3.5, cz + R.range(-9, 9), 0x6b4f2e, 0.12, 7, 0.12);
          world.addBox(cx - 2.2, cx + 2.2, cz - 2.2, cz + 2.2, 12);
        }
        break;
      case 'mandir': {
        props.box(34, 2, 34, cx, 1, cz, 0xe9d8a6);
        world.addBox(cx - 17, cx + 17, cz - 17, cz + 17, 2);
        props.box(16, 8, 16, cx, 6, cz, 0xf4a261);
        // shikhara: stacked tapering tiers
        for (let t = 0; t < 7; t++) {
          const s = 13 - t * 1.7;
          props.box(s, 2.6, s, cx, 11 + t * 2.4, cz, t % 2 ? 0xf77f00 : 0xfcbf49);
        }
        props.geo(ICO, cx, 28.6, cz, 0xffd60a, 1.4, 1.4, 1.4);
        props.geo(CYL8, cx, 31, cz, 0x333333, 0.06, 4, 0.06);
        props.geo(CONE8, cx + 0.9, 32.2, cz, 0xff9933, 0.6, 1.6, 0.05, 0, 0, -Math.PI / 2);
        for (const [dx, dz] of [[-6, 8], [6, 8], [-6, -8], [6, -8]]) props.geo(CYL8, cx + dx, 5, cz + dz + Math.sign(dz) * 1, 0xfff1d0, 0.6, 6, 0.6);
        world.addBox(cx - 8, cx + 8, cz - 8, cz + 8, 30);
        addSign('॥ श्री मंदिर ॥', '#ff9933', '#7a0000', cx, 9, cz + 8.1, 0, 10, 2);
        for (let s = 0; s < 4; s++) addStall(x0 + 20 + s * 16, z0 + 11.5, 0, 'PHOOL MALA');
        pois.mandir = { x: x0 + 44, z: z0 + 11 }; // between the flower stalls
        break;
      }
      case 'plaza': {
        // stone gateway arch
        const ax = cx - 10, az = cz;
        props.box(8, 22, 8, ax, 11, az - 12, 0xc9a66b);
        props.box(8, 22, 8, ax, 11, az + 12, 0xc9a66b);
        props.box(9, 8, 34, ax, 26, az, 0xc9a66b);
        props.box(10, 2, 36, ax, 30.5, az, 0xb08850);
        for (const dz of [-14, -5, 5, 14]) props.geo(ICO, ax, 33, az + dz, 0xb08850, 2, 2, 2);
        world.addBox(ax - 4, ax + 4, az - 16, az - 8, 22);
        world.addBox(ax - 4, ax + 4, az + 8, az + 16, 22);
        addSign('DARWAZA', '#c9a66b', '#5a3e1b', ax + 4.6, 24, az, Math.PI / 2, 14, 2.5);
        addSign('SHAADI HALL ➜', '#ff006e', '#fff', cx + 30, 5, z0 + 13.5, 0, 10, 2.5);
        for (let s = 0; s < 3; s++) addStall(cx + 20, z0 + 25 + s * 15, Math.PI / 2, 'BHEL PURI');
        pois.plaza = { x: cx + 25, z: cz };
        break;
      }
      case 'police':
        addBuilding(cx, cz, 50, 34, 14, 0x9fb4c7);
        addSign('POLICE THANA\nपुलिस स्टेशन', '#1d4ed8', '#fff', cx, 10.5, cz + 17.1, 0, 20, 4);
        pois.police = { x: cx, z: z0 + 89 };
        break;
      case 'hospital':
        addBuilding(cx, cz, 52, 40, 22, 0xf5f5f5);
        addSign('SARKARI HOSPITAL ✚', '#fff', '#d00000', cx, 17, cz + 20.1, 0, 26, 4);
        pois.hospital = { x: cx, z: z0 + 89 };
        break;
    }

    // trees and lamps along sidewalks (not maidan interior)
    for (let t = 25; t < 100; t += 50) {
      if (R() < 0.55) addTree(x0 + t + R.range(-5, 5), z0 + 10.3, dname === 'promenade' ? 'palm' : 'neem');
      if (R() < 0.55) addTree(x0 + 10.3, z0 + t + R.range(-5, 5), 'neem');
    }
    addLamp(x0 + 10, z0 + 10, -Math.PI * 0.75);
    addLamp(x0 + 90, z0 + 90, Math.PI * 0.25);
    lampSpots.push([x0 + 10 + Math.sin(-Math.PI * 0.75) * 1.5, z0 + 10 + Math.cos(-Math.PI * 0.75) * 1.5], [x0 + 90 + Math.sin(Math.PI * 0.25) * 1.5, z0 + 90 + Math.cos(Math.PI * 0.25) * 1.5]);

    // curbs (painted yellow-black near important places)
    const painted = ['bazaar', 'mandir', 'police', 'hospital', 'plaza'].includes(dname);
    const e0 = 9.2, e1 = 90.8;
    curb(x0 + e0, z0 + e0, x0 + e1, z0 + e0, painted);
    curb(x0 + e0, z0 + e1, x0 + e1, z0 + e1, painted);
    if (dname === 'rail') {
      curb(x0 + e0, z0 + e0, x0 + e0, RAIL_Z - 5, painted); curb(x0 + e0, RAIL_Z + 5, x0 + e0, z0 + e1, painted);
      curb(x0 + e1, z0 + e0, x0 + e1, RAIL_Z - 5, painted); curb(x0 + e1, RAIL_Z + 5, x0 + e1, z0 + e1, painted);
    } else {
      curb(x0 + e0, z0 + e0, x0 + e0, z0 + e1, painted);
      curb(x0 + e1, z0 + e0, x0 + e1, z0 + e1, painted);
    }

    // utility poles + wires in the older, denser districts
    if (['bazaar', 'chawl', 'residential', 'rail'].includes(dname)) {
      const zz = z0 + 11.5;
      const end = addPoleLine(x0 + 18, zz, x0 + 82, zz);
      if (['bazaar', 'chawl'].includes(dname)) {
        // tangle across the street to the next block
        for (let tw = 0; tw < 4; tw++) sagWire(x0 + R.range(18, 82), 8.6, zz, x0 + R.range(18, 82), 8.6, zz - 23, R.range(1, 3));
        addPoleLine(x0 + 11.5, z0 + 25, x0 + 11.5, z0 + 75);
      }
    }
  }

  // remove colliders that intersect the railway track (the trains need a clear path)
  for (const cell of world.cells) {
    for (let i = cell.length - 1; i >= 0; i--) {
      const b = cell[i];
      if (b.minZ < RAIL_Z + 4 && b.maxZ > RAIL_Z - 4) cell.splice(i, 1);
    }
  }

  // beach palms + promenade wall
  for (let z = -590; z < 600; z += R.range(14, 26)) {
    addTree(-618 + R.range(-3, 3), z, 'palm');
  }
  for (let z = -600; z < 600; z += 1) { /* tetrapods hinted by a low wall */ }
  props.box(1, 1, 1220, -609.5, 0.5, 0, 0xcfc7b0);

  // railway: rails + sleepers
  props.box(1400, 0.2, 0.2, 30, 0.2, RAIL_Z - 1.2, 0x777777);
  props.box(1400, 0.2, 0.2, 30, 0.2, RAIL_Z + 1.2, 0x777777);
  for (let x = SEA_X; x < 700; x += 2.5) props.box(0.6, 0.12, 3.6, x, 0.08, RAIL_Z, 0x4a3b2c);

  buildSignAtlas(signReqs, signs);
  const bMesh = bm.build(bMat);
  scene.add(bMesh);
  const propMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  scene.add(props.build(propMat));
  const lampMat = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffd27a, emissiveIntensity: 0 });
  scene.add(lamps.build(lampMat));
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  scene.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x151515 })));

  // ---- local train ----
  const train = new THREE.Group();
  const coaches = 6, clen = 20;
  for (let i = 0; i < coaches; i++) {
    const zc = -i * (clen + 1);
    box(3.2, 3.4, clen, i === 0 ? 0xffd60a : 0x7b2d26, 0, 2.2, zc, train);
    box(3.25, 0.9, clen - 1, 0x2b2d42, 0, 2.6, zc, train);
    box(3.3, 0.35, clen, 0xffd60a, 0, 1.3, zc, train);
    box(3.0, 0.3, clen, 0x666666, 0, 4.05, zc, train);
    for (let d = -1; d <= 1; d += 2) {
      // door gaps with people hanging out, Mumbai-local style
      const p = makeHuman();
      p.position.set(1.75, 0.6, zc + d * 5);
      p.rotation.y = Math.PI / 2;
      p.scale.setScalar(0.9);
      train.add(p);
    }
  }
  const tsign = textPlane('FAST ● CHURCHGATE-ISH', 3, 0.6, { bg: '#000', fg: '#ff4d00' });
  tsign.position.set(0, 3.6, clen / 2 + 0.05);
  train.add(tsign);
  INST.register(train);
  train.rotation.y = Math.PI / 2; // run along +x
  train.position.set(-900, 0, RAIL_Z);
  scene.add(train);
  const trainState = { mesh: train, x: -900, speed: 24, length: coaches * (clen + 1), horned: false };

  return { world, groundCanvas, bMat, lampMat, pois, train: trainState, sea, lampSpots, groundMat: ground.material };
}

// ---------------------------------------------------------------------------
// All static signs share texture atlas pages -> one draw call per page.
// ---------------------------------------------------------------------------
function buildSignAtlas(reqs, parent) {
  const PAGE = 4096, CW = 512, CH = 256, PER_ROW = PAGE / CW, PER_PAGE = PER_ROW * (PAGE / CH);
  const cells = new Map();
  const pages = [];
  const geosByPage = [];
  const drawCell = (g, req, cx, cy, rw, rh) => {
    g.fillStyle = req.bg;
    g.fillRect(cx - 4, cy - 4, rw + 8, rh + 8); // padding against mip bleed
    g.fillStyle = req.fg;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = String(req.text).split('\n');
    const lh = rh / (lines.length + 0.3);
    lines.forEach((ln, i) => {
      let size = Math.floor(lh * 0.62);
      const font = (sz) => `bold ${sz}px "Arial Black", Arial, sans-serif`;
      g.font = font(size);
      while (g.measureText(ln).width > rw * 0.92 && size > 8) { size -= 2; g.font = font(size); }
      g.fillText(ln, cx + rw / 2, cy + lh * (i + 0.65));
    });
  };
  for (const r of reqs) {
    const aspect = Math.round((r.w / r.h) * 4) / 4;
    const key = [r.text, r.bg, r.fg, aspect].join('|');
    let cell = cells.get(key);
    if (!cell) {
      const idx = cells.size;
      const pi = Math.floor(idx / PER_PAGE), li = idx % PER_PAGE;
      if (!pages[pi]) {
        const c = document.createElement('canvas'); c.width = c.height = PAGE;
        pages[pi] = c; geosByPage[pi] = [];
      }
      const cx = (li % PER_ROW) * CW + 6, cy = Math.floor(li / PER_ROW) * CH + 6;
      const aw = CW - 12, ah = CH - 12;
      let rw = aw, rh = aw / aspect;
      if (rh > ah) { rh = ah; rw = ah * aspect; }
      drawCell(pages[pi].getContext('2d'), r, cx, cy, rw, rh);
      cell = { pi, cx, cy, rw, rh };
      cells.set(key, cell);
    }
    const geo = new THREE.PlaneGeometry(r.w, r.h);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i), v = uv.getY(i);
      uv.setXY(i, (cell.cx + u * cell.rw) / PAGE, 1 - (cell.cy + (1 - v) * cell.rh) / PAGE);
    }
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(r.x, r.y, r.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r.ry, 0)), new THREE.Vector3(1, 1, 1)));
    geosByPage[cell.pi].push(geo);
  }
  pages.forEach((c, pi) => {
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mesh = new THREE.Mesh(mergeGeometries(geosByPage[pi], false), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    parent.add(mesh);
  });
}

// sidewalk corner points used by peds, pickups and missions
export function sidewalkCorners() {
  const pts = [];
  for (let i = 0; i < LINES; i++) for (let j = 0; j < LINES; j++) {
    for (const sx of [-11, 11]) for (const sz of [-11, 11]) {
      const x = line(i) + sx, z = line(j) + sz;
      if (Math.abs(x) > HALF + 5 || Math.abs(z) > HALF + 5) continue;
      if (Math.abs(z - RAIL_Z) < 8) continue;
      pts.push({ x, z });
    }
  }
  return pts;
}
