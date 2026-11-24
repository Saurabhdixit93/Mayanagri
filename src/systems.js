// GTA-style side systems: armed police & goons, helicopter, blood, garage (respray),
// gun shop, cheats, health regen, radio DJ.
import * as THREE from 'three';
import { Shooter, Heli, WEAPONS } from './combat.js';
import { line } from './config.js';
import { rand, pick, clamp } from './utils.js';

export const GARAGE = { x: line(2) + 11, z: line(5) + 50, name: 'Jugaad Garage 🔧' };
export const SHOP = { x: line(5) + 11, z: line(6) - 30, name: 'Hathiyar Bhandar 🔫' };

const CHEATS = {
  JUGAAD: 'Health, armour & gaadi repair',
  PAISA: '₹10,000',
  MAMU: 'Wanted level cleared',
  HATHIYAR: 'All weapons + ammo (18+)',
  BARISH: 'Monsoon on/off',
  TAMASHA: '5 stars. Good luck.',
};

export class Systems {
  constructor(ctx) {
    this.c = ctx;
    this.cheatBuf = '';
    this.djT = rand(60, 100);
    this.lastWitness = -99;
    this.shopOpen = false;
    this.buildMarkers();
    this.buildShopUI();
    window.addEventListener('keydown', (e) => {
      if (e.key.length === 1 && /[a-z]/i.test(e.key)) {
        this.cheatBuf = (this.cheatBuf + e.key.toUpperCase()).slice(-12);
        for (const code of Object.keys(CHEATS)) if (this.cheatBuf.endsWith(code)) { this.cheat(code); this.cheatBuf = ''; }
      }
    });
  }

