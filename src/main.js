import * as THREE from 'three';
import { buildCity, sidewalkCorners } from './city.js';
import { Vehicle, randomTrafficType, randomRoadSpawn } from './vehicles.js';
import { Ped, Cow, WALK_XS } from './people.js';
import { makeHuman, animateHuman, textTexture, textPlane, box, INST } from './models.js';
import { AudioSys } from './audio.js';
import { HUD } from './hud.js';
import { LINES as VOICE, BOARD } from './lines.js';
import { missionDefs } from './missions.js';
import { FX, SOFT } from './fx.js';
import { loadAssets, CarInstancer, ASSET_COUNT } from './assets.js';
import { VoiceBank } from './voice.js';
import { CombatFX, WEAPONS, Shooter } from './combat.js';
import { PlayerCombat } from './player_combat.js';
import { Weather } from './weather.js';
import { Systems } from './systems.js';
import { Cutscene } from './cutscene.js';
import { storyChapters } from './story.js';
import { Stunts, RAMPS } from './stunts.js';
import { Sea, waveH, JETTY, ISLAND, ISLAND_DOCK, SEA_MIN_X } from './sea.js';
import { setVehicleNight } from './vehicles.js';
import { line, LANE, RAIL_Z, SEA_X, areaName } from './config.js';
import { rand, pick, clamp, lerp, angleDiff, shuffle } from './utils.js';

// ============================================================================
// Renderer / scene
// ============================================================================
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfe3ea);
scene.fog = new THREE.Fog(0xcfe3ea, 90, 400);
INST.attach(scene);
scene.matrixWorldAutoUpdate = false; // we update once per frame before copying instance matrices
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.3, 1500);

const hemi = new THREE.HemisphereLight(0xfff4e0, 0x6b5a40, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe2b0, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 500 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ============================================================================
// World
// ============================================================================
// ---------- load CC0 models before building the world ----------
{
  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  let done = 0;
  btn.textContent = `Loading 0/${ASSET_COUNT}…`;
  await loadAssets(() => { done++; btn.textContent = `Loading ${done}/${ASSET_COUNT}…`; });
  btn.disabled = false;
  btn.textContent = 'CHALO! ▶';
}
const city = buildCity(scene);
const world = city.world;
const corners = sidewalkCorners();
const audio = new AudioSys();
const hud = new HUD(city.groundCanvas);
const fx = new FX(scene, city);
const sea = new Sea(scene, world);
const voice = new VoiceBank(audio);

let save = { money: 500, done: 0 };
try { save = { ...save, ...JSON.parse(localStorage.getItem('bharat-streets-save') || '{}') }; } catch { /* ignore */ }

const g = {
  money: save.money, missionsDone: save.done,
  stars: 0, evadeT: 0, bustT: 0,
  health: 100,
  time: 0, dayTime: 0.3,
  camYaw: 0, camPitch: 0.25, camZoom: 1, lastMouse: -10,
  focus: { x: 0, z: 0 }, focusYaw: 0, focusVel: { x: 0, z: 0 },
  vehicles: [], police: [], peds: [], cows: [], pickups: [], markers: [],
  pois: city.pois,
  mission: null,
  frozen: 0, paused: true, started: false,
  shake: 0, lastMeme: -10, lastHonkShout: -10, hornCd: 0,
  showBoard: false, showMap: false,
  mature: (() => { try { return localStorage.getItem('bharat-18') === '1'; } catch { return false; } })(),
  armor: 0, shooters: [], heli: null, services: [], mouseL: false, mouseR: false, fpv: false, lastHurt: -99,
  mapShapes: sea.mapShapes, atSea: false, buoyAt: null,
};
window.__game = g;
window.__debug = { renderer }; // handy for debugging in the console

// ---------- player ----------
const player = {
  x: -89, z: -55, y: 0, vy: 0, yaw: Math.PI, r: 0.5, anim: 0, vehicle: null, hurtCd: 0,
  model: makeHuman({ arch: 'casual', shirt: 0xff9933, pants: 0x1d3557, shades: true, female: false, mustache: true, kurta: true }),
};
scene.add(player.model);
window.__player = player;
const cfx = new CombatFX(scene);
const weather = new Weather(scene, audio);
const ctx = {
  scene, camera, world, g, player, audio, voice, hud, cfx, weather, corners, pois: city.pois,
  k: (c) => keys.has(c), kp: (c) => pressed.has(c),
  meme: (...a) => meme(...a), addWanted: (...a) => addWanted(...a), crime: (...a) => crime(...a),
  damagePlayer: (...a) => damagePlayer(...a), puff: (...a) => puff(...a), destroyVehicle: (v) => destroyVehicle(v),
  blood: (...a) => systems.blood(...a), gunfireNear: (...a) => systems.gunfireNear(...a), lockPointer: () => lockPointer(),
};
let stuntSave = [];
try { stuntSave = JSON.parse(localStorage.getItem('bharat-stunts') || '[]'); } catch { /* ignore */ }
const stunts = new Stunts(scene, world, stuntSave);
window.__debug.stunts = stunts;
window.__debug.spawn = (type, x = player.x + 5, z = player.z, yaw = 0) => { const v = new Vehicle(type, scene, x, z, yaw); v.protected = true; g.vehicles.push(v); return v; };
ctx.refreshMarkers = () => refreshMissionMarkers();
const combat = new PlayerCombat(ctx);
ctx.combat = combat;
const systems = new Systems(ctx);
window.__debug.combat = combat; window.__debug.systems = systems; window.__debug.camera = camera; window.__debug.world = world;

// ---------- traffic ----------
const TRAFFIC = 46, PEDS = 70, COWS = 16;

function spawnTraffic(v, minD = 0, maxD = 1e9) {
  for (let t = 0; t < 25; t++) {
    const s = randomRoadSpawn();
    const d = Math.hypot(line(s.i) - g.focus.x, line(s.j) - g.focus.z);
    if (d < minD || d > maxD) continue;
    v.initAI(s.i, s.j, s.dir);
    v.hp = v.spec.hp;
    return true;
  }
  return false;
}

g.focus.x = player.x; g.focus.z = player.z;
g.hornNear = 0;
g.meme = (...a) => meme(...a);
g.spawnGoons = (pts, opts = {}) => pts.map(([x, z]) => {
  const weapon = opts.weapon === 'mix' ? pick(['katta', 'katta', 'dunali', 'ak']) : opts.weapon;
  const s = new Shooter(scene, opts.kind || 'goon', x, z, { weapon, alert: opts.alert });
  s.mission = true;
  g.shooters.push(s);
  return s;
});
const runtimeSigns = {};
g.addSign = (text, bg, fg, x, z, key) => {
  if (runtimeSigns[key]) return;
  const s = textPlane(text, 8, 2, { bg, fg });
  s.position.set(x, 4, z); s.rotation.y = -Math.PI / 2;
  scene.add(s); runtimeSigns[key] = s;
};
g.spawnTarget = (type, minD, maxD, hp) => {
  const v = new Vehicle(type, scene);
  spawnTraffic(v, minD, maxD);
  v.protected = true;
  if (hp) v.hp = hp;
  g.vehicles.push(v);
  return v;
};
for (let i = 0; i < TRAFFIC; i++) {
  const v = new Vehicle(randomTrafficType(), scene);
  spawnTraffic(v, 30, 330);
  g.vehicles.push(v);
}
// parked rides near start
const parked = [['auto', -95.5, -40, 0], ['bike', -104.5, -70, Math.PI], ['car', -95.5, -20, 0], ['taxi', -60, -95.5, Math.PI / 2],
  ['scooter', -104.5, -50, Math.PI], ['supercar', -629, -440, 0], ['bike', -372, 450, Math.PI / 2], ['supercar', -500 + 4.5, -380, 0], ['tractor', -80, -104.5, -Math.PI / 2], ['ambassador', -95.5, 0, 0], ['erick', -60, -104.5, -Math.PI / 2], ['tempo', -120, -95.5, Math.PI / 2]];
for (const [type, x, z, yaw] of parked) {
  const v = new Vehicle(type, scene, x, z, yaw);
  v.protected = true; // showcase rides stay where they are until taken
  g.vehicles.push(v);
}
// ---------- sea traffic: fishing boats, speedboats, jet ski, ferry, and rides at the jetty ----------
function spawnBoat(type, x, z, yaw, ai = true) {
  const v = new Vehicle(type, scene, x, z, yaw);
  v.protected = true;
  if (ai) v.aiBoat = { throttle: type === 'fishboat' ? 0.45 : 0.6 };
  g.vehicles.push(v);
  return v;
}
for (let i = 0; i < 5; i++) { const p = sea.randomSeaPoint(); spawnBoat('fishboat', p.x, p.z, rand(0, 6)); }
for (let i = 0; i < 2; i++) { const p = sea.randomSeaPoint(); spawnBoat('speedboat', p.x, p.z, rand(0, 6)); }
{ const p = sea.randomSeaPoint(); spawnBoat('jetski', p.x, p.z, 0); }
{
  const ferry = spawnBoat('ferry', JETTY.x0 - 14, JETTY.z + 9, -Math.PI / 2);
  ferry.aiBoat = { throttle: 0.8, route: [{ x: JETTY.x0 - 14, z: JETTY.z + 9, wait: 12 }, { x: ISLAND_DOCK.x + 14, z: ISLAND_DOCK.z + 8, wait: 12 }], i: 0 };
  ferry.aiBoat.target = ferry.aiBoat.route[0];
}
spawnBoat('speedboat', JETTY.x0 + 20, JETTY.z - 6.6, -Math.PI / 2, false);
spawnBoat('jetski', JETTY.x0 + 34, JETTY.z - 5, -Math.PI / 2, false);
spawnBoat('fishboat', JETTY.x0 + 46, JETTY.z + 7.8, -Math.PI / 2, false);
g.sea = sea;
const carInst = new CarInstancer(scene);
for (let i = 0; i < PEDS; i++) g.peds.push(new Ped(scene));
for (let i = 0; i < COWS; i++) {
  const c = new Cow(scene);
  c.respawnNear(player.x, player.z, 20, 300);
  g.cows.push(c);
}

// ---------- pickups ----------
const coinTex = textTexture('₹', { bg: '#2b9348', fg: '#fff', w: 128, h: 128, font: 'bold 100px Arial' });
const samosaTex = textTexture('🥟', { bg: '#00000000', fg: '#fff', w: 128, h: 128, font: '100px sans-serif' });
function makePickup(kind) {
  const mat = new THREE.SpriteMaterial({ map: kind === 'cash' ? coinTex : samosaTex, depthTest: true });
  const s = new THREE.Sprite(mat);
  s.scale.set(1.4, 1.4, 1);
  scene.add(s);
  const p = { kind, mesh: s, active: true, timer: 0, x: 0, z: 0 };
  placePickup(p);
  return p;
}
function placePickup(p) {
  const c = pick(corners);
  p.x = c.x + rand(-3, 3); p.z = c.z + rand(-3, 3);
  p.mesh.position.set(p.x, 1.2, p.z);
}
for (let i = 0; i < 40; i++) g.pickups.push(makePickup(i < 28 ? 'cash' : 'samosa'));

// ---------- missions ----------
const MISSIONS = missionDefs(city, corners);
for (const def of MISSIONS) {
  const grp = new THREE.Group();
  const col = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 8, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd60a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
  col.position.y = 4;
  grp.add(col);
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(def.title, { bg: '#000000aa', fg: '#ffd60a', w: 512, h: 96, font: 'bold 52px Arial' }), depthTest: false }));
  label.scale.set(8, 1.5, 1);
  label.position.y = 9.5;
  grp.add(label);
  grp.position.set(def.giver.x, 0, def.giver.z);
  scene.add(grp);
  g.markers.push({ def, x: def.giver.x, z: def.giver.z, mesh: grp });
}
// ---------- story mode ----------
let storyIdx = 0;
try { storyIdx = JSON.parse(localStorage.getItem('bharat-story') || '0') || 0; } catch { /* ignore */ }
const storyMarker = new THREE.Group();
{
  const col = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 14, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
  col.position.y = 7;
  storyMarker.add(col);
  const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('★', { bg: '#00000000', fg: '#ffb703', w: 128, h: 128, font: 'bold 110px Arial' }), depthTest: false }));
  star.scale.set(3, 3, 1); star.position.y = 16;
  storyMarker.add(star);
  scene.add(storyMarker);
}
function currentChapter() {
  const ch = storyChapters(g.mature);
  return storyIdx < ch.length ? { ...ch[storyIdx], n: storyIdx + 1, total: ch.length } : null;
}
function refreshStoryMarker() {
  const c = currentChapter();
  const def = c && MISSIONS.find((d) => d.id === c.mission);
  storyMarker.visible = !!def && !g.mission && !g.cutscene;
  if (def) storyMarker.position.set(def.giver.x, 0, def.giver.z);
  g.storyGiver = def ? { x: def.giver.x, z: def.giver.z } : null;
  if (storyMarker.userData.label !== c?.title) {
    if (storyMarker.userData.labelSprite) storyMarker.remove(storyMarker.userData.labelSprite);
    if (c) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(`★ ${c.n}/${c.total}: ${c.title}`, { bg: '#000000aa', fg: '#ffb703', w: 512, h: 96, font: 'bold 50px Arial' }), depthTest: false }));
      sp.scale.set(9, 1.7, 1); sp.position.y = 19;
      storyMarker.add(sp);
      storyMarker.userData.labelSprite = sp;
    }
    storyMarker.userData.label = c?.title;
  }
}
function startStoryChapter() {
  const c = currentChapter();
  const def = c && MISSIONS.find((d) => d.id === c.mission);
  if (!def) return;
  hud.prompt(null);
  storyMarker.visible = false;
  new Cutscene(ctx, { anchor: def.giver, cast: c.cast, lines: c.lines, title: `Chapter ${c.n}: ${c.title}` }, () => {
    g.storyRunning = true;
    startMission(def);
    g.mission.story = true;
  }).start();
}
function storyChapterDone() {
  const c = currentChapter();
  storyIdx++;
  try { localStorage.setItem('bharat-story', JSON.stringify(storyIdx)); } catch { /* ignore */ }
  const next = currentChapter();
  refreshMissionMarkers();
  if (c?.outro) {
    setTimeout(() => new Cutscene(ctx, { anchor: { x: g.focus.x, z: g.focus.z }, cast: [], lines: [['narrator', c.outro]], title: 'THE END' }, showCredits).start(), 3800);
  } else if (next) setTimeout(() => hud.toast(`★ Next chapter: ${next.title} (gold star on the map)`, 5000), 3800);
}
function showCredits() {
  const el = document.getElementById('credits');
  el.style.display = 'flex';
  el.onclick = () => (el.style.display = 'none');
}
window.__debug.story = { start: startStoryChapter, set: (i) => { storyIdx = i; }, get: () => storyIdx };

