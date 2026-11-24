// Player weapons: aiming, shooting (hitscan), melee, ammo, weapon switching.
import * as THREE from 'three';
import { WEAPONS, WEAPON_ORDER, equipModels, showWeapon, raySphere } from './combat.js';
import { rand, clamp } from './utils.js';

const _dir = new THREE.Vector3();
const _o = new THREE.Vector3();
const _p = new THREE.Vector3();
const _hand = new THREE.Vector3();

export class PlayerCombat {
  constructor(ctx) {
    this.c = ctx;
    this.owned = new Set(['fists']);
    this.ammo = { katta: 0, dunali: 0, ak: 0 };
    this.cur = 'fists';
    this.cd = 0;
    this.prevFire = false;
    this.aiming = false;
    this.meleeT = 0;
    this.models = equipModels(ctx.player.model);
    this.lastShotT = -99;
  }

  available() {
    return WEAPON_ORDER.filter((w) => this.owned.has(w) && (!WEAPONS[w].mature || this.c.g.mature));
  }

  cycle(dir = 1) {
    const av = this.available();
    const i = av.indexOf(this.cur);
    this.cur = av[(i + dir + av.length) % av.length] || 'fists';
    const W = WEAPONS[this.cur];
    this.c.hud.weapon(this, true);
    this.c.audio.click?.();
    return W;
  }

  give(w, ammo = 0) {
    this.owned.add(w);
    if (ammo && w in this.ammo) this.ammo[w] += ammo;
    if (WEAPONS[w].mature && !this.c.g.mature) return;
    this.cur = w;
  }

  update(dt, input) {
    const { player, g } = this.c;
    if (!this.available().includes(this.cur)) this.cur = 'fists';
    const W = WEAPONS[this.cur];
    const ch = player.model.userData.char;
    this.cd -= dt;
    this.meleeT -= dt;
    if (player.vehicle || g.frozen > 0) {
      this.aiming = false;
      player.model.userData.lockAnim = false;
      return;
    }
    showWeapon(this.models, this.cur === 'fists' ? null : this.cur);
    const gun = !W.melee;
    this.aiming = input.aim && gun;
    if (this.aiming) player.yaw = g.camYaw;
    // animation override while aiming / attacking
    if (ch) {
      if (this.meleeT > 0) player.model.userData.lockAnim = true;
      else if (this.aiming) {
        player.model.userData.lockAnim = true;
        ch.play(input.moving ? 'Run_Shoot' : (this.cd > W.rate * 0.5 ? 'Idle_Gun_Shoot' : 'Idle_Gun_Pointing'), { fade: 0.1 });
      } else player.model.userData.lockAnim = false;
    }
    const trigger = input.fire;
    const want = W.auto ? trigger : trigger && !this.prevFire;
    this.prevFire = trigger;
    if (want && this.cd <= 0) {
      if (W.melee) this.melee(W);
      else this.shoot(W);
    }
  }