  // ---------- markers ----------
  buildMarkers() {
    const { scene, g } = this.c;
    const mk = (p, color) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 7, 20, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(p.x, 3.5, p.z);
      scene.add(m);
      return m;
    };
    this.garageMesh = mk(GARAGE, 0x4cc9f0);
    this.shopMesh = mk(SHOP, 0xff3d3d);
    g.services = [{ ...GARAGE, color: '#4cc9f0' }, { ...SHOP, color: '#ff3d3d' }];
  }

  // ---------- gun shop ----------
  buildShopUI() {
    const el = document.createElement('div');
    el.id = 'shop';
    el.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.7);z-index:20;font-family:inherit';
    document.body.appendChild(el);
    this.shopEl = el;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.close) return this.closeShop();
      this.buy(b.dataset.item, b.dataset.kind);
    });
  }

  renderShop() {
    const { g, combat } = this.c;
    const rows = [];
    const row = (label, price, item, kind, disabled) => rows.push(`<tr><td>${label}</td><td style="text-align:right">₹${price.toLocaleString('en-IN')}</td><td><button data-item="${item}" data-kind="${kind}" ${disabled ? 'disabled' : ''} style="padding:4px 12px;border-radius:6px;border:2px solid #000;background:${disabled ? '#555' : '#ffd60a'};cursor:pointer;font-weight:900">${disabled ? (kind === 'gun' ? 'Owned' : kind === 'ammo' ? '—' : 'Full') : 'Buy'}</button></td></tr>`);
    row('🛡️ Bulletproof Banyan (armour)', 500, 'armor', 'armor', g.armor >= 100);
    row('🥟 Samosa thali (full health)', 150, 'health', 'health', g.health >= 100);
    row(WEAPONS.lathi.icon + ' ' + WEAPONS.lathi.name, WEAPONS.lathi.price, 'lathi', 'gun', combat.owned.has('lathi'));
    if (g.mature) {
      for (const w of ['katta', 'dunali', 'ak']) {
        const W = WEAPONS[w];
        row(`${W.icon} ${W.name}`, W.price, w, 'gun', combat.owned.has(w));
        row(`&nbsp;&nbsp;↳ ammo ×${W.ammoPack} (have ${combat.ammo[w]})`, W.ammoPrice, w, 'ammo', !combat.owned.has(w));
      }
    }
    this.shopEl.innerHTML = `<div style="background:#1b1b1b;border:4px solid #ff3d3d;border-radius:14px;padding:20px 26px;min-width:420px;color:#fff">
      <h2 style="margin:0 0 4px;color:#ff3d3d">HATHIYAR BHANDAR</h2>
      <div style="opacity:.7;margin-bottom:10px">"Mobile repair" ke peeche wali dukaan · Paisa: ₹${Math.floor(g.money).toLocaleString('en-IN')}</div>
      ${g.mature ? '' : '<div style="color:#ffd60a;margin-bottom:8px">Guns are only sold in 18+ mode.</div>'}
      <table style="width:100%;border-spacing:0 6px">${rows.join('')}</table>
      <button data-close="1" style="margin-top:10px;padding:8px 20px;border-radius:20px;border:2px solid #000;background:#fff;font-weight:900;cursor:pointer">Close (E)</button></div>`;
  }

  openShop() {
    this.shopOpen = true;
    this.c.g.paused = true;
    document.exitPointerLock?.();
    this.renderShop();
    this.shopEl.style.display = 'flex';
    this.c.meme('shop', true);
  }

  closeShop() {
    this.shopOpen = false;
    this.shopEl.style.display = 'none';
    this.c.g.paused = false;
    this.c.lockPointer?.();
  }

  buy(item, kind) {
    const { g, combat, audio, hud } = this.c;
    const price = kind === 'armor' ? 500 : kind === 'health' ? 150 : kind === 'ammo' ? WEAPONS[item].ammoPrice : WEAPONS[item].price;
    if (g.money < price) { hud.toast('Paise nahi hain bhai! 💸', 1500); audio.fail?.(); return; }
    g.money -= price;
    if (kind === 'armor') g.armor = 100;
    else if (kind === 'health') g.health = 100;
    else if (kind === 'ammo') combat.ammo[item] += WEAPONS[item].ammoPack;
    else combat.give(item, WEAPONS[item].ammoPack || 0);
    audio.cash();
    this.renderShop();
  }

  // ---------- cheats ----------
  cheat(code) {
    const { g, hud, audio, combat, player, weather } = this.c;
    if (code === 'JUGAAD') { g.health = 100; g.armor = 100; if (player.vehicle) player.vehicle.hp = player.vehicle.spec.hp; }
    if (code === 'PAISA') g.money += 10000;
    if (code === 'MAMU') { g.stars = 0; }
    if (code === 'HATHIYAR') {
      if (!g.mature) { hud.toast('HATHIYAR needs 18+ mode', 2000); return; }
      for (const w of ['lathi', 'katta', 'dunali', 'ak']) combat.give(w, (WEAPONS[w].ammoPack || 0) * 3);
    }
    if (code === 'BARISH') weather.toggle();
    if (code === 'TAMASHA') this.c.addWanted(5);
    hud.big(`CHEAT: ${code}<br><span style="font-size:28px;color:#fff">${CHEATS[code]}</span>`, '#7dff7a', 2200);
    audio.ting();
    this.c.meme('cheat', true);
  }

  // ---------- NPC combat callbacks ----------
  shooterCtx() {
    const { g, player, world } = this.c;
    if (!this._sctx) {
      this._sctx = {
        world,
        target: () => ({ x: g.focus.x, z: g.focus.z }),
        shout: (s) => this.c.meme(s.kind === 'cop' ? 'copShout' : 'goonShout'),
        npcShoot: (s, d) => this.npcShoot(s, d),
        npcMelee: (s) => this.npcMelee(s),
      };
    }
    this._sctx.time = g.time;
    this._sctx.mature = g.mature;
    return this._sctx;
  }

  npcShoot(s, d) {
    const { g, player, audio, cfx } = this.c;
    const from = new THREE.Vector3(s.x, (s.y || 0) + (s.heli ? 0 : 1.45), s.z);
    const to = new THREE.Vector3(g.focus.x, 1.2, g.focus.z);
    cfx.muzzle(from);
    const vol = clamp(1 - d / 120, 0.1, 0.8);
    audio.gun(WEAPONS[s.weapon]?.sound || 'pistol', vol);
    const moving = player.vehicle ? Math.abs(player.vehicle.speed) / 30 : (Math.hypot(g.focusVel.x, g.focusVel.z) / 10);
    const chance = clamp(0.55 - d / 70 - moving * 0.25, 0.08, 0.5);
    if (Math.random() < chance) {
      cfx.tracer(from, to);
      if (player.vehicle) { player.vehicle.hp -= 7; audio.punch(); }
      else {
        this.c.damagePlayer(s.weapon === 'ak' ? 9 : s.weapon === 'dunali' ? 16 : 11);
        if (g.mature) this.blood(to.x, to.y, to.z, false);
      }
    } else {
      to.x += rand(-3, 3); to.y += rand(-1, 2); to.z += rand(-3, 3);
      cfx.tracer(from, to);
    }
  }

  npcMelee(s) {
    const { g, player, audio } = this.c;
    if (player.vehicle) return;
    if (Math.hypot(s.x - player.x, s.z - player.z) > 2.2) return;
    audio.punch();
    this.c.damagePlayer(s.weapon === 'lathi' ? 9 : 6);
    g.shake = Math.max(g.shake, 0.3);
  }

  blood(x, y, z, killed, e) {
    const { g, puff, cfx } = this.c;
    if (!g.mature) { puff(x, y, z, 0xdddddd, 0.3, 0.3, 0, 1, 0, 1); return; }
    for (let i = 0; i < (killed ? 7 : 4); i++) puff(x, y, z, pick([0x8a0000, 0x6a0000, 0xb00000]), rand(0.15, 0.4), rand(0.3, 0.6), rand(-2, 2), rand(0, 2.5), rand(-2, 2), 1.2);
    if (killed) setTimeout(() => cfx.bloodPool(e ? e.x : x, e ? e.z : z, rand(1.8, 2.8)), 700);
  }

  gunfireNear(x, z) {
    const { g } = this.c;
    let witnesses = 0;
    for (const p of g.peds) {
      if (p.state !== 'walk') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < 60) { p.flee = 10; witnesses++; }
    }
    if (witnesses && Math.random() < 0.25) this.c.meme('gunPanic');
    if (witnesses && g.time - this.lastWitness > 6) { this.lastWitness = g.time; this.c.crime(1); }
  }

  // ---------- per frame ----------
  update(dt) {
    const { g, player, scene, hud, kp, audio, corners, voice } = this.c;
    const sctx = this.shooterCtx();
    for (const s of g.shooters) s.update(dt, sctx);

    // police on foot (3+ stars, or 2+ in 18+ mode)
    const needFoot = g.stars >= (g.mature ? 2 : 3) ? Math.min(8, g.stars * 2 - (g.mature ? 1 : 3)) : 0;
    const cops = g.shooters.filter((s) => s.kind === 'cop' && !s.dead);
    this.footCd = (this.footCd || 0) - dt;
    if (cops.length < needFoot && this.footCd <= 0) {
      this.footCd = 2.2;
      const spots = corners.filter((p) => { const d = Math.hypot(p.x - g.focus.x, p.z - g.focus.z); return d > 35 && d < 75; });
      if (spots.length) {
        const p = pick(spots);
        const weapon = g.mature ? (g.stars >= 5 ? 'ak' : g.stars >= 4 ? 'dunali' : 'katta') : 'lathi';
        const s = new Shooter(scene, 'cop', p.x, p.z, { weapon });
        g.shooters.push(s);
      }
    }
    // remove cops when wanted is gone, and bodies that are far away
    for (const s of g.shooters) {
      const d = Math.hypot(s.x - g.focus.x, s.z - g.focus.z);
      if ((s.kind === 'cop' && g.stars === 0 && !s.dead && d > 25) || (s.dead && (d > 120 || s.deadT > 60)) || d > 250) { s.destroy(); s.gone = true; }
      if (s.kind === 'cop' && g.stars === 0) s.alert = false;
    }
    g.shooters = g.shooters.filter((s) => !s.gone);

    // helicopter
    if (g.stars >= 4 && !g.heli) {
      g.heli = new Heli(scene, g.focus.x + 200, g.focus.z + 200);
      this.c.meme('heli', true);
    }
    if (g.heli) {
      if (g.stars < 4) g.heli.leaving = true;
      const d = g.heli.update(dt, sctx, 1 - (g.dayF ?? 1));
      audio.setHeli(clamp(1 - Math.hypot(d, g.heli.y) / 220, 0, 1));
      if (g.heli.leaving && d > 450) { g.heli.destroy(); g.heli = null; audio.setHeli(0); }
    }

    // markers spin
    this.garageMesh.rotation.y += dt; this.shopMesh.rotation.y += dt;
    this.shopMesh.visible = true;

    // garage (respray / repair)
    const v = player.vehicle;
    if (v && Math.hypot(v.x - GARAGE.x, v.z - GARAGE.z) < 7) {
      if (Math.abs(v.speed) > 3) hud.prompt('🔧 Jugaad Garage — slow down to enter');
      else if (!this.inGarage) {
        this.inGarage = true;
        const cost = 400;
        if (g.money < cost) hud.toast('Garage: ₹400 chahiye bhai 💸', 2000);
        else {
          g.money -= cost;
          v.hp = v.spec.hp;
          const seen = g.police.some((p) => Math.hypot(p.x - v.x, p.z - v.z) < 60) || g.shooters.some((s) => s.kind === 'cop' && !s.dead && Math.hypot(s.x - v.x, s.z - v.z) < 40);
          if (!seen) g.stars = 0;
          hud.big(`NAYA NUMBER PLATE<br><span style="font-size:28px;color:#fff">Repaired${seen ? ' — but the police saw you!' : ' · Wanted cleared'} · -₹${cost}</span>`, '#4cc9f0', 2500);
          this.c.meme('garage', true);
          audio.ting();
        }
      }
    } else this.inGarage = false;

    // gun shop
    if (!v && Math.hypot(player.x - SHOP.x, player.z - SHOP.z) < 3.5) {
      hud.prompt(`E — ${SHOP.name}`);
      if (kp('KeyE')) this.openShop();
    }

    // health regen up to 40 (like GTA V's half-health regen)
    if (g.health < 40 && g.health > 0 && g.time - (g.lastHurt || 0) > 6) g.health = Math.min(40, g.health + dt * 2);

    // radio DJ / news breaks while driving with radio on
    if (v && audio.station !== 3) {
      this.djT -= dt;
      if (this.djT <= 0) {
        this.djT = rand(100, 170);
        voice.play(Math.random() < 0.3 ? 'news' : 'dj' + audio.station, { onSub: (l) => hud.subtitle('📻 ' + l.en) });
      }
    }
  }

  onStation(i) {
    if (i === 3) return;
    setTimeout(() => this.c.voice.play('dj' + i, { onSub: (l) => this.c.hud.subtitle('📻 ' + l.en) }), 900);
    this.djT = rand(100, 170);
  }
}
