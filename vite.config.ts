import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Writes dist/sw.js with the list of every built file, so the game works offline once installed. */
function serviceWorker(): Plugin {
  return {
    name: 'nano-sw',
    apply: 'build',
    closeBundle() {
      const dist = join(__dirname, 'dist');
      const files: string[] = [];
      const walk = (dir: string) => {
        for (const f of readdirSync(dir)) {
          const p = join(dir, f);
          if (statSync(p).isDirectory()) walk(p);
          else if (f !== 'sw.js') files.push(relative(dist, p).split('\\').join('/'));
        }
      };
      walk(dist);
      const hash = createHash('sha1');
      for (const f of files.sort()) hash.update(f).update(readFileSync(join(dist, f)));
      const version = hash.digest('hex').slice(0, 10);
      const template = readFileSync(join(__dirname, 'src/sw-template.js'), 'utf8');
      writeFileSync(join(dist, 'sw.js'), template.replace('__VERSION__', version).replace('__FILES__', JSON.stringify(['./', ...files])));
    },
  };
}

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  plugins: [serviceWorker()],
  test: { include: ['tests/**/*.test.ts'] },
} as any);