function refreshMissionMarkers() {
  for (const mk of g.markers) {
    mk.mesh.visible = !g.mission && !g.cutscene && (!mk.def.mature || g.mature) && mk.def.id !== currentChapter()?.mission;
    if (mk.def.mature) mk.mesh.children[0].material.color.setHex(0xff3d3d);
  }
}
const checkpoint = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 40, 24, 1, true),
  new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
checkpoint.visible = false;
scene.add(checkpoint);
const passenger = makeHuman({ shirt: 0x06d6a0 });
passenger.visible = false;
scene.add(passenger);

// ---------- particles ----------
const particles = [];
const puffGeo = new THREE.IcosahedronGeometry(1, 0);
for (let i = 0; i < 160; i++) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT, color: 0x555555, transparent: true, opacity: 0, depthWrite: false }));
  m.visible = false;
  scene.add(m);
  particles.push({ mesh: m, life: 0, max: 1, vx: 0, vy: 0, vz: 0, grow: 1 });
}
let pIdx = 0;
function puff(x, y, z, color, size, life, vx = 0, vy = 1.5, vz = 0, grow = 1.5, glow = false) {
  const p = particles[pIdx++ % particles.length];
  p.mesh.material.color.setHex(color);
  p.mesh.material.blending = glow ? THREE.AdditiveBlending : THREE.NormalBlending;
  p.mesh.position.set(x, y, z);
  p.mesh.scale.setScalar(size);
  p.mesh.visible = true;
  Object.assign(p, { life, max: life, vx, vy, vz, grow });
}
function onStuntLanded(v, L) {
  g.timeScale = 1;
  g.stuntCam = null;
  if (L.impact > 16) {
    v.hp -= Math.min(v.spec.hp * 0.35, (L.impact - 16) * 3);
    audio.crash(clamp(L.impact / 25, 0.3, 1));
    g.shake = Math.max(g.shake, 0.6);
  }
  if (L.airT < 0.7) return;
  const cash = Math.round(L.airT * 120 + L.dist * 3);
  addMoney(cash);
  audio.cash();
  hud.toast(`✈ STUNT! ${L.airT.toFixed(1)}s air · ${Math.round(L.dist)}m · +₹${cash}`, 2500);
  meme('stunt');
  const r = L.ramp;
  if (r && r.unique && !stunts.done.has(r.name)) {
    if (L.airT >= r.req) {
      stunts.markDone(r);
      addMoney(1500);
      try { localStorage.setItem('bharat-stunts', JSON.stringify([...stunts.done])); } catch { /* ignore */ }
      hud.big(`UNIQUE STUNT JUMP<br><span style="font-size:30px;color:#fff">${r.name} · ${stunts.done.size}/${RAMPS.length} · +₹1500</span>`, '#00f5d4', 3200);
      audio.ting();
      persist();
    } else hud.toast(`Almost! ${r.name} needs ${r.req}s of air — go faster`, 3000);
  }
}
function destroyVehicle(v) {
  if (v.dead) return;
  explode(v.x, v.z);
  v.dead = true;
  v.destroy();
  if (v.player) {
    player.vehicle = null;
    player.x = v.x + 3; player.z = v.z; world.resolve(player, player.r, { amph: true });
    player.model.visible = true;
    damagePlayer(35);
  } else if (!v.protected) crime(1);
}
function explode(x, z) {
  audio.explosion();
  for (let i = 0; i < 14; i++) puff(x + rand(-1, 1), 1 + rand(0, 2), z + rand(-1, 1), pick([0xff6b00, 0xffd60a, 0xff9f1c]), rand(2, 4), rand(0.5, 1.1), rand(-6, 6), rand(2, 8), rand(-6, 6), 2.5, true);
  for (let i = 0; i < 12; i++) puff(x + rand(-1, 1), 2 + rand(0, 2), z + rand(-1, 1), 0x2a2a2a, rand(2.5, 4), rand(1.5, 2.6), rand(-2, 2), rand(2, 5), rand(-2, 2), 2);
  g.shake = 1.2;
}

