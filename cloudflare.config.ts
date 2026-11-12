import { defineConfig } from 'cf/config';

// Assets-only Worker: serves the prebuilt game from dist/ (see `npm run deploy`).
export default defineConfig({
  worker: {
    name: 'nanodefenders',
    compatibilityDate: '2026-11-01',
    assets: { notFoundHandling: 'single-page-application' },
    domains: ['nanodefenders.play.maximebf.com'],
  },
});
