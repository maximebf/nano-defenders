import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Writes dist/precache.json (every built file with its hash and size) and dist/sw.js.
 * The loading screen downloads that list into Cache Storage so the game plays offline;
 * on updates only the files whose hash changed are downloaded again.
 */
function offlineManifest(): Plugin {
  return {
    name: 'nano-offline',
    apply: 'build',
    closeBundle() {
      const dist = join(__dirname, 'dist');
      // _headers is read by Cloudflare at deploy time and never served
      const skip = new Set(['sw.js', 'precache.json', '_headers']);
      const files: { url: string; hash: string; size: number }[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (!skip.has(f)) {
            const url = relative(dist, p).split('\\').join('/');
            const data = readFileSync(p);
            // the page itself is cached under './' (that is what a launch from the home screen asks for)
            files.push({ url: url === 'index.html' ? './' : url, hash: createHash('sha1').update(data).digest('hex').slice(0, 12), size: data.length });
          }
        }
      };
      walk(dist);
      files.sort((a, b) => a.url.localeCompare(b.url));
      const version = createHash('sha1').update(JSON.stringify(files)).digest('hex').slice(0, 10);
      writeFileSync(join(dist, 'precache.json'), JSON.stringify({ version, files }));
      writeFileSync(join(dist, 'sw.js'), readFileSync(join(__dirname, 'src/sw-template.js'), 'utf8'));
    },
  };
}

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  plugins: [offlineManifest()],
  test: { include: ['tests/**/*.test.ts'] },
} as any);
