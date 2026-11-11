import { save } from '../save';
import lines from '../content/lines.json';

// All sound goes through one Web Audio context, unlocked by the first tap
// (required on iPad). Voice files are decoded and played through it too.

let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let voiceBus: GainNode;

export function audioCtx(): AudioContext | null {
  return ctx;
}

/** Call from a user gesture. */
export function unlockAudio(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.5;
    sfxBus.connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.16;
    musicBus.connect(master);
    voiceBus = ctx.createGain();
    voiceBus.gain.value = 1;
    voiceBus.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/* ---------------- sound effects (synthesised) ---------------- */

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, endFreq?: number, delay = 0) {
  if (!ctx || !save.settings.sound) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfxBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, from = 2000, to = 400, delay = 0) {
  if (!ctx || !save.settings.sound) return;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(sfxBus);
  src.start(t);
}

let lastZap = 0;
export const sfx = {
  tap: () => tone(660, 0.06, 'triangle', 0.25),
  place: () => {
    tone(523, 0.08, 'triangle', 0.35);
    tone(784, 0.1, 'triangle', 0.3, undefined, 0.06);
  },
  remove: () => tone(392, 0.12, 'triangle', 0.3, 260),
  zap: () => {
    if (!ctx) return;
    if (ctx.currentTime - lastZap < 0.04) return; // many turrets: do not stack
    lastZap = ctx.currentTime;
    tone(1400, 0.09, 'square', 0.12, 300);
  },
  ping: () => tone(2400, 0.12, 'triangle', 0.25, 2200),
  pop: () => {
    tone(500, 0.08, 'sine', 0.4, 1100);
    noise(0.05, 0.15, 3000, 1500);
  },
  infect: () => {
    tone(220, 0.3, 'sawtooth', 0.15, 140);
  },
  heal: () => {
    tone(660, 0.1, 'sine', 0.3);
    tone(880, 0.1, 'sine', 0.3, undefined, 0.08);
    tone(1320, 0.15, 'sine', 0.25, undefined, 0.16);
  },
  net: () => noise(0.25, 0.35, 800, 3000),
  catch: () => tone(330, 0.15, 'triangle', 0.3, 200),
  crack: () => {
    noise(0.12, 0.4, 4000, 1200);
    tone(900, 0.1, 'square', 0.15, 500);
  },
  bump: () => tone(140, 0.15, 'square', 0.2, 90),
  move: () => tone(392, 0.07, 'sine', 0.3),
  turn: () => tone(587, 0.06, 'triangle', 0.3),
  wait: () => tone(1046, 0.03, 'sine', 0.15),
  fever: () => {
    tone(300, 0.6, 'sine', 0.3, 600);
    tone(450, 0.6, 'sine', 0.2, 900, 0.05);
  },
  wave: () => {
    tone(523, 0.12, 'square', 0.12);
    tone(523, 0.12, 'square', 0.12, undefined, 0.18);
  },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.35, undefined, i * 0.12)),
  lose: () => [392, 370, 349, 330].forEach((f, i) => tone(f, 0.3, 'triangle', 0.25, undefined, i * 0.22)),
  star: (i: number) => tone(880 + i * 220, 0.2, 'triangle', 0.35),
  go: () => {
    tone(392, 0.1, 'square', 0.15);
    tone(784, 0.2, 'square', 0.15, undefined, 0.1);
  },
};

/* ---------------- music: a small generated loop per world ---------------- */

const SCALES: Record<number, number[]> = {
  0: [261.6, 293.7, 329.6, 392.0, 440.0], // menus: C pentatonic
  1: [293.7, 329.6, 370.0, 440.0, 493.9], // nose: D
  2: [246.9, 277.2, 311.1, 370.0, 415.3], // throat: B
  3: [220.0, 246.9, 277.2, 329.6, 370.0], // blood: A
};
let musicTimer: number | undefined;
let musicStep = 0;
let musicWorld = 0;
let musicLively = false;

