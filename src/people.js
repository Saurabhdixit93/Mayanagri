import { makeHuman, animateHuman, makeCow, INST } from './models.js';
import { line, LINES, SIDE, HALF, RAIL_Z, LANE } from './config.js';
import { rand, pick, angleDiff, clamp } from './utils.js';

// Pedestrians walk a lattice of sidewalk lines (offset SIDE from every road centre).
const XS = [];
for (let i = 0; i < LINES; i++) { XS.push(line(i) - SIDE, line(i) + SIDE); }
export const WALK_XS = XS;           // same set for z
const NW = XS.length;

export class Ped {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.mesh = makeHuman(opts);
    scene.add(this.mesh);
    this.r = 0.5;
    this.state = 'walk';
    this.timer = 0;
    this.phase = Math.random() * 10;
    this.y = 0; this.vy = 0; this.vx = 0; this.vz = 0;
    this.speed = rand(1.1, 1.7);
    this.flee = 0;
    this.hp = 100;
    this.char = this.mesh.userData.char || null;
    this.place(Math.floor(rand(0, NW)), Math.floor(rand(0, NW)));
  }

  place(ix, iz) {
    this.ix = clamp(ix, 0, NW - 1); this.iz = clamp(iz, 0, NW - 1);
    this.x = XS[this.ix]; this.z = XS[this.iz];
    if (Math.abs(this.z - RAIL_Z) < 8) { this.iz = clamp(this.iz + 2, 0, NW - 1); this.z = XS[this.iz]; }
    this.state = 'walk'; this.y = 0; this.hp = 100;
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.userData.lockAnim = false;
    this.newTarget();
  }

  newTarget() {
    for (let tries = 0; tries < 6; tries++) {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const step = Math.random() < 0.5 ? -1 : 1;
      let ix = this.ix, iz = this.iz;
      if (axis === 'x') ix += step; else iz += step;
      if (ix < 0 || iz < 0 || ix >= NW || iz >= NW) continue;
      if (Math.abs(XS[iz] - RAIL_Z) < 8) continue;
      this.ix = ix; this.iz = iz;
      this.tx = XS[ix]; this.tz = XS[iz];
      return;
    }
    this.tx = XS[this.ix]; this.tz = XS[this.iz];
  }

  knock(vx, vz, power) {
    if (this.state === 'fly' || this.state === 'down') return false;
    this.state = 'fly';
    if (this.char) { this.mesh.userData.lockAnim = true; this.char.play('Death', { once: true, fade: 0.08 }); }
    this.vx = vx; this.vz = vz;
    this.vy = 4 + power * 0.25;
    return true;
  }

  update(dt) {
    const m = this.mesh;
    if (this.state === 'fly') {
      this.vy -= 22 * dt;
      this.x += this.vx * dt; this.z += this.vz * dt; this.y += this.vy * dt;
      if (!this.char) m.rotation.x -= dt * 8;
      if (this.y <= 0) {
        this.y = 0; this.state = this.hp <= 0 ? 'dead' : 'down'; this.timer = rand(4, 8);
        if (!this.char) m.rotation.x = -Math.PI / 2;
      }
    } else if (this.state === 'dead') {
      // stays down until recycled
    } else if (this.state === 'down') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.state = 'walk'; m.rotation.x = 0; this.flee = 6;
        m.userData.lockAnim = false;
        // snap back to nearest walk lattice node
        this.ix = nearestIdx(this.x); this.iz = nearestIdx(this.z);
        this.newTarget();
      }
    } else {
      const sp = this.flee > 0 ? 4.5 : this.speed;
      if (this.flee > 0) this.flee -= dt;
      const dx = this.tx - this.x, dz = this.tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) this.newTarget();
      else {
        this.x += (dx / d) * sp * dt;
        this.z += (dz / d) * sp * dt;
        const want = Math.atan2(dx, dz);
        m.rotation.y += angleDiff(m.rotation.y, want) * Math.min(1, dt * 8);
      }
      this.phase += dt * sp * 3.2;
      animateHuman(m, this.phase, this.flee > 0 ? 1.3 : 1);
    }
    m.position.set(this.x, this.y, this.z);
    if (this.char && m.visible) this.char.update(dt);
  }

  // shot / beaten. Returns true if this killed them.
  damage(dmg, dx, dz) {
    if (this.state === 'dead') return false;
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.state = 'dead';
      if (this.char) { this.mesh.userData.lockAnim = true; this.char.play('Death', { once: true, fade: 0.05 }); }
      else { this.mesh.rotation.x = -Math.PI / 2; }
      return true;
    }
    if (this.char) { this.char.play('HitRecieve', { once: true, fade: 0.05 }); setTimeout(() => { if (this.state === 'walk') this.char.play('Run'); }, 500); }
    this.flee = 10;
    return false;
  }

  destroy() { this.scene.remove(this.mesh); INST.unregister(this.mesh); }
}

function nearestIdx(v) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < NW; i++) { const d = Math.abs(XS[i] - v); if (d < bd) { bd = d; best = i; } }
  return best;
}

// Cows: wander on roads, sit down randomly, are completely unbothered by traffic.
export class Cow {
  constructor(scene) {
    this.scene = scene;
    this.mesh = makeCow();
    scene.add(this.mesh);
    this.r = 1.4;
    this.respawnNear(0, 0, 0, 600);
  }

  respawnNear(px, pz, minD, maxD) {
    for (let t = 0; t < 30; t++) {
      const i = Math.floor(rand(0, LINES)), j = Math.floor(rand(0, LINES));
      const along = rand(-40, 40);
      const off = rand(-LANE - 2, LANE + 2);
      const horiz = Math.random() < 0.5;
      const x = horiz ? line(i) + along : line(i) + off;
      const z = horiz ? line(j) + off : line(j) + along;
      const d = Math.hypot(x - px, z - pz);
      if (d < minD || d > maxD || Math.abs(z - RAIL_Z) < 10 || Math.abs(x) > HALF || Math.abs(z) > HALF) continue;
      this.x = x; this.z = z; this.hx = x; this.hz = z; this.horiz = horiz;
      break;
    }
    this.state = 'stand'; this.timer = rand(2, 6);
    this.mesh.rotation.y = rand(0, Math.PI * 2);
    this.mesh.position.set(this.x, 0, this.z);
  }

  update(dt, t) {
    const m = this.mesh;
    this.timer -= dt;
    if (this.state === 'walk') {
      const dx = this.tx - this.x, dz = this.tz - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5 || this.timer <= 0) { this.state = Math.random() < 0.35 ? 'sit' : 'stand'; this.timer = rand(5, 20); }
      else {
        this.x += (dx / d) * 0.7 * dt; this.z += (dz / d) * 0.7 * dt;
        m.rotation.y += angleDiff(m.rotation.y, Math.atan2(dx, dz)) * Math.min(1, dt * 2);
      }
      m.position.y = Math.abs(Math.sin(t * 3)) * 0.04;
    } else if (this.timer <= 0) {
      this.state = 'walk'; this.timer = 25;
      const r = 25;
      this.tx = this.hx + (this.horiz ? rand(-r, r) : rand(-4, 4));
      this.tz = this.hz + (this.horiz ? rand(-4, 4) : rand(-r, r));
    }
    m.position.x = this.x; m.position.z = this.z;
    m.position.y = this.state === 'sit' ? -0.55 : (this.state === 'walk' ? m.position.y : 0);
    m.userData.head.rotation.y = Math.sin(t * 0.7 + this.hx) * 0.4;
  }
}
