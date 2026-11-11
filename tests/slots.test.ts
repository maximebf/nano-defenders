import { describe, it } from 'vitest';
import { appendFileSync } from 'node:fs';
import { WORLDS } from '../src/levels';
import { cardCombos, run, tapper } from './helpers';

// Card-combination report for slot levels: BALANCE=/path npx vitest run tests/slots.test.ts
describe.runIf(process.env.BALANCE)('slot report', () => {
  for (const level of WORLDS[1].filter((l) => l.slots)) {
    it(level.id, () => {
      const all = cardCombos(level).map((cards) => {
        const r = run(level, { bots: [], programs: [], slotCards: cards });
        const t = run(level, { bots: [], programs: [], slotCards: cards }, tapper(15));
        const score = (r.won ? 100 : 0) + r.healthy * 10 + r.sim.popped / 100;
        return { score, nearest: cards.every((c) => c === 'nearest'), line: `${level.id} ${cards.map((c) => c[0]).join('')} -> ${r.won ? 'WIN ' : 'lose'} ${r.healthy}/${r.total} popped=${r.sim.popped}/${r.sim.totalViruses} | tap: ${t.won ? 'WIN ' : 'lose'} ${t.healthy}/${t.total}` };
      });
      all.sort((a, b) => b.score - a.score);
      const wins = all.filter((a) => a.score >= 100).length;
      const rows = [...all.slice(0, 4).map((a) => a.line), '   all-nearest: ' + all.find((a) => a.nearest)!.line, `   ${wins}/${all.length} combos win`];
      appendFileSync(process.env.BALANCE as string, rows.join('\n') + '\n');
    });
  }
});