  melee(W) {
    const { player, g, audio } = this.c;
    this.cd = W.rate;
    this.meleeT = 0.45;
    const ch = player.model.userData.char;
    ch?.play(this.cur === 'lathi' ? 'Sword_Slash' : (Math.random() < 0.5 ? 'Punch_Right' : 'Punch_Left'), { once: true, fade: 0.05 });
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    let hitAny = false;
    const tryHit = (e, isPed) => {
      const dx = e.x - player.x, dz = e.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > W.range + 0.5 || d < 0.01) return;
      if ((dx * fx + dz * fz) / d < 0.45) return;
      hitAny = true;
      if (isPed) {
        if (e.state === 'dead') return;
        const killed = e.damage(W.dmg * (g.mature ? 1 : 0.6), dx, dz);
        if (!killed) e.knock?.(fx * 3, fz * 3, 6);
        this.c.crime(killed ? 2 : 1);
        if (g.mature) this.c.blood(e.x, 1.4, e.z, killed);
      } else {
        const killed = e.hit(W.dmg, dx, dz);
        if (e.kind === 'cop') this.c.addWanted(killed ? 2 : 1);
        if (g.mature) this.c.blood(e.x, 1.4, e.z, killed);
      }
    };
    setTimeout(() => {
      for (const p of g.peds) tryHit(p, true);
      for (const s of g.shooters) if (!s.dead) tryHit(s, false);
      if (hitAny) { audio.punch(); g.shake = Math.max(g.shake, 0.2); if (Math.random() < 0.3) this.c.meme('punch'); }
    }, 180);
  }

  muzzlePos(out) {
    const { player } = this.c;
    const ch = player.model.userData.char;
    if (ch?.hand) { ch.hand.getWorldPosition(out); return out; }
    return out.set(player.x + Math.sin(player.yaw) * 0.6 - Math.cos(player.yaw) * 0.35, 1.4, player.z + Math.cos(player.yaw) * 0.6 + Math.sin(player.yaw) * 0.35);
  }

  shoot(W) {
    const { camera, g, audio, player } = this.c;
    if (this.ammo[this.cur] <= 0) {
      this.cd = 0.3;
      audio.click?.();
      this.c.hud.toast('Goli khatam! 🔫 (buy ammo at Hathiyar Bhandar)', 1500);
      return;
    }
    this.ammo[this.cur]--;
    this.cd = W.rate;
    this.lastShotT = g.time;
    audio.gun(W.sound);
    camera.getWorldDirection(_dir);
    _o.copy(camera.position);
    const minT = _o.distanceTo(_p.set(player.x, 1.5, player.z)) + 0.4;
    this.muzzlePos(_hand);
    this.c.cfx.muzzle(_hand);
    const pellets = W.pellets || 1;
    for (let i = 0; i < pellets; i++) {
      const d = _dir.clone();
      const sp = W.spread * (this.aiming ? 1 : 2.5);
      d.x += rand(-sp, sp); d.y += rand(-sp, sp); d.z += rand(-sp, sp);
      d.normalize();
      this.hitscan(_o, d, minT, W.range + minT, W.dmg);
    }
    g.camPitch = clamp(g.camPitch - (this.cur === 'dunali' ? 0.03 : 0.008), -0.15, 1.1);
    g.shake = Math.max(g.shake, this.cur === 'dunali' ? 0.25 : 0.08);
    this.c.gunfireNear(player.x, player.z);
  }

  hitscan(o, d, minT, maxT, dmg) {
    const { g, world, cfx } = this.c;
    // static world: march the ray
    let wallT = maxT;
    for (let t = minT; t < maxT; t += 0.7) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y <= 0 || world.pointBlocked(x, y, z)) { wallT = t; break; }
    }
    let best = wallT, hit = null, head = false;
    const test = (e, type) => {
      const tb = raySphere(o, d, e.x, (e.y || 0) + 1.05, e.z, 0.5);
      const th = raySphere(o, d, e.x, (e.y || 0) + 1.72, e.z, 0.24);
      if (th > minT && th < best) { best = th; hit = { e, type }; head = true; }
      if (tb > minT && tb < best) { best = tb; hit = { e, type }; head = false; }
    };
    for (const p of g.peds) if (p.state !== 'dead' && p.mesh.visible && Math.abs(p.x - o.x) < maxT && Math.abs(p.z - o.z) < maxT) test(p, 'ped');
    for (const s of g.shooters) if (!s.dead) test(s, 'shooter');
    for (const v of g.vehicles) {
      if (v.dead || v.player) continue;
      const t = raySphere(o, d, v.x, 1.0, v.z, v.spec.radius * 0.8);
      if (t > minT && t < best) { best = t; hit = { e: v, type: 'vehicle' }; head = false; }
    }
    for (const c of g.cows) {
      const t = raySphere(o, d, c.x, 1.1, c.z, 1.1);
      if (t > minT && t < best) { best = t; hit = { e: c, type: 'cow' }; head = false; }
    }
    const end = new THREE.Vector3(o.x + d.x * best, o.y + d.y * best, o.z + d.z * best);
    cfx.tracer(_hand, end);
    if (!hit) { this.c.puff(end.x, end.y, end.z, 0x9a8f80, 0.35, 0.5, 0, 0.8, 0, 1.5); return; }
    const { e, type } = hit;
    const dx = d.x, dz = d.z;
    const amount = dmg * (head ? 2.6 : 1);
    if (type === 'ped') {
      const killed = e.damage(amount, dx, dz);
      if (killed) e.knock?.(dx * 2, dz * 2, 2);
      this.c.blood(end.x, end.y, end.z, killed, e);
      this.c.crime(killed ? 2 : 1);
      if (!killed) this.c.meme('pedHit');
    } else if (type === 'shooter') {
      const killed = e.hit(amount, dx, dz);
      this.c.blood(end.x, end.y, end.z, killed, e);
      if (e.kind === 'cop') this.c.addWanted(killed ? 2 : 1);
      if (killed && head) this.c.hud.toast('🎯 Headshot!', 900);
    } else if (type === 'vehicle') {
      e.hp -= amount * 0.45;
      this.c.puff(end.x, end.y, end.z, 0xffd27a, 0.3, 0.25, rand(-2, 2), 2, rand(-2, 2), 1, true);
      if (e.type === 'police') this.c.addWanted(1);
      if (e.hp <= 0) this.c.destroyVehicle(e);
    } else if (type === 'cow') {
      if (g.time - (this.cowMsg || -99) > 15) { this.cowMsg = g.time; this.c.hud.toast('🐄 Gaay mata ko kuch nahi hota. Bullet ne hi rasta badal liya.', 2500); }
      this.c.audio.moo(0.6);
    }
  }
}
