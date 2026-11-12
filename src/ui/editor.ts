import { h, svg } from './dom';
import { ICON } from './icons';
import { countBlocks } from '../sim/vm';
import type { Block, BlockOp, Program } from '../sim/types';
import { say, sfx } from '../audio/audio';

// Icon-mode program editor (ScratchJr style): big picture blocks in a strip.
// Tap a palette block to add it, tap a block to select it, drag to reorder,
// drag it out of the strip to delete. One block = one step: to move three
// tiles, add three move blocks.

const COLORS: Record<BlockOp, string> = {
  move: 'b-move',
  turnLeft: 'b-move',
  turnRight: 'b-move',
  wait: 'b-wait',
  zap: 'b-action',
  net: 'b-action',
  repeat: 'b-loop',
};

function makeBlock(op: BlockOp): Block {
  switch (op) {
    case 'move':
      return { op, n: 1 };
    case 'wait':
      return { op, n: 1 };
    case 'repeat':
      return { op, n: 2, body: [] };
    default:
      return { op } as Block;
  }
}

/** Programs saved before counts were removed may hold "move ×3": split them into single blocks. */
function splitCounts(p: Program) {
  p.blocks = p.blocks.flatMap((b): Block[] =>
    (b.op === 'move' || b.op === 'wait') && b.n > 1 ? Array.from({ length: b.n }, () => ({ op: b.op, n: 1 }) as Block) : [b],
  );
}

export class ProgramEditor {
  el: HTMLElement;
  private strip: HTMLElement;
  private palette: HTMLElement;
  private budgetEl: HTMLElement;
  private toolbar: HTMLElement;
  private selected: number | null = null;
  private running: number | null = null;
  locked = false;
  private drag: { from: 'palette' | 'strip'; op?: BlockOp; index?: number; ghost: HTMLElement | null; sx: number; sy: number; started: boolean; pointer: number } | null = null;

  constructor(
    private program: Program,
    allowed: BlockOp[],
    private budget: number,
    private onChange: () => void,
  ) {
    this.strip = h('div', { class: 'strip' });
    this.palette = h('div', { class: 'palette' });
    this.budgetEl = h('div', { class: 'budget' });
    this.toolbar = h('div', { class: 'block-tools' });
    this.el = h(
      'div',
      { class: 'editor' },
      h('div', { class: 'editor-head' }, h('span', { class: 'scout-tag' }, 'Programme de Scout'), this.budgetEl),
      h('div', { class: 'strip-wrap' }, h('div', { class: 'start-flag' }, svg(ICON.play)), this.strip),
      this.toolbar,
      h('div', { class: 'palette-row' }, this.palette),
    );
    for (const op of allowed) {
      const b = h('div', { class: `pblock ${COLORS[op]}`, 'data-op': op }, svg(ICON[op as keyof typeof ICON]));
      b.addEventListener('pointerdown', (e) => this.pointerDown(e, 'palette', op));
      this.palette.append(b);
    }
    window.addEventListener('pointermove', this.pointerMove);
    window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('pointercancel', this.pointerUp);
    splitCounts(this.program);
    this.render();
  }

  destroy() {
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    window.removeEventListener('pointercancel', this.pointerUp);
  }

  setProgram(p: Program) {
    this.program = p;
    splitCounts(p);
    this.selected = null;
    this.render();
  }

  get used(): number {
    return countBlocks(this.program.blocks);
  }

  setRunning(index: number | null) {
    this.running = index;
    this.strip.querySelectorAll('.sblock').forEach((el, i) => el.classList.toggle('running', i === index));
  }

  setLocked(locked: boolean) {
    this.locked = locked;
    this.el.classList.toggle('locked', locked);
    if (locked) this.selected = null;
    this.render();
  }

  private render() {
    const blocks = this.program.blocks;
    const items: HTMLElement[] = blocks.map((b, i) => {
        const el = h('div', { class: `sblock ${COLORS[b.op]} ${this.selected === i ? 'selected' : ''} ${this.running === i ? 'running' : ''}` }, svg(ICON[b.op as keyof typeof ICON]));
        el.addEventListener('pointerdown', (e) => this.pointerDown(e, 'strip', undefined, i));
        return el;
    });
    if (blocks.length === 0) items.push(h('div', { class: 'strip-empty' }, svg(ICON.hand), h('span', null, 'Touche un bloc en bas')));
    this.strip.replaceChildren(...items);
    const full = this.used >= this.budget;
    this.budgetEl.replaceChildren(
      ...Array.from({ length: this.budget }, (_, i) => h('span', { class: `pip ${i < this.used ? 'on' : ''}` })),
      h('span', { class: 'budget-num' }, `${this.used}/${this.budget}`),
    );
    this.palette.classList.toggle('full', full);

    // toolbar for the selected block
    this.toolbar.replaceChildren();
    const sel = this.selected !== null ? blocks[this.selected] : null;
    if (sel && !this.locked) {
      const i = this.selected!;
      const tb = (icon: string, fn: () => void, label: string, disabled = false) =>
        h('button', { class: 'tool', disabled, 'aria-label': label, onclick: () => { sfx.tap(); fn(); } }, icon.startsWith('<') ? svg(icon) : h('b', null, icon));
      const tools: HTMLElement[] = [
        tb(ICON.back, () => this.moveBlock(i, i - 1), 'avant', i === 0),
        tb(ICON.next, () => this.moveBlock(i, i + 1), 'après', i === blocks.length - 1),
        tb(ICON.bin, () => this.remove(i), 'enlever'),
      ];
      this.toolbar.append(...tools);
    }
  }

