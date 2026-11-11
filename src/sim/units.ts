import type { BlockOp, TurretKind, VirusKind } from './types';

/** Speeds are in tiles per tick (10 ticks = 1 second). */
export interface VirusStats {
  hp: number;
  speed: number;
  armoured: boolean;
  /** drawing scale, 1 = one tile */
  size: number;
  /** how many cells it infects when it gets through */
  damage: number;
  /** regains 1 hp every `regen` ticks when nobody hit it recently (0 = never) */
  regen: number;
}

/** ticks without being hit before a regenerating virus starts healing */
export const REGEN_DELAY = 12;

export const VIRUS: Record<VirusKind, VirusStats> = {
  snifflet: { damage: 1, hp: 3, speed: 0.08, armoured: false, size: 0.8, regen: 0 },
  bigSnifflet: { damage: 3, hp: 12, speed: 0.05, armoured: false, size: 1.2, regen: 6 },
  zoomer: { damage: 1, hp: 2, speed: 0.22, armoured: false, size: 0.75, regen: 0 },
  shellby: { damage: 1, hp: 3, speed: 0.06, armoured: true, size: 0.9, regen: 0 },
};

export interface TurretStats {
  range: number; // in tiles, from tile centre
  cooldown: number; // ticks between two actions
}

export const TURRET: Record<TurretKind, TurretStats> = {
  zappy: { range: 2.5, cooldown: 8 },
  netter: { range: 2.5, cooldown: 35 },
};

export const ZAPPY_DAMAGE = 1;
export const HEAL_COOLDOWN = 50;
export const HEAL_RANGE = 4.5;

export const TAP_DAMAGE = 1;
export const TAP_COOLDOWN = 15;

export const NET_TRAP_TICKS = 1e9; // a net lies on its tile until a virus walks in
export const NET_HOLD_TICKS = 40; // how long a caught virus is held

export const FEVER_TICKS = 50;
export const FEVER_SLOW = 0.35;

export const SCOUT_ZAP_DAMAGE = 3;

/** Time each block takes, in ticks. Instant blocks would be 0. */
export const BLOCK_TICKS: Record<Exclude<BlockOp, 'repeat'>, number> = {
  move: 5, // per tile
  turnLeft: 2,
  turnRight: 2,
  wait: 10, // per second
  zap: 3,
  net: 3,
};

/** Hard cap on instant blocks executed per bot per tick (protects against empty loops). */
export const MAX_INSTANT_PER_TICK = 50;

/** Safety stop: a level can never run longer than this. */
export const MAX_TICKS = 10 * 60 * 6;