export function playMusic(world: number, lively: boolean): void {
  musicWorld = world;
  musicLively = lively;
  if (musicTimer !== undefined) return;
  musicTimer = window.setInterval(musicTick, 125);
}

export function stopMusic(): void {
  clearInterval(musicTimer);
  musicTimer = undefined;
}

// a fixed melodic pattern (indices into the scale), -1 = rest
const PATTERN = [0, -1, 2, -1, 4, -1, 2, -1, 3, -1, 1, -1, 2, -1, -1, -1, 0, -1, 2, -1, 4, -1, 3, 4, 2, -1, 1, -1, 0, -1, -1, -1];
const BASS = [0, 0, 3, 3, 2, 2, 4, 4];

function musicTick() {
  if (!ctx || !save.settings.music || ctx.state !== 'running') return;
  const scale = SCALES[musicWorld] ?? SCALES[0];
  const step = musicStep++;
  const every = musicLively ? 1 : 2;
  if (step % every !== 0) return;
  const s = (step / every) % PATTERN.length;
  const t = ctx.currentTime;
  const n = PATTERN[s];
  if (n >= 0) musicNote(scale[n] * (musicLively ? 2 : 1), musicLively ? 0.18 : 0.35, 'triangle', 0.5, t);
  if (s % 4 === 0) musicNote(scale[BASS[(s / 4) % BASS.length]] / 2, musicLively ? 0.4 : 0.8, 'sine', 0.8, t);
}

function musicNote(freq: number, dur: number, type: OscillatorType, vol: number, t: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/* ---------------- voice: pre-generated files, browser voice as fallback ---------------- */

export type LineId = keyof typeof lines;
export function text(id: string): string {
  return (lines as Record<string, string>)[id] ?? id;
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();
let current: AudioBufferSourceNode | null = null;
let queueToken = 0;

function loadVoice(id: string): Promise<AudioBuffer | null> {
  let p = buffers.get(id);
  if (!p) {
    p = fetch(`assets/voice/${id}.mp3`)
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('audio') ? r.arrayBuffer() : Promise.reject(new Error('no file'))))
      .then((b) => ctx!.decodeAudioData(b))
      .catch(() => null);
    buffers.set(id, p);
  }
  return p;
}

export function preloadVoice(ids: string[]): void {
  if (!ctx) return;
  ids.forEach((id) => void loadVoice(id));
}

export function stopVoice(): void {
  queueToken++;
  if (current) {
    try {
      current.stop();
    } catch {
      /* already stopped */
    }
    current = null;
  }
  window.speechSynthesis?.cancel();
}

/** Says one line. Resolves when it is finished (or skipped). */
async function sayOne(id: string, token: number): Promise<void> {
  if (!save.settings.voice || !ctx || token !== queueToken) return;
  const buf = await loadVoice(id);
  if (token !== queueToken) return;
  if (buf) {
    await new Promise<void>((resolve) => {
      const src = ctx!.createBufferSource();
      src.buffer = buf;
      src.connect(voiceBus);
      src.onended = () => resolve();
      current = src;
      src.start();
    });
    return;
  }
  const synth = window.speechSynthesis;
  if (!synth) return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text(id));
    u.lang = 'fr-FR';
    u.rate = 0.95;
    u.pitch = 1.2;
    const fr = synth.getVoices().find((v) => v.lang.startsWith('fr'));
    if (fr) u.voice = fr;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

/** Says lines one after another; calls onLine before each one (to show its text). */
export async function say(ids: string[], onLine?: (id: string, index: number) => void): Promise<void> {
  stopVoice();
  const token = queueToken;
  for (let i = 0; i < ids.length; i++) {
    if (token !== queueToken) return;
    onLine?.(ids[i], i);
    await sayOne(ids[i], token);
    if (token !== queueToken) return;
    await new Promise((r) => setTimeout(r, save.settings.voice ? 250 : 0));
  }
}
