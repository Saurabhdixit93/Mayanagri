// The Arabian Sea: wave height, jetty + Koliwada fishing village, Kila island with a
// lighthouse and treasure, an anchored cargo ship, and water collisions for boats/swimmers.
import * as THREE from 'three';
import { SEA_X } from './config.js';
import { box, cyl, cone, textPlane, INST } from './models.js';
import { rand, pick, clamp } from './utils.js';

export const SEA_MIN_X = SEA_X - 650;
export const SEA_MAX_Z = 720;
export const ISLAND = { x: -905, z: 130, r: 42, h: 1.2 };
export const SHIP = { x: -1120, z: -250, w: 20, len: 120 };
export const JETTY = { x0: -705, x1: -626, z: -150, w: 6, h: 1.1 };
export const KOLIWADA = { x: -624, z: -132 };
export const ISLAND_DOCK = { x: ISLAND.x + ISLAND.r + 6, z: ISLAND.z };

// Same swell the wave mesh uses (fx.js) so boats ride the visible waves.
export function waveH(x, z, t) {
  const shore = Math.min(1, (SEA_X - x) / 40 + 0.2) * Math.min(1, Math.max(0, (x - (SEA_X - 700)) / 200));
  if (shore <= 0) return 0.2;
  return 0.2 + (Math.sin(x * 0.08 + t * 1.6) * 0.5 + Math.sin(z * 0.05 + x * 0.03 + t * 1.1) * 0.35 + Math.sin(x * 0.21 - z * 0.13 + t * 2.3) * 0.15) * Math.max(0, shore);
}

