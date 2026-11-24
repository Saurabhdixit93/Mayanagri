// Weapons, shooting, melee, blood, armed NPCs (police on foot, goons) and the police helicopter.
import * as THREE from 'three';
import { makeHuman, animateHuman, box, cyl, INST } from './models.js';
import { SOFT } from './fx.js';
import { rand, pick, clamp, angleDiff } from './utils.js';

export const WEAPONS = {
  fists:  { name: 'Mukka (Fists)',      icon: '👊', melee: true, dmg: 18, range: 1.9, rate: 0.42 },
  lathi:  { name: 'Lathi',              icon: '🪵', melee: true, dmg: 38, range: 2.5, rate: 0.6, price: 200 },
  katta:  { name: 'Desi Katta',         icon: '🔫', dmg: 34, range: 75,  rate: 0.42, spread: 0.012, price: 1500, ammoPrice: 200, ammoPack: 18, mature: true, sound: 'pistol' },
  dunali: { name: 'Dunali (Shotgun)',   icon: '💥', dmg: 20, pellets: 8, range: 30, rate: 0.95, spread: 0.065, price: 3500, ammoPrice: 300, ammoPack: 10, mature: true, sound: 'shotgun' },
  ak:     { name: 'AK — Bhai ka Saamaan', icon: '⚔️', dmg: 24, range: 110, rate: 0.1, spread: 0.022, auto: true, price: 9000, ammoPrice: 600, ammoPack: 90, mature: true, sound: 'rifle' },
};
export const WEAPON_ORDER = ['fists', 'lathi', 'katta', 'dunali', 'ak'];

// Attach a weapon model to a human's right arm. Returns {grp per weapon}.
const _ws = new THREE.Vector3();
export function equipModels(human) {
  const ch = human.userData.char;
  let arm, mk;
  if (ch && ch.hand) {
    // attach to the wrist bone; undo the bone's world scale so guns are metre-sized
    arm = ch.hand;
    human.updateMatrixWorld(true);
    arm.getWorldScale(_ws);
    const inv = 1 / (_ws.x || 1);
    mk = (build) => {
      const g = new THREE.Group();
      g.scale.setScalar(inv);
      const inner = new THREE.Group();
      inner.rotation.set(-Math.PI / 2, 0, 0); // bone points along +Y; guns are built along +Z
      inner.position.set(0, 0.08, 0.02);
      g.add(inner);
      build(inner); g.visible = false; arm.add(g); INST.register(g); return g;
    };
  } else if (human.userData.parts) {
    arm = human.userData.parts.armR;
    mk = (build) => { const g = new THREE.Group(); g.position.set(0, -0.62, 0.05); build(g); g.visible = false; arm.add(g); INST.register(g); return g; };
  } else {
    arm = human;
    mk = (build) => { const g = new THREE.Group(); g.position.set(0.35, 1.3, 0.3); build(g); g.visible = false; arm.add(g); INST.register(g); return g; };
  }
  return {
    lathi: mk((g) => { const m = box(0.06, 0.06, 1.6, 0x8b5a2b, 0, 0, 0.5, g); m.rotation.x = 0; }),
    katta: mk((g) => { box(0.07, 0.14, 0.32, 0x2b2b2b, 0, 0, 0.12, g); box(0.06, 0.16, 0.08, 0x5a3a1a, 0, -0.1, 0.0, g); }),
    dunali: mk((g) => { box(0.08, 0.1, 1.1, 0x333333, 0.03, 0, 0.45, g); box(0.08, 0.1, 1.1, 0x333333, -0.03, 0, 0.45, g); box(0.1, 0.16, 0.45, 0x6b3e1e, 0, -0.04, -0.2, g); }),
    ak: mk((g) => { box(0.08, 0.14, 0.9, 0x222222, 0, 0, 0.35, g); box(0.07, 0.22, 0.1, 0x222222, 0, -0.14, 0.35, g); box(0.09, 0.14, 0.35, 0x7a4a22, 0, -0.03, -0.25, g); }),
  };
}
export function showWeapon(models, key) {
  for (const [k, grp] of Object.entries(models)) grp.visible = k === key;
}

