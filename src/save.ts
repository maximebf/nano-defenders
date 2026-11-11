import { get, set } from 'idb-keyval';
import { LEVELS, WORLDS } from './levels';
import type { Setup } from './sim/types';

export interface Settings {
  sound: boolean;
  music: boolean;
  voice: boolean;
  leftHanded: boolean;
  /** run speed multiplier used when a wave starts */
  speed: number;
}

export interface SaveData {
  v: 1;
  bodyName: string;
  settings: Settings;
  /** best stars per level id: [win, all cells safe, bonus] */
  stars: Record<string, [boolean, boolean, boolean]>;
  /** last setup per level, so retrying keeps the program intact */
  setups: Record<string, Setup>;
  /** failed attempts in a row, per level (for hints) */
  fails: Record<string, number>;
  unlockAll: boolean;
  seenIntro: boolean;
}

const KEY = 'nanodefenders-save';

function fresh(): SaveData {
  return {
    v: 1,
    bodyName: '',
    settings: { sound: true, music: true, voice: true, leftHanded: false, speed: 1 },
    stars: {},
    setups: {},
    fails: {},
    unlockAll: false,
    seenIntro: false,
  };
}

export let save: SaveData = fresh();

export async function loadSave(): Promise<void> {
  try {
    const data = (await get(KEY)) as SaveData | undefined;
    if (data && data.v === 1) save = { ...fresh(), ...data, settings: { ...fresh().settings, ...data.settings } };
  } catch {
    // private mode or blocked storage: play without saving
  }
}

let pending: number | undefined;
export function persist(): void {
  clearTimeout(pending);
  pending = window.setTimeout(() => {
    set(KEY, save).catch(() => undefined);
  }, 150);
}

export function resetSave(): void {
  const keep = { settings: save.settings, bodyName: save.bodyName, seenIntro: save.seenIntro };
  save = { ...fresh(), ...keep };
  persist();
}

export function starCount(id: string): number {
  return (save.stars[id] ?? []).filter(Boolean).length;
}

export function recordResult(id: string, stars: [boolean, boolean, boolean]): void {
  const old = save.stars[id] ?? [false, false, false];
  save.stars[id] = [old[0] || stars[0], old[1] || stars[1], old[2] || stars[2]];
  if (stars[0]) save.fails[id] = 0;
  else save.fails[id] = (save.fails[id] ?? 0) + 1;
  persist();
}

export function isLevelUnlocked(id: string): boolean {
  if (save.unlockAll) return true;
  const i = LEVELS.findIndex((l) => l.id === id);
  if (i <= 0) return true;
  return !!save.stars[LEVELS[i - 1].id]?.[0];
}

export function isWorldUnlocked(world: number): boolean {
  if (save.unlockAll || world === 1) return true;
  const prev = WORLDS[world - 2];
  return !!save.stars[prev[prev.length - 1].id]?.[0];
}

export function isWorldDone(world: number): boolean {
  const w = WORLDS[world - 1];
  return !!save.stars[w[w.length - 1].id]?.[0];
}

/** Export / import of the save as a file, to move between devices. */
export function exportSave(): string {
  return JSON.stringify(save);
}

export function importSave(text: string): boolean {
  try {
    const data = JSON.parse(text) as SaveData;
    if (data.v !== 1 || typeof data.stars !== 'object') return false;
    save = { ...fresh(), ...data };
    persist();
    return true;
  } catch {
    return false;
  }
}
