// Core data types shared by the simulation, the levels and the UI.
// The simulation never imports anything from the renderer or the DOM.

/** 0 = up, 1 = right, 2 = down, 3 = left */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

export const TICKS_PER_SECOND = 10;

export type VirusKind = 'snifflet' | 'bigSnifflet' | 'zoomer' | 'shellby';
export type TurretKind = 'zappy' | 'netter';
export type BotKind = TurretKind | 'scout';
export type Card = 'nearest' | 'strongest' | 'heal';

/* ---------- Programs (versioned JSON tree, run by the bot VM) ---------- */

export type BlockOp = 'move' | 'turnLeft' | 'turnRight' | 'wait' | 'zap' | 'net' | 'repeat';

export type Block =
  | { op: 'move'; n: number }
  | { op: 'turnLeft' }
  | { op: 'turnRight' }
  | { op: 'wait'; n: number }
  | { op: 'zap' }
  | { op: 'net' }
  /** Not exposed before World 4, but the VM already supports nesting. */
  | { op: 'repeat'; n: number; body: Block[] };

export interface Program {
  v: 1;
  blocks: Block[];
}

/* ---------- Levels ---------- */

export interface WaveDef {
  /** seconds after the start of the run */
  at: number;
  virus: VirusKind;
  count: number;
  /** seconds between two spawns */
  every: number;
  /** index into LevelDef.paths (default 0) */
  path?: number;
}

export type StarRule =
  | { kind: 'maxBots'; n: number }
  | { kind: 'maxBlocks'; n: number }
  | { kind: 'noFever' }
  | { kind: 'noTap' };

export interface ScoutStart {
  x: number;
  y: number;
  dir: Dir;
}

export interface FixedBot {
  kind: TurretKind;
  x: number;
  y: number;
  card?: Card;
}

export type IntroThing =
  | { kind: 'virus'; id: VirusKind }
  | { kind: 'bot'; id: BotKind }
  | { kind: 'card'; id: Card }
  | { kind: 'block'; id: BlockOp }
  | { kind: 'power'; id: 'fever' | 'tap' };

export interface LevelDef {
  id: string; // "1-1"
  world: 1 | 2 | 3;
  index: number; // 1-based inside the world
  name: string;
  /**
   * Rows of the grid. '.' = tissue (bots can be placed, scouts can walk),
   * '#' = membrane wall, 'C' = healthy cell. Path tiles come from `paths`.
   */
  map: string[];
  /** Corner waypoints of each virus path, [x, y]; consecutive points share a row or column. */
  paths: [number, number][][];
  waves: WaveDef[];
  /** How many of each turret the player can place. */
  bots: Partial<Record<TurretKind, number>>;
  /** Behaviour cards the player can choose from (World 2+). Without cards zappies use 'nearest'. */
  cards?: Card[];
  fixedBots?: FixedBot[];
  /** Zappies already in place whose behaviour card the player chooses (World 2). */
  slots?: { x: number; y: number }[];
  scouts?: ScoutStart[];
  /** Blocks offered in the editor (World 3). */
  blocks?: BlockOp[];
  blockBudget?: number;
  tapZap: boolean;
  fever: number;
  star3: StarRule;
  intro?: IntroThing;
}

/* ---------- Player setup and inputs ---------- */

export interface PlacedBot {
  kind: TurretKind;
  x: number;
  y: number;
  card: Card;
}

export interface Setup {
  bots: PlacedBot[];
  /** one program per scout, same order as LevelDef.scouts */
  programs: Program[];
  /** one card per slot, same order as LevelDef.slots */
  slotCards?: Card[];
}

export type Input = { t: 'tap'; virus: number } | { t: 'fever' };

export interface TimedInput {
  tick: number;
  input: Input;
}

/* ---------- Events emitted for the renderer and the sound ---------- */

export type SimEvent =
  | { t: 'spawn'; virus: number }
  | { t: 'wave'; n: number }
  | { t: 'zap'; fromX: number; fromY: number; virus: number; ping: boolean; source: 'bot' | 'tap' | 'scout' }
  | { t: 'netThrow'; fromX: number; fromY: number; x: number; y: number }
  | { t: 'netCatch'; virus: number }
  | { t: 'crack'; virus: number }
  | { t: 'pop'; virus: number; x: number; y: number; kind: VirusKind }
  | { t: 'infect'; cell: number; virus: number }
  | { t: 'heal'; cell: number; fromX: number; fromY: number }
  | { t: 'bump'; scout: number }
  | { t: 'block'; scout: number; path: number[] | null; op: BlockOp | null }
  | { t: 'fever' }
  | { t: 'won' }
  | { t: 'lost' };