// ---------------------------------------------------------------------------
// Armed NPC: police on foot (khaki) or gang goon. Chases and attacks the player.
// ---------------------------------------------------------------------------
export class Shooter {
  constructor(scene, kind, x, z, opts = {}) {
    this.scene = scene;
    this.kind = kind; // 'cop' | 'goon' | 'target'
    const look = kind === 'cop'
      ? { shirt: 0xc2a46b, pants: 0xb39660, cap: 0x7a1f1f, female: false, mustache: true, arch: 'swat' }
      : kind === 'target'
        ? { shirt: 0xffffff, pants: 0xffffff, shades: true, female: false, mustache: true, kurta: true, arch: 'business' }
        : { shirt: pick([0x111111, 0x8b0000, 0x2b2d42]), pants: 0x111111, shades: Math.random() < 0.6, female: false, arch: pick(['hoodie', 'beach', 'worker']) };
    this.mesh = makeHuman(look);
    this.char = this.mesh.userData.char || null;
    if (kind !== 'cop' && !this.char) box(0.3, 0.05, 0.05, 0xffd700, 0, 1.55, 0.17, this.mesh); // gold chain
    scene.add(this.mesh);
    this.guns = equipModels(this.mesh);
    this.weapon = opts.weapon || (kind === 'cop' ? 'lathi' : 'katta');
    showWeapon(this.guns, this.weapon);
    this.x = x; this.z = z; this.y = 0; this.yaw = 0;
    this.r = 0.5;
    this.hp = opts.hp || (kind === 'target' ? 120 : 100);
    this.dead = false;
    this.deadT = 0;
    this.cd = rand(0.5, 1.5);
    this.phase = rand(0, 6);
    this.alert = opts.alert ?? true;
    this.home = { x, z };
    this.state = 'walk';
  }

  update(dt, ctx) {
    const m = this.mesh;
    if (this.dead) {
      this.deadT += dt;
      m.position.set(this.x, this.char ? 0 : 0.15, this.z);
      if (this.char && this.deadT < 3) this.char.update(dt);
      return;
    }
    const P = ctx.target();
    const dx = P.x - this.x, dz = P.z - this.z;
    const d = Math.hypot(dx, dz);
    const gun = !WEAPONS[this.weapon].melee;
    const want = gun ? (this.kind === 'cop' ? 14 : 10) : 1.3;
    let moving = false;
    if (!this.alert) {
      // idle until the player comes close or shoots
      if (d < 18) { this.alert = true; ctx.shout(this); }
    } else if (d > want) {
      const sp = d > 30 ? 5.8 : 4.6;
      this.x += (dx / d) * sp * dt; this.z += (dz / d) * sp * dt;
      moving = true;
    } else if (gun && d < want * 0.5) {
      this.x -= (dx / d) * 2.5 * dt; this.z -= (dz / d) * 2.5 * dt; moving = true;
    }
    ctx.world.resolve(this, this.r);
    this.yaw += angleDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    this.phase += dt * (moving ? 12 : 0);
    const ch = this.char;
    if (ch) {
      this.animT = (this.animT || 0) - dt;
      if (this.animT <= 0) {
        if (moving) ch.play(gun && this.alert && d < 40 ? 'Run_Shoot' : 'Run');
        else ch.play(gun && this.alert ? 'Idle_Gun_Pointing' : 'Idle');
      }
      ch.update(dt);
    } else animateHuman(m, this.phase, moving ? 1 : 0);
    const arm = ch ? { rotation: { x: 0 } } : m.userData.parts.armR;
    // attack
    this.cd -= dt;
    if (this.alert && this.cd <= 0) {
      if (gun && d < WEAPONS[this.weapon].range * 0.85) {
        arm.rotation.x = -1.5;
        if (ch && !moving) { ch.play('Gun_Shoot', { once: true, fade: 0.05 }); this.animT = 0.35; }
        ctx.npcShoot(this, d);
        this.cd = this.weapon === 'ak' ? 0.18 : rand(0.9, 1.6);
        if (this.weapon === 'ak') { this.burst = (this.burst || 0) + 1; if (this.burst > 5) { this.burst = 0; this.cd = 1.6; } }
      } else if (!gun && d < 2) {
        arm.rotation.x = -2.2;
        if (ch) { ch.play('Punch_Right', { once: true, fade: 0.05 }); this.animT = 0.6; }
        ctx.npcMelee(this);
        this.cd = 1.0;
      }
    }
    if (gun && d < WEAPONS[this.weapon].range) arm.rotation.x = Math.min(arm.rotation.x, -1.4);
    m.position.set(this.x, this.y, this.z);
    m.rotation.y = this.yaw;
  }

