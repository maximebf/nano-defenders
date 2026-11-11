// Generates game art with Gemini, then cuts out the flat background.
//   node scripts/gen-images.mjs              -> generate every missing image
//   node scripts/gen-images.mjs snifflet     -> only these keys
//   node scripts/gen-images.mjs --process    -> only re-run background removal on cached raws
// Raw model outputs are cached in assets-src/raw/ (git-ignored) so nothing is paid for twice.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const RAW = join(ROOT, 'assets-src/raw');
const OUT = join(ROOT, 'public/assets/img');
mkdirSync(RAW, { recursive: true });
mkdirSync(OUT, { recursive: true });

const MODEL = 'gemini-3.1-flash-image';
const STYLE =
  'Cute 2D cartoon sprite for a game for 7-year-old children. Bold rounded shapes, thick dark navy-blue outline, ' +
  'soft cel shading with one highlight, bright saturated colours, big expressive goofy eyes, friendly and funny, never scary. ' +
  'Single character, centred, whole body visible with generous empty margin around it, front three-quarter view. ' +
  'No text, no letters, no ground shadow, no scenery.';
const GREEN = 'The background must be one perfectly flat, uniform pure green colour (#00FF00) with no gradient, no texture and no shadow.';
const MAGENTA = 'The background must be one perfectly flat, uniform pure magenta colour (#FF00FF) with no gradient, no texture and no shadow.';

/** key -> [prompt, background, output size] */
const ASSETS = {
  snifflet: ['A small round lime-green virus blob with short stubby spikes ending in little balls, a runny nose, sleepy half-closed goofy eyes and a silly grin. It looks slow and clumsy.', 'magenta', 256],
  zoomer: ['A small purple teardrop-shaped virus that looks very fast: streamlined body leaning forward, speed swoosh lines behind it, wide excited eyes, tongue sticking out. A few short spikes on its back.', 'green', 256],
  shellby: ['A chubby orange-yellow virus wearing a hard grey-blue turtle-like armoured shell helmet on its back and head, little spikes poking out, smug confident face with tiny eyes.', 'green', 256],
  shellbyBare: ['The same chubby orange-yellow virus but its armour shell is gone, it looks surprised and embarrassed, little spikes, arms covering itself.', 'green', 256],
  bigSnifflet: ['A big fat lime-green virus blob, much bigger and rounder than a normal one, many stubby spikes ending in balls, a huge runny nose, a tiny crown, a boastful grumpy goofy face.', 'magenta', 256],
  zappy: ['A tiny friendly white and cyan robot turret on a round base, with a small lightning-rod antenna on top that glows cyan, and a little screen face showing happy eyes.', 'magenta', 256],
  netter: ['A tiny friendly white and cyan robot on a round base holding a small launcher with a folded orange net, and a little screen face showing focused eyes.', 'magenta', 256],
  scout: ['A tiny friendly white and cyan robot on two small wheels, rounded square body, a little screen face showing curious eyes, one small antenna, seen from the front.', 'magenta', 256],
  pixel: ['A small friendly floating mentor robot, round head with a big screen face showing a big smile, white and cyan body, tiny propeller on top, waving hello with one hand.', 'magenta', 512],
  cell: ['A happy round pink-red body cell, soft and squishy, with a darker pink nucleus in the middle, rosy cheeks and a big content smile.', 'green', 256],
  cellSick: ['A round body cell that has turned pale greenish with purple spots, feeling a bit grumpy and sneezy with a thermometer in its mouth. Funny, not scary.', 'magenta', 256],
};

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const env = readFileSync(join(ROOT, '.env'), 'utf8');
  const m = env.match(/^GEMINI_API_KEY=(.*)$/m);
  if (!m) throw new Error('GEMINI_API_KEY missing in .env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

async function generate(key, prompt, bg, reference) {
  const parts = [];
  if (reference) {
    const buf = readFileSync(reference);
    const mimeType = buf[0] === 0xff && buf[1] === 0xd8 ? 'image/jpeg' : 'image/png';
    parts.push({ inlineData: { mimeType, data: buf.toString('base64') } });
    parts.push({ text: 'Use exactly the same art style, outline thickness, shading and colour palette as this reference image, but draw a different character:' });
  }
  parts.push({ text: `${STYLE}\n\nCharacter: ${prompt}\n\n${bg === 'green' ? GREEN : MAGENTA}` });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' } },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json.error ?? json).slice(0, 400));
  const img = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!img) throw new Error('no image in response: ' + JSON.stringify(json).slice(0, 400));
  return Buffer.from(img.data, 'base64');
}

/** Flood-fills the background from the borders and makes it transparent, with soft edges. */
async function cutout(rawPath, outPath, bg, size) {
  const { data, info } = await sharp(rawPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const key = bg === 'green' ? [0, 255, 0] : [255, 0, 255];
  // sample the real background colour from the corners (models drift a little)
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]]);
  const ref = corners.reduce((a, c) => a.map((v, k) => v + c[k] / 4), [0, 0, 0]);
  const dist = (i) => Math.hypot(data[i * 4] - ref[0], data[i * 4 + 1] - ref[1], data[i * 4 + 2] - ref[2]);
  const HARD = 90; // below: background
  const SOFT = 150; // between: partially transparent edge
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (seen[i]) continue;
    const d = dist(i);
    if (d > SOFT) continue;
    seen[i] = 1;
    data[i * 4 + 3] = d < HARD ? 0 : Math.round((255 * (d - HARD)) / (SOFT - HARD));
    if (d >= HARD) continue; // edge pixel: do not spread further
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  // despill: pull the key colour out of semi-transparent edge pixels
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a === 0 || a === 255) continue;
    if (bg === 'green') data[i * 4 + 1] = Math.min(data[i * 4 + 1], Math.max(data[i * 4], data[i * 4 + 2]));
    else {
      const m = data[i * 4 + 1];
      data[i * 4] = Math.min(data[i * 4], m + 40);
      data[i * 4 + 2] = Math.min(data[i * 4 + 2], m + 40);
    }
  }
  void key;
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: false })
    .toFile(outPath);
}

const args = process.argv.slice(2);
const processOnly = args.includes('--process');
const only = args.filter((a) => !a.startsWith('--'));
const keys = only.length ? only : Object.keys(ASSETS);
const apiKey = processOnly ? null : loadKey();
const reference = existsSync(join(RAW, 'snifflet.png')) ? join(RAW, 'snifflet.png') : null;

for (const k of keys) {
  const [prompt, bg, size] = ASSETS[k] ?? [];
  if (!prompt) {
    console.error(`unknown asset ${k}`);
    continue;
  }
  const raw = join(RAW, `${k}.png`);
  if (!existsSync(raw)) {
    if (processOnly) continue;
    process.stdout.write(`generating ${k}... `);
    const buf = await generate(apiKey, prompt, bg, k === 'snifflet' ? null : reference);
    writeFileSync(raw, buf);
    console.log('ok');
  }
  await cutout(raw, join(OUT, `${k}.png`), bg, size);
  console.log(`processed ${k}`);
}