export class Sea {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.boxes = [];        // sea-side colliders (jetty pilings, fort walls, ship hull)
    this.mapShapes = [];
    this.t = 0;
    this.buildJetty();
    this.buildKoliwada();
    this.buildIsland();
    this.buildShip();
    this.buildBuoy();
  }

  addBox(minX, maxX, minZ, maxZ, h, tag) {
    const b = { minX, maxX, minZ, maxZ, h, tag };
    this.boxes.push(b);
    return b;
  }

  // ---------------- construction ----------------
  buildJetty() {
    const g = new THREE.Group();
    const J = JETTY, len = J.x1 - J.x0, cx = (J.x0 + J.x1) / 2;
    box(len, 0.25, J.w, 0x8b6b45, cx, J.h, J.z, g);                         // deck
    for (let x = J.x0 + 1; x < J.x1; x += 2.2) box(0.12, 0.05, J.w, 0x6e5235, x, J.h + 0.14, J.z, g); // planks
    for (let x = J.x0 + 1; x < J.x1; x += 6) for (const s of [-1, 1]) {
      cyl(0.22, 4, 0x4a3b2c, x, J.h - 1.6, J.z + s * (J.w / 2 - 0.3), g);  // pilings
      cyl(0.05, 1.0, 0x333333, x, J.h + 0.6, J.z + s * (J.w / 2 - 0.1), g); // rail posts
    }
    box(len, 0.06, 0.06, 0x333333, cx, J.h + 1.05, J.z - J.w / 2 + 0.1, g);
    box(len, 0.06, 0.06, 0x333333, cx, J.h + 1.05, J.z + J.w / 2 - 0.1, g);
    const s = textPlane('KOLIWADA JETTY · कोळीवाडा', 7, 1.2, { bg: '#0077b6', fg: '#fff' });
    s.position.set(J.x1 - 1, J.h + 2.4, J.z); s.rotation.y = Math.PI / 2; g.add(s);
    box(0.15, 2.4, 0.15, 0x333333, J.x1 - 1, J.h + 1.1, J.z - 2.5, g);
    box(0.15, 2.4, 0.15, 0x333333, J.x1 - 1, J.h + 1.1, J.z + 2.5, g);
    INST.register(g);
    this.scene.add(g);
    this.addBox(J.x0, J.x1, J.z - J.w / 2, J.z + J.w / 2, J.h, 'jetty');
    this.mapShapes.push({ x: cx, z: J.z, w: len, d: J.w, color: '#8b6b45' });
  }

  buildKoliwada() {
    const g = new THREE.Group();
    const K = KOLIWADA;
    // colourful beached boats, drying racks, nets, huts
    for (let i = 0; i < 4; i++) {
      const z = K.z - 40 + i * 9 + (i > 1 ? 30 : 0);
      const c = pick([0x1d4ed8, 0xe63946, 0x2a9d8f, 0xffbe0b]);
      const bg = new THREE.Group();
      box(1.6, 0.7, 6, c, 0, 0.35, 0, bg);
      box(1.65, 0.18, 6.05, 0xffffff, 0, 0.62, 0, bg);
      const bow = box(1.1, 0.7, 1.1, c, 0, 0.45, 3.1, bg); bow.rotation.y = Math.PI / 4;
      cyl(0.05, 3, 0x6b4f2e, 0, 1.8, 0.8, bg);
      cone(0.4, 0.8, 0xff9f1c, 0.35, 3.0, 0.8, bg).rotation.z = -Math.PI / 2;
      bg.position.set(-630 + rand(-2, 2), 0, z); bg.rotation.y = rand(-0.4, 0.4) + Math.PI / 2;
      g.add(bg);
      this.world.addBox(bg.position.x - 2, bg.position.x + 2, z - 2, z + 2, 1.2);
    }
    for (let i = 0; i < 3; i++) {
      const z = K.z + 14 + i * 5;
      for (const dz of [-1.5, 1.5]) cyl(0.06, 2.2, 0x6b4f2e, -622 + dz * 0, 1.1, z + dz, g);
      for (let k = 0; k < 6; k++) box(0.08, 0.5, 0.25, 0xc0c0c0, -622, 1.6, z - 1.3 + k * 0.5, g); // drying bombil
      box(0.04, 0.04, 3, 0x333333, -622, 2.1, z, g);
    }
    box(4, 0.15, 3, 0x2a9d8f, -626, 0.1, K.z - 6, g); // net pile
    const s = textPlane('कोळीवाडा  KOLIWADA', 6, 1.2, { bg: '#ff9f1c', fg: '#3a0ca3' });
    s.position.set(-612, 3, K.z); s.rotation.y = -Math.PI / 2; g.add(s);
    INST.register(g);
    this.scene.add(g);
  }

  buildIsland() {
    const I = ISLAND;
    const g = new THREE.Group();
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(I.r, I.r + 7, 3, 40), new THREE.MeshLambertMaterial({ color: 0xe3cf9a }));
    sand.position.set(I.x, I.h - 1.5, I.z); sand.receiveShadow = true;
    g.add(sand);
    const grass = new THREE.Mesh(new THREE.CylinderGeometry(I.r - 8, I.r - 6, 0.3, 32), new THREE.MeshLambertMaterial({ color: 0x6a994e }));
    grass.position.set(I.x, I.h + 0.02, I.z); grass.receiveShadow = true;
    g.add(grass);
    const parts = new THREE.Group();
    // rocks
    for (let i = 0; i < 18; i++) {
      const a = rand(0, Math.PI * 2), rr = I.r + rand(1, 6);
      box(rand(1.5, 3.5), rand(1, 2.5), rand(1.5, 3.5), pick([0x6c757d, 0x495057, 0x5c5f66]), I.x + Math.cos(a) * rr, 0.6, I.z + Math.sin(a) * rr, parts).rotation.y = a;
    }
    // ruined fort (kila): square of walls with a gate facing the dock (+x)
    const F = 14, H = 5;
    const wall = (x, z, w, d) => { box(w, H, d, 0xa08463, x, I.h + H / 2, z, parts); this.addBox(x - w / 2, x + w / 2, z - d / 2, z + d / 2, I.h + H, 'fort'); };
    wall(I.x, I.z - F, F * 2, 1.4);
    wall(I.x, I.z + F, F * 2, 1.4);
    wall(I.x - F, I.z, 1.4, F * 2);
    wall(I.x + F, I.z - F / 2 - 2.5, 1.4, F - 5);   // gate gap in the middle of the east wall
    wall(I.x + F, I.z + F / 2 + 2.5, 1.4, F - 5);
    for (const [dx, dz] of [[-F, -F], [F, -F], [-F, F], [F, F]]) { cyl(2.2, H + 2, 0x8d7155, I.x + dx, I.h + (H + 2) / 2, I.z + dz, parts); }
    for (let i = -F + 1; i < F; i += 2.5) box(1, 0.8, 1.5, 0xa08463, I.x + i, I.h + H + 0.4, I.z - F, parts); // battlements
    const flag = cone(0.8, 2.5, 0xff9933, I.x - F, I.h + H + 4, I.z - F, parts); flag.rotation.z = -Math.PI / 2;
    cyl(0.06, 4, 0x333333, I.x - F, I.h + H + 3, I.z - F, parts);
    // lighthouse on the west tip
    const lx = I.x - I.r + 9, lz = I.z;
    for (let k = 0; k < 6; k++) cyl(2.6 - k * 0.25, 3, k % 2 ? 0xffffff : 0xc1121f, lx, I.h + 1.5 + k * 3, lz, parts);
    cyl(1.6, 1.5, 0x333333, lx, I.h + 19, lz, parts);
    this.lampPos = new THREE.Vector3(lx, I.h + 19, lz);
    // treasure chest in the fort courtyard
    this.chest = new THREE.Group();
    box(1.4, 0.8, 0.9, 0x6b3e1e, 0, 0.4, 0, this.chest);
    box(1.45, 0.15, 0.95, 0xffd700, 0, 0.82, 0, this.chest);
    box(0.2, 0.25, 0.05, 0xffd700, 0, 0.5, 0.47, this.chest);
    this.chest.position.set(I.x - 4, I.h, I.z + 3);
    parts.add(this.chest);
    // small dock on the east side
    box(12, 0.25, 4, 0x8b6b45, I.x + I.r + 2, I.h - 0.2, I.z, parts);
    this.addBox(I.x + I.r - 4, I.x + I.r + 8, I.z - 2, I.z + 2, I.h - 0.1, 'islandDock');
    const s = textPlane('KILA ISLAND · किला', 6, 1.2, { bg: '#5a3e1b', fg: '#ffd60a' });
    s.position.set(I.x + I.r + 7, I.h + 2.2, I.z); s.rotation.y = Math.PI / 2; parts.add(s);
    INST.register(parts);
    g.add(parts);
    // rotating lighthouse beam (visible at night)
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(6, 70, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.geometry.translate(0, -35, 0);
    this.beam.geometry.rotateZ(Math.PI / 2);
    this.beamPivot = new THREE.Group();
    this.beamPivot.position.copy(this.lampPos);
    this.beamPivot.add(this.beam);
    g.add(this.beamPivot);
    this.scene.add(g);
    this.mapShapes.push({ x: I.x, z: I.z, r: I.r, color: '#e3cf9a' }, { x: I.x, z: I.z, w: F * 2, d: F * 2, color: '#a08463' });
  }

  buildShip() {
    const S = SHIP;
    const g = new THREE.Group();
    box(S.w, 9, S.len, 0x7a1f1f, 0, 2.5, 0, g);           // hull
    box(S.w + 0.2, 1.2, S.len + 0.2, 0x111111, 0, -1.4, 0, g); // waterline
    box(S.w * 0.7, 3, 10, 0x7a1f1f, 0, 3, S.len / 2 + 3, g); // bow block
    const bow = box(S.w * 0.72, 9, S.w * 0.72, 0x7a1f1f, 0, 2.5, S.len / 2 + 4, g); bow.rotation.y = Math.PI / 4;
    const cols = [0x1d4ed8, 0xe63946, 0x2a9d8f, 0xffbe0b, 0xff7b00, 0x6a4c93];
    for (let z = -S.len / 2 + 22; z < S.len / 2 - 6; z += 6.5) for (let x = -S.w / 2 + 2.5; x < S.w / 2 - 1; x += 2.6) {
      const n = 1 + Math.floor(rand(0, 3));
      for (let k = 0; k < n; k++) box(2.4, 2.5, 6, pick(cols), x, 7 + 2.5 / 2 + k * 2.5, z, g);
    }
    box(S.w - 2, 12, 12, 0xf1f1f1, 0, 13, -S.len / 2 + 9, g);  // bridge
    box(S.w - 1.6, 1.2, 12.4, 0x223344, 0, 17, -S.len / 2 + 9, g);
    cyl(1.4, 6, 0xe63946, 0, 21, -S.len / 2 + 6, g);
    const name = textPlane('MV DESI DHOW · MAYANAGRI', 18, 2.2, { bg: '#7a1f1f', fg: '#ffffff' });
    name.position.set(S.w / 2 + 0.06, 4, 0); name.rotation.y = Math.PI / 2; g.add(name);
    g.position.set(S.x, 0, S.z);
    INST.register(g);
    this.scene.add(g);
    this.addBox(S.x - S.w / 2, S.x + S.w / 2, S.z - S.len / 2, S.z + S.len / 2 + 9, 12, 'ship');
    this.mapShapes.push({ x: S.x, z: S.z, w: S.w, d: S.len, color: '#7a1f1f' });
    this.shipStern = { x: S.x + S.w / 2 + 8, z: S.z - S.len / 2 + 12 };
  }

  buildBuoy() {
    this.buoy = new THREE.Group();
    cyl(0.7, 1.4, 0xe63946, 0, 0.5, 0, this.buoy);
    cyl(0.72, 0.35, 0xffffff, 0, 0.6, 0, this.buoy);
    cone(0.5, 1.0, 0xe63946, 0, 1.7, 0, this.buoy);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd60a }));
    lamp.position.y = 2.3; this.buoy.add(lamp);
    INST.register(this.buoy);
    this.buoy.visible = false;
    this.scene.add(this.buoy);
  }

  // ---------------- queries ----------------
  onIsland(x, z) { return Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r; }
  onJetty(x, z, pad = 0) { return x > JETTY.x0 - pad && x < JETTY.x1 + pad && Math.abs(z - JETTY.z) < JETTY.w / 2 + pad; }
  onIslandDock(x, z) { return x > ISLAND.x + ISLAND.r - 4 && x < ISLAND.x + ISLAND.r + 8 && Math.abs(z - ISLAND.z) < 2; }
  isWater(x, z) { return x < SEA_X - 0.5 && !this.onIsland(x, z) && !this.onJetty(x, z) && !this.onIslandDock(x, z); }
  atSea(x, z) { return x < SEA_X - 0.5; }

  // walking surface under a person: jetty deck, island, beach/land, or water (swim)
  groundFor(x, z) {
    if (this.onJetty(x, z)) return { h: JETTY.h + 0.13, water: false };
    if (this.onIslandDock(x, z)) return { h: ISLAND.h - 0.05, water: false };
    if (this.onIsland(x, z)) return { h: ISLAND.h, water: false };
    if (x < SEA_X - 0.5) return { h: waveH(x, z, this.t) - 0.15, water: true };
    return { h: 0, water: false };
  }

  // clamp to the sea area and push out of sea colliders
  pushBoxes(ent, r, skipTag, minY = -99) {
    let hit = null;
    for (const b of this.boxes) {
      if (b.tag === skipTag || b.h <= minY) continue;
      if (ent.x < b.minX - r || ent.x > b.maxX + r || ent.z < b.minZ - r || ent.z > b.maxZ + r) continue;
      const cx = clamp(ent.x, b.minX, b.maxX), cz = clamp(ent.z, b.minZ, b.maxZ);
      let dx = ent.x - cx, dz = ent.z - cz;
      let d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d < 1e-4) {
        const opts = [[ent.x - b.minX, -1, 0], [b.maxX - ent.x, 1, 0], [ent.z - b.minZ, 0, -1], [b.maxZ - ent.z, 0, 1]].sort((a, c) => a[0] - c[0])[0];
        ent.x += opts[1] * (opts[0] + r); ent.z += opts[2] * (opts[0] + r);
        hit = { nx: opts[1], nz: opts[2] };
      } else {
        ent.x += (dx / d) * (r - d); ent.z += (dz / d) * (r - d);
        hit = { nx: dx / d, nz: dz / d };
      }
    }
    return hit;
  }

  resolveBoat(v) {
    const r = v.spec.radius;
    let hit = this.pushBoxes(v, r);
    // island shore
    const dx = v.x - ISLAND.x, dz = v.z - ISLAND.z, d = Math.hypot(dx, dz), R = ISLAND.r + 4 + r * 0.6;
    if (d < R) { v.x = ISLAND.x + (dx / d) * R; v.z = ISLAND.z + (dz / d) * R; hit = { nx: dx / d, nz: dz / d }; }
    // mainland beach
    const shoreX = SEA_X - r * 0.6;
    if (v.x > shoreX) { v.x = shoreX; hit = { nx: -1, nz: 0 }; }
    if (v.x < SEA_MIN_X) { v.x = SEA_MIN_X; hit = { nx: 1, nz: 0 }; }
    if (Math.abs(v.z) > SEA_MAX_Z) { v.z = Math.sign(v.z) * SEA_MAX_Z; hit = { nx: 0, nz: -Math.sign(v.z) }; }
    return hit;
  }

  resolveSwimmer(p) {
    this.pushBoxes(p, p.r, 'jetty', (p.y || 0) + 0.3);
    if (p.x < SEA_MIN_X) p.x = SEA_MIN_X;
    if (Math.abs(p.z) > SEA_MAX_Z) p.z = Math.sign(p.z) * SEA_MAX_Z;
  }

  randomSeaPoint(minX = SEA_X - 420, maxX = SEA_X - 25) {
    for (let i = 0; i < 30; i++) {
      const x = rand(minX, maxX), z = rand(-650, 650);
      if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r + 25) continue;
      if (Math.abs(x - SHIP.x) < 30 && Math.abs(z - SHIP.z) < SHIP.len / 2 + 25) continue;
      if (this.onJetty(x, z, 12)) continue;
      return { x, z };
    }
    return { x: SEA_X - 100, z: 0 };
  }

  update(dt, night, buoyAt) {
    this.t += dt;
    this.beamPivot.rotation.y += dt * 0.8;
    this.beam.material.opacity = night > 0.3 ? 0.12 * night : 0;
    this.chest.rotation.y += dt * 0.5;
    if (buoyAt) {
      this.buoy.visible = true;
      this.buoy.position.set(buoyAt.x, waveH(buoyAt.x, buoyAt.z, this.t) - 0.3, buoyAt.z);
      this.buoy.rotation.z = Math.sin(this.t * 1.7) * 0.15;
    } else this.buoy.visible = false;
  }
}
