// Ramps, vehicle airtime / rooftop physics and stunt scoring (incl. unique stunt jumps).
import * as THREE from 'three';
import { line, RAIL_Z, SEA_X } from './config.js';
import { textPlane, INST } from './models.js';

// unique stunt jumps: x,z = ramp start (low end), yaw = launch direction, L,H,w = size, req = airtime needed
export const RAMPS = [
  { name: 'Beach Uchhal',         x: SEA_X + 11, z: -380, yaw: 0,            L: 9,  H: 2.6, w: 6, req: 1.0, unique: true },
  { name: 'Sea-face Rail Jump',   x: SEA_X + 11, z: 300,  yaw: Math.PI,      L: 12, H: 4,   w: 6, req: 1.4, unique: true },
  { name: 'Maidan Over the Road', x: line(2) + 52, z: line(10) + 50, yaw: Math.PI / 2, L: 10, H: 3.4, w: 7, req: 1.2, unique: true },
  { name: 'Darwaza ke Beech Se',  x: line(0) + 72, z: line(2) + 50, yaw: -Math.PI / 2, L: 8, H: 2.2, w: 5, req: 0.9, unique: true },
  { name: 'Local Train Leap',     x: line(3) + 4.5, z: RAIL_Z - 26, yaw: 0, L: 10, H: 3.5, w: 5, req: 1.2, unique: true },
  { name: 'Mandir Chowk Hop',     x: line(6) + 4.5, z: line(9) + 30, yaw: 0, L: 8, H: 2.2, w: 5, req: 0.9, unique: true },
];

function wedgeGeo(w, H, L) {
  const geo = new THREE.BoxGeometry(w, H, L);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getZ(i) < 0 && p.getY(i) > 0) p.setY(i, -H / 2); // low end
  }
  geo.translate(0, H / 2, L / 2);
  geo.computeVertexNormals();
  return geo;
}

function stripeTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8b5a2b'; g.fillRect(0, 0, 64, 256);
  for (let y = 0; y < 256; y += 16) { g.fillStyle = y % 32 ? '#7a4d24' : '#9a6834'; g.fillRect(0, y, 64, 14); }
  g.fillStyle = '#ffd60a'; g.fillRect(0, 0, 6, 256); g.fillRect(58, 0, 6, 256);
  g.fillStyle = '#111'; for (let y = 0; y < 256; y += 32) { g.fillRect(0, y, 6, 16); g.fillRect(58, y, 6, 16); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 3);
  return t;
}

export class Stunts {
  constructor(scene, world, done = []) {
    this.world = world;
    this.done = new Set(done);
    const mat = new THREE.MeshLambertMaterial({ map: stripeTex() });
    this.beacons = [];
    for (const r of RAMPS) {
      r.cos = Math.cos(r.yaw); r.sin = Math.sin(r.yaw);
      const m = new THREE.Mesh(wedgeGeo(r.w, r.H, r.L), mat);
      m.position.set(r.x, 0.02, r.z);
      m.rotation.y = r.yaw;
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      // floating marker for undiscovered unique jumps
      const b = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshBasicMaterial({ color: 0x00f5d4 }));
      b.position.set(r.x - r.sin * 2, 3, r.z - r.cos * 2);
      b.visible = r.unique && !this.done.has(r.name);
      scene.add(b);
      this.beacons.push(b);
      const sign = textPlane(`⤴ ${r.name}`, 4, 0.8, { bg: '#111111', fg: '#00f5d4' });
      sign.position.set(r.x - r.sin * 2.5, 1.2, r.z - r.cos * 2.5);
      sign.rotation.y = r.yaw + Math.PI;
      scene.add(sign);
    }
  }

  // ramp surface height at a point (0 if not on a ramp)
  rampAt(x, z) {
    for (const r of RAMPS) {
      const dx = x - r.x, dz = z - r.z;
      const lz = dx * r.sin + dz * r.cos;          // along the ramp
      const lx = dx * r.cos - dz * r.sin;          // across
      if (lz >= 0 && lz <= r.L && Math.abs(lx) <= r.w / 2) return { h: (r.H * lz) / r.L, ramp: r };
    }
    return null;
  }

  // ground under a vehicle: road, ramp or a roof it is already above
  groundAt(x, z, y) {
    let h = 0, ramp = null;
    const rp = this.rampAt(x, z);
    if (rp) { h = rp.h; ramp = rp.ramp; }
    for (const b of this.world.query(x, z)) {
      if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
      if ((b.maxX - b.minX) * (b.maxZ - b.minZ) < 12) continue; // trees, poles
      if (b.h <= y + 0.7 && b.h > h) { h = b.h; ramp = null; }
    }
    return { h, ramp };
  }

  // vertical physics for the player's vehicle; returns events
  step(v, dt, prevX, prevZ) {
    if (v.y === undefined) { v.y = 0; v.vy = 0; v.air = false; v.airT = 0; }
    const gnd = this.groundAt(v.x, v.z, v.y);
    const ev = {};
    if (v.air) {
      v.vy -= 22 * dt;
      v.y += v.vy * dt;
      v.airT += dt;
      if (v.y <= gnd.h) {
        ev.landed = { airT: v.airT, dist: Math.hypot(v.x - v.launchX, v.z - v.launchZ), impact: -v.vy, ramp: v.launchRamp };
        v.y = gnd.h; v.air = false; v.vy = 0;
      }
    } else if (gnd.h > v.y + 0.7) {
      // ran into the tall end of a ramp: treat like a wall
      v.x = prevX; v.z = prevZ; v.speed *= -0.3;
      ev.bonk = true;
    } else if (gnd.h < v.y - 0.25) {
      v.air = true; v.airT = 0;
      v.vy = v.climb || 0;
      v.launchX = v.x; v.launchZ = v.z;
      v.launchRamp = v.lastRamp;
      ev.launched = v.lastRamp;
    } else {
      v.climb = Math.max(0, (gnd.h - v.y) / Math.max(dt, 1e-3));
      v.y = gnd.h;
      v.lastRamp = gnd.ramp;
    }
    // visual pitch
    const body = v.mesh.userData.body;
    const pitch = v.air ? Math.atan2(v.vy, Math.max(4, Math.abs(v.speed))) : (gnd.ramp ? Math.atan2(gnd.ramp.H, gnd.ramp.L) : 0);
    body.rotation.x += (-pitch * 0.8 - body.rotation.x) * Math.min(1, dt * 8);
    return ev;
  }

  markDone(r) {
    this.done.add(r.name);
    const i = RAMPS.indexOf(r);
    if (this.beacons[i]) this.beacons[i].visible = false;
  }

  update(dt) {
    for (const b of this.beacons) if (b.visible) { b.rotation.y += dt * 2; b.position.y = 3 + Math.sin(performance.now() / 400) * 0.4; }
  }
}