// ============================================================================
// Input
// ============================================================================
const keys = new Set();
const pressed = new Set();
window.addEventListener('keydown', (e) => {
  if (!keys.has(e.code)) pressed.add(e.code);
  keys.add(e.code);
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
const k = (c) => keys.has(c);
const kp = (c) => pressed.has(c);

function lockPointer() {
  try { const r = canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch { /* embedded preview */ }
}
canvas.addEventListener('click', () => { if (!g.paused) lockPointer(); });
canvas.addEventListener('mousedown', (e) => { if (e.button === 0 && document.pointerLockElement === canvas) g.mouseL = true; if (e.button === 2) g.mouseR = true; });
window.addEventListener('mouseup', (e) => { if (e.button === 0) g.mouseL = false; if (e.button === 2) g.mouseR = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => { if (!g.paused && !player.vehicle) combat.cycle(e.deltaY > 0 ? 1 : -1); }, { passive: true });
document.addEventListener('mousemove', (e) => {
  // pointer lock, or click-and-drag when pointer lock isn't available (embedded previews)
  if (document.pointerLockElement !== canvas && !(e.buttons & 1 && e.target === canvas)) return;
  g.camYaw -= e.movementX * 0.0025;
  g.camPitch = clamp(g.camPitch + e.movementY * 0.002, -0.15, 1.1);
  g.lastMouse = g.time;
});

const menu = document.getElementById('menu');
{ const m18 = document.getElementById('mature18'); if (m18) m18.checked = g.mature; }
voice.mature = g.mature;
document.getElementById('startBtn').addEventListener('click', async () => {
  await audio.init();
  voice.preload();
  if (audio.ctx.state === 'suspended') await audio.ctx.resume();
  const m18 = document.getElementById('mature18');
  if (m18) { g.mature = m18.checked; try { localStorage.setItem('bharat-18', g.mature ? '1' : '0'); } catch { /* ignore */ } }
  voice.mature = g.mature;
  refreshMissionMarkers();
  menu.style.display = 'none';
  g.paused = false;
  lockPointer();
  if (!g.started) {
    g.started = true;
    hud.radio(audio.setStation(0));
    setTimeout(() => meme('welcome', true), 600);
    hud.toast('🟡 Yellow markers = missions. Press F near a vehicle to ride!', 6000);
  }
});

function setPaused(p) {
  g.paused = p;
  menu.style.display = p ? 'flex' : 'none';
  document.getElementById('startBtn').textContent = p ? 'RESUME ▶' : 'CHALO! ▶';
  if (p) document.exitPointerLock?.();
  audio.ctx?.[p ? 'suspend' : 'resume']();
}

// ============================================================================
// Helpers
// ============================================================================
function meme(ev, priority = false) {
  if (!priority && g.time - g.lastMeme < 2.5) return;
  g.lastMeme = g.time;
  if (audio.playEvent(ev)) return; // user's custom meme clip wins
  if (voice.has(ev)) { voice.play(ev, { priority, onSub: (l) => hud.subtitle(l.en) }); return; }
  const ln = VOICE[ev] && pick(VOICE[ev]);
  if (ln) { audio.say(ln, priority); hud.subtitle(ln.en); }
}

function copsNear(x, z, r) {
  for (const v of g.vehicles) if (v.type === 'police' && Math.hypot(v.x - x, v.z - z) < r) return true;
  return false;
}

function addWanted(n, force = false) {
  const before = g.stars;
  g.stars = clamp(g.stars + n, 0, 5);
  g.evadeT = 0;
  if (g.stars > before) {
    if (before === 0) { meme('wanted', true); audio.dramatic(); }
    else meme('moreWanted');
  }
}
g.addWanted = addWanted;

function crime(severity) {
  // First offence: witnesses (or nearby police) report you. Once wanted, a killing
  // spree escalates gradually instead of jumping straight to 5 stars.
  if (g.stars === 0) {
    if (copsNear(g.focus.x, g.focus.z, 90) || Math.random() < (severity >= 2 ? 0.9 : 0.45)) addWanted(severity);
    return;
  }
  const now = g.time;
  if (now - (g.lastEscalate || -99) < 6) return;
  if (Math.random() < (severity >= 2 ? 0.55 : 0.15)) { g.lastEscalate = now; addWanted(1); }
}

function addMoney(n) {
  g.money = Math.max(0, g.money + n);
}

function persist() {
  try { localStorage.setItem('bharat-streets-save', JSON.stringify({ money: Math.floor(g.money), done: g.missionsDone })); } catch { /* ignore */ }
}
setInterval(persist, 15000);

function nearestWalkIdx(v) {
  let best = 0;
  WALK_XS.forEach((w, i) => { if (Math.abs(w - v) < Math.abs(WALK_XS[best] - v)) best = i; });
  return best;
}

function nearestRoadLane(x, z) {
  // snap to nearest road centre-line, offset to the left lane
  const i = clamp(Math.round((x + 600) / 100), 0, 12), j = clamp(Math.round((z + 600) / 100), 0, 12);
  const dxLine = Math.abs(x - line(i)), dzLine = Math.abs(z - line(j));
  if (dxLine < dzLine) return { x: line(i) + LANE, z, yaw: 0 };
  return { x, z: line(j) - LANE, yaw: Math.PI / 2 };
}

// ============================================================================
// Vehicles: enter / exit
// ============================================================================
function tryEnterExit() {
  const v = player.vehicle;
  if (v) {
    if (Math.abs(v.speed) > 6) { hud.toast('Gaadi rok pehle! (slow down)'); return; }
    v.player = false;
    v.speed = 0;
    player.vehicle = null;
    player.x = v.x + Math.cos(v.yaw) * (v.spec.radius + 1.2);
    player.z = v.z - Math.sin(v.yaw) * (v.spec.radius + 1.2);
    if (v.boat) {
      // step onto the jetty or the island if it's right there, else into the water
      if (sea.onJetty(v.x, v.z, 9)) { player.x = clamp(v.x, JETTY.x0 + 1, JETTY.x1 - 1); player.z = JETTY.z + clamp(v.z - JETTY.z, -2, 2); }
      else if (Math.hypot(v.x - ISLAND_DOCK.x, v.z - ISLAND_DOCK.z) < 16) { player.x = ISLAND_DOCK.x - 2; player.z = ISLAND_DOCK.z; }
      else if (Math.hypot(v.x - ISLAND.x, v.z - ISLAND.z) < ISLAND.r + 18) { const a2 = Math.atan2(v.z - ISLAND.z, v.x - ISLAND.x); player.x = ISLAND.x + Math.cos(a2) * (ISLAND.r - 3); player.z = ISLAND.z + Math.sin(a2) * (ISLAND.r - 3); }
      player.y = sea.groundFor(player.x, player.z).h;
    } else world.resolve(player, player.r, { amph: true });
    player.model.visible = true;
    player.yaw = v.yaw;
    audio.setEngine(v.spec.engine, 0, false);
    return;
  }
  let best = null, bd = Infinity;
  for (const c of g.vehicles) {
    if (c.dead) continue;
    const d = Math.hypot(c.x - player.x, c.z - player.z) - c.spec.radius;
    if (d < 2.6 && d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  if (best.ai) {
    // hijack: driver gets out and shouts
    const ped = new Ped(scene, { shirt: 0xffffff });
    ped.x = best.x - Math.cos(best.yaw) * (best.spec.radius + 1);
    ped.z = best.z + Math.sin(best.yaw) * (best.spec.radius + 1);
    ped.flee = 10;
    ped.ix = nearestWalkIdx(ped.x); ped.iz = nearestWalkIdx(ped.z);
    ped.tx = ped.x + rand(-30, 30); ped.tz = ped.z + rand(-30, 30);
    g.peds.push(ped);
    best.ai = null;
    meme('hijack', true);
    if (best.type === 'police') addWanted(2); else if (Math.random() < 0.4 || copsNear(best.x, best.z, 80)) addWanted(1);
  } else if (best.cop) {
    best.cop = false;
    g.police = g.police.filter((p) => p !== best);
    addWanted(2);
  }
  if (best.aiBoat) { best.aiBoat = null; meme('hijack', true); if (Math.random() < 0.3) addWanted(1); }
  best.player = true;
  player.vehicle = best;
  if (best.boat && Math.random() < 0.5) setTimeout(() => meme('boat'), 1200);
  player.model.visible = false;
  hud.toast(best.spec.name + ' 🔑');
  if (audio.station !== 3) hud.radio(AudioSys.STATIONS[audio.station]);
}

// ============================================================================
// Police
// ============================================================================
function spawnCop() {
  if (g.atSea) {
    for (let t = 0; t < 30; t++) {
      const p = sea.randomSeaPoint(SEA_MIN_X + 20, SEA_X - 20);
      const d = Math.hypot(p.x - g.focus.x, p.z - g.focus.z);
      if (d < 100 || d > 260) continue;
      const v = new Vehicle('policeboat', scene, p.x, p.z, Math.atan2(g.focus.x - p.x, g.focus.z - p.z));
      v.cop = true;
      g.vehicles.push(v); g.police.push(v);
      if (!g.coastShouted) { g.coastShouted = true; meme('coastShout', true); }
      return;
    }
    return;
  }
  for (let t = 0; t < 30; t++) {
    const s = randomRoadSpawn();
    const x = line(s.i), z = line(s.j);
    const d = Math.hypot(x - g.focus.x, z - g.focus.z);
    if (d < 110 || d > 220) continue;
    const v = new Vehicle('police', scene, x + LANE, z, Math.atan2(g.focus.x - x, g.focus.z - z));
    v.cop = true;
    v.speed = 10;
    g.vehicles.push(v);
    g.police.push(v);
    return;
  }
}

function updateCopBoat(v, dt) {
  const dx = g.focus.x - v.x, dz = g.focus.z - v.z, d = Math.hypot(dx, dz);
  const diff = angleDiff(v.yaw, Math.atan2(dx, dz));
  const close = d < 14;
  v.driveBoat({ throttle: close ? 0.2 : 1, steer: clamp(diff * 2, -1, 1), brake: close && d < 8 }, dt);
  v.bounceBoat(sea.resolveBoat(v));
  boatWake(v, dt, 0.12);
  v.shootCd = (v.shootCd ?? 2) - dt;
  if (g.mature && g.stars >= 2 && d < 55 && v.shootCd <= 0) {
    v.shootCd = rand(1.4, 2.6);
    systems.npcShoot({ x: v.x, y: v.y, z: v.z, weapon: g.stars >= 4 ? 'ak' : 'katta' }, d);
  }
}
function updateCop(v, dt) {
  const tx = g.focus.x + g.focusVel.x * 0.5, tz = g.focus.z + g.focusVel.z * 0.5;
  const dx = tx - v.x, dz = tz - v.z;
  const d = Math.hypot(dx, dz);
  const diff = angleDiff(v.yaw, Math.atan2(dx, dz));
  let steer = clamp(diff * 2.5, -1, 1), throttle = 1, brake = false;
  const onFoot = !player.vehicle;
  if (v.reverseT > 0) {
    v.reverseT -= dt; throttle = -1; steer = -steer;
  } else {
    if (onFoot && d < 16) { throttle = d > 8 ? 0.35 : 0; brake = d < 9; }
    if (Math.abs(diff) > 2.0 && d < 25) { throttle = -0.7; steer = -steer; }
    if (Math.abs(v.speed) < 1.2 && throttle > 0.5) {
      v.stuckT += dt;
      if (v.stuckT > 1.2) { v.reverseT = 1.1; v.stuckT = 0; }
    } else v.stuckT = 0;
  }
  v.drive({ throttle, steer, brake }, dt);
  v.collideWorld(world);
}

function updateWanted(dt) {
  if (g.stars > 0) {
    const want = Math.min(6, g.stars + (g.stars >= 3 ? 1 : 0));
    g.copSpawnCd = (g.copSpawnCd || 0) - dt;
    const mine = g.police.filter((c) => !!c.boat === !!g.atSea).length;
    if (mine < want && g.copSpawnCd <= 0) { spawnCop(); g.copSpawnCd = 2.5; }
    let nearest = Infinity;
    for (const c of g.police) nearest = Math.min(nearest, Math.hypot(c.x - g.focus.x, c.z - g.focus.z));
    if (nearest > 110) {
      g.evadeT += dt;
      if (g.evadeT > 8 + g.stars * 3) {
        g.stars--; g.evadeT = 0;
        hud.toast(g.stars ? '⭐ Ek star kam!' : '😎 Police ne peecha chhod diya!');
        if (!g.stars) meme('lostWanted');
      }
    } else g.evadeT = 0;
    // busted?
    for (const s of g.shooters) if (s.kind === 'cop' && !s.dead) nearest = Math.min(nearest, Math.hypot(s.x - g.focus.x, s.z - g.focus.z) + (g.mature && g.stars >= 3 ? 6 : 0));
    if (g.heli && !g.heli.leaving) nearest = Math.min(nearest, 60);
    const fighting = g.mature && g.stars >= 3 && g.time - combat.lastShotT < 3;
    const slow = !fighting && (!player.vehicle || Math.abs(player.vehicle.speed) < 2.5);
    if (nearest < 8 && slow) g.bustT += dt; else g.bustT = Math.max(0, g.bustT - dt * 0.5);
    if (g.bustT > 0.3) hud.prompt(`🚔 Police pakad rahi hai! BHAAGO! ${'▮'.repeat(Math.max(0, Math.ceil((2.5 - g.bustT) * 4)))}`);
    if (g.bustT > 2.5) busted();
    // re-place cops that fell far behind
    for (const c of g.police) {
      if (Math.hypot(c.x - g.focus.x, c.z - g.focus.z) > 380) { c.destroy(); c.dead = true; }
    }
  } else {
    g.bustT = 0;
    g.coastShouted = false;
    for (const c of g.police) { c.cop = false; c.speed = 0; }
    g.police = [];
  }
  g.police = g.police.filter((c) => !c.dead && c.cop);
  g.vehicles = g.vehicles.filter((c) => !c.dead);
  // siren volume
  let sv = 0;
  for (const c of g.police) sv = Math.max(sv, 1 - Math.hypot(c.x - g.focus.x, c.z - g.focus.z) / 200);
  audio.setSiren(sv);
}

// ============================================================================
// Respawn: busted / hospital
// ============================================================================
function teleportPlayer(x, z) {
  if (player.vehicle) { player.vehicle.player = false; player.vehicle = null; }
  player.x = x; player.z = z; player.y = 0; player.vy = 0;
  player.model.visible = true;
  audio.setEngine('car', 0, false);
}
function clearCops() {
  for (const s of g.shooters) if (s.kind === 'cop') { s.destroy(); s.gone = true; }
  g.shooters = g.shooters.filter((s) => !s.gone);
  if (g.heli) { g.heli.destroy(); g.heli = null; audio.setHeli(0); }
  for (const c of g.police) { c.destroy(); c.dead = true; }
  g.police = [];
  g.stars = 0;
  g.vehicles = g.vehicles.filter((c) => !c.dead);
}
function busted() {
  if (g.frozen > 0) return;
  g.frozen = 3.2;
  const fine = Math.max(100, Math.floor(g.money * 0.25));
  addMoney(-fine);
  hud.big('PAKDE GAYE! 🚔', '#4895ef');
  meme('busted', true);
  failMission('Busted');
  setTimeout(() => { clearCops(); teleportPlayer(g.pois.police.x, g.pois.police.z); hud.toast(`Thane se chhoot gaye. Fine: ₹${fine}`, 4000); }, 2800);
}
function wasted() {
  if (g.frozen > 0) return;
  g.frozen = 3.2;
  hud.big('KHATAM! 🏥', '#ff3d3d');
  meme('dead', true);
  audio.fail();
  failMission('Hospital');
  setTimeout(() => {
    clearCops(); teleportPlayer(g.pois.hospital.x, g.pois.hospital.z);
    g.health = 100; addMoney(-200);
    hud.toast('Sarkari hospital bill: ₹200', 4000);
  }, 2800);
}

function damagePlayer(n) {
  if (g.armor > 0) { const a = Math.min(g.armor, n * 0.7); g.armor -= a; n -= a; }
  g.lastHurt = g.time;
  if (n > 4 && Math.random() < 0.35) meme('pain');
  g.health -= n;
  g.shake = Math.max(g.shake, 0.5);
  if (g.health <= 0) { g.health = 0; wasted(); }
}

// ============================================================================
// Missions
// ============================================================================
window.__debug.start = (id) => startMission(MISSIONS.find((d) => d.id === id));
function startMission(def) {
  storyMarker.visible = false;
  const steps = def.build(g);
  const m = { def, steps, idx: 0, timeLeft: def.time, vehicle: null };
  g.mission = m;
  if (def.vehicle) {
    const lane = def.spawnAt || nearestRoadLane(def.giver.x, def.giver.z);
    // reuse a leftover mission vehicle from an earlier attempt instead of stacking a new one
    let v = g.vehicles.find((o) => !o.dead && o.type === def.vehicle && !o.hasDriver && Math.hypot(o.x - lane.x, o.z - lane.z) < 20);
    const reused = !!v;
    if (!v) v = new Vehicle(def.vehicle, scene, lane.x, lane.z, lane.yaw);
    v.protected = true;
    if (def.id === 'baraat' && !reused) {
      const body = v.mesh.userData.body;
      box(1.9, 0.18, 0.18, 0xff9f1c, 0, 1.05, 2.0, body);
      box(0.18, 0.18, 3.8, 0xff9f1c, 0.9, 1.05, 0, body);
      box(0.18, 0.18, 3.8, 0xff9f1c, -0.9, 1.05, 0, body);
      box(0.8, 0.5, 0.8, 0xff006e, 0, 1.15, 1.5, body);
    }
    if (!reused) { def.decorate?.(v, box); g.vehicles.push(v); }
    m.vehicle = v;
    hud.toast(`Your ${v.spec.name} is parked nearby — press F to get in`, 4000);
  }
  def.start?.(g);
  hud.big(def.title, def.mature ? '#ff3d3d' : '#ffd60a', 2500);
  hud.subtitle(def.intro);
  setTimeout(() => meme('intro_' + def.id, true), 400);
  audio.ting();
  for (const mk of g.markers) mk.mesh.visible = false;
}

function endMission() {
  const m = g.mission;
  if (!m) return;
  if (m.vehicle) m.vehicle.protected = false;
  for (const st of m.steps) if (st.target) st.target.protected = false;
  g.mission = null;
  g.buoyAt = null;
  checkpoint.visible = false;
  passenger.visible = false;
  refreshMissionMarkers();
}

function completeMission() {
  const m = g.mission;
  addMoney(m.def.reward);
  g.missionsDone++;
  hud.big(`KAAM HO GAYA!<br><span style="font-size:42px;color:#7dff7a">+ ₹${m.def.reward}</span>`, '#ffd60a', 3500);
  meme(m.def.mature ? 'donDone' : 'missionDone', true);
  audio.dramatic();
  if (m.story) storyChapterDone();
  endMission();
  persist();
}

function failMission(reason) {
  if (!g.mission) return;
  hud.big(`KAAM BIGAD GAYA<br><span style="font-size:32px;color:#fff">${reason}</span>`, '#ff3d3d', 3000);
  if (reason !== 'Busted' && reason !== 'Hospital') { meme('missionFail', true); audio.fail(); }
  endMission();
}

function updateMission(dt) {
  const m = g.mission;
  if (!m) {
    // start prompts: story chapter first
    refreshStoryMarker();
    if (storyMarker.visible && Math.hypot(storyMarker.position.x - g.focus.x, storyMarker.position.z - g.focus.z) < 5) {
      const c = currentChapter();
      hud.prompt(`E — ★ Story chapter ${c.n}/${c.total}: ${c.title}`);
      if (kp('KeyE')) startStoryChapter();
      return;
    }
    for (const mk of g.markers) {
      mk.mesh.children[0].rotation.y += dt;
      if (mk.mesh.visible && Math.hypot(mk.x - g.focus.x, mk.z - g.focus.z) < 5) {
        hud.prompt(`E — Start: ${mk.def.title} (₹${mk.def.reward})`);
        if (kp('KeyE')) { hud.prompt(null); startMission(mk.def); }
        return;
      }
    }
    return;
  }
  m.timeLeft -= dt;
  if (m.timeLeft <= 0) { failMission('Time khatam!'); return; }
  const st = m.steps[m.idx];
  if (!st) { completeMission(); return; }
  let distText = '';
  const v = player.vehicle;
  const advance = () => {
    audio.ting();
    if (st.bonus) { addMoney(st.bonus); audio.cash(); }
    hud.toast(st.done || 'Done!');
    st.onDone?.(g);
    if (st.passenger) meme('passenger');
    m.idx++;
    m.stepT = 0;
    m.hornBase = g.hornNear;
  };
  m.stepT = (m.stepT || 0) + dt;
  if (m.hornBase === undefined) m.hornBase = g.hornNear;
  const okVeh = !st.require || (st.require === 'any' ? !!v : st.require === 'foot' ? !v : st.require === 'boat' ? !!(v && v.boat) : v && v.type === st.require);
  const needMsg = st.require === 'any' ? 'Gaadi mein aao! (need a vehicle)' : st.require === 'foot' ? 'Gaadi se utro! (on foot only)' : st.require === 'boat' ? 'Boat chahiye! (get in a boat)' : `Need a ${st.require} for this!`;
  g.buoyAt = st.x !== undefined && st.x < SEA_X - 3 ? st : null;
  checkpoint.material.color.setHex(st.target ? 0xff2020 : 0xff00ff);
  if (st.onStart && !st._started) { st._started = true; st.onStart(g); }
  if (st.evade) {
    checkpoint.visible = false;
    passenger.visible = false;
    if (g.stars === 0) advance();
  } else if (st.kill) {
    checkpoint.visible = false;
    passenger.visible = false;
    const left = st.kill.filter((s2) => !s2.dead).length;
    const near = st.kill.filter((s2) => !s2.dead).reduce((a, s2) => Math.min(a, Math.hypot(s2.x - g.focus.x, s2.z - g.focus.z)), Infinity);
    distText = `· ${left} left${near < Infinity ? ' · ' + Math.round(near) + 'm' : ''}`;
    if (!left) advance();
  } else if (st.hold) {
    checkpoint.visible = true;
    checkpoint.position.set(st.x, 20, st.z);
    const d = Math.hypot(st.x - g.focus.x, st.z - g.focus.z);
    if (d < 5 && okVeh) { st._t = (st._t || 0) + dt; hud.prompt(`⏳ ${'▮'.repeat(Math.min(20, Math.ceil(st._t)))}${'▯'.repeat(Math.max(0, Math.ceil(st.hold - st._t)))}`); }
    distText = `· ${Math.max(0, Math.ceil(st.hold - (st._t || 0)))}s`;
    if ((st._t || 0) >= st.hold) advance();
  } else if (st.honk) {
    checkpoint.visible = false;
    passenger.visible = false;
    const n = g.hornNear - m.hornBase;
    distText = `· ${Math.min(n, st.honk)}/${st.honk} 📯`;
    if (!okVeh) hud.prompt(needMsg);
    if (n >= st.honk) advance();
  } else if (st.speed) {
    checkpoint.visible = false;
    passenger.visible = false;
    const kmh = v ? Math.abs(v.speed) * 3.6 : 0;
    distText = `· ${Math.round(kmh)}/${st.speed} km/h`;
    if (!okVeh) hud.prompt(needMsg);
    else if (kmh >= st.speed) advance();
  } else if (st.target) {
    const t = st.target;
    passenger.visible = false;
    checkpoint.visible = !t.dead;
    checkpoint.position.set(t.x, 20, t.z);
    distText = `· ${Math.round(Math.hypot(t.x - g.focus.x, t.z - g.focus.z))}m · ${Math.max(0, Math.round((t.hp / (st.startHp || t.spec.hp)) * 100))}%`;
    if (t.dead) advance();
  } else {
    checkpoint.visible = true;
    checkpoint.position.set(st.x, 20, st.z);
    checkpoint.rotation.y += dt;
    passenger.visible = !!st.passenger;
    if (st.passenger) { passenger.position.set(st.x, 0, st.z); animateHuman(passenger, g.time * 6, 0.4); passenger.rotation.y = g.time; }
    const d = Math.hypot(st.x - g.focus.x, st.z - g.focus.z);
    distText = `· ${Math.round(d)}m`;
    if (d < (v ? 7 : 3.5)) {
      if (!okVeh) hud.prompt(needMsg);
      else if (v && Math.abs(v.speed) > 12 && st.passenger) hud.prompt('Slow down so the passenger can get in!');
      else if (v && Math.abs(v.speed) > 2.5 && st.stop) hud.prompt('Ruko! Stop the vehicle here (Space)');
      else advance();
    }
  }
  if (m.idx >= m.steps.length) { completeMission(); return; }
  hud.mission(m, distText);
}

// ============================================================================
// Main update
// ============================================================================
const tmpV = new THREE.Vector3();
const DAY_LEN = 480; // seconds per in-game day

function updatePlayer(dt) {
  if (g.frozen > 0) return;
  const v = player.vehicle;
  if (kp('KeyF')) tryEnterExit();
  if (v) {
    const input = {
      throttle: (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0),
      steer: (k('KeyA') || k('ArrowLeft') ? 1 : 0) - (k('KeyD') || k('ArrowRight') ? 1 : 0),
      brake: k('Space'),
    };
    const px = v.x, pz = v.z;
    let impact = 0, sev = {};
    if (v.sinking) {
      // nothing to steer while the car goes down
    } else if (v.boat) {
      v.driveBoat(input, dt);
      impact = v.bounceBoat(sea.resolveBoat(v));
      boatWake(v, dt, 0.05);
      if (impact > 6) audio.splash(clamp(impact / 15, 0.3, 1));
    } else {
      if (v.air) {
        // airborne: keep momentum, a little mid-air steering
        v.yaw += input.steer * 0.9 * dt;
        v.x += Math.sin(v.yaw) * v.speed * dt; v.z += Math.cos(v.yaw) * v.speed * dt;
      } else v.drive(input, dt);
      impact = v.collideWorld(world, { amph: true });
      sev = stunts.step(v, dt, px, pz);
      // drove off the beach into the Arabian Sea
      if (v.x < SEA_X - 1.5 && !sea.onJetty(v.x, v.z) && !v.air) startSinking(v);
    }
    if (sev.launched && sev.launched.unique && Math.abs(v.speed) > 14 && !stunts.done.has(sev.launched.name)) {
      g.timeScale = 0.4;
      g.stuntCam = { x: v.x, z: v.z, side: Math.random() < 0.5 ? 1 : -1, yaw: v.yaw };
      audio.dramatic();
    }
    if (sev.landed) onStuntLanded(v, sev.landed);
    if (impact > 6) {
      v.hp -= (impact - 6) * 3;
      audio.crash(clamp(impact / 20, 0.2, 1));
      g.shake = Math.max(g.shake, clamp(impact / 25, 0.1, 0.8));
      if (impact > 13) meme('crash');
    }
    g.focusVel.x = (v.x - px) / dt; g.focusVel.z = (v.z - pz) / dt;
    // horn
    g.hornCd -= dt;
    if (k('KeyH') && g.hornCd <= 0) {
      audio.horn(v.spec.horn, 1);
      if (g.vehicles.some((o) => o !== v && !o.dead && Math.hypot(o.x - v.x, o.z - v.z) < 20)) g.hornNear++;
      g.hornCd = v.type === 'truck' ? 1.0 : 0.45;
      for (const p of g.peds) if (p.state === 'walk' && Math.hypot(p.x - v.x, p.z - v.z) < 14) p.flee = 2;
      for (const c of g.cows) if (Math.hypot(c.x - v.x, c.z - v.z) < 10 && g.time - (g.cowJoke || -99) > 20) { g.cowJoke = g.time; hud.toast('🐄 Gaay ko koi farak nahi padta.'); }
    }
    audio.setEngine(v.spec.engine, Math.abs(v.speed) / v.spec.max, true);
    if (v.hp <= 0) {
      explode(v.x, v.z);
      v.dead = true; v.destroy();
      player.vehicle = null;
      player.x = v.x + 3; player.z = v.z; world.resolve(player, player.r, { amph: true });
      player.model.visible = true;
      audio.setEngine('car', 0, false);
      damagePlayer(35);
      meme('crash', true);
    }
  } else {
    const f = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const r = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    const cy = g.camYaw;
    let mx = Math.sin(cy) * f - Math.cos(cy) * r;
    let mz = Math.cos(cy) * f + Math.sin(cy) * r;
    const len = Math.hypot(mx, mz);
    const aiming = combat.aiming;
    const sp = player.swimming ? (k('ShiftLeft') || k('ShiftRight') ? 4 : 2.6) : aiming ? 3.2 : k('ShiftLeft') || k('ShiftRight') ? 9 : 4.8;
    const px = player.x, pz = player.z;
    if (len > 0) {
      mx /= len; mz /= len;
      player.x += mx * sp * dt; player.z += mz * sp * dt;
      if (!aiming) player.yaw += angleDiff(player.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 12);
      player.anim += dt * sp * 2.2;
    }
    animateHuman(player.model, player.anim, len > 0 ? (sp > 5 ? 1.3 : 1) : 0);
    const gnd = sea.groundFor(player.x, player.z);
    const wasSwim = player.swimming;
    player.swimming = gnd.water && player.y <= gnd.h + 0.35;
    if (player.swimming) {
      player.vy = 0; player.y = gnd.h;
      if (!wasSwim) { audio.splash(0.6); if (Math.random() < 0.5) meme('swim'); }
    } else {
      if (kp('Space') && player.y <= gnd.h + 0.02) player.vy = 7;
      player.vy -= 22 * dt;
      player.y += player.vy * dt;
      if (player.y <= gnd.h) { player.y = gnd.h; player.vy = Math.max(0, player.vy); }
    }
    world.resolve(player, player.r, { amph: true });
    if (player.x < SEA_X) sea.resolveSwimmer(player);
    // push out of vehicles and cows
    for (const c of g.vehicles) {
      const dx = player.x - c.x, dz = player.z - c.z;
      const d = Math.hypot(dx, dz), rr = c.spec.radius + player.r;
      if (d < rr && d > 1e-4) {
        player.x = c.x + (dx / d) * rr; player.z = c.z + (dz / d) * rr;
        if (Math.abs(c.speed) > 5 && player.hurtCd <= 0) {
          player.hurtCd = 1;
          damagePlayer(Math.abs(c.speed) * 1.3);
          audio.crash(0.4);
          player.vy = 6;
          hud.subtitle('Aaah! Dekh ke chalao!');
        }
      }
    }
    for (const c of g.cows) {
      const dx = player.x - c.x, dz = player.z - c.z, d = Math.hypot(dx, dz);
      if (d < c.r + player.r && d > 1e-4) { player.x = c.x + (dx / d) * (c.r + player.r); player.z = c.z + (dz / d) * (c.r + player.r); }
    }
    player.hurtCd -= dt;
    g.focusVel.x = (player.x - px) / dt; g.focusVel.z = (player.z - pz) / dt;
    if (kp('KeyH')) meme('blocked', true); // shout on foot
    // weapons: right mouse / Z = aim, left mouse (pointer locked) / Ctrl / X = fire
    combat.update(dt, {
      aim: !player.swimming && (g.mouseR || k('KeyZ')),
      fire: !player.swimming && (g.mouseL || k('ControlLeft') || k('ControlRight') || k('KeyX')),
      moving: len > 0,
    });
  }
}

function vehicleInteractions(dt) {
  const pv = player.vehicle;
  if (!pv) return;
  if ((pv.y || 0) > 1.2) return; // flying over everything
  // vs other vehicles
  for (const o of g.vehicles) {
    if (o === pv || o.dead) continue;
    const dx = o.x - pv.x, dz = o.z - pv.z;
    const rr = (o.spec.radius + pv.spec.radius) * 0.9;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, pen = rr - d;
    const mp = pv.spec.hp, mo = o.spec.hp;
    const wp = mo / (mp + mo), wo = mp / (mp + mo);
    pv.x -= nx * pen * wp; pv.z -= nz * pen * wp;
    o.x += nx * pen * wo; o.z += nz * pen * wo;
    const vpx = Math.sin(pv.yaw) * pv.speed, vpz = Math.cos(pv.yaw) * pv.speed;
    const vox = Math.sin(o.yaw) * o.speed, voz = Math.cos(o.yaw) * o.speed;
    const rel = (vpx - vox) * nx + (vpz - voz) * nz;
    if (rel > 3) {
      const dmg = rel * 2.2;
      pv.hp -= dmg * wp * 1.5; o.hp -= dmg * wo * 1.5;
      pv.speed *= 0.45; o.speed = rel * 0.3;
      audio.crash(clamp(rel / 18, 0.2, 1));
      g.shake = Math.max(g.shake, clamp(rel / 25, 0.15, 0.8));
      if (rel > 9) meme('crash');
      if (o.type === 'police') crime(1);
      if (o.hp <= 0) { explode(o.x, o.z); o.dead = true; o.destroy(); if (!o.protected) crime(1); }
    }
  }
  // vs pedestrians
  const sp = Math.abs(pv.speed);
  for (const p of g.peds) {
    if (p.state !== 'walk') continue;
    const d = Math.hypot(p.x - pv.x, p.z - pv.z);
    if (d < pv.spec.radius + 0.5) {
      if (sp > 3) {
        const hx = Math.sin(pv.yaw) * pv.speed, hz = Math.cos(pv.yaw) * pv.speed;
        if (g.mature && sp > 14) p.hp = 0;
        if (p.knock(hx * 0.7 + rand(-2, 2), hz * 0.7 + rand(-2, 2), sp)) {
          if (p.hp <= 0) { systems.blood(p.x, 1, p.z, true, p); crime(1); }
          meme('hitPed', true);
          audio.crash(0.3);
          pv.speed *= 0.85;
          crime(1);
        }
      } else {
        // nudge
        const dx = p.x - pv.x, dz = p.z - pv.z;
        p.x = pv.x + (dx / d) * (pv.spec.radius + 0.5); p.z = pv.z + (dz / d) * (pv.spec.radius + 0.5);
      }
    }
  }
  // vs armed NPCs (cops / goons on foot)
  for (const s of g.shooters) {
    if (s.dead) continue;
    const d = Math.hypot(s.x - pv.x, s.z - pv.z);
    if (d < pv.spec.radius + 0.5 && sp > 5) {
      const killed = s.hit(sp * (g.mature ? 7 : 3), Math.sin(pv.yaw), Math.cos(pv.yaw));
      s.x += Math.sin(pv.yaw) * 2; s.z += Math.cos(pv.yaw) * 2;
      audio.crash(0.4);
      if (s.kind === 'cop') addWanted(killed ? 2 : 1);
      if (killed) systems.blood(s.x, 1, s.z, true, s);
    }
  }
  // vs cows: cows are immovable objects
  for (const c of g.cows) {
    const dx = pv.x - c.x, dz = pv.z - c.z, d = Math.hypot(dx, dz), rr = pv.spec.radius + c.r;
    if (d < rr && d > 1e-4) {
      const nx = dx / d, nz = dz / d;
      pv.x = c.x + nx * rr; pv.z = c.z + nz * rr;
      const vn = Math.sin(pv.yaw) * pv.speed * nx + Math.cos(pv.yaw) * pv.speed * nz;
      if (vn < -2) {
        const imp = -vn;
        pv.speed *= -0.2;
        pv.hp -= imp * 1.2;
        audio.crash(0.4); audio.moo(1);
        meme('cow', true);
        if (imp > 10) crime(1);
      }
    }
  }
}

function updateTrain(dt) {
  const tr = city.train;
  tr.x += tr.speed * dt;
  if (tr.x > 900 + tr.length) { tr.x = -900; tr.horned = false; tr.warned = false; }
  tr.mesh.position.x = tr.x;
  tr.info = { z: RAIL_Z, maxX: tr.x + 10, minX: tr.x + 10 - tr.length };
  const near = Math.abs(g.focus.x - tr.x);
  if (!tr.horned && tr.x > -700 && near < 260) { audio.trainHorn(clamp(1 - Math.abs(g.focus.z - RAIL_Z) / 300, 0.15, 1)); tr.horned = true; }
  if (!tr.warned && Math.abs(g.focus.z - RAIL_Z) < 25 && g.focus.x > tr.x && g.focus.x - tr.x < 150) { tr.warned = true; meme('train', true); }
  const hitTest = (ent, r) => {
    if ((ent.y || 0) > 4.5) return false;
    if (ent.x > tr.info.minX - r && ent.x < tr.info.maxX + r && Math.abs(ent.z - RAIL_Z) < 1.8 + r) {
      ent.z = RAIL_Z + Math.sign(ent.z - RAIL_Z || 1) * (1.9 + r);
      return true;
    }
    return false;
  };
  if (player.vehicle) {
    if (hitTest(player.vehicle, player.vehicle.spec.radius)) {
      player.vehicle.hp -= 60; player.vehicle.speed = 0; audio.crash(1); g.shake = 1; meme('crash', true);
    }
  } else if (hitTest(player, player.r) && player.hurtCd <= 0) {
    player.hurtCd = 1.5; damagePlayer(45); audio.crash(1);
  }
  for (const v of g.police) hitTest(v, v.spec.radius);
}

function recycle() {
  const fx = g.focus.x, fz = g.focus.z;
  for (const v of g.vehicles) {
    if (v.player || v.cop || v.protected || v.dead || v.boat || v.sinking) continue;
    if (Math.hypot(v.x - fx, v.z - fz) > 340) spawnTraffic(v, 200, 320);
  }
  // keep total traffic around TRAFFIC (vehicles destroyed get replaced)
  const civ = g.vehicles.filter((v) => !v.cop && !v.player && !v.boat).length;
  if (civ < TRAFFIC) {
    const v = new Vehicle(randomTrafficType(), scene);
    spawnTraffic(v, 200, 320);
    g.vehicles.push(v);
  }
  for (let i = g.peds.length - 1; i >= 0; i--) {
    const p = g.peds[i];
    if (Math.hypot(p.x - fx, p.z - fz) > 200) {
      if (g.peds.length > PEDS) { p.destroy(); g.peds.splice(i, 1); continue; }
      const cand = WALK_XS.map((v, idx) => idx);
      for (let t = 0; t < 20; t++) {
        const ix = pick(cand), iz = pick(cand);
        const d = Math.hypot(WALK_XS[ix] - fx, WALK_XS[iz] - fz);
        if (d > 100 && d < 190) { p.place(ix, iz); break; }
      }
    }
  }
  for (const c of g.cows) if (Math.hypot(c.x - fx, c.z - fz) > 320) c.respawnNear(fx, fz, 150, 300);
}

function updatePickups(dt) {
  for (const p of g.pickups) {
    if (!p.active) {
      p.timer -= dt;
      if (p.timer <= 0) { p.active = true; placePickup(p); p.mesh.visible = true; }
      continue;
    }
    p.mesh.position.y = 1.2 + Math.sin(g.time * 3 + p.x) * 0.25;
    const d = Math.hypot(p.x - g.focus.x, p.z - g.focus.z);
    if (d < (player.vehicle ? 3.2 : 1.8)) {
      p.active = false; p.mesh.visible = false; p.timer = 45;
      if (p.kind === 'cash') {
        const n = pick([50, 100, 100, 200, 500]);
        addMoney(n); audio.cash(); hud.toast(`+ ₹${n}`, 1200);
        if (n === 500) meme('money');
      } else {
        g.health = Math.min(100, g.health + 30); audio.ting(); hud.toast('🥟 Samosa! +30 health', 1500);
        meme('pickup');
      }
    }
  }
}

let treasureTaken = false;
try { treasureTaken = localStorage.getItem('bharat-treasure') === '1'; } catch { /* ignore */ }
function updateTreasure() {
  sea.chest.visible = !treasureTaken;
  if (treasureTaken || player.vehicle) return;
  if (Math.hypot(player.x - sea.chest.position.x, player.z - sea.chest.position.z) < 2.4) {
    treasureTaken = true;
    try { localStorage.setItem('bharat-treasure', '1'); } catch { /* ignore */ }
    addMoney(5000);
    audio.cash(); audio.dramatic();
    hud.big('KILA KA KHAZANA!<br><span style="font-size:34px;color:#7dff7a">+ ₹5,000</span>', '#ffd700', 3500);
    meme('treasure', true);
    persist();
  }
}
function boatWake(v, dt, every) {
  v.wakeT = (v.wakeT || 0) - dt;
  if (Math.abs(v.speed) < 3 || v.wakeT > 0) return;
  v.wakeT = every;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), L = v.spec.radius * 0.9;
  puff(v.x - fx * L + rand(-0.4, 0.4), v.y + 0.35, v.z - fz * L + rand(-0.4, 0.4), 0xffffff, 0.5, 1.4, -fx * 0.5, 0.05, -fz * 0.5, 2.2);
  if (Math.abs(v.speed) > 16) puff(v.x + fx * L + fz * rand(-1, 1), v.y + 0.6, v.z + fz * L - fx * rand(-1, 1), 0xe8f4ff, 0.3, 0.5, fz * rand(-3, 3), 1.5, -fx * rand(-3, 3), 1.2);
}

function startSinking(v) {
  if (v.sinking) return;
  v.sinking = { t: 0 };
  v.ai = null;
  audio.splash(1);
  for (let i = 0; i < 8; i++) puff(v.x + rand(-2, 2), 0.5, v.z + rand(-2, 2), 0xffffff, 0.6, 1, rand(-2, 2), rand(2, 5), rand(-2, 2), 1.5);
}

function updateSinking(v, dt) {
  const s = v.sinking;
  s.t += dt;
  v.speed *= Math.max(0, 1 - dt * 1.5);
  v.x += Math.sin(v.yaw) * v.speed * dt; v.z += Math.cos(v.yaw) * v.speed * dt;
  v.y = Math.max(-4, (v.y || 0) - dt * (s.t < 1 ? 0.4 : 1.1));
  const body = v.mesh.userData.body;
  body.rotation.x += (0.35 - body.rotation.x) * Math.min(1, dt);
  if (Math.random() < dt * 6) puff(v.x + rand(-1, 1), 0.3, v.z + rand(-1, 1), 0xffffff, 0.3, 0.8, 0, 1.2, 0, 1);
  if (v.player && s.t > 1.2) {
    // bail out and swim
    v.player = false;
    player.vehicle = null;
    player.x = v.x + Math.cos(v.yaw) * (v.spec.radius + 1); player.z = v.z - Math.sin(v.yaw) * (v.spec.radius + 1);
    player.y = 0; player.swimming = true;
    player.model.visible = true;
    audio.setEngine('car', 0, false);
    meme('sink', true);
  }
  if (s.t > 8) { v.dead = true; v.destroy(); }
}

function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    const m = p.mesh;
    m.position.x += p.vx * dt; m.position.y += p.vy * dt; m.position.z += p.vz * dt;
    m.scale.multiplyScalar(1 + p.grow * dt * 0.5);
    m.material.opacity = Math.max(0, p.life / p.max) * 0.8;
    if (p.life <= 0) m.visible = false;
  }
  // damaged vehicles smoke
  for (const v of g.vehicles) {
    if (v.hp < v.spec.hp * 0.35 && Math.hypot(v.x - g.focus.x, v.z - g.focus.z) < 120) {
      v.smokeT -= dt;
      if (v.smokeT <= 0) {
        v.smokeT = 0.18;
        puff(v.x + Math.sin(v.yaw) * v.spec.radius * 0.8, 1.6, v.z + Math.cos(v.yaw) * v.spec.radius * 0.8, v.hp < v.spec.hp * 0.15 ? 0x222222 : 0x777777, 0.5, 1.4, rand(-0.3, 0.3), 2, rand(-0.3, 0.3));
      }
    }
  }
}

const SKY_DAY = new THREE.Color(0xbfdbe8), SKY_DUSK = new THREE.Color(0xf29e5c), SKY_NIGHT = new THREE.Color(0x0b1630);
const tmpC = new THREE.Color();
const RAIN_GREY = new THREE.Color(0x5d6670);
const skyTop = new THREE.Color(), sunCol = new THREE.Color(), sunDirV = new THREE.Vector3();
const TOP_DAY = new THREE.Color(0x3f86c8), TOP_DUSK = new THREE.Color(0x5a4a8a), TOP_NIGHT = new THREE.Color(0x02060f);
function updateSky() {
  const ang = (g.dayTime - 0.25) * Math.PI * 2; // 6am sunrise
  const h = Math.sin(ang);
  const dayF = clamp(h * 3 + 0.3, 0, 1);
  const dusk = clamp(1 - Math.abs(h) * 4, 0, 1);
  tmpC.copy(SKY_NIGHT).lerp(SKY_DAY, dayF).lerp(SKY_DUSK, dusk * 0.6);
  scene.background.copy(tmpC);
  scene.fog.color.copy(tmpC);
  skyTop.copy(TOP_NIGHT).lerp(TOP_DAY, dayF).lerp(TOP_DUSK, dusk * 0.5);
  sunDirV.set(Math.cos(ang), h, 0.35).normalize();
  if (h < -0.05) { sunDirV.negate(); sunCol.setHex(0x9fb0d0).multiplyScalar(0.6); } // moon
  else sunCol.setHex(0xfff0c8).lerp(new THREE.Color(0xff8a3d), dusk);
  fx.setSky(skyTop, tmpC, sunDirV, sunCol, 1 - dayF);
  g.dayF = dayF;
  setVehicleNight(1 - dayF);
  const wet = weather.rain, flash = weather.flash;
  tmpC.lerp(RAIN_GREY, wet * 0.6 * dayF + wet * 0.2);
  scene.fog.color.copy(tmpC);
  scene.fog.near = 90 - wet * 50; scene.fog.far = 400 - wet * 170;
  fx.setSky(skyTop.lerp(RAIN_GREY, wet * 0.7), tmpC, sunDirV, sunCol.multiplyScalar(1 - wet * 0.85), (1 - dayF) * (1 - wet));
  hemi.intensity = (0.45 + 0.55 * dayF) * (1 - wet * 0.35) + flash * 2.5;
  sun.intensity = (0.32 + 1.33 * dayF) * (1 - wet * 0.75);
  city.groundMat && city.groundMat.color.setScalar(1 - wet * 0.35);
  sun.color.setHex(dayF > 0.2 ? 0xffe2b0 : 0x8899cc);
  const sx = Math.cos(ang), sy = Math.max(0.25, Math.abs(h));
  sun.position.set(g.focus.x + sx * 150, sy * 220, g.focus.z + 80);
  sun.target.position.set(g.focus.x, 0, g.focus.z);
  const night = 1 - dayF;
  city.bMat.emissiveIntensity = night * 0.9;
  city.lampMat.emissiveIntensity = night * 2.2;
}

function updateCamera(dt) {
  const v = player.vehicle;
  const tx = v ? v.x : player.x, tz = v ? v.z : player.z;
  const ty = v ? 1.8 + v.spec.radius * 0.3 + (v.y || 0) : 1.6 + player.y;
  if (v && g.stuntCam && v.air) {
    // cinematic side shot of the jump
    const sc = g.stuntCam;
    const sx = Math.cos(sc.yaw) * sc.side, sz = -Math.sin(sc.yaw) * sc.side;
    camera.position.set(sc.x + sx * 12 + Math.sin(sc.yaw) * 10, 3 + (v.y || 0) * 0.5, sc.z + sz * 12 + Math.cos(sc.yaw) * 10);
    camera.lookAt(v.x, (v.y || 0) + 1, v.z);
    return;
  }
  if (v && g.time - g.lastMouse > 1.2 && Math.abs(v.speed) > 1) {
    const want = v.yaw + (v.speed < -1 ? Math.PI : 0);
    g.camYaw += angleDiff(g.camYaw, want) * Math.min(1, dt * 2.5);
  }
  const aiming = combat.aiming && !v;
  let fov = 65 + (v ? clamp(Math.abs(v.speed) / v.spec.max, 0, 1) * 14 : 0);
  // ---- first person ----
  if (g.fpv) {
    player.model.visible = false;
    const fx = Math.sin(g.camYaw) * Math.cos(g.camPitch), fy = -Math.sin(g.camPitch), fz = Math.cos(g.camYaw) * Math.cos(g.camPitch);
    if (v) {
      const sx = v.type === 'bike' || v.type === 'auto' ? 0 : -0.4;
      tmpV.set(v.x + Math.cos(v.yaw) * -sx + Math.sin(v.yaw) * (v.spec.radius * 0.1), v.type === 'bus' || v.type === 'truck' ? 2.6 : 1.35, v.z - Math.sin(v.yaw) * -sx + Math.cos(v.yaw) * (v.spec.radius * 0.1));
    } else tmpV.set(player.x + Math.sin(player.yaw) * 0.25, 1.72 + player.y, player.z + Math.cos(player.yaw) * 0.25);
    if (!v && !aiming) player.yaw = g.camYaw;
    camera.position.copy(tmpV);
    camera.lookAt(tmpV.x + fx, tmpV.y + fy, tmpV.z + fz);
    if (aiming) fov = 50;
  } else {
    if (!v && g.frozen <= 0) player.model.visible = true;
    const base = aiming ? 2.6 : v ? 7 + v.spec.radius * 1.8 : 5;
    const dist = base * (aiming ? 1 : g.camZoom);
    const pitch = g.camPitch;
    const dirX = -Math.sin(g.camYaw) * Math.cos(pitch), dirY = Math.sin(pitch), dirZ = -Math.cos(g.camYaw) * Math.cos(pitch);
    // over-the-shoulder offset while aiming
    const side = aiming ? 0.75 : 0;
    const ox = -Math.cos(g.camYaw) * side, oz = Math.sin(g.camYaw) * side;
    const aty = aiming ? 1.45 + player.y : ty;
    let dd = dist;
    for (let t = 1; t <= dist; t += 0.5) {
      if (world.pointBlocked(tx + ox + dirX * t, aty + dirY * t + 0.6, tz + oz + dirZ * t)) { dd = Math.max(1.0, t - 0.6); break; }
    }
    tmpV.set(tx + ox + dirX * dd, Math.max(0.6, aty + dirY * dd + (aiming ? 0.1 : 0.6)), tz + oz + dirZ * dd);
    camera.position.copy(tmpV);
    if (aiming) {
      // look far along the camera yaw so the crosshair is screen-centred
      const fx = Math.sin(g.camYaw) * Math.cos(pitch), fy = -Math.sin(pitch), fz = Math.cos(g.camYaw) * Math.cos(pitch);
      camera.lookAt(tmpV.x + fx * 50, tmpV.y + fy * 50, tmpV.z + fz * 50);
      fov = 52;
    } else camera.lookAt(tx, ty, tz);
  }
  if (g.shake > 0) {
    camera.position.x += rand(-1, 1) * g.shake * 0.3; camera.position.y += rand(-1, 1) * g.shake * 0.3;
    g.shake = Math.max(0, g.shake - dt * 2.5);
  }
  if (Math.abs(camera.fov - fov) > 0.1) { camera.fov = lerp(camera.fov, fov, Math.min(1, dt * 8)); camera.updateProjectionMatrix(); }
}

function handleKeys() {
  if (systems.shopOpen) { if (kp('KeyE') || kp('Escape')) systems.closeShop(); return; }
  if (kp('KeyP') || kp('Escape')) { if (kp('KeyP')) setPaused(!g.paused); }
  if (g.paused) return;
  if (kp('KeyR')) { const name = audio.setStation(audio.station + 1); hud.radio(name); systems.onStation(audio.station); }
  if (kp('KeyV')) { g.fpv = !g.fpv; hud.toast(g.fpv ? '👁️ First person' : '🎥 Third person', 1000); }
  if ((kp('KeyQ') || kp('Tab')) && !player.vehicle) combat.cycle(1);
  if (kp('KeyM')) { g.showMap = !g.showMap; }
  if (kp('KeyC')) { g.camZoom = g.camZoom === 1 ? 1.6 : g.camZoom === 1.6 ? 0.7 : 1; }
  if (kp('KeyN')) { audio.setMuted(!audio.muted); hud.toast(audio.muted ? '🔇 Muted' : '🔊 Sound on'); }
  if (kp('KeyB')) g.showBoard = !g.showBoard;
  for (let i = 1; i <= 9; i++) {
    if (!kp('Digit' + i)) continue;
    const key = String(i);
    const clip = audio.boardClip(key);
    if (clip) { audio.playBuffer(clip.buffer); hud.subtitle(clip.label); continue; }
    const b = BOARD.find((x) => x.key === key);
    if (!b) continue;
    if (b.line) { audio.say(b.line, true); hud.subtitle(b.line.en); }
    else if (b.sfx === 'truck') audio.horn('truck', 1);
    else audio[b.sfx]?.();
  }
}

// pointer lock lost via Escape -> pause
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && g.started && !g.paused && !g.showMap) setPaused(true);
});

