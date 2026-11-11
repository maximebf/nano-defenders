import { BotVM, countBlocks, type ActionBlock } from './vm';
import { geometry, tileAt, type Geometry } from './grid';
import {
  BLOCK_TICKS,
  FEVER_SLOW,
  FEVER_TICKS,
  HEAL_COOLDOWN,
  HEAL_RANGE,
  MAX_TICKS,
  NET_HOLD_TICKS,
  NET_TRAP_TICKS,
  REGEN_DELAY,
  SCOUT_ZAP_DAMAGE,
  TAP_COOLDOWN,
  TAP_DAMAGE,
  TURRET,
  VIRUS,
  ZAPPY_DAMAGE,
} from './units';
import {
  DX,
  DY,
  TICKS_PER_SECOND,
  type BlockOp,
  type Card,
  type Dir,
  type Input,
  type LevelDef,
  type Setup,
  type SimEvent,
  type TurretKind,
  type VirusKind,
} from './types';

export interface Virus {
  id: number;
  kind: VirusKind;
  hp: number;
  maxHp: number;
  armoured: boolean;
  path: number;
  progress: number;
  held: number;
  /** tick of the last hit that did damage */
  lastHit: number;
  /** true while regenerating, for drawing */
  healing: boolean;
  /** position in tile units (tile centre = x + 0.5) */
  x: number;
  y: number;
  alive: boolean;
}

export interface Cell {
  x: number;
  y: number;
  healthy: boolean;
}

export interface Turret {
  kind: TurretKind;
  x: number;
  y: number;
  card: Card;
  cooldown: number;
  fixed: boolean;
}

type ScoutAction =
  | { op: 'move'; stepsLeft: number; t: number }
  | { op: 'turn'; t: number }
  | { op: 'wait'; t: number }
  | { op: 'zap'; t: number; fired: boolean }
  | { op: 'net'; t: number };

export interface Scout {
  index: number;
  x: number;
  y: number;
  dir: Dir;
  /** tile the scout is moving from, for smooth drawing */
  fromX: number;
  fromY: number;
  /** 0..1 progress of the current step */
  anim: number;
  vm: BotVM;
  action: ScoutAction | null;
  current: { op: BlockOp; path: number[] } | null;
  finished: boolean;
  /** true while a zap block waits for a virus in front */
  waiting: boolean;
}

export interface Trap {
  x: number;
  y: number;
  ticks: number;
}

interface Spawn {
  tick: number;
  kind: VirusKind;
  path: number;
  wave: number;
}

export type Status = 'running' | 'won' | 'lost';

export interface Result {
  won: boolean;
  stars: [boolean, boolean, boolean];
  healthy: number;
  total: number;
}

export class Sim {
  readonly level: LevelDef;
  readonly geo: Geometry;
  tick = 0;
  status: Status = 'running';
  viruses: Virus[] = [];
  cells: Cell[];
  turrets: Turret[];
  scouts: Scout[];
  traps: Trap[] = [];
  feverTicks = 0;
  feverLeft: number;
  tapCooldown = 0;
  tapsUsed = 0;
  feverUsed = 0;
  cellsEverLost = 0;
  popped = 0;
  wave = 0;
  readonly waveCount: number;
  readonly totalViruses: number;
  private spawns: Spawn[];
  private nextSpawn = 0;
  private nextVirusId = 1;
  private blocksUsed: number;

  constructor(level: LevelDef, setup: Setup) {
    this.level = level;
    this.geo = geometry(level);
    this.cells = this.geo.cells.map(([x, y]) => ({ x, y, healthy: true }));
    this.turrets = [
      ...(level.fixedBots ?? []).map((b) => ({
        kind: b.kind,
        x: b.x,
        y: b.y,
        card: b.card ?? 'nearest',
        cooldown: 0,
        fixed: true,
      })),
      ...(level.slots ?? []).map((sl, i) => ({
        kind: 'zappy' as const,
        x: sl.x,
        y: sl.y,
        card: setup.slotCards?.[i] ?? 'nearest',
        cooldown: 0,
        fixed: true,
      })),
      ...setup.bots.map((b) => ({ ...b, cooldown: 0, fixed: false })),
    ];
    this.scouts = (level.scouts ?? []).map((s, i) => ({
      index: i,
      x: s.x,
      y: s.y,
      dir: s.dir,
      fromX: s.x,
      fromY: s.y,
      anim: 1,
      vm: new BotVM(setup.programs[i] ?? { v: 1, blocks: [] }),
      action: null,
      current: null,
      finished: false,
      waiting: false,
    }));
    this.blocksUsed = setup.programs.reduce((n, p) => n + countBlocks(p.blocks), 0);
    this.feverLeft = level.fever;

    const ats = [...new Set(level.waves.map((w) => w.at))].sort((a, b) => a - b);
    this.waveCount = ats.length;
    this.spawns = [];
    for (const w of level.waves) {
      for (let i = 0; i < w.count; i++) {
        this.spawns.push({
          tick: Math.round((w.at + i * w.every) * TICKS_PER_SECOND),
          kind: w.virus,
          path: w.path ?? 0,
          wave: ats.indexOf(w.at) + 1,
        });
      }
    }
    this.spawns.sort((a, b) => a.tick - b.tick || a.path - b.path);
    this.totalViruses = this.spawns.length;
  }