  hit(dmg, dirX, dirZ) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.alert = true;
    if (this.hp <= 0) {
      this.dead = true;
      if (this.char) this.char.play('Death', { once: true, fade: 0.05 });
      else { this.mesh.rotation.set(-Math.PI / 2, Math.atan2(dirX, dirZ), 0); animateHuman(this.mesh, 0, 0); }
      return true;
    }
    return false;
  }

  destroy() { this.scene.remove(this.mesh); INST.unregister(this.mesh); }
}

// ---------------------------------------------------------------------------
// Police helicopter (4+ stars)
// ---------------------------------------------------------------------------
export class Heli {
  constructor(scene, x, z) {
    this.scene = scene;
    const g = new THREE.Group();
    box(2.4, 2.0, 4.6, 0x1d3557, 0, 0, 0, g);
    box(2.42, 0.6, 4.62, 0xf1faee, 0, 0.2, 0, g);
    box(2.0, 1.3, 1.6, 0x9fd3ff, 0, 0.2, 2.2, g);
    box(0.5, 0.5, 5, 0x1d3557, 0, 0.4, -4.5, g);
    box(0.15, 1.4, 0.9, 0x1d3557, 0, 1.0, -6.8, g);
    box(0.2, 0.12, 3.6, 0x333333, -1.1, -1.3, 0, g);
    box(0.2, 0.12, 3.6, 0x333333, 1.1, -1.3, 0, g);
    this.rotor = new THREE.Group();
    box(11, 0.08, 0.4, 0x222222, 0, 0, 0, this.rotor);
    box(0.4, 0.08, 11, 0x222222, 0, 0, 0, this.rotor);
    this.rotor.position.y = 1.3;
    g.add(this.rotor);
    this.tail = new THREE.Group();
    box(0.08, 2.2, 0.3, 0x222222, 0, 0, 0, this.tail);
    this.tail.position.set(0.15, 1.0, -6.8);
    g.add(this.tail);
    const beacon = box(0.3, 0.3, 0.3, 0xff0000, 0, 1.0, -2, g);
    beacon.userData.noInst = true;
    this.beacon = beacon;
    INST.register(g);
    this.mesh = g;
    this.x = x; this.z = z; this.y = 70; this.a = rand(0, 6);
    this.spot = new THREE.SpotLight(0xe8f0ff, 0, 140, 0.18, 0.6, 1);
    scene.add(g, this.spot, this.spot.target);
    this.cd = 3;
    this.leaving = false;
  }

  update(dt, ctx, night) {
    const P = ctx.target();
    this.a += dt * 0.35;
    const tx = this.leaving ? P.x + 600 : P.x + Math.cos(this.a) * 28;
    const tz = this.leaving ? P.z + 600 : P.z + Math.sin(this.a) * 28;
    const ty = this.leaving ? 120 : 38;
    const k = Math.min(1, dt * 0.8);
    const vx = (tx - this.x) * k, vz = (tz - this.z) * k;
    this.x += vx; this.z += vz; this.y += (ty - this.y) * Math.min(1, dt * 0.6);
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = Math.atan2(P.x - this.x, P.z - this.z);
    this.mesh.rotation.z = clamp(-vx * 0.3, -0.3, 0.3);
    this.rotor.rotation.y += dt * 40;
    this.tail.rotation.x += dt * 50;
    this.beacon.visible = Math.floor(ctx.time * 2) % 2 === 0;
    this.spot.position.set(this.x, this.y - 1.5, this.z);
    this.spot.target.position.set(P.x, 0, P.z);
    this.spot.intensity = night > 0.3 ? 4000 * night : 0;
    this.cd -= dt;
    if (!this.leaving && this.cd <= 0) {
      this.cd = rand(2.5, 4.5);
      if (ctx.mature) ctx.npcShoot({ x: this.x, y: this.y - 1, z: this.z, weapon: 'ak', heli: true }, Math.hypot(P.x - this.x, P.z - this.z) + 30);
    }
    return Math.hypot(this.x - P.x, this.z - P.z);
  }

