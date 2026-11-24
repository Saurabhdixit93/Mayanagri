import * as THREE from 'three';
import { makeVehicleModel, makeBoxHuman, seatHuman, INST } from './models.js';
import { line, LINES, LANE } from './config.js';
import { clamp, angleDiff, pick, rand } from './utils.js';
import { SOFT } from './fx.js';

// head / tail light glows, shared materials so night fades them all at once
const HEAD = new THREE.SpriteMaterial({ map: SOFT, color: 0xfff1c1, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
const TAIL = new THREE.SpriteMaterial({ map: SOFT, color: 0xff2a1a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
const LIGHT_SPRITES = [];
let lightsOn = null;
export function setVehicleNight(n) {
  const on = n > 0.2;
  if (on !== lightsOn) { lightsOn = on; for (const l of LIGHT_SPRITES) l.visible = on; }
  HEAD.opacity = clamp(n * 1.2 - 0.2, 0, 1);
  TAIL.opacity = clamp(n * 1.2 - 0.2, 0, 0.85);
}
const LIGHTS = { // [halfLength, xOffset, height]
  auto: [1.5, 0, 1.25], car: [2.05, 0.6, 0.75], taxi: [2.05, 0.6, 0.75], police: [2.15, 0.6, 0.85],
  bus: [5.05, 0.9, 1.0], truck: [4.05, 0.9, 1.2], bike: [0.95, 0, 1.0],
  scooter: [0.85, 0, 1.25], tractor: [1.6, 0.4, 1.5], tempo: [2.4, 0.6, 0.9], ambassador: [2.15, 0.55, 0.9], erick: [1.3, 0, 0.9], supercar: [2.25, 0.6, 0.62],
  fishboat: [4.6, 0, 1.2], speedboat: [3.4, 0.5, 0.8], jetski: [1.4, 0, 0.7], policeboat: [4.1, 0.6, 1.0], ferry: [12, 1.6, 1.5],
};

export const SPECS = {
  auto:   { name: 'Auto Rickshaw',    max: 17, accel: 7,   turn: 2.6, radius: 1.7, hp: 70,  horn: 'auto',  engine: 'auto', kmh: 3.6 },
  car:    { name: 'Hatchback',        max: 30, accel: 10,  turn: 2.1, radius: 2.1, hp: 100, horn: 'car',   engine: 'car',  kmh: 3.6 },
  taxi:   { name: 'Kaali-Peeli Taxi', max: 26, accel: 9,   turn: 2.1, radius: 2.1, hp: 90,  horn: 'car',   engine: 'car',  kmh: 3.6 },
  bus:    { name: 'City Bus',         max: 18, accel: 4,   turn: 1.3, radius: 3.6, hp: 260, horn: 'bus',   engine: 'bus',  kmh: 3.6 },
  truck:  { name: 'Goods Truck',      max: 19, accel: 4.5, turn: 1.3, radius: 3.4, hp: 230, horn: 'truck', engine: 'bus',  kmh: 3.6 },
  bike:   { name: 'Thumper Bike',     max: 33, accel: 13,  turn: 2.9, radius: 1.1, hp: 50,  horn: 'bike',  engine: 'bike', kmh: 3.6 },
  scooter:   { name: 'Family Scooter',   max: 21, accel: 9,  turn: 2.9, radius: 1.1, hp: 40,  horn: 'bike',  engine: 'bike', kmh: 3.6 },
  tractor:   { name: 'Tractor',          max: 11, accel: 5,  turn: 1.6, radius: 2.2, hp: 220, horn: 'bus',   engine: 'bus',  kmh: 3.6 },
  tempo:     { name: 'Chhota Hathi Tempo', max: 20, accel: 6, turn: 1.8, radius: 2.4, hp: 150, horn: 'car', engine: 'auto', kmh: 3.6 },
  ambassador:{ name: 'Ambassador Classic', max: 26, accel: 8, turn: 1.9, radius: 2.2, hp: 150, horn: 'car', engine: 'car',  kmh: 3.6 },
  erick:     { name: 'E-Rickshaw',       max: 12, accel: 5,  turn: 2.4, radius: 1.7, hp: 60,  horn: 'auto',  engine: 'auto', kmh: 3.6 },
  supercar:  { name: 'Bijli GT',         max: 50, accel: 20, turn: 2.4, radius: 2.1, hp: 130,  horn: 'car',   engine: 'car',  kmh: 3.6 },
  fishboat:  { name: 'Koli Fishing Boat', max: 13, accel: 4,  turn: 0.9, radius: 3.6, hp: 220, horn: 'bus',  engine: 'boat',      kmh: 3.6, boat: true },
  speedboat: { name: 'Speedboat',         max: 36, accel: 11, turn: 1.6, radius: 2.6, hp: 130, horn: 'car',  engine: 'speedboat', kmh: 3.6, boat: true },
  jetski:    { name: 'Jet Ski',           max: 30, accel: 13, turn: 2.6, radius: 1.3, hp: 60,  horn: 'bike', engine: 'jetski',    kmh: 3.6, boat: true },
  policeboat:{ name: 'Coast Guard Boat',  max: 34, accel: 11, turn: 1.5, radius: 2.9, hp: 220, horn: 'car',  engine: 'speedboat', kmh: 3.6, boat: true },
  ferry:     { name: 'Mayanagri Ferry',   max: 10, accel: 2.5, turn: 0.6, radius: 5.5, hp: 800, horn: 'bus', engine: 'boat',      kmh: 3.6, boat: true },
  police: { name: 'Police Jeep',      max: 32, accel: 11,  turn: 2.3, radius: 2.2, hp: 150, horn: 'car',   engine: 'car',  kmh: 3.6 },
};

const TRAFFIC_MIX = ['auto', 'auto', 'auto', 'auto', 'car', 'car', 'car', 'taxi', 'taxi', 'bike', 'bike', 'scooter', 'scooter', 'scooter', 'erick', 'erick', 'tempo', 'ambassador', 'ambassador', 'bus', 'truck', 'truck', 'police', 'tractor', 'supercar'];
export const randomTrafficType = () => pick(TRAFFIC_MIX);

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export class Vehicle {
  constructor(type, scene, x = 0, z = 0, yaw = 0) {
    this.type = type;
    this.spec = SPECS[type];
    this.mesh = makeVehicleModel(type);
    scene.add(this.mesh);
    this.scene = scene;
    this.x = x; this.z = z; this.yaw = yaw;
    this.speed = 0;
    this.hp = this.spec.hp;
    this.ai = null;           // traffic AI state
    this.player = false;      // driven by the player
    this.cop = false;         // chasing police unit
    this.hornCd = rand(0, 3);
    this.blockT = 0;
    this.ghostT = 0;
    this.stuckT = 0;
    this.reverseT = 0;
    this.smokeT = 0;
    this.dead = false;
    this.protected = false;   // mission vehicles are never recycled
    this.wheelSpin = 0;
    this.lean = 0;
    this.boat = !!this.spec.boat;
    this.vx = 0; this.vz = 0; this.y = 0;
    const [hl, lx, ly] = LIGHTS[type];
    for (const sx of lx ? [-lx, lx] : [0]) {
      const h = new THREE.Sprite(HEAD); h.position.set(sx, ly, hl + 0.3); h.scale.set(1.6, 1.6, 1); this.mesh.add(h);
      const t = new THREE.Sprite(TAIL); t.position.set(sx, ly, -hl - 0.2); t.scale.set(0.9, 0.9, 1); this.mesh.add(t);
      h.visible = t.visible = !!lightsOn; LIGHT_SPRITES.push(h, t);
    }
    const seat = this.mesh.userData.driverSeat;
    if (seat) {
      this.driverModel = makeBoxHuman({ shirt: type === 'auto' ? 0xd9c9a0 : undefined, female: false });
      seatHuman(this.driverModel);
      this.driverModel.position.set(seat[0], seat[1], seat[2]);
      this.mesh.userData.body.add(this.driverModel);
    }
    this.sync();
  }

  get hasDriver() { return !!this.ai || this.player || this.cop || !!this.aiBoat; }

  // ---------------- boats ----------------
  // Water handling: thrust along the hull, strong sideways slip, speed-dependent turning.
  driveBoat(input, dt) {
    const s = this.spec;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let fwd = this.vx * fx + this.vz * fz;
    let side = this.vx * fz - this.vz * fx;
    if (input.throttle > 0) fwd += s.accel * dt * input.throttle;
    else if (input.throttle < 0) fwd -= s.accel * (fwd > 0.5 ? 1.2 : 0.5) * dt;
    fwd *= 1 - 0.25 * dt;
    if (input.brake) fwd *= 1 - 1.5 * dt;
    side *= 1 - 2.2 * dt;
    fwd = clamp(fwd, -s.max * 0.3, s.max);
    const steerAuth = clamp(Math.abs(fwd) / 6, 0.25, 1) * (fwd < -0.5 ? -1 : 1);
    const prevYaw = this.yaw;
    this.yaw += input.steer * s.turn * steerAuth * dt;
    // carving a turn throws the stern out a little
    side += (this.yaw - prevYaw) * fwd * 0.35;
    const nfx = Math.sin(this.yaw), nfz = Math.cos(this.yaw);
    this.vx = nfx * fwd + nfz * side;
    this.vz = nfz * fwd - nfx * side;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.speed = fwd;
    this.lean += ((angleDiff(prevYaw, this.yaw) / Math.max(dt, 1e-3)) * -0.4 - this.lean) * Math.min(1, dt * 4);
  }

  // stop sideways/forward motion into a wall (called after resolve)
  bounceBoat(hit) {
    if (!hit) return 0;
    const vn = this.vx * hit.nx + this.vz * hit.nz;
    if (vn >= 0) return 0;
    this.vx -= vn * hit.nx * 1.4; this.vz -= vn * hit.nz * 1.4;
    this.speed = this.vx * Math.sin(this.yaw) + this.vz * Math.cos(this.yaw);
    return -vn;
  }

  // ride the swell: height + pitch/roll from the wave field, plus planing nose-up
  floatOn(waveH, t) {
    const L = this.spec.radius * 0.8, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const h0 = waveH(this.x, this.z, t);
    const hb = waveH(this.x + fx * L, this.z + fz * L, t), hs = waveH(this.x - fx * L, this.z - fz * L, t);
    const hl = waveH(this.x + fz, this.z - fx, t), hr = waveH(this.x - fz, this.z + fx, t);
    const draft = this.type === 'ferry' ? 0.6 : 0.25;
    this.y = h0 - draft + (this.type === 'jetski' ? 0.05 : 0);
    const body = this.mesh.userData.body;
    const plane = this.type === 'speedboat' || this.type === 'jetski' || this.type === 'policeboat' ? clamp(this.speed / this.spec.max, 0, 1) * 0.12 : 0;
    body.rotation.x = Math.atan2(hs - hb, 2 * L) - plane;
    body.rotation.z = Math.atan2(hr - hl, 2) * 0.8 - this.lean * 0.15;
  }

  // simple wandering / route-following AI for sea traffic
  updateBoatAI(dt, sea) {
    const a = this.aiBoat;
    if (a.wait > 0) { a.wait -= dt; this.driveBoat({ throttle: 0, steer: 0, brake: true }, dt); return; }
    if (!a.target || Math.hypot(a.target.x - this.x, a.target.z - this.z) < 10) {
      if (a.route) { a.i = (a.i + 1) % a.route.length; a.target = a.route[a.i]; a.wait = a.route[a.i].wait || 0; }
      else a.target = sea.randomSeaPoint();
    }
    const diff = angleDiff(this.yaw, Math.atan2(a.target.x - this.x, a.target.z - this.z));
    this.driveBoat({ throttle: a.throttle ?? 0.55, steer: clamp(diff * 1.5, -1, 1), brake: false }, dt);
    this.bounceBoat(sea.resolveBoat(this));
  }

  sync(dt = 0, t = 0) {
    this.mesh.position.set(this.x, this.y || 0, this.z);
    this.mesh.rotation.y = this.yaw;
    if (this.driverModel) this.driverModel.visible = this.hasDriver;
    this.wheelSpin += this.speed * dt * 2.5;
    for (const w of this.mesh.userData.wheels) w.rotation.x = this.wheelSpin;
    const body = this.mesh.userData.body;
    if (this.boat) { /* pitch/roll come from the waves (floatOn) */ }
    else if (this.type === 'bike') body.rotation.z = this.lean * 0.5;
    else body.rotation.z = -this.lean * 0.06;
    const b = this.mesh.userData.beacons;
    if (b.length) {
      const on = Math.floor(t * 6) % 2 === 0;
      b[0].visible = on || !this.cop;
      b[1].visible = !on || !this.cop;
    }
  }

  // Arcade physics shared by player and police.
  drive(input, dt) {
    const s = this.spec;
    const prevYaw = this.yaw;
    if (input.throttle > 0) this.speed += (this.speed < 0 ? s.accel * 2.5 : s.accel) * dt * input.throttle;
    else if (input.throttle < 0) {
      if (this.speed > 0.5) this.speed -= s.accel * 2.4 * dt;
      else this.speed -= s.accel * 0.6 * dt;
    } else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 2.5 * dt);
    if (input.brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 16 * dt);
    this.speed = clamp(this.speed, -s.max * 0.35, s.max);
    const steerFactor = clamp(this.speed / 5, -1, 1) * (1 - 0.35 * Math.min(1, Math.abs(this.speed) / s.max));
    this.yaw += input.steer * s.turn * steerFactor * dt * (input.brake ? 1.5 : 1);
    this.x += Math.sin(this.yaw) * this.speed * dt;
    this.z += Math.cos(this.yaw) * this.speed * dt;
    this.lean += ((angleDiff(prevYaw, this.yaw) / Math.max(dt, 1e-3)) * -0.4 - this.lean) * Math.min(1, dt * 6);
  }

  // Resolve static collision; returns impact speed (0 if none).
  collideWorld(world, opts) {
    const hit = world.resolve(this, this.spec.radius, opts);
    if (!hit) return 0;
    let vx = Math.sin(this.yaw) * this.speed, vz = Math.cos(this.yaw) * this.speed;
    const vn = vx * hit.nx + vz * hit.nz;
    if (vn >= 0) return 0;
    vx -= vn * hit.nx * 1.25; vz -= vn * hit.nz * 1.25;
    this.speed = vx * Math.sin(this.yaw) + vz * Math.cos(this.yaw);
    this.speed *= 0.85;
    return -vn;
  }

  // ---------------- traffic AI (drives on grid roads, keeps LEFT) ----------------
  initAI(i, j, dirIdx) {
    const [dx, dz] = DIRS[dirIdx];
    const ni = i + dx, nj = j + dz;
    this.ai = { ti: ni, tj: nj, dx, dz, next: null };
    this.y = 0; this.vy = 0; this.air = false;
    if (this.mesh.userData.body) this.mesh.userData.body.rotation.x = 0;
    this.ai.next = this.chooseNext(ni, nj, dx, dz);
    const yaw = Math.atan2(dx, dz);
    this.yaw = yaw;
    this.x = line(i) + dz * LANE + dx * 12;
    this.z = line(j) - dx * LANE + dz * 12;
    this.speed = this.spec.max * 0.4;
    this.cop = false; this.player = false;
  }

  chooseNext(i, j, dx, dz) {
    const opts = [];
    for (const [ax, az] of DIRS) {
      if (ax === -dx && az === -dz) continue;
      const ni = i + ax, nj = j + az;
      if (ni < 0 || nj < 0 || ni >= LINES || nj >= LINES) continue;
      const w = ax === dx && az === dz ? 3 : 1;
      for (let k = 0; k < w; k++) opts.push([ax, az]);
    }
    return opts.length ? pick(opts) : [-dx, -dz];
  }

  target() {
    const a = this.ai;
    return [line(a.ti) + a.dz * LANE, line(a.tj) - a.dx * LANE];
  }

  updateAI(dt, obstacles, train, onHonk) {
    const a = this.ai;
    let [tx, tz] = this.target();
    let d = Math.hypot(tx - this.x, tz - this.z);
    if (d < 4.5) {
      const [nx, nz] = a.next;
      a.dx = nx; a.dz = nz;
      a.ti += nx; a.tj += nz;
      a.next = this.chooseNext(a.ti, a.tj, nx, nz);
      [tx, tz] = this.target();
      d = Math.hypot(tx - this.x, tz - this.z);
    }
    const desired = Math.atan2(tx - this.x, tz - this.z);
    const diff = angleDiff(this.yaw, desired);
    const prevYaw = this.yaw;
    this.yaw += clamp(diff, -2.4 * dt, 2.4 * dt);

    const turning = (a.next[0] !== a.dx || a.next[1] !== a.dz) && d < 18;
    let targetSpeed = turning ? 6 : this.spec.max * 0.5;
    if (Math.abs(diff) > 0.6) targetSpeed = Math.min(targetSpeed, 5);

    // look ahead for obstacles
    let blocked = false;
    if (this.ghostT > 0) this.ghostT -= dt;
    else {
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      const look = 5 + Math.max(0, this.speed) * 0.7 + this.spec.radius;
      for (const o of obstacles) {
        if (o === this) continue;
        const rx = o.x - this.x, rz = o.z - this.z;
        if (Math.abs(rx) > 30 || Math.abs(rz) > 30) continue;
        const fwd = rx * sy + rz * cy;
        if (fwd <= 0 || fwd > look + (o.r || 1)) continue;
        const lat = Math.abs(rx * cy - rz * sy);
        if (lat < 1.6 + (o.r || 1) * 0.7) { blocked = true; break; }
      }
      // railway crossing
      if (!blocked && train && Math.abs(this.z - train.z) < 22 && Math.sign(train.z - this.z) === Math.sign(cy) && Math.abs(cy) > 0.7) {
        if (this.x > train.minX - 40 && this.x < train.maxX + 40) blocked = true;
      }
    }
    if (blocked) {
      targetSpeed = 0;
      this.blockT += dt;
      if (this.blockT > 0.5 && this.hornCd <= 0) {
        onHonk(this);
        this.hornCd = rand(1.0, 3.5);
      }
      if (this.blockT > 7) { this.ghostT = 2.5; this.blockT = 0; }
    } else this.blockT = Math.max(0, this.blockT - dt);
    this.hornCd -= dt;

    const acc = targetSpeed > this.speed ? this.spec.accel : 14;
    this.speed += clamp(targetSpeed - this.speed, -acc * dt, acc * dt);
    this.x += Math.sin(this.yaw) * this.speed * dt;
    this.z += Math.cos(this.yaw) * this.speed * dt;
    this.lean += ((angleDiff(prevYaw, this.yaw) / Math.max(dt, 1e-3)) * -0.4 - this.lean) * Math.min(1, dt * 6);
  }

  destroy() {
    this.scene.remove(this.mesh);
    INST.unregister(this.mesh);
  }
}

// Random road node and direction for spawning traffic.
export function randomRoadSpawn() {
  const i = Math.floor(Math.random() * LINES), j = Math.floor(Math.random() * LINES);
  const opts = [];
  DIRS.forEach(([dx, dz], idx) => {
    const ni = i + dx, nj = j + dz;
    if (ni >= 0 && nj >= 0 && ni < LINES && nj < LINES) opts.push(idx);
  });
  return { i, j, dir: pick(opts) };
}

export { DIRS };
