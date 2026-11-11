import type { LevelDef, PlacedBot } from './types';

export const GRID_W = 16;
export const GRID_H = 10;

export type TileKind = 'tissue' | 'wall' | 'cell' | 'path';

export interface Geometry {
  w: number;
  h: number;
  tiles: TileKind[][]; // [y][x]
  /** expanded tile lists for each path */
  paths: [number, number][][];
  cells: [number, number][];
  /** for each path, cell indices ordered from the closest to the path end */
  cellOrder: number[][];
}

/** Expands corner waypoints into a list of every tile visited. */
export function expandPath(points: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    if (ax !== bx && ay !== by) throw new Error(`path segment not straight: ${points[i]} -> ${points[i + 1]}`);
    const sx = Math.sign(bx - ax);
    const sy = Math.sign(by - ay);
    let x = ax;
    let y = ay;
    if (i === 0) out.push([x, y]);
    while (x !== bx || y !== by) {
      x += sx;
      y += sy;
      out.push([x, y]);
    }
  }
  if (points.length === 1) out.push(points[0]);
  return out;
}

const cache = new WeakMap<LevelDef, Geometry>();

export function geometry(level: LevelDef): Geometry {
  const hit = cache.get(level);
  if (hit) return hit;
  const h = level.map.length;
  const w = level.map[0].length;
  const tiles: TileKind[][] = [];
  const cells: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    const row: TileKind[] = [];
    for (let x = 0; x < w; x++) {
      const c = level.map[y][x];
      if (c === '#') row.push('wall');
      else if (c === 'C') {
        row.push('cell');
        cells.push([x, y]);
      } else row.push('tissue');
    }
    tiles.push(row);
  }
  const paths = level.paths.map(expandPath);
  for (const p of paths) for (const [x, y] of p) if (y >= 0 && y < h && x >= 0 && x < w) tiles[y][x] = 'path';
  const cellOrder = paths.map((p) => {
    const [ex, ey] = p[p.length - 1];
    return cells
      .map((c, i) => ({ i, d: (c[0] - ex) ** 2 + (c[1] - ey) ** 2 }))
      .sort((a, b) => a.d - b.d || a.i - b.i)
      .map((e) => e.i);
  });
  const g: Geometry = { w, h, tiles, paths, cells, cellOrder };
  cache.set(level, g);
  return g;
}

export function tileAt(g: Geometry, x: number, y: number): TileKind | null {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return null;
  return g.tiles[y][x];
}

/** Can a turret be placed on this tile, given the bots already placed? */
export function canPlace(level: LevelDef, bots: PlacedBot[], x: number, y: number): boolean {
  const g = geometry(level);
  if (tileAt(g, x, y) !== 'tissue') return false;
  if (bots.some((b) => b.x === x && b.y === y)) return false;
  if (level.fixedBots?.some((b) => b.x === x && b.y === y)) return false;
  if (level.scouts?.some((s) => s.x === x && s.y === y)) return false;
  if (level.slots?.some((s) => s.x === x && s.y === y)) return false;
  return true;
}
