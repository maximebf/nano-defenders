import type { LevelDef } from '../sim/types';
import { world1 } from './world1';
import { world2 } from './world2';
import { world3 } from './world3';

export const WORLDS: LevelDef[][] = [world1, world2, world3];
export const LEVELS: LevelDef[] = WORLDS.flat();

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(id: string): LevelDef | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
