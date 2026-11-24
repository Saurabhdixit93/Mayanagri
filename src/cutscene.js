// In-engine cutscenes: letterbox, cast of animated actors, auto-framed camera
// shots (establishing / over-the-shoulder / narrator crane) and voiced dialogue.
import * as THREE from 'three';
import { makeHuman, animateHuman } from './models.js';
import { line } from './config.js';
import { INST } from './models.js';

const $ = (id) => document.getElementById(id);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class Cutscene {
  // script: { anchor:{x,z}, cast:[{id, arch}], lines:[[speakerId, voiceId]], title? }
  constructor(ctx, script, onEnd) {
    this.c = ctx;
    this.s = script;
    this.onEnd = onEnd;
    this.idx = -1;
    this.t = 0;
    this.waiting = false;
    this.done = false;
    this.camPos = V();
    this.camGoal = V();
    this.look = V();
    this.lookGoal = V();
    this.actors = {};
  }

  start() {
    const { scene, player, g } = this.c;
    const a = this.s.anchor;
    // which way is the open road? (shots are taken from the road side, away from buildings)
    const i = Math.round((a.x + 600) / 100), j = Math.round((a.z + 600) / 100);
    const dx = line(Math.max(0, Math.min(12, i))) - a.x, dz = line(Math.max(0, Math.min(12, j))) - a.z;
    this.out = Math.abs(dx) < Math.abs(dz) ? V(Math.sign(dx) || 1, 0, 0) : V(0, 0, Math.sign(dz) || 1);
    this.tan = V(-this.out.z, 0, this.out.x);
    this.mid = V(a.x, 0, a.z);
    // the player steps out of any vehicle and stands at the anchor
    if (player.vehicle) { player.vehicle.player = false; player.vehicle.speed = 0; player.vehicle = null; this.c.audio.setEngine('car', 0, false); }
    const pp = this.mid.clone().addScaledVector(this.tan, -1.1);
    player.x = pp.x; player.z = pp.z; player.y = 0;
    player.yaw = Math.atan2(this.tan.x, this.tan.z);
    player.model.visible = true;
    player.model.position.set(player.x, 0, player.z);
    player.model.rotation.y = player.yaw;
    animateHuman(player.model, 0, 0);
    // actors
    const cast = this.s.cast || [];
    cast.forEach((c, k) => {
      const m = makeHuman({ arch: c.arch, female: c.female });
      const p = this.mid.clone().addScaledVector(this.tan, 1.1).addScaledVector(this.out, k * 1.1);
      m.position.copy(p);
      m.rotation.y = Math.atan2(pp.x - p.x, pp.z - p.z);
      scene.add(m);
      this.actors[c.id] = m;
    });
    this.actors.player = player.model;
    document.body.classList.add('cine');
    $('letterbox').style.display = 'block';
    if (this.s.title) this.c.hud.big(this.s.title, '#ffd60a', 2600);
    g.cutscene = this;
    this.c.refreshMarkers?.();
    this.shot('wide');
    this.camPos.copy(this.camGoal).addScaledVector(this.tan, 3).y += 1.5;
    this.look.copy(this.lookGoal);
    this.t = this.s.title ? 2.6 : 1.4;
  }

  shot(kind, speaker) {
    const up = V(0, 1, 0);
    if (kind === 'wide') {
      this.camGoal.copy(this.mid).addScaledVector(this.out, 7.5).addScaledVector(this.tan, 2).add(up.clone().multiplyScalar(2.3));
      this.lookGoal.copy(this.mid).add(V(0, 1.3, 0));
    } else if (kind === 'crane') {
      this.camGoal.copy(this.mid).addScaledVector(this.out, 16).add(V(0, 9, 0));
      this.lookGoal.copy(this.mid).add(V(0, 2, 0));
    } else {
      const S = this.actors[speaker];
      const others = Object.entries(this.actors).filter(([k]) => k !== speaker);
      const L = (others.find(([k]) => k === 'player') || others[0] || [null, S])[1];
      const sp = S.position.clone(), lp = L.position.clone();
      const back = lp.clone().sub(sp).setY(0).normalize();
      this.camGoal.copy(lp).addScaledVector(back, 1.4).addScaledVector(this.out, 1.0).add(V(0, 1.75, 0));
      this.lookGoal.copy(sp).add(V(0, 1.55, 0));
    }
    // cut: jump most of the way, then a slow push-in
    this.camPos.copy(this.camGoal).addScaledVector(this.out, 0.6);
    this.look.copy(this.lookGoal);
  }

  async next() {
    this.idx++;
    const L = this.s.lines[this.idx];
    if (!L) { this.end(); return; }
    const [who, id] = L;
    this.waiting = true;
    if (who === 'narrator') this.shot(this.idx === 0 ? 'crane' : 'wide');
    else this.shot('speaker', who);
    const actor = this.actors[who];
    const ch = actor?.userData.char;
    if (ch) { actor.userData.lockAnim = true; ch.play(Math.random() < 0.5 ? 'Interact' : 'Wave', { once: true }); }
    let dur = 3;
    try { dur = await this.c.voice.playId(id, (l) => this.c.hud.subtitle(l.en)); } catch { /* keep going */ }
    if (this.done) return;
    if (ch) setTimeout(() => { actor.userData.lockAnim = false; ch.play('Idle'); }, 1400);
    this.t = dur + 0.45;
    this.waiting = false;
  }

  update(dt) {
    if (this.done) return;
    const { camera } = this.c;
    for (const [k, m] of Object.entries(this.actors)) if (k !== 'player') m.userData.char?.update(dt);
    this.camPos.lerp(this.camGoal, Math.min(1, dt * 0.6));
    this.look.lerp(this.lookGoal, Math.min(1, dt * 3));
    camera.position.copy(this.camPos);
    camera.lookAt(this.look);
    if (camera.fov !== 45) { camera.fov = 45; camera.updateProjectionMatrix(); }
    if (!this.waiting) {
      this.t -= dt;
      if (this.t <= 0) this.next();
    }
  }

  skip() { this.c.voice.stop(); this.end(); }

  end() {
    if (this.done) return;
    this.done = true;
    const { scene, g } = this.c;
    for (const [k, m] of Object.entries(this.actors)) {
      if (k === 'player') continue;
      scene.remove(m);
      INST.unregister(m);
    }
    this.c.player.model.userData.lockAnim = false;
    document.body.classList.remove('cine');
    $('letterbox').style.display = 'none';
    g.cutscene = null;
    this.c.refreshMarkers?.();
    this.onEnd?.();
  }
}
