// Generates Pixel's French voice lines with Gemini TTS, as MP3 files.
//   node scripts/gen-voice.mjs            -> every missing or changed line
//   node scripts/gen-voice.mjs hello      -> only these ids (regenerated)
// A manifest remembers the text of each generated line, so only changed lines are paid for again.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

// lamejs' CommonJS build is broken ("MPEGMode is not defined"); its bundled browser build works.
const lameCtx = {};
vm.createContext(lameCtx);
vm.runInContext(readFileSync(new URL('../node_modules/lamejs/lame.all.js', import.meta.url), 'utf8') + ';this.lamejs = lamejs;', lameCtx);
const lamejs = lameCtx.lamejs;

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'public/assets/voice');
const MANIFEST = join(ROOT, 'assets-src/voice-manifest.json');
const RAW = join(ROOT, 'assets-src/raw/voice'); // raw PCM cache (git-ignored)
mkdirSync(OUT, { recursive: true });
mkdirSync(RAW, { recursive: true });

const MODEL = 'gemini-2.5-flash-preview-tts'; // natural pace; gemini-3.8-flash-tts spoke about twice as slowly
const VOICE = 'Puck';
const STYLE = 'Dis joyeusement, comme un gentil petit robot qui parle à un enfant :';

const lines = JSON.parse(readFileSync(join(ROOT, 'src/content/lines.json'), 'utf8'));
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const m = readFileSync(join(ROOT, '.env'), 'utf8').match(/^GEMINI_API_KEY=(.*)$/m);
  if (!m) throw new Error('GEMINI_API_KEY missing in .env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function tts(key, text) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${STYLE}\n\n${text}` }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
        },
      }),
    });
    const json = await res.json();
    if (res.ok) {
      const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (part) return { pcm: Buffer.from(part.inlineData.data, 'base64'), mime: part.inlineData.mimeType };
      console.warn('no audio, retrying:', JSON.stringify(json).slice(0, 200));
    } else if (res.status === 429 || res.status >= 500) {
      console.warn(`HTTP ${res.status}, waiting before retry ${attempt}`);
      await new Promise((r) => setTimeout(r, 15000 * attempt));
    } else throw new Error(JSON.stringify(json.error ?? json).slice(0, 400));
  }
  throw new Error('TTS failed after 3 attempts');
}

/** 16-bit little-endian mono PCM -> MP3 (64 kbps). Trims silence at both ends. */
function toMp3(pcm, sampleRate) {
  if (pcm.subarray(0, 4).toString() === 'RIFF') {
    // WAV container: read the rate and skip to the data chunk
    sampleRate = pcm.readUInt32LE(24);
    let i = 12;
    while (i < pcm.length - 8 && pcm.subarray(i, i + 4).toString() !== 'data') i += 8 + pcm.readUInt32LE(i + 4);
    pcm = pcm.subarray(i + 8);
  }
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  let a = 0;
  let b = samples.length - 1;
  while (a < b && Math.abs(samples[a]) < 300) a++;
  while (b > a && Math.abs(samples[b]) < 300) b--;
  const pad = Math.floor(sampleRate * 0.08);
  const trimmed = samples.subarray(Math.max(0, a - pad), Math.min(samples.length, b + pad));
  const enc = new lamejs.Mp3Encoder(1, sampleRate, 64);
  const chunks = [];
  for (let i = 0; i < trimmed.length; i += 1152) {
    const out = enc.encodeBuffer(trimmed.subarray(i, i + 1152));
    if (out.length) chunks.push(Buffer.from(out));
  }
  const end = enc.flush();
  if (end.length) chunks.push(Buffer.from(end));
  return { mp3: Buffer.concat(chunks), seconds: trimmed.length / sampleRate };
}

const only = process.argv.slice(2);
const todo = Object.entries(lines).filter(([id, text]) =>
  only.length ? only.includes(id) : manifest[id] !== text || !existsSync(join(OUT, `${id}.mp3`)),
);
console.log(`${todo.length} line(s) to generate`);
const key = todo.length ? loadKey() : null;

let total = 0;
const CONCURRENCY = 2;
let next = 0;
async function worker() {
  while (next < todo.length) {
    const [id, text] = todo[next++];
    const rawFile = join(RAW, `${id}.json`);
    let cached = existsSync(rawFile) ? JSON.parse(readFileSync(rawFile, 'utf8')) : null;
    if (!cached || cached.text !== text) {
      const { pcm, mime } = await tts(key, text);
      cached = { text, mime, pcm: pcm.toString('base64') };
      writeFileSync(rawFile, JSON.stringify(cached));
    }
    const pcm = Buffer.from(cached.pcm, 'base64');
    const rate = Number(/rate=(\d+)/.exec(cached.mime ?? '')?.[1] ?? 24000);
    const { mp3, seconds } = toMp3(pcm, rate);
    writeFileSync(join(OUT, `${id}.mp3`), mp3);
    manifest[id] = text;
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
    total += seconds;
    console.log(`${id}: ${seconds.toFixed(1)}s`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`done, ${total.toFixed(0)} seconds of audio`);