  private changed() {
    this.render();
    this.onChange();
  }

  private add(op: BlockOp, at?: number) {
    if (this.used >= this.budget) {
      sfx.bump();
      void say(['budget_full']);
      return;
    }
    const index = at ?? (this.selected !== null ? this.selected + 1 : this.program.blocks.length);
    this.program.blocks.splice(index, 0, makeBlock(op));
    this.selected = index;
    sfx.place();
    this.changed();
  }

  private remove(i: number) {
    this.program.blocks.splice(i, 1);
    this.selected = null;
    sfx.remove();
    this.changed();
  }

  private moveBlock(from: number, to: number) {
    const b = this.program.blocks;
    if (to < 0 || to >= b.length) return;
    const [x] = b.splice(from, 1);
    b.splice(to, 0, x);
    this.selected = to;
    this.changed();
  }

  /* ---------- drag and drop (pointer events work for touch, pen and mouse) ---------- */

  private pointerDown(e: PointerEvent, from: 'palette' | 'strip', op?: BlockOp, index?: number) {
    if (this.locked) return;
    e.preventDefault();
    this.drag = { from, op, index, ghost: null, sx: e.clientX, sy: e.clientY, started: false, pointer: e.pointerId };
  }

  private pointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointer) return;
    if (!d.started && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 10) {
      d.started = true;
      const op = d.from === 'palette' ? d.op! : this.program.blocks[d.index!].op;
      d.ghost = h('div', { class: `sblock ghost ${COLORS[op]}` }, svg(ICON[op as keyof typeof ICON]));
      document.body.append(d.ghost);
      if (d.from === 'strip') this.strip.children[d.index!]?.classList.add('dragging');
    }
    if (d.started && d.ghost) {
      d.ghost.style.left = `${e.clientX}px`;
      d.ghost.style.top = `${e.clientY}px`;
      const at = this.insertIndex(e);
      this.showInsert(at);
      if (d.from === 'strip') d.ghost.classList.toggle('removing', at === null);
    }
  };

  private pointerUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointer) return;
    this.drag = null;
    d.ghost?.remove();
    this.showInsert(null);
    if (!d.started) {
      // a simple tap
      if (d.from === 'palette') {
        void say([`b_${d.op}`]);
        this.add(d.op!);
      } else {
        this.selected = this.selected === d.index ? null : d.index!;
        const b = this.program.blocks[d.index!];
        if (b) void say([`b_${b.op}`]);
        sfx.tap();
        this.render();
      }
      return;
    }
    const at = this.insertIndex(e);
    if (at === null) {
      // a strip block dropped outside the strip is removed
      if (d.from === 'strip') this.remove(d.index!);
      else this.render();
      return;
    }
    if (d.from === 'palette') this.add(d.op!, at);
    else {
      const to = at > d.index! ? at - 1 : at;
      this.moveBlock(d.index!, to);
    }
  };

  private over(el: HTMLElement, e: PointerEvent) {
    const r = el.getBoundingClientRect();
    return e.clientX >= r.left - 10 && e.clientX <= r.right + 10 && e.clientY >= r.top - 10 && e.clientY <= r.bottom + 10;
  }

  /** index where a dropped block would go, or null when not over the strip */
  private insertIndex(e: PointerEvent): number | null {
    const wrap = this.strip.parentElement!;
    if (!this.over(wrap, e)) return null;
    const items = [...this.strip.querySelectorAll('.sblock')] as HTMLElement[];
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (e.clientY < r.top - 6) return i;
      if (e.clientY <= r.bottom + 6 && e.clientX < r.left + r.width / 2) return i;
    }
    return items.length;
  }

  private showInsert(i: number | null) {
    this.strip.querySelectorAll('.sblock').forEach((el, k) => {
      el.classList.toggle('insert-before', i === k);
      el.classList.toggle('insert-after', i === k + 1 && k === this.strip.querySelectorAll('.sblock').length - 1);
    });
  }
}
