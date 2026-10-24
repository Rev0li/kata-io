// Sons synthétisés en direct (WebAudio) : aucun fichier audio à charger.
let AC: AudioContext | null = null,
  NOISE: AudioBuffer | null = null;
export const audioPrefs = { sfx: true, music: true };
const listener = { x: 0, y: 0 };
export function setListener(x: number, y: number) {
  listener.x = x;
  listener.y = y;
}

export function initAudio() {
  if (AC) {
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    return;
  }
  try {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    AC = new Ctor();
    const b = AC!.createBuffer(1, (AC!.sampleRate * 0.6) | 0, AC!.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    NOISE = b;
  } catch (e) {
    AC = null;
  }
}
function tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
  const t = AC!.currentTime + delay;
  const o = AC!.createOscillator(),
    g = AC!.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  o.connect(g);
  g.connect(AC!.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}
function noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass', f1?: number) {
  const t = AC!.currentTime;
  const s = AC!.createBufferSource();
  s.buffer = NOISE;
  const f = AC!.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  f.Q.value = q;
  const g = AC!.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(AC!.destination);
  s.start(t);
  s.stop(t + dur + 0.02);
}
export function sfx(type: string, v = 1) {
  if (!AC || !audioPrefs.sfx || v <= 0.03 || AC.state !== 'running') return;
  try {
    switch (type) {
      case 'whoosh':
        noise(0.12, 1600, 0.9, 0.1 * v);
        break;
      case 'heavy':
        noise(0.22, 700, 0.7, 0.2 * v, 'bandpass', 2200);
        break;
      case 'hit':
        tone(180, 60, 0.15, 'sine', 0.42 * v);
        noise(0.06, 900, 1, 0.25 * v);
        break;
      case 'bighit':
        tone(130, 40, 0.3, 'sine', 0.6 * v);
        noise(0.14, 500, 0.8, 0.4 * v);
        break;
      case 'parry':
        tone(1300, 1900, 0.2, 'triangle', 0.2 * v);
        tone(2600, 2500, 0.32, 'sine', 0.07 * v);
        break;
      case 'perfect':
        tone(1500, 2200, 0.25, 'triangle', 0.22 * v);
        tone(3000, 3000, 0.5, 'sine', 0.08 * v, 0.05);
        break;
      case 'avoid':
        noise(0.2, 520, 0.6, 0.12 * v);
        break;
      case 'charge':
        tone(160, 420, 0.65, 'sawtooth', 0.04 * v);
        break;
      case 'splash':
        noise(0.5, 1800, 0.5, 0.35 * v, 'lowpass', 300);
        tone(600, 180, 0.12, 'sine', 0.12 * v, 0.05);
        tone(900, 300, 0.1, 'sine', 0.08 * v, 0.12);
        break;
      case 'thud':
        tone(95, 48, 0.2, 'sine', 0.4 * v);
        noise(0.12, 380, 0.8, 0.18 * v);
        break;
      case 'ui':
        tone(700, 920, 0.06, 'sine', 0.07);
        break;
      case 'hover':
        tone(1250, 1450, 0.035, 'sine', 0.025);
        break;
      case 'heart':
        tone(70, 42, 0.14, 'sine', 0.55 * v);
        tone(62, 38, 0.12, 'sine', 0.4 * v, 0.17);
        break;
      case 'coin':
        tone(988, 988, 0.07, 'square', 0.05 * v);
        tone(1319, 1319, 0.22, 'square', 0.05 * v, 0.07);
        break;
      case 'gong':
        tone(220, 210, 1.4, 'sine', 0.25 * v);
        tone(441, 430, 1, 'sine', 0.08 * v);
        break;
      case 'win':
        tone(523, 523, 0.18, 'triangle', 0.15);
        tone(659, 659, 0.18, 'triangle', 0.15, 0.15);
        tone(784, 784, 0.5, 'triangle', 0.15, 0.3);
        break;
      case 'lose':
        tone(392, 370, 0.3, 'triangle', 0.12);
        tone(311, 290, 0.6, 'triangle', 0.12, 0.25);
        break;
    }
  } catch (e) {
    /* ignore */
  }
}
export function sfxAt(type: string, x: number, y: number, v = 1) {
  const d = Math.hypot(x - listener.x, y - listener.y);
  sfx(type, v * Math.max(0.35, Math.min(1, 1 - d / 900)));
}

/* ---------- musique d'ambiance générée ---------- */
let music: any = null;
const PENTA = [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392, 440, 523.25];
let musicLevel = 0.07;
export function startMusic() {
  if (!AC || music) return;
  try {
    const m = AC.createGain();
    m.gain.value = 0;
    const c = AC.createDynamicsCompressor();
    m.connect(c);
    c.connect(AC.destination);
    music = { m, next: AC.currentTime + 0.3, step: 0, phrase: [] as number[] };
    setMusicLevel(musicLevel);
  } catch (e) {
    music = null;
  }
}
export function setMusicLevel(v: number) {
  musicLevel = v;
  if (!music || !AC) return;
  music.m.gain.setTargetAtTime(audioPrefs.music ? v : 0, AC.currentTime, 0.5);
}
function mPluck(t: number, f: number, v: number) {
  const o = AC!.createOscillator(),
    o2 = AC!.createOscillator(),
    g = AC!.createGain(),
    fl = AC!.createBiquadFilter();
  o.type = 'triangle';
  o2.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o2.frequency.setValueAtTime(f * 2.01, t);
  fl.type = 'lowpass';
  fl.frequency.setValueAtTime(f * 8, t);
  fl.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.6);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0006, t + 1.6);
  o.connect(fl);
  o2.connect(fl);
  fl.connect(g);
  g.connect(music.m);
  o.start(t);
  o2.start(t);
  o.stop(t + 1.7);
  o2.stop(t + 1.7);
}
function mDrum(t: number, v: number) {
  const o = AC!.createOscillator(),
    g = AC!.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(120, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.3);
  g.gain.setValueAtTime(v, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(g);
  g.connect(music.m);
  o.start(t);
  o.stop(t + 0.5);
}
function mDrone(t: number) {
  for (const f of [73.42, 110]) {
    const o = AC!.createOscillator(),
      g = AC!.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 4.7);
    o.connect(g);
    g.connect(music.m);
    o.start(t);
    o.stop(t + 4.8);
  }
}
export function musicTick() {
  if (!music || !AC || AC.state !== 'running') return;
  const now = AC.currentTime;
  if (music.next < now - 0.4) music.next = now + 0.05;
  while (music.next < now + 0.35) {
    const t = music.next,
      s = music.step++,
      bar = s % 16;
    if (s % 32 === 0 || !music.phrase.length)
      music.phrase = Array.from({ length: 8 }, (_, i) =>
        i === 0 || Math.random() < 0.55 ? PENTA[(Math.random() * PENTA.length) | 0] : 0,
      );
    if (bar === 0) mDrone(t);
    if (bar === 0 || bar === 10) mDrum(t, 0.7);
    if (bar === 6 || bar === 14) mDrum(t, 0.28);
    if (bar % 2 === 0) {
      const f = music.phrase[(bar / 2) | 0];
      if (f) mPluck(t, f, 0.3);
    }
    music.next += 0.3;
  }
}
