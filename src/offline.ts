/**
 * Offline install: downloads every game file listed in precache.json into Cache Storage
 * (the service worker then serves them), showing progress on a loading screen.
 * Only files that are missing or whose hash changed are downloaded, so updates are quick.
 */

const CACHE = 'nano-game'; // same name as in sw-template.js
const STATE = '__installed__'; // cache entry holding { url: hash } of what is stored
const COMPLETE = '__complete__'; // key in STATE, set once a full copy has been stored
const PARALLEL = 6;

interface FileEntry {
  url: string;
  hash: string;
  size: number;
}
interface Manifest {
  version: string;
  files: FileEntry[];
}

export interface Progress {
  done: number; // bytes
  total: number; // bytes
}

/** What is left to do before the game can run offline. */
export interface Plan {
  /** files to download (empty when everything is already stored) */
  todo: FileEntry[];
  /** true when no fresh file list could be fetched (offline) */
  offline: boolean;
  /** true when a complete copy of the game (maybe an older version) is already stored */
  installed: boolean;
  run(onProgress: (p: Progress) => void): Promise<void>;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function readState(cache: Cache): Promise<Record<string, string>> {
  try {
    const r = await cache.match(STATE);
    return r ? await r.json() : {};
  } catch {
    return {};
  }
}

function writeState(cache: Cache, state: Record<string, string>): Promise<void> {
  return cache.put(STATE, new Response(JSON.stringify(state), { headers: { 'content-type': 'application/json' } }));
}

/** True when the game runs as an installed app (home screen / desktop app), not in a browser tab. */
export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || !!(navigator as unknown as { standalone?: boolean }).standalone;
}

/** True when a copy of the game was already stored (by the installed app, which may share storage with the browser). */
export async function hasOfflineCopy(): Promise<boolean> {
  if (!('caches' in window)) return false;
  return !!(await readState(await caches.open(CACHE)))[COMPLETE];
}

export async function planOffline(): Promise<Plan | null> {
  if (!('caches' in window)) return null;
  const cache = await caches.open(CACHE);
  const state = await readState(cache);
  const installed = !!state[COMPLETE];

  let manifest: Manifest;
  try {
    const r = await withTimeout(fetch(`precache.json?t=${Date.now()}`, { cache: 'no-store' }), installed ? 4000 : 15000);
    if (!r.ok) throw new Error(String(r.status));
    manifest = await r.json();
  } catch {
    // offline: play with what is stored (if anything)
    return { todo: [], offline: true, installed, run: async () => {} };
  }

  const stored = new Set((await cache.keys()).map((req) => new URL(req.url).href));
  const abs = (u: string) => new URL(u, location.href).href;
  const todo = manifest.files.filter((f) => state[f.url] !== f.hash || !stored.has(abs(f.url)));
  // the page goes last: if the download stops halfway, the stored page still matches the stored scripts
  todo.sort((a, b) => Number(a.url === './') - Number(b.url === './'));

  const run = async (onProgress: (p: Progress) => void) => {
    const total = todo.reduce((s, f) => s + f.size, 0);
    let done = 0;
    let sinceSave = 0;
    onProgress({ done, total });
    const pages = todo.filter((f) => f.url === './');
    const rest = todo.filter((f) => f.url !== './');

    const download = async (f: FileEntry) => {
      let lastErr: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await withTimeout(fetch(`${f.url}${f.url.includes('?') ? '&' : '?'}v=${f.hash}`, { cache: 'reload' }), 30000);
          if (!r.ok) throw new Error(`${f.url}: ${r.status}`);
          const body = await r.blob();
          await cache.put(abs(f.url), new Response(body, { headers: { 'content-type': r.headers.get('content-type') ?? '' } }));
          state[f.url] = f.hash;
          done += f.size;
          onProgress({ done, total });
          if (++sinceSave >= 10) {
            sinceSave = 0;
            await writeState(cache, state);
          }
          return;
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr;
    };

    try {
      const queue = [...rest];
      await Promise.all(
        Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
          for (let f = queue.shift(); f; f = queue.shift()) await download(f);
        }),
      );
      for (const f of pages) await download(f);
    } finally {
      await writeState(cache, state);
    }

    // forget files that are no longer part of the game
    const keep = new Set(manifest.files.map((f) => abs(f.url)));
    for (const req of await cache.keys()) {
      if (new URL(req.url).pathname.endsWith(STATE)) continue;
      if (!keep.has(new URL(req.url).href)) await cache.delete(req);
    }
    for (const url of Object.keys(state)) if (url !== COMPLETE && !manifest.files.some((f) => f.url === url)) delete state[url];
    state[COMPLETE] = manifest.version;
    await writeState(cache, state);
  };

  return { todo, offline: false, installed, run };
}
