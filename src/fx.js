// Atmosphere & eye candy: sky dome, clouds, kites, birds, waves, night lighting.
import * as THREE from 'three';
import { SEA_X, HALF } from './config.js';
import { rand, pick } from './utils.js';

function radialTex(inner, outer, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const SOFT = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

function cloudTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 22; i++) {
    const x = rand(50, 206), y = rand(50, 85), r = rand(18, 42);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class FX {
  constructor(scene, city) {
    this.scene = scene;
    this.t = 0;

    // ---------- sky dome ----------
    this.skyU = {
      top: { value: new THREE.Color(0x4f8fc9) },
      horizon: { value: new THREE.Color(0xd9e6ea) },
      sunDir: { value: new THREE.Vector3(0.3, 0.6, 0.3).normalize() },
      sunColor: { value: new THREE.Color(0xfff0c8) },
      night: { value: 0 },
    };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyU,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunColor; uniform float night;
        varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,45.164))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(horizon, top, pow(h, 0.45));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (smoothstep(0.9993, 0.9997, s) * 3.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08);
          float st = step(0.9975, hash(floor(d * 380.0))) * smoothstep(0.6, 1.0, night) * smoothstep(0.05, 0.3, h);
          col += vec3(st);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    // ---------- clouds ----------
    this.clouds = [];
    const ctex = cloudTex();
    for (let i = 0; i < 34; i++) {
      const m = new THREE.SpriteMaterial({ map: ctex, fog: false, depthWrite: false, transparent: true, opacity: rand(0.55, 0.9) });
      const s = new THREE.Sprite(m);
      const sc = rand(140, 300);
      s.scale.set(sc, sc * 0.45, 1);
      s.position.set(rand(-900, 900), rand(170, 260), rand(-900, 900));
      s.renderOrder = -5;
      scene.add(s);
      this.clouds.push(s);
    }

    // ---------- kites (patang) ----------
    this.kites = [];
    const kiteGeo = new THREE.PlaneGeometry(1.6, 1.6);
    const stringPts = [];
    for (let i = 0; i < 26; i++) {
      const color = pick([0xff006e, 0xffbe0b, 0x3a86ff, 0x8338ec, 0xfb5607, 0x06d6a0, 0xffffff, 0xe63946]);
      const k = new THREE.Mesh(kiteGeo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
      k.rotation.z = Math.PI / 4;
      const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 1.4), new THREE.MeshBasicMaterial({ color: pick([0xffffff, 0x111111, 0xffd60a]), side: THREE.DoubleSide }));
      tail.position.set(0.6, -0.6, 0);
      k.add(tail);
      const grp = new THREE.Group(); grp.add(k);
      const anchor = new THREE.Vector3(rand(-500, 550), rand(10, 25), rand(-550, 550));
      grp.position.set(anchor.x + rand(-25, 25), rand(40, 75), anchor.z + rand(-25, 25));
      scene.add(grp);
      this.kites.push({ grp, base: grp.position.clone(), anchor, ph: rand(0, 10) });
      stringPts.push(anchor.x, anchor.y, anchor.z, grp.position.x, grp.position.y, grp.position.z);
    }
    this.kiteStrings = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(stringPts, 3)),
      new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.5 }));
    scene.add(this.kiteStrings);

    // ---------- birds (crows / pigeons) ----------
    this.flocks = [];
    const wing = new THREE.BoxGeometry(0.9, 0.04, 0.35);
    wing.translate(0.45, 0, 0);
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
    for (let f = 0; f < 5; f++) {
      const birds = [];
      const grp = new THREE.Group();
      for (let b = 0; b < 9; b++) {
        const bird = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.6), birdMat);
        const l = new THREE.Mesh(wing, birdMat), r = new THREE.Mesh(wing, birdMat);
        r.rotation.y = Math.PI;
        bird.add(body, l, r);
        bird.position.set(rand(-6, 6), rand(-2, 2), rand(-6, 6));
        grp.add(bird);
        birds.push({ l, r, ph: rand(0, 6) });
      }
      scene.add(grp);
      this.flocks.push({ grp, birds, cx: rand(-450, 450), cz: rand(-450, 450), rad: rand(40, 90), h: rand(30, 55), sp: rand(0.15, 0.3) * (Math.random() < 0.5 ? 1 : -1), a: rand(0, 6) });
    }

    // ---------- sea waves + shore foam ----------
    const W = 700, L = 1500;
    this.waveGeo = new THREE.PlaneGeometry(W, L, 70, 150);
    this.waveGeo.rotateX(-Math.PI / 2);
    this.waveBase = Float32Array.from(this.waveGeo.attributes.position.array);
    this.waves = new THREE.Mesh(this.waveGeo, new THREE.MeshStandardMaterial({ color: 0x1b6f8f, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.93 }));
    this.waves.position.set(SEA_X - W / 2 + 2, 0.2, 0);
    this.waves.receiveShadow = true;
    scene.add(this.waves);
    this.flatSea = city.sea.material = new THREE.MeshStandardMaterial({ color: 0x1b6f8f, roughness: 0.15, metalness: 0.25 });
    city.sea.position.y = 0.05;
    this.foam = new THREE.Mesh(new THREE.PlaneGeometry(5, 1400), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.set(SEA_X - 1.5, 0.35, 0);
    scene.add(this.foam);

    // ---------- street-lamp light pools (night) ----------
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,200,120,1)', 'rgba(255,170,80,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const spots = city.lampSpots;
    this.pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(18, 18).rotateX(-Math.PI / 2), poolMat, spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, z], i) => { m4.makeTranslation(x, 0.06, z); this.pools.setMatrixAt(i, m4); });
    this.pools.renderOrder = 1;
    scene.add(this.pools);
    this.poolMat = poolMat;

    // lamp glow halos: a single Points draw call
    const hp = [];
    for (const [x, z] of spots) hp.push(x, 6.8, z);
    this.haloMat = new THREE.PointsMaterial({ map: SOFT, color: 0xffd9a0, size: 5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    this.halos = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(hp, 3)), this.haloMat);
    scene.add(this.halos);

    // player headlight
    this.headlight = new THREE.SpotLight(0xfff2d0, 0, 70, 0.5, 0.5, 1.2);
    scene.add(this.headlight, this.headlight.target);
  }

  update(dt, focus, camera, dayF, playerVehicle) {
    this.t += dt;
    const t = this.t;
    const night = 1 - dayF;
    this.sky.position.copy(camera.position);

    // clouds drift, wrap around the player, tint by time of day
    for (const c of this.clouds) {
      c.position.x += dt * 3;
      if (c.position.x - focus.x > 900) c.position.x -= 1800;
      if (c.position.x - focus.x < -900) c.position.x += 1800;
      if (c.position.z - focus.z > 900) c.position.z -= 1800;
      if (c.position.z - focus.z < -900) c.position.z += 1800;
      c.material.color.setScalar(0.25 + 0.75 * dayF);
    }

    // kites sway
    const sp = this.kiteStrings.geometry.attributes.position;
    this.kites.forEach((k, i) => {
      k.grp.position.set(k.base.x + Math.sin(t * 0.5 + k.ph) * 6, k.base.y + Math.sin(t * 0.9 + k.ph) * 3, k.base.z + Math.cos(t * 0.4 + k.ph) * 6);
      k.grp.rotation.set(Math.sin(t * 2 + k.ph) * 0.3, t * 0.2 + k.ph, Math.sin(t * 1.5 + k.ph) * 0.4);
      sp.setXYZ(i * 2 + 1, k.grp.position.x, k.grp.position.y, k.grp.position.z);
    });
    sp.needsUpdate = true;

    // birds circle and flap
    for (const f of this.flocks) {
      f.a += f.sp * dt;
      f.grp.position.set(f.cx + Math.cos(f.a) * f.rad, f.h + Math.sin(f.a * 3) * 3, f.cz + Math.sin(f.a) * f.rad);
      f.grp.rotation.y = -f.a + (f.sp > 0 ? 0 : Math.PI);
      for (const b of f.birds) {
        const w = Math.sin(t * 9 + b.ph) * 0.6;
        b.l.rotation.z = w; b.r.rotation.z = -w;
      }
    }

    // waves (only animate when near the sea to save CPU)
    if (focus.x < SEA_X + 350) {
      const pos = this.waveGeo.attributes.position;
      const base = this.waveBase;
      const ox = this.waves.position.x;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3] + ox, z = base[i * 3 + 2];
        const shore = Math.min(1, (SEA_X - x) / 40 + 0.2) * Math.min(1, Math.max(0, (x - (SEA_X - 700)) / 200));
        pos.array[i * 3 + 1] = (Math.sin(x * 0.08 + t * 1.6) * 0.5 + Math.sin(z * 0.05 + x * 0.03 + t * 1.1) * 0.35 + Math.sin(x * 0.21 - z * 0.13 + t * 2.3) * 0.15) * shore;
      }
      pos.needsUpdate = true;
      this.waveGeo.computeVertexNormals();
    }
    this.foam.material.opacity = 0.25 + Math.sin(t * 1.6) * 0.2;
    this.foam.position.x = SEA_X - 1.5 + Math.sin(t * 1.6) * 1.2;
    this.waves.material.color.setRGB(0.1 + 0.02 * dayF, 0.25 + 0.2 * dayF, 0.32 + 0.25 * dayF);
    this.flatSea.color.copy(this.waves.material.color);

    // night lights
    this.poolMat.opacity = night * 0.55;
    this.haloMat.opacity = night * 0.9;
    this.halos.visible = this.pools.visible = night > 0.05;
    const hl = this.headlight;
    if (playerVehicle && night > 0.3) {
      const v = playerVehicle;
      const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
      hl.intensity = 60 * night;
      hl.position.set(v.x + fx * v.spec.radius, 1.2, v.z + fz * v.spec.radius);
      hl.target.position.set(v.x + fx * 25, 0, v.z + fz * 25);
    } else hl.intensity = 0;
  }

  setSky(top, horizon, sunDir, sunColor, night) {
    this.skyU.top.value.copy(top);
    this.skyU.horizon.value.copy(horizon);
    this.skyU.sunDir.value.copy(sunDir);
    this.skyU.sunColor.value.copy(sunColor);
    this.skyU.night.value = night;
  }
}
