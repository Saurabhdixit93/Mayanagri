// Monsoon rain + thunder.
import * as THREE from 'three';
import { rand } from './utils.js';

const N = 3500;

export class Weather {
  constructor(scene, audio) {
    this.audio = audio;
    this.rain = 0;          // current intensity 0..1
    this.target = 0;
    this.timer = rand(90, 200); // seconds until weather changes
    this.pos = new Float32Array(N * 6);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.lines = new THREE.LineSegments(this.geo, new THREE.LineBasicMaterial({ color: 0xaec4d6, transparent: true, opacity: 0, depthWrite: false }));
    this.lines.frustumCulled = false;
    scene.add(this.lines);
    this.drops = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { this.drops[i * 3] = rand(-45, 45); this.drops[i * 3 + 1] = rand(0, 35); this.drops[i * 3 + 2] = rand(-45, 45); }
    this.flash = 0;
    this.thunderT = rand(6, 15);
  }

  toggle() { this.target = this.target > 0 ? 0 : 1; this.timer = 240; return this.target > 0; }

  update(dt, cam, onStart) {
    this.timer -= dt;
    if (this.timer <= 0) {
      const was = this.target;
      this.target = this.target > 0 ? 0 : (Math.random() < 0.6 ? rand(0.6, 1) : 0);
      this.timer = this.target > 0 ? rand(90, 180) : rand(150, 300);
      if (!was && this.target) onStart?.();
    }
    this.rain += Math.sign(this.target - this.rain) * Math.min(Math.abs(this.target - this.rain), dt * 0.15);
    const r = this.rain;
    this.lines.material.opacity = r * 0.55;
    this.lines.visible = r > 0.01;
    if (this.lines.visible) {
      const fall = 32 * dt, wind = 4 * dt;
      for (let i = 0; i < N; i++) {
        let y = this.drops[i * 3 + 1] - fall;
        if (y < 0) y += 35;
        this.drops[i * 3 + 1] = y;
        const x = cam.x + this.drops[i * 3] + (this.drops[i * 3 + 1] - 17) * 0.1, z = cam.z + this.drops[i * 3 + 2];
        const j = i * 6, yy = cam.y - 10 + y;
        this.pos[j] = x; this.pos[j + 1] = yy; this.pos[j + 2] = z;
        this.pos[j + 3] = x - wind * 3; this.pos[j + 4] = yy - 0.9; this.pos[j + 5] = z;
      }
      this.geo.attributes.position.needsUpdate = true;
    }
    this.audio.setRain?.(r);
    // thunder
    if (r > 0.5) {
      this.thunderT -= dt;
      if (this.thunderT <= 0) { this.thunderT = rand(10, 28); this.flash = 1; setTimeout(() => this.audio.thunder?.(), rand(300, 1500)); }
    }
    this.flash = Math.max(0, this.flash - dt * 3);
    return { rain: r, flash: this.flash };
  }
}