  destroy() { this.scene.remove(this.mesh, this.spot, this.spot.target); INST.unregister(this.mesh); }
}

// ---------------------------------------------------------------------------
// Visual effects: tracers, muzzle flash, blood decals
// ---------------------------------------------------------------------------
export class CombatFX {
  constructor(scene) {
    this.scene = scene;
    this.tracerPos = new Float32Array(40 * 6);
    this.tracerLife = new Float32Array(40);
    this.tracerGeo = new THREE.BufferGeometry();
    this.tracerGeo.setAttribute('position', new THREE.BufferAttribute(this.tracerPos, 3));
    this.tracers = new THREE.LineSegments(this.tracerGeo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 }));
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);
    this.ti = 0;
    this.flash = new THREE.PointLight(0xffc266, 0, 18, 2);
    scene.add(this.flash);
    this.flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0xffd27a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    this.flashSprite.scale.set(1.2, 1.2, 1);
    this.flashSprite.visible = false;
    scene.add(this.flashSprite);
    this.flashT = 0;
    // blood pools
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const x = 64 + rand(-30, 30), y = 64 + rand(-30, 30), r = rand(10, 34);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(110,0,0,0.95)'); gr.addColorStop(0.7, 'rgba(90,0,0,0.8)'); gr.addColorStop(1, 'rgba(80,0,0,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.bloodMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.pools = [];
    this.pi = 0;
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < 30; i++) {
      const m = new THREE.Mesh(geo, this.bloodMat);
      m.visible = false; m.renderOrder = 2;
      scene.add(m);
      this.pools.push({ m, grow: 0, size: 1 });
    }
  }

  tracer(a, b) {
    const i = this.ti++ % 40;
    this.tracerPos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    this.tracerLife[i] = 0.06;
  }

  muzzle(p) {
    this.flash.position.copy(p);
    this.flash.intensity = 30;
    this.flashSprite.position.copy(p);
    this.flashSprite.visible = true;
    this.flashSprite.material.rotation = Math.random() * 6;
    this.flashT = 0.05;
  }

  bloodPool(x, z, size = 2.2) {
    const p = this.pools[this.pi++ % this.pools.length];
    p.m.position.set(x + rand(-0.3, 0.3), 0.04 + Math.random() * 0.01, z + rand(-0.3, 0.3));
    p.m.rotation.y = rand(0, 6);
    p.m.scale.setScalar(0.2);
    p.m.visible = true;
    p.size = size; p.grow = 1;
  }

  update(dt) {
    for (let i = 0; i < 40; i++) {
      if (this.tracerLife[i] > 0) {
        this.tracerLife[i] -= dt;
        if (this.tracerLife[i] <= 0) this.tracerPos.fill(0, i * 6, i * 6 + 6);
      }
    }
    this.tracerGeo.attributes.position.needsUpdate = true;
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) { this.flash.intensity = 0; this.flashSprite.visible = false; } }
    for (const p of this.pools) {
      if (p.grow > 0) {
        const s = p.m.scale.x + dt * 0.6;
        p.m.scale.setScalar(Math.min(p.size, s));
        if (s >= p.size) p.grow = 0;
      }
    }
  }
}

// Ray vs sphere: returns distance or -1
export function raySphere(o, d, cx, cy, cz, r) {
  const ox = o.x - cx, oy = o.y - cy, oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - c;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}
