import { SEA_X } from './config.js';
import { WEAPONS } from './combat.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(groundCanvas) {
    this.ground = groundCanvas;
    this.mini = $('minimap').getContext('2d');
    this.timers = {};
    this.lastArea = '';
  }

  fade(id, text, ms = 2500, html = false) {
    const el = $(id);
    if (html) el.innerHTML = text; else el.textContent = text;
    el.style.opacity = 1;
    clearTimeout(this.timers[id]);
    this.timers[id] = setTimeout(() => (el.style.opacity = 0), ms);
  }
  toast(t, ms) { this.fade('toast', t, ms || 2500); }
  subtitle(t) { this.fade('subtitle', '🗣️ ' + t, 2800); }
  radio(t) { this.fade('radio', '📻 ' + t, 2500); }
  big(t, color = '#ff3d3d', ms = 3000) {
    const el = $('big');
    el.innerHTML = `<span style="color:${color};-webkit-text-stroke:3px #000">${t}</span>`;
    el.style.opacity = 1;
    clearTimeout(this.timers.big);
    this.timers.big = setTimeout(() => (el.style.opacity = 0), ms);
  }
  area(name) {
    if (name === this.lastArea) return;
    this.lastArea = name;
    this.fade('area', name, 3000);
  }
  prompt(t) {
    const el = $('prompt');
    if (t) { el.textContent = t; el.style.display = 'block'; } else el.style.display = 'none';
  }

  stats(g) {
    $('money').textContent = '₹ ' + Math.floor(g.money).toLocaleString('en-IN');
    let s = '';
    for (let i = 0; i < 5; i++) s += `<span class="${i < g.stars ? 'on' : ''}">★</span>`;
    $('stars').innerHTML = s;
    $('health').firstElementChild.style.width = Math.max(0, g.health) + '%';
    const hrs = (g.dayTime * 24) % 24;
    const h = Math.floor(hrs), m = Math.floor((hrs - h) * 60);
    $('clock').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 6 && h < 19 ? '☀️' : '🌙'}`;
  }

  weapon(c, flash) {
    const el = $('weapon');
    const W = WEAPONS[c.cur];
    const ammo = W.melee ? '' : ` <b>${c.ammo[c.cur]}</b>`;
    const html = `${W.icon} ${W.name}${ammo}`;
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
    if (flash) { el.style.transform = 'scale(1.25)'; setTimeout(() => (el.style.transform = ''), 150); }
  }
  armor(a) {
    const el = $('armor');
    el.style.display = a > 0 ? 'block' : 'none';
    el.firstElementChild.style.width = a + '%';
  }
  crosshair(on) { $('crosshair').style.display = on ? 'block' : 'none'; }

  vehicle(v) {
    const el = $('veh');
    if (!v) { el.innerHTML = ''; return; }
    const kmh = Math.abs(Math.round(v.speed * 3.6));
    const air = v.air ? `<div style="color:#00f5d4;font-size:20px">✈ ${v.airT.toFixed(1)}s</div>` : '';
    el.innerHTML = `${air}<div class="name">${v.spec.name}</div><div class="speed">${kmh} <span style="font-size:18px">km/h</span></div><div class="vhp"><div style="width:${Math.max(0, (v.hp / v.spec.hp) * 100)}%"></div></div>`;
  }

  mission(m, distText) {
    const el = $('mission');
    if (!m) { el.innerHTML = ''; return; }
    const step = m.steps[m.idx];
    const t = Math.max(0, Math.ceil(m.timeLeft));
    el.innerHTML = `<div class="title">${m.def.title}</div><div class="timer">⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</div><div class="obj">${step ? step.text : ''} ${distText || ''}</div>`;
  }

  board(items, show) {
    const el = $('board');
    el.style.display = show ? 'block' : 'none';
    if (show) el.innerHTML = '<b>Soundboard</b><br>' + items.map((i) => `${i.key} · ${i.label}`).join('<br>');
  }

  // Rotating minimap centred on player; map "up" is camera forward.
  minimap(g) {
    const ctx = this.mini;
    const S = 210, half = S / 2;
    const viewUnits = 280;
    const k = this.ground.width / 1400; // canvas px per world unit
    const s = S / viewUnits;              // minimap px per world unit
    const px = g.focus.x, pz = g.focus.z;
    const theta = g.camYaw - Math.PI;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1f6f8b'; ctx.fillRect(0, 0, S, S);
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(theta);
    ctx.scale(s / k, s / k);
    ctx.translate(-(px + 700) * k, -(pz + 700) * k);
    ctx.drawImage(this.ground, 0, 0);
    // sea features beyond the ground texture (island, ship, jetty)
    for (const sh of g.mapShapes || []) {
      ctx.fillStyle = sh.color;
      const X = (sh.x + 700) * k, Z = (sh.z + 700) * k;
      if (sh.r) { ctx.beginPath(); ctx.arc(X, Z, sh.r * k, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(X - (sh.w / 2) * k, Z - (sh.d / 2) * k, sh.w * k, sh.d * k);
    }
    ctx.restore();

    const c = Math.cos(theta), sn = Math.sin(theta);
    const toMini = (x, z) => {
      const dx = (x - px) * s, dz = (z - pz) * s;
      return [half + dx * c - dz * sn, half + dx * sn + dz * c];
    };
    const dot = (x, z, color, r = 3, clampEdge = false) => {
      let [mx, my] = toMini(x, z);
      const ox = mx - half, oy = my - half;
      const d = Math.hypot(ox, oy);
      if (d > half - 8) { if (!clampEdge) return; mx = half + (ox / d) * (half - 8); my = half + (oy / d) * (half - 8); }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(mx, my, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    };
    for (const v of g.police) dot(v.x, v.z, Math.floor(g.time * 4) % 2 ? '#ff2020' : '#2050ff', 4, true);
    for (const m of g.markers) if (!g.mission && m.mesh.visible !== false && (!m.def.mature || g.mature)) dot(m.x, m.z, m.def.mature ? '#ff3d3d' : '#ffd60a', 6, true);
    for (const s of g.services || []) dot(s.x, s.z, s.color, 4, false);
    if (g.storyGiver && !g.mission) dot(g.storyGiver.x, g.storyGiver.z, '#ffb703', 7, true);
    for (const s of g.shooters || []) if (!s.dead && s.alert) dot(s.x, s.z, s.kind === 'cop' ? '#4895ef' : '#ff3d3d', 3, false);
    if (g.heli) dot(g.heli.x, g.heli.z, '#ffffff', 5, true);
    dot(g.pois.hospital.x, g.pois.hospital.z, '#ff4d6d', 4, true);
    dot(g.pois.police.x, g.pois.police.z, '#4895ef', 4, true);
    if (g.mission) {
      const st = g.mission.steps[g.mission.idx];
      if (st && st.x !== undefined) dot(st.x, st.z, '#ff00ff', 6, true);
    }
    // player arrow
    const h = g.focusYaw;
    const ax = Math.sin(h), az = Math.cos(h);
    const fx = ax * c - az * sn, fy = ax * sn + az * c;
    ctx.save(); ctx.translate(half, half); ctx.rotate(Math.atan2(fy, fx));
    ctx.fillStyle = '#7dff7a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // north indicator
    const [nx, ny] = [half + (0 * c - (-1) * sn) * (half - 10), half + (0 * sn + (-1) * c) * (half - 10)];
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', nx, ny);
  }

  bigmap(g, show) {
    const wrap = $('bigmap');
    wrap.style.display = show ? 'flex' : 'none';
    if (!show) return;
    const cv = $('bigmapCanvas');
    const ctx = cv.getContext('2d');
    const S = cv.width;
    // show the sea too: world x -1300..700, z -1000..1000
    const X0 = -1300, Z0 = -1000, SPAN = 2000;
    const toC = (x, z) => [((x - X0) / SPAN) * S, ((z - Z0) / SPAN) * S];
    ctx.fillStyle = '#1f6f8b'; ctx.fillRect(0, 0, S, S);
    const [gx, gz] = toC(-700, -700);
    ctx.drawImage(this.ground, gx, gz, (1400 / SPAN) * S, (1400 / SPAN) * S);
    for (const sh of g.mapShapes || []) {
      const [cx, cz] = toC(sh.x, sh.z);
      ctx.fillStyle = sh.color;
      if (sh.r) { ctx.beginPath(); ctx.arc(cx, cz, (sh.r / SPAN) * S, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(cx - (sh.w / SPAN) * S / 2, cz - (sh.d / SPAN) * S / 2, (sh.w / SPAN) * S, (sh.d / SPAN) * S);
    }
    const mark = (x, z, color, r, label) => {
      const [cx, cz] = toC(x, z);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cz, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
      if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.strokeText(label, cx + r + 3, cz + 4); ctx.fillText(label, cx + r + 3, cz + 4); }
    };
    ctx.font = 'bold 16px sans-serif';
    for (const m of g.markers) if (!m.def.mature || g.mature) mark(m.x, m.z, m.def.mature ? '#ff3d3d' : '#ffd60a', 8, m.def.title);
    for (const s of g.services || []) mark(s.x, s.z, s.color, 7, s.name);
    if (g.storyGiver) mark(g.storyGiver.x, g.storyGiver.z, '#ffb703', 10, '★ STORY');
    mark(g.pois.hospital.x, g.pois.hospital.z, '#ff4d6d', 7, 'Hospital');
    mark(g.pois.police.x, g.pois.police.z, '#4895ef', 7, 'Police Thana');
    mark(g.pois.mandir.x, g.pois.mandir.z, '#ff9933', 6, 'Mandir');
    mark(g.pois.station.x, g.pois.station.z, '#c65d3b', 6, 'Station');
    mark(g.pois.plaza.x, g.pois.plaza.z, '#c9a66b', 6, 'Darwaza / Shaadi Hall');
    if (g.mission) {
      const st = g.mission.steps[g.mission.idx];
      if (st && st.x !== undefined) mark(st.x, st.z, '#ff00ff', 9, 'Objective');
    }
    mark(g.focus.x, g.focus.z, '#7dff7a', 9, 'YOU');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText('ARABIAN SEA', toC(SEA_X - 380, 0)[0], toC(0, -420)[1]);
  }
}
