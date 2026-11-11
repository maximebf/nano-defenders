import { describe, it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { WORLDS } from '../src/levels';
import { greedy, tapper } from './helpers';
import type { Card } from '../src/sim/types';

// Run with: BALANCE=/path/to/report.txt npx vitest run tests/balance.test.ts
const ONLY = process.env.ONLY?.split(',');
describe.runIf(process.env.BALANCE)('balance report', () => {
  for (const level of WORLDS[0].concat(WORLDS[1])) {
    if (ONLY && !ONLY.includes(level.id)) continue;
    it(level.id, () => {
      const n = level.bots.zappy ?? 0;
      const all = level.cards ?? ['nearest'];
      const variants: [number, Card[], number][] = [];
      for (const k of [n - 2, n - 1, n]) {
        variants.push([k, ['nearest'], 0]);
        if (all.length > 1) variants.push([k, all, 0]);
      }
      variants.push([n - 2, ['nearest'], 15]);
      const lines = variants.map(([k, cards, tap]) => {
        const r = greedy(level, k, cards, [], tap ? tapper(tap) : undefined);
        return `${level.id} bots=${k} cards=${cards.map((c) => c[0]).join('')} tap=${tap} -> ${r.won ? 'WIN ' : 'lose'} healthy=${r.healthy}/${r.total} popped=${r.sim.popped}/${r.sim.totalViruses} [${r.bots.map((b) => `${b.x},${b.y}${b.card[0]}`).join(' ')}]`;
      });
      appendFileSync(process.env.BALANCE as string, lines.join('\n') + '\n');
    }, 600_000);
  }
});
