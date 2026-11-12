import { describe, expect, it } from 'vitest';
import { LEVELS, levelById, WORLDS } from '../src/levels';
import { geometry, tileAt } from '../src/sim/grid';
import { countBlocks } from '../src/sim/vm';
import { Sim } from '../src/sim/sim';
import type { Block, LevelDef, PlacedBot, Program } from '../src/sim/types';
import { cardCombos, greedy, run, tapper } from './helpers';

const P = (...blocks: (Block | Block[])[]): Program => ({ v: 1, blocks: blocks.flat() });
/** the editor has no counts: moving n tiles takes n move blocks */
const move = (n: number): Block[] => Array.from({ length: n }, () => ({ op: 'move', n: 1 }));
const net: Block = { op: 'net' };
const zap: Block = { op: 'zap' };
const left: Block = { op: 'turnLeft' };
const right: Block = { op: 'turnRight' };

describe('level data', () => {
  it('has 6 levels per world, ids in order', () => {
    expect(WORLDS.map((w) => w.length)).toEqual([6, 6, 6]);
    for (const w of WORLDS) w.forEach((l, i) => expect(l.id).toBe(`${l.world}-${i + 1}`));
  });

  for (const level of LEVELS) {
    it(`${level.id}: map and paths agree`, () => {
      const g = geometry(level);
      expect(level.map.length).toBe(10);
      for (const row of level.map) expect(row.length).toBe(16);
      for (let y = 0; y < g.h; y++)
        for (let x = 0; x < g.w; x++) {
          const drawn = level.map[y][x] === '=';
          const real = g.tiles[y][x] === 'path';
          expect(`${x},${y}:${drawn}`).toBe(`${x},${y}:${real}`);
        }
      for (const p of g.paths) {
        const [ex, ey] = p[p.length - 1];
        const touches = g.cells.some(([cx, cy]) => Math.abs(cx - ex) + Math.abs(cy - ey) === 1);
        expect(touches, `path end ${ex},${ey} touches a cell`).toBe(true);
      }
      for (const s of [...(level.scouts ?? []), ...(level.slots ?? []), ...(level.fixedBots ?? [])])
        expect(tileAt(g, s.x, s.y)).toBe('tissue');
      expect(g.cells.length).toBeGreaterThan(0);
    });
  }
});

/** Reference solutions: each must earn all 3 stars. Taps are only used where the level allows them. */
const placements: Record<string, PlacedBot[]> = {};
function td(level: LevelDef): { bots: PlacedBot[]; tap: boolean } {
  const n = level.star3.kind === 'maxBots' ? level.star3.n : (level.bots.zappy ?? 0);
  const tap = level.tapZap && level.star3.kind !== 'noTap';
  const r = greedy(level, n, level.cards ?? ['nearest'], [], tap ? tapper(20) : undefined);
  placements[level.id] = r.bots;
  return { bots: r.bots, tap };
}

describe('every level can be won with 3 stars', () => {
  for (const level of WORLDS[0].concat(WORLDS[1]).filter((l) => !l.slots)) {
    it(`${level.id} (placement)`, () => {
      const { bots, tap } = td(level);
      const r = run(level, { bots, programs: [] }, tap ? tapper(20) : undefined);
      expect(r.stars).toEqual([true, true, true]);
    }, 120_000);
  }

  for (const level of WORLDS[1].filter((l) => l.slots)) {
    it(`${level.id} (cards matter)`, () => {
      const results = cardCombos(level).map((cards) => ({ cards, r: run(level, { bots: [], programs: [], slotCards: cards }) }));
      expect(results.some(({ r }) => r.stars.every(Boolean))).toBe(true);
      const allNearest = results.find(({ cards }) => cards.every((c) => c === 'nearest'))!;
      expect(allNearest.r.stars[1]).toBe(false);
    });
  }

  const programs: Record<string, Program> = {
    '3-1': P(left, move(2), zap, zap),
    '3-2': P(net, zap, net, zap),
    '3-3': P(move(3), right, move(2), net, zap, net, zap),
    '3-5': P(move(1), net, zap, right, right, move(3), net, zap),
    '3-6': P(move(1), net, zap, net, zap, net, zap),
  };
  const bots: Record<string, PlacedBot[]> = {
    '3-4': [
      { kind: 'netter', x: 12, y: 6, card: 'nearest' },
      { kind: 'zappy', x: 8, y: 6, card: 'nearest' },
      { kind: 'zappy', x: 9, y: 7, card: 'nearest' },
    ],
    '3-6': [
      { kind: 'zappy', x: 3, y: 6, card: 'nearest' },
      { kind: 'zappy', x: 13, y: 6, card: 'nearest' },
    ],
  };
  for (const level of WORLDS[2]) {
    it(`${level.id} (program)`, () => {
      const prog = programs[level.id];
      if (prog) expect(countBlocks(prog.blocks)).toBeLessThanOrEqual(level.blockBudget!);
      const r = run(level, { bots: bots[level.id] ?? [], programs: prog ? [prog] : [] });
      expect(r.stars).toEqual([true, true, true]);
    });
  }
});

