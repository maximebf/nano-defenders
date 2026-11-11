import { describe, it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { WORLDS } from '../src/levels';
import { geometry, canPlace } from '../src/sim/grid';
import { run, tapper } from './helpers';
import type { PlacedBot } from '../src/sim/types';

// "Random child" report: random placements near the path. BALANCE=/path npx vitest run tests/kid.test.ts
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
}
describe.runIf(process.env.BALANCE)('kid report', () => {
  for (const level of [...WORLDS[0], ...WORLDS[1]].filter((l) => (l.bots.zappy ?? 0) > 0)) {
    it(level.id, () => {
      const g = geometry(level);
      const near: [number, number][] = [];
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++)
          if (canPlace(level, [], x, y) && g.paths.some((p) => p.some(([px, py]) => Math.hypot(px - x, py - y) <= 2))) near.push([x, y]);
      const R = rng(42);
      const n = level.bots.zappy!;
      const stats = { win: 0, full: 0, winTap: 0, fullTap: 0 };
      const N = 40;
      for (let i = 0; i < N; i++) {
        const bots: PlacedBot[] = [];
        while (bots.length < n) {
          const [x, y] = near[Math.floor(R() * near.length)];
          if (canPlace(level, bots, x, y)) bots.push({ kind: 'zappy', x, y, card: 'nearest' });
        }
        const a = run(level, { bots, programs: [] });
        const b = run(level, { bots, programs: [] }, tapper(20));
        stats.win += +a.won;
        stats.full += +(a.healthy === a.total);
        stats.winTap += +b.won;
        stats.fullTap += +(b.healthy === b.total);
      }
      const pc = (k: number) => `${Math.round((100 * k) / N)}%`;
      appendFileSync(process.env.BALANCE as string, `${level.id} random ${n} bots: win ${pc(stats.win)} full ${pc(stats.full)} | with taps: win ${pc(stats.winTap)} full ${pc(stats.fullTap)}\n`);
    });
  }
});
