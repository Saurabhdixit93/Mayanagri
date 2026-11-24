// CC0 glTF assets (Quaternius / poly.pizza) for characters and cars.
// Characters: the 4 skinned body-part meshes are merged into ONE skinned mesh with
// vertex colours so each person is a single draw call. Cars: all parts merged into one
// geometry and drawn with one InstancedMesh per model.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const ASSETS = { ready: false, chars: {}, cars: {} };

const CHAR_FILES = {
  casual: 'c_casual', business: 'c_business', worker: 'c_worker', hoodie: 'c_hoodie', swat: 'c_swat',
  farmer: 'c_farmer', beach: 'c_beach', woman1: 'c_woman1', woman2: 'c_woman2',
};
const CAR_FILES = { car: ['v_car', 4.0], suv: ['v_suv', 4.4], taxi: ['v_taxi', 4.2], police: ['v_police', 4.3] };
export const MALE_ARCH = ['casual', 'business', 'worker', 'farmer', 'beach', 'hoodie'];
export const FEMALE_ARCH = ['woman1', 'woman2'];

const loader = new GLTFLoader();
const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

// Indian skin tones for the "Skin" material
const SKIN_TONES = [0x8d5524, 0xa0662f, 0xc68642, 0x7a4a22];

function mergeSkinned(root, skinTone) {
  root.updateMatrixWorld(true);
  const parts = [];
  root.traverse((o) => { if (o.isSkinnedMesh) parts.push(o); });
  if (!parts.length) return null;
  const sk = parts[0].skeleton;
  // all parts must share bones + inverse bind matrices to be merged
  const same = parts.every((p) => p.skeleton.bones.length === sk.bones.length && p.skeleton.boneInverses.every((m, i) => m.equals(sk.boneInverses[i]) || m.elements.every((e, k) => Math.abs(e - sk.boneInverses[i].elements[k]) < 1e-4)));
  if (!same) return null;
  const geos = parts.map((p) => {
    let geo = p.geometry.clone();
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'skinIndex', 'skinWeight'].includes(k)) geo.deleteAttribute(k);
    geo.morphAttributes = {};
    geo.applyMatrix4(p.bindMatrix);
    let c = p.material.color.clone();
    if (/skin/i.test(p.material.name) && skinTone != null) c = new THREE.Color(skinTone);
    const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  });
  const merged = mergeGeometries(geos, false);
  const mesh = new THREE.SkinnedMesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  parts[0].parent.add(mesh);
  mesh.bind(sk, new THREE.Matrix4());
  for (const p of parts) p.parent.remove(p);
  return mesh;
}

async function loadChar(key, file, onProgress) {
  const gltf = await load(`models/${file}.glb`);
  const root = gltf.scene;
  const skin = /woman/.test(key) ? SKIN_TONES[2] : key === 'swat' ? null : SKIN_TONES[Object.keys(CHAR_FILES).indexOf(key) % SKIN_TONES.length];
  const merged = mergeSkinned(root, skin);
  if (!merged) root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  root.updateMatrixWorld(true);
  root.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.update(); });
  const box = new THREE.Box3().setFromObject(root, true);
  const h = box.max.y - box.min.y || 1;
  const s = 1.8 / h;
  const proto = new THREE.Group();
  root.scale.multiplyScalar(s);
  root.position.y = -box.min.y * s;
  proto.add(root);
  ASSETS.chars[key] = { proto, clips: gltf.animations };
  onProgress?.();
}

async function loadCar(key, file, length, onProgress) {
  const gltf = await load(`models/${file}.glb`);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const geos = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    let geo = o.geometry.clone();
    if (geo.index) geo = geo.toNonIndexed();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
    geo.applyMatrix4(o.matrixWorld);
    const c = o.material.color;
    const n = geo.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    geos.push(geo);
  });
  const geo = mergeGeometries(geos, false);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const s = length / (bb.max.z - bb.min.z);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(s, s, s);
  geo.computeBoundingBox();
  ASSETS.cars[key] = { geo, height: geo.boundingBox.max.y };
  onProgress?.();
}

export async function loadAssets(onProgress) {
  const jobs = [];
  for (const [k, f] of Object.entries(CHAR_FILES)) jobs.push(loadChar(k, f, onProgress));
  for (const [k, [f, len]] of Object.entries(CAR_FILES)) jobs.push(loadCar(k, f, len, onProgress));
  const res = await Promise.allSettled(jobs);
  const failed = res.filter((r) => r.status === 'rejected');
  if (failed.length) console.warn('Some models failed to load', failed.map((f) => f.reason));
  ASSETS.ready = Object.keys(ASSETS.chars).length > 0;
  return jobs.length;
}
export const ASSET_COUNT = Object.keys(CHAR_FILES).length + Object.keys(CAR_FILES).length;

// ---------------------------------------------------------------------------
// Animated character instance
// ---------------------------------------------------------------------------
export class CharModel {
  constructor(key) {
    const P = ASSETS.chars[key] || Object.values(ASSETS.chars)[0];
    this.key = key;
    this.group = SkeletonUtils.clone(P.proto);
    this.mixer = new THREE.AnimationMixer(this.group);
    this.actions = {};
    for (const clip of P.clips) this.actions[clip.name.split('|').pop()] = this.mixer.clipAction(clip);
    this.cur = null; this.curName = '';
    this.hand = ['WristR', 'Wrist.R', 'Wrist_R', 'LowerArmR', 'LowerArm.R'].map((n) => this.group.getObjectByName(n)).find(Boolean) || null;
    this.play('Idle', { fade: 0 });
  }

  play(name, { once = false, fade = 0.18, speed = 1 } = {}) {
    if (this.curName === name && !once) { if (this.cur) this.cur.timeScale = speed; return; }
    const a = this.actions[name];
    if (!a) return;
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.timeScale = speed;
    a.enabled = true;
    a.setEffectiveWeight(1);
    if (this.cur && this.cur !== a && fade > 0) { a.play(); this.cur.crossFadeTo(a, fade, false); }
    else { if (this.cur && this.cur !== a) this.cur.stop(); a.play(); }
    this.cur = a; this.curName = name;
  }

  update(dt) { this.mixer.update(dt); }
}

// One InstancedMesh per car model; vehicles report their transform every frame.
export class CarInstancer {
  constructor(scene) {
    this.sets = {};
    for (const [k, c] of Object.entries(ASSETS.cars)) {
      const im = new THREE.InstancedMesh(c.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.25 }), 200);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true;
      scene.add(im);
      this.sets[k] = im;
    }
  }
  update(vehicles, cam) {
    const n = {};
    for (const k in this.sets) n[k] = 0;
    for (const v of vehicles) {
      const key = v.mesh.userData.glb;
      if (!key || v.dead || !this.sets[key]) continue;
      const e = v.mesh.matrixWorld.elements;
      if ((e[12] - cam.x) ** 2 + (e[14] - cam.z) ** 2 > 380 * 380) continue;
      const im = this.sets[key];
      if (n[key] >= 200) continue;
      im.setMatrixAt(n[key]++, v.mesh.userData.body.matrixWorld);
    }
    for (const k in this.sets) { this.sets[k].count = n[k]; this.sets[k].instanceMatrix.needsUpdate = true; }
  }
}
