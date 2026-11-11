import { Sim } from '../src/sim/sim';
import { canPlace, geometry } from '../src/sim/grid';
import type { Card, Input, LevelDef, PlacedBot, Program, Setup, TurretKind } from '../src/sim/types';

/** A simulated child tapping the most advanced virus every `every` ticks. */
export function tapper(every: number) {
  return (tick: number, sim: Sim): Input[] => {
    if (tick % every !== 0) return [];
    const v = [...sim.viruses].filter((v) => v.alive).sort((a, b) => b.progress - a.progress)[0];
    return v ? [{ t: 'tap', virus: v.id }] : [];
  };
}

export function run(level: LevelDef, setup: Setup, inputs?: (tick: number, sim: Sim) => Input[]) {
  const sim = new Sim(level, setup);
  const r = sim.runToEnd(inputs);
  return { ...r, sim, lost: sim.cellsEverLost, killed: sim.totalViruses - sim.cellsEverLost };
}

/** Greedy placement: add turrets one at a time, each time keeping the tile/card that saves the most cells. */
export function greedy(level: LevelDef, n: number, cards: Card[] = ['nearest'], programs: Program[] = [], inputs?: (tick: number, sim: Sim) => Input[], kinds?: TurretKind[], start: PlacedBot[] = []) {
  const g = geometry(level);
  let bots: PlacedBot[] = [...start];
  for (let k = 0; k < n; k++) {
    const kind = kinds?.[k] ?? 'zappy';
    let best: { bots: PlacedBot[]; score: number } | null = null;
    for (let y = 0; y < g.h; y++)
      for (let x = 0; x < g.w; x++) {
        if (!canPlace(level, bots, x, y)) continue;
        for (const card of cards) {
          const cand = [...bots, { kind, x, y, card }];
          const r = run(level, { bots: cand, programs }, inputs);
          const score = r.healthy * 1000 + (r.won ? 500 : 0) + r.sim.popped * 10 + r.sim.tick / 10000;
          if (!best || score > best.score) best = { bots: cand, score };
        }
      }
    if (!best) break;
    bots = best.bots;
  }
  return { bots, ...run(level, { bots, programs }, inputs) };
}

/** Every combination of cards for the slots of a level. */
export function cardCombos(level: LevelDef): Card[][] {
  const cards = level.cards ?? ['nearest'];
  let out: Card[][] = [[]];
  for (let i = 0; i < (level.slots?.length ?? 0); i++) out = out.flatMap((c) => cards.map((k) => [...c, k]));
  return out;
}