const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, recycleT = 0;
const fpsEl = document.getElementById('fps');

function frame() {
  requestAnimationFrame(frame);
  if (g.stuntCam && !player.vehicle?.air) { g.timeScale = 1; g.stuntCam = null; }
  tick(Math.min(clock.getDelta(), 0.05) * (g.timeScale || 1));
}
// test hook: advance the simulation even when the tab is hidden
window.__debug.tick = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) tick(dt); };
function tick(dt) {
  handleKeys();
  if (!g.paused) {
    g.time += dt;
    g.dayTime = (g.dayTime + dt / DAY_LEN) % 1;
    if (g.frozen > 0) g.frozen -= dt;

    if (g.cutscene) { if (kp('Enter') || kp('Space') || kp('Escape')) g.cutscene.skip(); } else updatePlayer(dt);
    const pv = player.vehicle;
    g.focus.x = pv ? pv.x : player.x;
    g.focus.z = pv ? pv.z : player.z;
    g.focusYaw = pv ? pv.yaw : player.yaw;

    // obstacle list for traffic AI
    const obstacles = [];
    for (const v of g.vehicles) { v.r = v.spec.radius; obstacles.push(v); }
    for (const p of g.peds) if (p.state === 'walk' && Math.abs(p.x - g.focus.x) < 200) obstacles.push(p);
    for (const c of g.cows) obstacles.push(c);
    if (!pv) obstacles.push({ x: player.x, z: player.z, r: 0.8 });

    const tinfo = city.train.info;
    for (const v of g.vehicles) {
      if (v.sinking) { updateSinking(v, dt); continue; }
      if (v.player || v.dead) continue;
      if (v.boat) {
        if (v.cop) updateCopBoat(v, dt);
        else if (v.aiBoat && Math.abs(v.x - g.focus.x) < 500 && Math.abs(v.z - g.focus.z) < 500) {
          v.updateBoatAI(dt, sea);
          if (Math.abs(v.x - camera.position.x) < 120 && Math.abs(v.z - camera.position.z) < 120) boatWake(v, dt, 0.15);
        } else if (Math.abs(v.vx) + Math.abs(v.vz) > 0.05) { v.driveBoat({ throttle: 0, steer: 0, brake: true }, dt); v.bounceBoat(sea.resolveBoat(v)); }
        continue;
      }
      if (v.cop) updateCop(v, dt);
      else if (v.ai) {
        v.updateAI(dt, obstacles, tinfo, (car) => {
          const d = Math.hypot(car.x - g.focus.x, car.z - g.focus.z);
          audio.horn(car.spec.horn, clamp(1 - d / 90, 0, 0.7));
          if (d < 14 && g.time - g.lastHonkShout > 9) { g.lastHonkShout = g.time; meme('blocked'); }
        });
      } else if (Math.abs(v.speed) > 0.01) {
        v.speed *= Math.max(0, 1 - dt * 2);
        v.x += Math.sin(v.yaw) * v.speed * dt; v.z += Math.cos(v.yaw) * v.speed * dt;
        v.collideWorld(world);
      }
    }
    vehicleInteractions(dt);
    for (const p of g.peds) {
      const near = Math.abs(p.x - g.focus.x) < 220 && Math.abs(p.z - g.focus.z) < 220;
      p.mesh.visible = Math.abs(p.x - camera.position.x) < 105 && Math.abs(p.z - camera.position.z) < 105;
      if (near) p.update(dt);
    }
    for (const c of g.cows) c.update(dt, g.time);
    updateWanted(dt);
    updateTrain(dt);
    if (g.frozen <= 0) updateMission(dt);
    updatePickups(dt);
    updateParticles(dt);
    systems.update(dt);
    g.atSea = !!(player.vehicle?.boat) || !!player.swimming || g.focus.x < SEA_X - 2;
    sea.update(dt, 1 - (g.dayF ?? 1), g.buoyAt);
    audio.setSea(clamp(1 - Math.abs(g.focus.x - SEA_X) / 90, 0, 1));
    updateTreasure();
    weather.update(dt, camera.position, () => meme('rain'));
    cfx.update(dt);
    stunts.update(dt);
    for (const s of g.shooters) s.mesh.visible = Math.abs(s.x - camera.position.x) < 150 && Math.abs(s.z - camera.position.z) < 150;
    recycleT -= dt;
    if (recycleT <= 0) { recycle(); recycleT = 0.5; }

    for (const v of g.vehicles) {
      if (v.boat) v.floatOn(waveH, sea.t);
      else if ((v.ai || v.cop) && !v.air && !v.sinking) { const rp = stunts.rampAt(v.x, v.z); v.y = rp ? rp.h : 0; }
      v.sync(dt, g.time);
    }
    player.model.position.set(player.x, player.y, player.z);
    player.model.userData.char?.update(dt);
    if (passenger.visible) passenger.userData.char?.update(dt);
    player.model.rotation.y = player.yaw;
    if (player.swimming && !player.vehicle) {
      const moving = Math.hypot(g.focusVel.x, g.focusVel.z) > 0.5;
      player.model.rotation.x = moving ? 1.3 : 0;     // stroke flat on the water, or tread water upright
      player.model.position.y = player.y + (moving ? 0.15 : -1.25) + Math.sin(g.time * 2) * 0.05;
    } else player.model.rotation.x = 0;
    updateSky();
    if (g.cutscene) g.cutscene.update(dt); else updateCamera(dt);
    fx.update(dt, g.focus, camera, g.dayF ?? 1, player.vehicle);

    // HUD
    if (g.bustT <= 0.3 && !(g.mission === null && g.markers.some((mk) => Math.hypot(mk.x - g.focus.x, mk.z - g.focus.z) < 5))) {
      const st = g.mission?.steps[g.mission.idx];
      if (!st || Math.hypot((st.x ?? 1e9) - g.focus.x, (st.z ?? 1e9) - g.focus.z) > (pv ? 7 : 3.5)) hud.prompt(null);
    }
    if (!g.mission) hud.mission(null);
    hud.stats(g);
    hud.vehicle(pv);
    hud.weapon(combat);
    hud.armor(g.armor);
    hud.crosshair(combat.aiming && !pv);
    hud.area(areaName(g.focus.x, g.focus.z));
    hud.minimap(g);
    hud.bigmap(g, g.showMap);
    hud.board(audio.board.length ? audio.board : BOARD, g.showBoard);

    // nearby vehicle hint
    if (!pv && g.frozen <= 0) {
      for (const c of g.vehicles) {
        if (!c.dead && Math.hypot(c.x - player.x, c.z - player.z) - c.spec.radius < 2.6) {
          if (document.getElementById('prompt').style.display !== 'block') hud.prompt(`F — ${c.ai ? 'Hijack' : 'Enter'} ${c.spec.name}`);
          break;
        }
      }
    }
  }
  pressed.clear();
  scene.updateMatrixWorld();
  INST.update(camera.position);
  carInst?.update(g.vehicles, camera.position);
  renderer.render(scene, camera);

  fpsAcc += dt; fpsN++;
  if (fpsAcc > 1) { fpsEl.textContent = Math.round(fpsN / fpsAcc) + ' fps'; fpsAcc = 0; fpsN = 0; }
}
frame();