  get healthyCells(): number {
    return this.cells.filter((c) => c.healthy).length;
  }

  get virusesLeft(): number {
    return this.totalViruses - this.nextSpawn + this.viruses.length;
  }

  /** Advance the world by one tick. Inputs are applied first. */
  step(inputs: Input[] = []): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.status !== 'running') return ev;
    this.tick++;

    // 1. player inputs
    for (const input of inputs) this.applyInput(input, ev);
    if (this.tapCooldown > 0) this.tapCooldown--;
    if (this.feverTicks > 0) this.feverTicks--;

    // 2. spawns
    while (this.nextSpawn < this.spawns.length && this.spawns[this.nextSpawn].tick <= this.tick) {
      const s = this.spawns[this.nextSpawn++];
      if (s.wave > this.wave) {
        this.wave = s.wave;
        ev.push({ t: 'wave', n: s.wave });
      }
      const st = VIRUS[s.kind];
      const [x, y] = this.geo.paths[s.path][0];
      const v: Virus = {
        id: this.nextVirusId++,
        kind: s.kind,
        hp: st.hp,
        maxHp: st.hp,
        armoured: st.armoured,
        path: s.path,
        progress: 0,
        held: 0,
        lastHit: this.tick,
        healing: false,
        x,
        y,
        alive: true,
      };
      this.viruses.push(v);
      ev.push({ t: 'spawn', virus: v.id });
    }

    // 3. viruses walk
    const slow = this.feverTicks > 0 ? FEVER_SLOW : 1;
    for (const v of this.viruses) {
      if (!v.alive) continue;
      const regen = VIRUS[v.kind].regen;
      v.healing = regen > 0 && v.hp < v.maxHp && this.tick - v.lastHit > REGEN_DELAY;
      if (v.healing && (this.tick - v.lastHit) % regen === 0) v.hp++;
      if (v.held > 0) {
        v.held--;
        continue;
      }
      const path = this.geo.paths[v.path];
      v.progress += VIRUS[v.kind].speed * slow;
      if (v.progress >= path.length - 1) {
        v.alive = false;
        this.infect(v, ev);
        continue;
      }
      this.placeVirus(v);
    }
    if (this.status !== 'running') return ev;

    // 4. nets lying on tiles catch viruses walking in
    for (const trap of this.traps) {
      const v = this.viruses.find((v) => v.alive && v.held === 0 && this.virusTileIs(v, trap.x, trap.y));
      if (v) {
        this.catchVirus(v, ev);
        trap.ticks = 0;
      } else trap.ticks--;
    }
    this.traps = this.traps.filter((t) => t.ticks > 0);

    // 5. bots act
    for (const t of this.turrets) this.turretAct(t, ev);
    for (const s of this.scouts) this.scoutAct(s, ev);

    // 6. remove popped viruses
    for (const v of this.viruses) {
      if (v.alive && v.hp <= 0) {
        v.alive = false;
        this.popped++;
        ev.push({ t: 'pop', virus: v.id, x: v.x, y: v.y, kind: v.kind });
      }
    }
    this.viruses = this.viruses.filter((v) => v.alive);

    // 7. end of level
    if (this.nextSpawn >= this.spawns.length && this.viruses.length === 0 && !this.healingLeft()) {
      this.status = this.healthyCells > 0 ? 'won' : 'lost';
      ev.push({ t: this.status === 'won' ? 'won' : 'lost' });
    } else if (this.tick >= MAX_TICKS) {
      this.status = 'lost';
      ev.push({ t: 'lost' });
    }
    return ev;
  }

  result(): Result {
    const won = this.status === 'won';
    const allSafe = won && this.healthyCells === this.cells.length;
    let third = false;
    const r = this.level.star3;
    if (won) {
      switch (r.kind) {
        case 'maxBots':
          third = this.turrets.filter((t) => !t.fixed).length <= r.n;
          break;
        case 'maxBlocks':
          third = this.blocksUsed <= r.n;
          break;
        case 'noFever':
          third = this.feverUsed === 0;
          break;
        case 'noTap':
          third = this.tapsUsed === 0;
          break;
      }
    }
    return { won, stars: [won, allSafe, third], healthy: this.healthyCells, total: this.cells.length };
  }

  /** Run until the end (used by tests and the solver check). */
  runToEnd(inputs: (tick: number, sim: Sim) => Input[] = () => []): Result {
    while (this.status === 'running') this.step(inputs(this.tick + 1, this));
    return this.result();
  }

  /* ---------------- internals ---------------- */

  /** After the last virus, healers get to finish their work before the level ends. */
  private healingLeft(): boolean {
    return this.turrets.some(
      (t) =>
        t.kind === 'zappy' &&
        t.card === 'heal' &&
        this.cells.some((c) => !c.healthy && Math.hypot(c.x - t.x, c.y - t.y) <= HEAL_RANGE),
    );
  }

  private applyInput(input: Input, ev: SimEvent[]) {
    if (input.t === 'tap') {
      if (!this.level.tapZap || this.tapCooldown > 0) return;
      const v = this.viruses.find((v) => v.id === input.virus && v.alive);
      if (!v) return;
      this.tapsUsed++;
      this.tapCooldown = TAP_COOLDOWN;
      this.hit(v, TAP_DAMAGE, v.x, v.y, 'tap', ev);
    } else if (input.t === 'fever') {
      if (this.feverLeft <= 0 || this.feverTicks > 0) return;
      this.feverLeft--;
      this.feverUsed++;
      this.feverTicks = FEVER_TICKS;
      ev.push({ t: 'fever' });
    }
  }

  private placeVirus(v: Virus) {
    const path = this.geo.paths[v.path];
    const i = Math.min(Math.floor(v.progress), path.length - 2);
    const f = v.progress - i;
    const [ax, ay] = path[i];
    const [bx, by] = path[i + 1];
    v.x = ax + (bx - ax) * f;
    v.y = ay + (by - ay) * f;
  }

  virusTile(v: Virus): [number, number] {
    const path = this.geo.paths[v.path];
    return path[Math.min(path.length - 1, Math.floor(v.progress + 0.5))];
  }

  private virusTileIs(v: Virus, x: number, y: number): boolean {
    const [tx, ty] = this.virusTile(v);
    return tx === x && ty === y;
  }

  private infect(v: Virus, ev: SimEvent[]) {
    const order = this.geo.cellOrder[v.path];
    for (let k = 0; k < VIRUS[v.kind].damage; k++) {
      const idx = order.find((i) => this.cells[i].healthy);
      if (idx === undefined) break;
      this.cells[idx].healthy = false;
      this.cellsEverLost++;
      ev.push({ t: 'infect', cell: idx, virus: v.id });
    }
    if (this.healthyCells === 0) {
      this.status = 'lost';
      ev.push({ t: 'lost' });
    }
  }

  private hit(v: Virus, dmg: number, fromX: number, fromY: number, source: 'bot' | 'tap' | 'scout', ev: SimEvent[]) {
    const ping = v.armoured;
    if (!ping) {
      v.hp -= dmg;
      v.lastHit = this.tick;
      v.healing = false;
    }
    ev.push({ t: 'zap', fromX, fromY, virus: v.id, ping, source });
  }

  private catchVirus(v: Virus, ev: SimEvent[]) {
    v.held = NET_HOLD_TICKS;
    ev.push({ t: 'netCatch', virus: v.id });
    if (v.armoured) {
      v.armoured = false;
      ev.push({ t: 'crack', virus: v.id });
    }
  }

  private dist(t: { x: number; y: number }, v: Virus): number {
    return Math.hypot(t.x - v.x, t.y - v.y);
  }

  private turretAct(t: Turret, ev: SimEvent[]) {
    if (t.cooldown > 0) {
      t.cooldown--;
      return;
    }
    if (t.kind === 'zappy' && t.card === 'heal') {
      let best = -1;
      let bestD = Infinity;
      this.cells.forEach((c, i) => {
        const d = Math.hypot(c.x - t.x, c.y - t.y);
        if (!c.healthy && d <= HEAL_RANGE && d < bestD) {
          best = i;
          bestD = d;
        }
      });
      if (best >= 0) {
        this.cells[best].healthy = true;
        t.cooldown = HEAL_COOLDOWN;
        ev.push({ t: 'heal', cell: best, fromX: t.x, fromY: t.y });
      }
      return;
    }
    const range = TURRET[t.kind].range;
    const inRange = this.viruses.filter((v) => v.alive && v.hp > 0 && this.dist(t, v) <= range);
    if (inRange.length === 0) return;

    if (t.kind === 'netter') {
      const free = inRange.filter((v) => v.held === 0);
      if (free.length === 0) return;
      const target = free.sort(
        (a, b) => Number(b.armoured) - Number(a.armoured) || this.dist(t, a) - this.dist(t, b) || a.id - b.id,
      )[0];
      const [tx, ty] = this.virusTile(target);
      ev.push({ t: 'netThrow', fromX: t.x, fromY: t.y, x: tx, y: ty });
      this.catchVirus(target, ev);
      t.cooldown = TURRET.netter.cooldown;
      return;
    }

    let target: Virus;
    if (t.card === 'strongest') {
      target = inRange.sort((a, b) => b.hp - a.hp || b.progress - a.progress || a.id - b.id)[0];
    } else {
      target = inRange.sort((a, b) => this.dist(t, a) - this.dist(t, b) || a.id - b.id)[0];
    }
    this.hit(target, ZAPPY_DAMAGE, t.x, t.y, 'bot', ev);
    t.cooldown = TURRET.zappy.cooldown;
  }

  private walkable(x: number, y: number, self: Scout): boolean {
    const k = tileAt(this.geo, x, y);
    if (k === null || k === 'wall' || k === 'cell') return false;
    if (this.turrets.some((t) => t.x === x && t.y === y)) return false;
    if (this.scouts.some((s) => s !== self && s.x === x && s.y === y)) return false;
    return true;
  }

  private scoutAct(s: Scout, ev: SimEvent[]) {
    if (s.finished) return;
    if (!s.action) {
      const step = s.vm.next();
      if (step.kind === 'yield') return;
      if (step.kind === 'done') {
        s.finished = true;
        s.current = null;
        s.waiting = false;
        ev.push({ t: 'block', scout: s.index, path: null, op: null });
        return;
      }
      s.action = this.startAction(step.block);
      s.current = { op: step.block.op, path: step.path };
      ev.push({ t: 'block', scout: s.index, path: step.path, op: step.block.op });
      if (step.block.op === 'turnLeft' || step.block.op === 'turnRight') {
        s.dir = ((s.dir + (step.block.op === 'turnLeft' ? 3 : 1)) % 4) as Dir;
      }
      if (s.action?.op === 'net') this.throwNet(s, ev);
      if (s.action?.op === 'move') this.beginStep(s, ev);
      if (!s.action) return;
    }
    const a = s.action;
    switch (a.op) {
      case 'move': {
        a.t--;
        s.anim = 1 - a.t / BLOCK_TICKS.move;
        if (a.t <= 0) {
          a.stepsLeft--;
          s.fromX = s.x;
          s.fromY = s.y;
          s.anim = 1;
          if (a.stepsLeft <= 0) s.action = null;
          else {
            a.t = BLOCK_TICKS.move;
            this.beginStep(s, ev);
          }
        }
        break;
      }
      case 'turn':
      case 'wait':
      case 'net':
        a.t--;
        if (a.t <= 0) s.action = null;
        break;
      case 'zap': {
        if (!a.fired) {
          const fx = s.x + DX[s.dir];
          const fy = s.y + DY[s.dir];
          const targets = this.viruses
            .filter((v) => v.alive && v.hp > 0 && this.virusTileIs(v, fx, fy))
            .sort((p, q) => q.progress - p.progress || p.id - q.id);
          if (targets.length === 0) {
            s.waiting = true;
            break;
          }
          s.waiting = false;
          a.fired = true;
          this.hit(targets[0], SCOUT_ZAP_DAMAGE, s.x, s.y, 'scout', ev);
        }
        a.t--;
        if (a.t <= 0) s.action = null;
        break;
      }
    }
  }

  private startAction(b: ActionBlock): ScoutAction | null {
    switch (b.op) {
      case 'move':
        return b.n > 0 ? { op: 'move', stepsLeft: b.n, t: BLOCK_TICKS.move } : null;
      case 'turnLeft':
      case 'turnRight':
        return { op: 'turn', t: BLOCK_TICKS[b.op] };
      case 'wait':
        return b.n > 0 ? { op: 'wait', t: BLOCK_TICKS.wait * b.n } : null;
      case 'zap':
        return { op: 'zap', t: BLOCK_TICKS.zap, fired: false };
      case 'net':
        return { op: 'net', t: BLOCK_TICKS.net };
    }
  }

  /** Called when a move step starts: the scout claims the next tile, or bumps. */
  private beginStep(s: Scout, ev: SimEvent[]) {
    const nx = s.x + DX[s.dir];
    const ny = s.y + DY[s.dir];
    s.fromX = s.x;
    s.fromY = s.y;
    s.anim = 0;
    if (this.walkable(nx, ny, s)) {
      s.x = nx;
      s.y = ny;
    } else {
      ev.push({ t: 'bump', scout: s.index });
    }
  }

  private throwNet(s: Scout, ev: SimEvent[]) {
    const x = s.x + DX[s.dir];
    const y = s.y + DY[s.dir];
    this.traps = this.traps.filter((t) => t.x !== x || t.y !== y);
    this.traps.push({ x, y, ticks: NET_TRAP_TICKS });
    ev.push({ t: 'netThrow', fromX: s.x, fromY: s.y, x, y });
  }
}
