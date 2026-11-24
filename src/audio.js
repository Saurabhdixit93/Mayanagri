// All sound is synthesised live with WebAudio (no copyrighted clips shipped).
// Drop your own meme clips into public/sounds and list them in manifest.json to override events.
import { pick, rand, clamp } from './utils.js';

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.custom = {};
    this.board = [];
    this.voiceHi = null;
    this.voiceEn = null;
    this.station = 0;
    this.ksCache = new Map();
    this.muted = false;
  }

  async init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    const c = (this.ctx = new C());
    this.master = c.createGain(); this.master.gain.value = 0.85; this.master.connect(c.destination);
    this.comp = c.createDynamicsCompressor(); this.comp.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.comp);
    this.music = c.createGain(); this.music.gain.value = 0.3; this.music.connect(this.comp);
    this.amb = c.createGain(); this.amb.gain.value = 0.22; this.amb.connect(this.comp);
    this.memeBus = c.createGain(); this.memeBus.gain.value = 1.0; this.memeBus.connect(this.master);

    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.setupAmbient();
    this.setupEngine();
    this.setupSiren();
    this.setupLoops();
    this.pickVoice();
    if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => this.pickVoice();
    this.radioTimer = setInterval(() => this.scheduleRadio(), 40);
    this.nextNote = c.currentTime + 0.1;
    this.step = 0;
    this.loadPack();
  }

  get t() { return this.ctx.currentTime; }

  // ---------- primitives ----------
  tone(type, f, start, dur, gain, dest, o = {}) {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, start);
    if (o.fEnd) osc.frequency.exponentialRampToValueAtTime(o.fEnd, start + dur);
    if (o.vib) {
      const l = c.createOscillator(); const lg = c.createGain();
      l.frequency.value = o.vib[0]; lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(osc.frequency); l.start(start); l.stop(start + dur + 0.1);
    }
    const g = c.createGain();
    const atk = o.atk ?? 0.008;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(gain, start + atk);
    if (o.hold) g.gain.setValueAtTime(gain, start + dur * o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    let node = osc;
    if (o.lp || o.bp || o.hp) {
      const f2 = c.createBiquadFilter();
      f2.type = o.lp ? 'lowpass' : o.bp ? 'bandpass' : 'highpass';
      f2.frequency.value = o.lp || o.bp || o.hp;
      if (o.q) f2.Q.value = o.q;
      osc.connect(f2); node = f2;
    }
    node.connect(g); g.connect(dest || this.sfx);
    osc.start(start); osc.stop(start + dur + 0.05);
  }

  noiseBurst(start, dur, gain, dest, o = {}) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    s.playbackRate.value = o.rate || 1;
    const f = c.createBiquadFilter(); f.type = o.type || 'lowpass'; f.frequency.value = o.f || 1000;
    if (o.q) f.Q.value = o.q;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx);
    s.start(start, Math.random() * 1.5); s.stop(start + dur + 0.05);
  }

  // ---------- horns ----------
  horn(kind, vol = 1, dest) {
    if (!this.ctx || vol <= 0.01) return;
    const t = this.t, D = dest || this.sfx;
    if (kind === 'auto') {
      for (const off of [0, 0.2]) {
        this.tone('square', 560, t + off, 0.15, 0.13 * vol, D, { lp: 2600, hold: 0.7 });
        this.tone('square', 840, t + off, 0.15, 0.06 * vol, D, { lp: 2600, hold: 0.7 });
      }
    } else if (kind === 'car') {
      this.tone('sawtooth', 415, t, 0.42, 0.11 * vol, D, { lp: 1800, hold: 0.8 });
      this.tone('sawtooth', 523, t, 0.42, 0.11 * vol, D, { lp: 1800, hold: 0.8 });
    } else if (kind === 'bus') {
      this.tone('sawtooth', 233, t, 0.75, 0.13 * vol, D, { lp: 1400, hold: 0.85 });
      this.tone('sawtooth', 294, t, 0.75, 0.13 * vol, D, { lp: 1400, hold: 0.85 });
    } else if (kind === 'truck') {
      // the famous decorated-truck musical horn (original little tune)
      const notes = [523, 659, 784, 659, 523, 784, 1046, 784];
      notes.forEach((f, i) => this.tone('square', f, t + i * 0.12, 0.11, 0.09 * vol, D, { lp: 3000, hold: 0.8 }));
    } else if (kind === 'bike') {
      this.tone('square', 640, t, 0.22, 0.1 * vol, D, { lp: 2500, hold: 0.8 });
      this.tone('square', 760, t, 0.22, 0.06 * vol, D, { lp: 2500, hold: 0.8 });
    }
  }

  crash(vol = 1) {
    if (!this.ctx) return;
    if (this.playEvent('crash_sfx')) return;
    const t = this.t;
    this.noiseBurst(t, 0.5, 0.6 * vol, this.sfx, { f: 900 });
    this.noiseBurst(t, 0.15, 0.3 * vol, this.sfx, { f: 4000, type: 'highpass' });
    this.tone('sine', 120, t, 0.35, 0.5 * vol, this.sfx, { fEnd: 40 });
  }

  explosion() {
    if (!this.ctx) return;
    const t = this.t;
    this.noiseBurst(t, 1.6, 0.9, this.sfx, { f: 500, rate: 0.6 });
    this.tone('sine', 90, t, 1.0, 0.7, this.sfx, { fEnd: 25 });
  }

  moo(vol = 1) {
    if (!this.ctx) return;
    const t = this.t;
    this.tone('sawtooth', 150, t, 1.3, 0.25 * vol, this.sfx, { fEnd: 105, bp: 520, q: 2.5, atk: 0.15, hold: 0.6, vib: [5, 4] });
    this.tone('sawtooth', 300, t, 1.3, 0.06 * vol, this.sfx, { fEnd: 210, bp: 900, q: 3, atk: 0.15, hold: 0.6 });
  }

  trainHorn(vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    const t = this.t;
    for (const f of [311, 392, 466]) this.tone('sawtooth', f, t, 1.8, 0.07 * vol, this.sfx, { lp: 1600, atk: 0.08, hold: 0.85 });
  }

  ting() {
    if (!this.ctx) return;
    const t = this.t;
    [880, 1108, 1318, 1760].forEach((f, i) => this.tone('sine', f, t + i * 0.08, 0.5, 0.15, this.sfx));
  }

  cash() {
    if (!this.ctx) return;
    const t = this.t;
    this.tone('square', 1318, t, 0.08, 0.06, this.sfx, { lp: 5000 });
    this.tone('square', 1760, t + 0.07, 0.25, 0.06, this.sfx, { lp: 5000 });
  }

  fail() {
    if (!this.ctx) return;
    const t = this.t;
    [392, 370, 349, 330].forEach((f, i) => this.tone('sawtooth', f, t + i * 0.3, i === 3 ? 0.9 : 0.28, 0.1, this.sfx, { lp: 1500, vib: i === 3 ? [6, 8] : null }));
  }

  // "Dramatic zoom" sting: three dhol hits + rising whoosh
  dramatic() {
    if (!this.ctx) return;
    const t = this.t;
    for (let i = 0; i < 3; i++) this.dholHit(t + i * 0.28, 0.9, this.memeBus);
    this.noiseBurst(t, 1.0, 0.25, this.memeBus, { f: 3000, type: 'bandpass', q: 1.5 });
  }

  dholHit(t, v = 1, dest) {
    this.tone('sine', 85, t, 0.4, 0.6 * v, dest || this.music, { fEnd: 45 });
    this.noiseBurst(t, 0.06, 0.25 * v, dest || this.music, { f: 2500, type: 'bandpass' });
  }

  // ---------- persistent: ambient city, engine, siren ----------
  setupAmbient() {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = 0.5;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350;
    const g = c.createGain(); g.gain.value = 0.35;
    s.connect(f); f.connect(g); g.connect(this.amb); s.start();
    const honkLoop = () => {
      if (!this.muted) this.horn(pick(['auto', 'auto', 'car', 'bike', 'bus', 'truck']), rand(0.08, 0.25), this.amb);
      this.ambTimer = setTimeout(honkLoop, rand(700, 3200));
    };
    honkLoop();
  }

  setupEngine() {
    const c = this.ctx;
    this.engOsc = c.createOscillator(); this.engOsc.type = 'sawtooth'; this.engOsc.frequency.value = 50;
    this.engOsc2 = c.createOscillator(); this.engOsc2.type = 'square'; this.engOsc2.frequency.value = 25;
    const g2 = c.createGain(); g2.gain.value = 0.5;
    this.engFilter = c.createBiquadFilter(); this.engFilter.type = 'lowpass'; this.engFilter.frequency.value = 700;
    this.engAM = c.createGain(); this.engAM.gain.value = 0.7;
    this.engLfo = c.createOscillator(); this.engLfo.frequency.value = 9;
    this.engLfoGain = c.createGain(); this.engLfoGain.gain.value = 0.0;
    this.engLfo.connect(this.engLfoGain); this.engLfoGain.connect(this.engAM.gain);
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter); this.engOsc2.connect(g2); g2.connect(this.engFilter);
    this.engFilter.connect(this.engAM); this.engAM.connect(this.engGain); this.engGain.connect(this.sfx);
    this.engOsc.start(); this.engOsc2.start(); this.engLfo.start();
  }

  setEngine(kind, frac, on) {
    if (!this.ctx) return;
    const t = this.t;
    const base = { auto: 34, car: 48, bus: 30, bike: 42, boat: 28, speedboat: 52, jetski: 62 }[kind] || 45;
    const f = base * (1 + clamp(frac, 0, 1.2) * 2.4);
    this.engOsc.frequency.setTargetAtTime(f, t, 0.08);
    this.engOsc2.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.engLfo.frequency.setTargetAtTime(kind === 'auto' ? f / 3.5 : f / 2.2, t, 0.1);
    this.engLfoGain.gain.setTargetAtTime(kind === 'auto' || kind === 'bike' || kind === 'boat' ? 0.55 : 0.15, t, 0.1);
    this.engGain.gain.setTargetAtTime(on ? 0.06 + 0.05 * clamp(frac, 0, 1) : 0, t, 0.12);
  }

  setupSiren() {
    const c = this.ctx;
    this.sirenOsc = c.createOscillator(); this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 820;
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.6;
    const lg = c.createGain(); lg.gain.value = 140;
    lfo.connect(lg); lg.connect(this.sirenOsc.frequency);
    this.sirenGain = c.createGain(); this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.sfx);
    this.sirenOsc.start(); lfo.start();
  }

  setSiren(vol) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(clamp(vol, 0, 1) * 0.09, this.t, 0.2);
  }

  // ---------- voices (TTS) and custom meme pack ----------
  pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const v = speechSynthesis.getVoices();
    this.voiceHi = v.find((x) => x.lang && x.lang.toLowerCase().startsWith('hi')) || null;
    this.voiceEn = v.find((x) => x.lang && x.lang.toLowerCase() === 'en-in') || v.find((x) => x.lang && x.lang.startsWith('en')) || null;
  }

  say(line, priority = false) {
    if (!('speechSynthesis' in window) || this.muted) return;
    if (speechSynthesis.speaking) { if (!priority) return; speechSynthesis.cancel(); }
    const useHi = this.voiceHi && line.hi;
    const u = new SpeechSynthesisUtterance(useHi ? line.hi : line.en);
    u.voice = useHi ? this.voiceHi : this.voiceEn;
    u.lang = useHi ? this.voiceHi.lang : (this.voiceEn ? this.voiceEn.lang : 'en-IN');
    u.rate = line.rate || 1.05;
    u.pitch = line.pitch || 1;
    u.volume = 1;
    speechSynthesis.speak(u);
  }

  async loadPack() {
    try {
      const res = await fetch('sounds/manifest.json', { cache: 'no-store' });
      if (!res.ok) return;
      const man = await res.json();
      const load = async (file) => {
        try {
          const r = await fetch('sounds/' + file);
          if (!r.ok) return null;
          return await this.ctx.decodeAudioData(await r.arrayBuffer());
        } catch { return null; }
      };
      for (const [ev, files] of Object.entries(man.events || {})) {
        const bufs = (await Promise.all((files || []).map(load))).filter(Boolean);
        if (bufs.length) this.custom[ev] = bufs;
      }
      for (const item of man.soundboard || []) {
        const b = await load(item.file);
        if (b) this.board.push({ key: String(item.key), label: item.label || item.file, buffer: b });
      }
      this.packInfo = `${Object.keys(this.custom).length} events, ${this.board.length} soundboard clips`;
    } catch { /* no pack - fine */ }
  }

  playBuffer(buf, dest, vol = 1) {
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(dest || this.memeBus); s.start();
    return s;
  }

  // Plays a user-supplied clip for this event if one exists. Returns true if played.
  playEvent(ev) {
    if (!this.ctx || this.muted) return false;
    const bufs = this.custom[ev];
    if (!bufs || !bufs.length) return false;
    if (this.memeSrc && this.memeEnd > this.t && ev !== 'crash_sfx') return true; // don't stack meme clips
    const b = pick(bufs);
    this.memeSrc = this.playBuffer(b);
    this.memeEnd = this.t + b.duration;
    return true;
  }

  boardClip(key) {
    return this.board.find((b) => b.key === key);
  }

  // ---------- weapons ----------
  gun(kind = 'pistol', vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    const t = this.t;
    if (kind === 'shotgun') {
      this.noiseBurst(t, 0.55, 1.0 * vol, this.sfx, { f: 1400 });
      this.tone('sine', 110, t, 0.4, 0.8 * vol, this.sfx, { fEnd: 35 });
      this.noiseBurst(t + 0.35, 0.12, 0.15 * vol, this.sfx, { f: 3000, type: 'bandpass' }); // pump
    } else if (kind === 'rifle') {
      this.noiseBurst(t, 0.16, 0.7 * vol, this.sfx, { f: 2600 });
      this.tone('square', 150, t, 0.1, 0.35 * vol, this.sfx, { fEnd: 60, lp: 900 });
    } else {
      this.noiseBurst(t, 0.25, 0.75 * vol, this.sfx, { f: 2000 });
      this.noiseBurst(t, 0.05, 0.4 * vol, this.sfx, { f: 6000, type: 'highpass' });
      this.tone('sine', 160, t, 0.18, 0.5 * vol, this.sfx, { fEnd: 50 });
    }
  }

  punch() {
    if (!this.ctx) return;
    const t = this.t;
    this.tone('sine', 140, t, 0.15, 0.7, this.sfx, { fEnd: 55 });
    this.noiseBurst(t, 0.08, 0.35, this.sfx, { f: 1200 });
  }

  click() {
    if (!this.ctx) return;
    this.tone('square', 1800, this.t, 0.03, 0.06, this.sfx, { lp: 4000 });
  }

  thunder() {
    if (!this.ctx) return;
    const t = this.t;
    this.noiseBurst(t, 3.5, 0.9, this.sfx, { f: 180, rate: 0.4 });
    this.noiseBurst(t, 0.4, 0.5, this.sfx, { f: 900 });
  }

  setupLoops() {
    const c = this.ctx;
    // rain: filtered noise
    const rs = c.createBufferSource(); rs.buffer = this.noise; rs.loop = true;
    const rf = c.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1200;
    this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
    rs.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(this.sfx); rs.start();
    // helicopter: amplitude-modulated low noise (wop-wop)
    const hs = c.createBufferSource(); hs.buffer = this.noise; hs.loop = true; hs.playbackRate.value = 0.3;
    const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 300;
    const am = c.createGain(); am.gain.value = 0.5;
    const lfo = c.createOscillator(); lfo.frequency.value = 17; const lg = c.createGain(); lg.gain.value = 0.5;
    lfo.connect(lg); lg.connect(am.gain); lfo.start();
    this.heliGain = c.createGain(); this.heliGain.gain.value = 0;
    hs.connect(hf); hf.connect(am); am.connect(this.heliGain); this.heliGain.connect(this.sfx); hs.start();
  }

  setSea(v) {
    if (!this.ctx) return;
    if (!this.seaGain) {
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = 0.35;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      const swell = c.createGain(); swell.gain.value = 0.5;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.12; const lg = c.createGain(); lg.gain.value = 0.45;
      lfo.connect(lg); lg.connect(swell.gain); lfo.start();
      this.seaGain = c.createGain(); this.seaGain.gain.value = 0;
      s.connect(f); f.connect(swell); swell.connect(this.seaGain); this.seaGain.connect(this.amb); s.start();
    }
    this.seaGain.gain.setTargetAtTime(clamp(v, 0, 1) * 1.2, this.t, 0.5);
  }

  splash(vol = 1) {
    if (!this.ctx) return;
    const t = this.t;
    this.noiseBurst(t, 0.9, 0.6 * vol, this.sfx, { f: 1800 });
    this.noiseBurst(t + 0.05, 0.4, 0.3 * vol, this.sfx, { f: 5000, type: 'highpass' });
  }

  setRain(r) { if (this.rainGain) this.rainGain.gain.setTargetAtTime(r * 0.18, this.t, 0.5); }
  setHeli(v) { if (this.heliGain) this.heliGain.gain.setTargetAtTime(clamp(v, 0, 1) * 0.9, this.t, 0.3); }

  // lower the radio while someone is talking
  duck(dur) {
    if (!this.ctx) return;
    const g = this.music.gain, t = this.t;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.09, t, 0.08);
    g.setTargetAtTime(0.3, t + dur, 0.4);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.t, 0.05);
    if (m && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  // ---------- RADIO (procedural, original music) ----------
  static STATIONS = ['Dhol Dhamaka FM 104.2', 'Raag Rasta 98.3', 'Retro Filmi 91.1', 'Radio Off'];

  setStation(i) {
    this.station = i % AudioSys.STATIONS.length;
    this.step = 0;
    this.motif = null;
    if (this.ctx) this.nextNote = this.t + 0.05;
    return AudioSys.STATIONS[this.station];
  }

  scheduleRadio() {
    if (!this.ctx || this.station === 3 || this.muted) return;
    const bpm = [148, 84, 112][this.station];
    const stepDur = 60 / bpm / 4;
    while (this.nextNote < this.t + 0.15) {
      if (this.nextNote < this.t - 0.2) this.nextNote = this.t; // tab was asleep
      [this.dholStep, this.raagStep, this.filmiStep][this.station].call(this, this.step, this.nextNote, stepDur);
      this.nextNote += stepDur;
      this.step++;
    }
  }

  newMotif(scale, density, len = 16) {
    const m = [];
    let deg = Math.floor(rand(0, scale.length));
    for (let i = 0; i < len; i++) {
      if (Math.random() < density) {
        deg = clamp(deg + pick([-2, -1, -1, 1, 1, 2, 0]), 0, scale.length - 1);
        m.push(scale[deg]);
      } else m.push(null);
    }
    return m;
  }

  dholStep(step, t, sd) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    if (!this.motif || (s === 0 && bar % 4 === 0)) this.motif = this.newMotif([0, 2, 4, 5, 7, 9, 10, 12, 14], 0.55);
    if ([0, 6, 10].includes(s)) this.dholHit(t, 0.9);
    if ([3, 8, 11, 14].includes(s)) this.tone('sine', 190, t, 0.12, 0.3, this.music, { fEnd: 120 });
    if (s % 2 === 1) this.noiseBurst(t, 0.04, 0.12, this.music, { f: 6000, type: 'highpass' });
    if (s === 4 || s === 12) this.noiseBurst(t, 0.1, 0.2, this.music, { f: 1800, type: 'bandpass', q: 2 }); // clap
    const n = this.motif[s];
    if (n !== null) this.tone('square', 587.3 * Math.pow(2, n / 12), t, 0.09, 0.07, this.music, { lp: 4000 }); // tumbi-ish
    if (s === 0 || s === 8) this.tone('triangle', 73.4 * (s === 8 && bar % 2 ? 1.5 : 1), t, sd * 6, 0.25, this.music);
  }

  pluck(freq, decay = 0.996, dur = 1.6) {
    const key = Math.round(freq) + '|' + decay;
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const sr = this.ctx.sampleRate;
    const N = Math.max(2, Math.round(sr / freq));
    const len = Math.floor(sr * dur);
    const buf = this.ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
    for (let i = N; i < len; i++) d[i] = decay * 0.5 * (d[i - N] + (i - N - 1 >= 0 ? d[i - N - 1] : 0));
    // a little sitar "jawari" buzz
    for (let i = 0; i < len; i++) d[i] = Math.tanh(d[i] * 1.8) * 0.7;
    this.ksCache.set(key, buf);
    return buf;
  }

  playPluck(freq, t, vol, decay, dur) {
    const s = this.ctx.createBufferSource(); s.buffer = this.pluck(freq, decay, dur);
    const g = this.ctx.createGain(); g.gain.value = vol;
    s.connect(g); g.connect(this.music); s.start(t);
  }

  raagStep(step, t, sd) {
    const SA = 277.18; // C#
    const s16 = step % 16;
    // tanpura cycle: Pa Sa' Sa' Sa every beat
    if (step % 4 === 0) {
      const beat = (step / 4) % 4;
      const f = [SA * 0.75, SA, SA, SA / 2][beat];
      this.playPluck(f / 2, t, 0.22, 0.9993, 3);
    }
    // tabla: teentaal-ish theka on beats
    if (step % 4 === 0) {
      const beat = (step / 4) % 16;
      const bol = ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'ta', 'ta', 'dhin', 'dhin', 'dha'][beat];
      if (bol.startsWith('dh')) this.tone('sine', 110, t, bol === 'dhin' ? 0.5 : 0.3, 0.35, this.music, { fEnd: 75 });
      this.tone('sine', bol === 'ta' || bol === 'tin' ? 740 : 620, t, 0.18, 0.12, this.music, { fEnd: bol === 'ta' ? 700 : undefined });
    }
    if (step % 2 === 0) {
      if (!this.motif || (s16 === 0 && Math.floor(step / 16) % 2 === 0)) this.motif = this.newMotif([0, 2, 4, 6, 7, 9, 11, 12, 14, 16], 0.6, 8);
      const n = this.motif[(step / 2) % 8];
      if (n !== null) this.playPluck(SA * Math.pow(2, n / 12), t, 0.3, 0.997, 1.4);
    }
  }

  filmiStep(step, t, sd) {
    const s = step % 16;
    const bar = Math.floor(step / 16);
    const chords = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]]; // Am F G E
    const ch = chords[bar % 4];
    const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    if (s === 0) ch.forEach((m) => this.tone('triangle', mtof(m), t, sd * 15, 0.05, this.music, { atk: 0.05, hold: 0.8 }));
    if (s % 4 === 0 || s === 6 || s === 14) this.tone('square', mtof(ch[0] - 24), t, sd * 1.5, 0.08, this.music, { lp: 600 });
    if (s === 0 || s === 8 || s === 10) this.tone('sine', 110, t, 0.2, 0.45, this.music, { fEnd: 45 });
    if (s === 4 || s === 12) this.noiseBurst(t, 0.15, 0.22, this.music, { f: 2000, type: 'bandpass' });
    if (s % 2 === 0) this.noiseBurst(t, 0.03, 0.07, this.music, { f: 7000, type: 'highpass' });
    if (s % 4 === 2) this.tone('sine', 420, t, 0.08, 0.1, this.music, { fEnd: 300 }); // bongo
    if (!this.motif || (s === 0 && bar % 8 === 0)) this.motif = this.newMotif([0, 2, 3, 5, 7, 8, 11, 12], 0.45);
    const n = this.motif[s];
    if (n !== null) this.tone('sine', mtof(69 + n), t, sd * 2.5, 0.09, this.music, { vib: [5.5, 6], atk: 0.03, hold: 0.6 });
  }
}
