import type { Block, Program } from './types';
import { MAX_INSTANT_PER_TICK } from './units';

export type ActionBlock = Exclude<Block, { op: 'repeat' }>;

interface Frame {
  blocks: Block[];
  pc: number;
  /** remaining passes for a repeat frame (1 for the root) */
  remaining: number;
  /** index path of the block that owns this frame */
  path: number[];
}

export type VMStep =
  | { kind: 'action'; block: ActionBlock; path: number[] }
  | { kind: 'done' }
  /** too many instant blocks this tick: try again next tick */
  | { kind: 'yield' };

/**
 * A tiny interpreter for one bot. It walks the block tree and hands out
 * the next action block; the simulation decides how long the action takes.
 * Programs are data, never JavaScript.
 */
export class BotVM {
  private stack: Frame[];

  constructor(program: Program) {
    this.stack = [{ blocks: program.blocks, pc: 0, remaining: 1, path: [] }];
  }

  get finished(): boolean {
    return this.stack.length === 0;
  }

  next(): VMStep {
    for (let guard = 0; guard < MAX_INSTANT_PER_TICK; guard++) {
      const frame = this.stack[this.stack.length - 1];
      if (!frame) return { kind: 'done' };
      if (frame.pc >= frame.blocks.length) {
        if (frame.remaining > 1) {
          frame.remaining--;
          frame.pc = 0;
        } else {
          this.stack.pop();
        }
        continue;
      }
      const index = frame.pc++;
      const block = frame.blocks[index];
      const path = [...frame.path, index];
      if (block.op === 'repeat') {
        if (block.n > 0 && block.body.length > 0) {
          this.stack.push({ blocks: block.body, pc: 0, remaining: block.n, path });
        }
        continue;
      }
      return { kind: 'action', block, path };
    }
    return { kind: 'yield' };
  }
}

/** Number of blocks a program uses (what the block budget counts). */
export function countBlocks(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    if (b.op === 'repeat') n += countBlocks(b.body);
  }
  return n;
}