describe('the lessons hold', () => {
  it('3-1: doing nothing loses', () => {
    expect(run(levelById('3-1')!, { bots: [], programs: [P()] }).won).toBe(false);
  });
  it('3-2: zap before net does not save every cell', () => {
    const r = run(levelById('3-2')!, { bots: [], programs: [P(zap, net, zap, net)] });
    expect(r.stars[1]).toBe(false);
  });
  it('3-3: stopping one tile short loses', () => {
    const r = run(levelById('3-3')!, { bots: [], programs: [P(move(3), right, move(1), net, zap, net, zap)] });
    expect(r.won).toBe(false);
  });
  it('3-4: zappies alone cannot stop shellbys', () => {
    const r = run(levelById('3-4')!, {
      bots: [8, 9, 10].map((x) => ({ kind: 'zappy' as const, x, y: 6, card: 'nearest' as const })),
      programs: [],
    });
    expect(r.stars[1]).toBe(false);
  });
  it('3-6: the program is needed', () => {
    const r = run(levelById('3-6')!, { bots: bots36(), programs: [P()] });
    expect(r.won).toBe(false);
  });
});

function bots36(): PlacedBot[] {
  return [
    { kind: 'zappy', x: 3, y: 6, card: 'nearest' },
    { kind: 'zappy', x: 13, y: 6, card: 'nearest' },
    { kind: 'zappy', x: 8, y: 3, card: 'nearest' },
  ];
}

describe('simulation', () => {
  it('is deterministic', () => {
    const level = levelById('1-6')!;
    const setup = { bots: placements['1-6'] ?? [{ kind: 'zappy' as const, x: 5, y: 4, card: 'nearest' as const }], programs: [] };
    const a = new Sim(level, setup);
    const b = new Sim(level, setup);
    const tap = tapper(13);
    while (a.status === 'running') {
      const ia = tap(a.tick + 1, a);
      a.step(ia);
      b.step(ia);
      expect(b.viruses.map((v) => [v.id, v.hp, v.progress])).toEqual(a.viruses.map((v) => [v.id, v.hp, v.progress]));
    }
    expect(b.result()).toEqual(a.result());
  });

  it('scouts bump into walls without moving', () => {
    const level = levelById('3-3')!;
    const sim = new Sim(level, { bots: [], programs: [P(right, move(9))] });
    let bumps = 0;
    for (let i = 0; i < 60; i++) bumps += sim.step().filter((e) => e.t === 'bump').length;
    expect(bumps).toBeGreaterThan(0);
    expect(sim.scouts[0].x).toBe(9); // stopped by the cells at x=10
  });

  it('fever slows viruses and is limited', () => {
    const level = levelById('3-4')!;
    const sim = new Sim(level, { bots: [], programs: [] });
    for (let i = 0; i < 30; i++) sim.step();
    const v = sim.viruses[0];
    const before = v.progress;
    sim.step([{ t: 'fever' }]);
    expect(v.progress - before).toBeLessThan(0.05);
    for (let i = 0; i < 100; i++) sim.step([{ t: 'fever' }]);
    expect(sim.feverUsed).toBe(3);
  });
});
