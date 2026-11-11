import Phaser from 'phaser';
import type { Sim } from '../sim/sim';
import { DX, DY, type BlockOp, type Card, type LevelDef, type SimEvent } from '../sim/types';
import { TURRET, VIRUS, HEAL_RANGE } from '../sim/units';
import { geometry } from '../sim/grid';
import { iconDataUrl, type IconName } from '../ui/icons';

export const T = 96; // tile size in canvas pixels
const IMAGES = ['snifflet', 'bigSnifflet', 'zoomer', 'shellby', 'shellbyBare', 'zappy', 'netter', 'scout', 'cell', 'cellSick'];
const ICONS: IconName[] = ['move', 'turnLeft', 'turnRight', 'wait', 'zap', 'net', 'nearest', 'strongest', 'heal', 'fever'];

export interface BoardHooks {
  onTile(x: number, y: number): void;
  onVirusTap(id: number): void;
  onFrame(dtMs: number): void;
}

interface Theme {
  bg: number;
  pad: number;
  padEdge: number;
  wall: number;
  wallEdge: number;
  pathOuter: number;
  pathInner: number;
  flow: number;
}

const THEMES: Record<number, Theme> = {
  1: { bg: 0xf4a6b8, pad: 0xf9c3cf, padEdge: 0xec8fa5, wall: 0xb84a6c, wallEdge: 0x8f2f50, pathOuter: 0xd98aa0, pathInner: 0xfff0d6, flow: 0xf2d8a7 },
  2: { bg: 0xf29e8e, pad: 0xf7bfb2, padEdge: 0xe0806f, wall: 0xa33a4a, wallEdge: 0x7a2333, pathOuter: 0xc96f6a, pathInner: 0xffe3d6, flow: 0xf5c2ae },
  3: { bg: 0xe46a7f, pad: 0xef8fa0, padEdge: 0xcc4f66, wall: 0x7d1d3f, wallEdge: 0x56102a, pathOuter: 0xa3203f, pathInner: 0xffb3c1, flow: 0xe5475f },
};

const center = (v: number) => v * T + T / 2;

export class BoardScene extends Phaser.Scene {
  private level!: LevelDef;
  private hooks!: BoardHooks;
  private sim: Sim | null = null;
  private theme!: Theme;

  private layerFloor!: Phaser.GameObjects.Container;
  private layerTraps!: Phaser.GameObjects.Container;
  private layerUnits!: Phaser.GameObjects.Container;
  private layerFx!: Phaser.GameObjects.Container;
  private layerUi!: Phaser.GameObjects.Container;

  private cellSprites: Phaser.GameObjects.Image[] = [];
  private turretSprites: Phaser.GameObjects.Container[] = [];
  private scoutSprites: { root: Phaser.GameObjects.Container; arrow: Phaser.GameObjects.Graphics; bubble: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Image; dots: Phaser.GameObjects.Text }[] = [];
  private virusSprites = new Map<number, { root: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Graphics; net: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Arc }>();
  private trapSprites: Phaser.GameObjects.Image[] = [];
  private rangeRing!: Phaser.GameObjects.Graphics;
  private hoverTile!: Phaser.GameObjects.Graphics;
  private feverTint!: Phaser.GameObjects.Rectangle;

  /** positions at the previous and the current tick, for smooth movement */
  private prev = new Map<string, [number, number]>();
  private cur = new Map<string, [number, number]>();
  alpha = 1;

  /** which turret index is selected (plan phase), shows its range */
  selected: number | null = null;
  /** ghost of the bot about to be placed */
  placing: 'zappy' | 'netter' | null = null;
  interactive: 'plan' | 'run' | 'none' = 'plan';

  constructor() {
    super('board');
  }

  init(data: { level: LevelDef; hooks: BoardHooks }) {
    this.level = data.level;
    this.hooks = data.hooks;
    this.theme = THEMES[this.level.world];
  }

  preload() {
    for (const k of IMAGES) this.load.image(k, `assets/img/${k}.png`);
    for (const k of ICONS) this.load.svg(`i_${k}`, iconDataUrl(k), { width: 128, height: 128 });
  }

  create() {
    this.makeTextures();
    this.drawFloor();
    this.layerTraps = this.add.container();
    this.rangeRing = this.add.graphics();
    this.hoverTile = this.add.graphics();
    this.layerUnits = this.add.container();
    this.layerFx = this.add.container();
    this.layerUi = this.add.container();
    this.feverTint = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xff7b00, 0).setOrigin(0);

    const g = geometry(this.level);
    this.cellSprites = g.cells.map(([x, y], i) => {
      const s = this.add.image(center(x), center(y), 'cell').setDisplaySize(T * 0.92, T * 0.92);
      this.layerUnits.add(s);
      this.tweens.add({ targets: s, scaleY: s.scaleY * 0.95, scaleX: s.scaleX * 1.04, duration: 900 + i * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      return s;
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onHover(p));
    this.game.events.emit('board-ready');
  }

  update(_time: number, delta: number) {
    this.hooks.onFrame(delta);
    this.render();
  }

  /* ------------------------------------------------------------ setup */

  private makeTextures() {
    // net texture
    const g = this.make.graphics({}, false);
    g.lineStyle(5, 0xff9f43, 1);
    for (let i = 0; i <= 4; i++) {
      g.lineBetween(10 + i * 19, 6, 10 + i * 19, 90);
      g.lineBetween(6, 10 + i * 19, 90, 10 + i * 19);
    }
    g.lineStyle(7, 0xd9480f, 1);
    g.strokeRoundedRect(4, 4, 88, 88, 18);
    g.generateTexture('netTex', 96, 96);
    g.destroy();
    // particle dot
    const d = this.make.graphics({}, false);
    d.fillStyle(0xffffff, 1);
    d.fillCircle(8, 8, 8);
    d.generateTexture('dot', 16, 16);
    d.destroy();
  }

  private drawFloor() {
    const th = this.theme;
    const geo = geometry(this.level);
    this.layerFloor = this.add.container();
    const g = this.add.graphics();
    this.layerFloor.add(g);
    g.fillStyle(th.bg, 1);
    g.fillRect(0, 0, geo.w * T, geo.h * T);

    // a few soft blobs for texture (fixed pseudo-random so every visit looks the same)
    let seed = this.level.world * 97 + this.level.index * 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 40; i++) {
      g.fillStyle(0xffffff, 0.06 + rnd() * 0.06);
      g.fillCircle(rnd() * geo.w * T, rnd() * geo.h * T, 10 + rnd() * 40);
    }

    for (let y = 0; y < geo.h; y++)
      for (let x = 0; x < geo.w; x++) {
        const k = geo.tiles[y][x];
        if (k === 'tissue') {
          g.fillStyle(th.padEdge, 0.55);
          g.fillRoundedRect(x * T + 5, y * T + 7, T - 10, T - 10, 18);
          g.fillStyle(th.pad, 1);
          g.fillRoundedRect(x * T + 5, y * T + 4, T - 10, T - 12, 18);
        } else if (k === 'wall') {
          g.fillStyle(th.wallEdge, 1);
          g.fillRoundedRect(x * T + 1, y * T + 1, T - 2, T - 2, 22);
          g.fillStyle(th.wall, 1);
          g.fillRoundedRect(x * T + 5, y * T + 4, T - 10, T - 12, 20);
          g.fillStyle(0xffffff, 0.12);
          g.fillCircle(x * T + T * 0.33, y * T + T * 0.32, T * 0.12);
        }
      }

    // vessels: an outer wall then the lighter channel, as rounded strokes
    for (const [w, color] of [
      [T * 0.98, th.pathOuter],
      [T * 0.74, th.pathInner],
    ] as const) {
      for (const p of geo.paths) {
        g.fillStyle(color, 1);
        for (let i = 0; i < p.length; i++) {
          const [x, y] = p[i];
          g.fillCircle(center(x), center(y), w / 2);
          if (i > 0) {
            const [px, py] = p[i - 1];
            const minX = Math.min(px, x);
            const minY = Math.min(py, y);
            if (px !== x) g.fillRect(center(minX), center(y) - w / 2, T, w);
            else g.fillRect(center(x) - w / 2, center(minY), w, T);
          }
        }
      }
    }
    // flow marks along the paths
    for (const p of geo.paths) {
      for (let i = 1; i < p.length - 1; i += 2) {
        const [x, y] = p[i];
        const [nx, ny] = p[i + 1];
        const a = Math.atan2(ny - y, nx - x);
        g.fillStyle(th.flow, 0.9);
        const cx = center(x);
        const cy = center(y);
        const s = T * 0.13;
        g.fillTriangle(
          cx + Math.cos(a) * s,
          cy + Math.sin(a) * s,
          cx + Math.cos(a + 2.4) * s,
          cy + Math.sin(a + 2.4) * s,
          cx + Math.cos(a - 2.4) * s,
          cy + Math.sin(a - 2.4) * s,
        );
      }
      // entrance hole
      const [sx, sy] = p[0];
      g.fillStyle(0x3b0d24, 0.55);
      g.fillCircle(center(sx), center(sy), T * 0.3);
    }
  }

  /* ------------------------------------------------------------ binding */

  setSim(sim: Sim) {
    this.sim = sim;
    for (const s of this.turretSprites) s.destroy();
    for (const s of this.scoutSprites) s.root.destroy();
    for (const v of this.virusSprites.values()) v.root.destroy();
    this.virusSprites.clear();
    this.prev.clear();
    this.cur.clear();
    this.turretSprites = sim.turrets.map((t, i) => this.makeTurret(t.kind, t.card, i));
    this.scoutSprites = sim.scouts.map(() => this.makeScout());
    this.capture();
    this.capture();
    this.alpha = 1;
    this.render();
  }

  private makeTurret(kind: 'zappy' | 'netter', card: Card, index: number) {
    const root = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, T * 0.34, T * 0.7, T * 0.2, 0x000000, 0.18);
    const img = this.add.image(0, 0, kind).setDisplaySize(T * 0.92, T * 0.92);
    root.add([shadow, img]);
    if (this.level.cards && kind === 'zappy') {
      const badge = this.add.circle(T * 0.3, -T * 0.3, T * 0.2, 0xffffff).setStrokeStyle(4, 0x1d3557);
      const icon = this.add.image(T * 0.3, -T * 0.3, `i_${card}`).setDisplaySize(T * 0.3, T * 0.3);
      root.add([badge, icon]);
    }
    if (this.level.slots && index < this.level.slots.length + (this.level.fixedBots?.length ?? 0)) {
      const n = index - (this.level.fixedBots?.length ?? 0) + 1;
      if (n >= 1) {
        const tag = this.add.circle(-T * 0.32, -T * 0.32, T * 0.17, 0x1d3557);
        const txt = this.add.text(-T * 0.32, -T * 0.32, String(n), { fontFamily: 'Fredoka, sans-serif', fontSize: `${Math.round(T * 0.24)}px`, color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
        root.add([tag, txt]);
      }
    }
    this.tweens.add({ targets: img, y: -3, duration: 700 + index * 50, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.layerUnits.add(root);
    return root;
  }

  private makeScout() {
    const root = this.add.container(0, 0);
    const shadow = this.add.ellipse(0, T * 0.36, T * 0.7, T * 0.18, 0x000000, 0.2);
    const arrow = this.add.graphics();
    const img = this.add.image(0, 0, 'scout').setDisplaySize(T * 0.9, T * 0.9);
    const bubble = this.add.container(T * 0.38, -T * 0.62);
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.95);
    bg.lineStyle(4, 0x1d3557, 1);
    bg.fillCircle(0, 0, T * 0.27);
    bg.strokeCircle(0, 0, T * 0.27);
    bg.fillCircle(-T * 0.24, T * 0.28, T * 0.06);
    bg.strokeCircle(-T * 0.24, T * 0.28, T * 0.06);
    const icon = this.add.image(0, 0, 'i_move').setDisplaySize(T * 0.36, T * 0.36);
    const dots = this.add.text(0, T * 0.02, '…', { fontFamily: 'sans-serif', fontSize: `${T * 0.3}px`, color: '#1d3557', fontStyle: 'bold' }).setOrigin(0.5);
    bubble.add([bg, icon, dots]);
    bubble.setVisible(false);
    root.add([shadow, arrow, img, bubble]);
    this.layerUnits.add(root);
    return { root, arrow, bubble, icon, dots };
  }

  /** Store positions at a tick boundary. Call right after every sim step. */
  capture() {
    if (!this.sim) return;
    this.prev = this.cur;
    this.cur = new Map();
    for (const v of this.sim.viruses) this.cur.set(`v${v.id}`, [v.x, v.y]);
    for (const s of this.sim.scouts) {
      const k = Math.min(1, s.anim);
      this.cur.set(`s${s.index}`, [s.fromX + (s.x - s.fromX) * k, s.fromY + (s.y - s.fromY) * k]);
    }
  }

  private lerped(key: string): [number, number] | null {
    const c = this.cur.get(key);
    if (!c) return null;
    const p = this.prev.get(key) ?? c;
    return [p[0] + (c[0] - p[0]) * this.alpha, p[1] + (c[1] - p[1]) * this.alpha];
  }

  /* ------------------------------------------------------------ drawing */

  private render() {
    const sim = this.sim;
    if (!sim) return;
    sim.turrets.forEach((t, i) => this.turretSprites[i]?.setPosition(center(t.x), center(t.y)));

    sim.cells.forEach((c, i) => {
      const s = this.cellSprites[i];
      const tex = c.healthy ? 'cell' : 'cellSick';
      if (s.texture.key !== tex) s.setTexture(tex);
    });

    // viruses
    const alive = new Set<number>();
    for (const v of sim.viruses) {
      alive.add(v.id);
      let sp = this.virusSprites.get(v.id);
      if (!sp) sp = this.makeVirus(v.id, v.kind);
      const pos = this.lerped(`v${v.id}`) ?? [v.x, v.y];
      sp.root.setPosition(center(pos[0]), center(pos[1]));
      const tex = v.kind === 'shellby' && !v.armoured ? 'shellbyBare' : v.kind;
      if (sp.img.texture.key !== tex) sp.img.setTexture(tex);
      sp.net.setVisible(v.held > 0);
      sp.glow.setVisible(v.healing);
      const size = VIRUS[v.kind].size * T;
      sp.bar.clear();
      if (v.hp < v.maxHp) {
        const w = size * 0.8;
        sp.bar.fillStyle(0x1d3557, 0.8);
        sp.bar.fillRoundedRect(-w / 2 - 2, -size * 0.62 - 2, w + 4, 12, 5);
        sp.bar.fillStyle(v.healing ? 0x7bd88f : 0xffd166, 1);
        sp.bar.fillRoundedRect(-w / 2, -size * 0.62, (w * Math.max(0, v.hp)) / v.maxHp, 8, 4);
      }
    }
    for (const [id, sp] of this.virusSprites) {
      if (!alive.has(id)) {
        sp.root.destroy();
        this.virusSprites.delete(id);
      }
    }

    // scouts
    sim.scouts.forEach((s, i) => {
      const sp = this.scoutSprites[i];
      if (!sp) return;
      const pos = this.lerped(`s${i}`) ?? [s.x, s.y];
      sp.root.setPosition(center(pos[0]), center(pos[1]));
      sp.arrow.clear();
      const a = Math.atan2(DY[s.dir], DX[s.dir]);
      const r = T * 0.5;
      sp.arrow.fillStyle(0x4cc9f0, 1);
      sp.arrow.lineStyle(4, 0x1d3557, 1);
      const pts = [
        new Phaser.Math.Vector2(Math.cos(a) * r, Math.sin(a) * r),
        new Phaser.Math.Vector2(Math.cos(a + 0.5) * r * 0.62, Math.sin(a + 0.5) * r * 0.62),
        new Phaser.Math.Vector2(Math.cos(a - 0.5) * r * 0.62, Math.sin(a - 0.5) * r * 0.62),
      ];
      sp.arrow.fillPoints(pts, true);
      sp.arrow.strokePoints(pts, true);
      const op = s.current?.op;
      sp.bubble.setVisible(!!op && this.interactive === 'run');
      if (op && op !== 'repeat') {
        sp.icon.setTexture(`i_${op}`).setDisplaySize(T * 0.36, T * 0.36);
        sp.icon.setVisible(!s.waiting);
        sp.dots.setVisible(s.waiting);
      }
    });

    // nets lying on tiles
    while (this.trapSprites.length < sim.traps.length) {
      const img = this.add.image(0, 0, 'netTex').setDisplaySize(T * 0.8, T * 0.8).setAlpha(0.85);
      this.layerTraps.add(img);
      this.trapSprites.push(img);
    }
    this.trapSprites.forEach((img, i) => {
      const t = sim.traps[i];
      img.setVisible(!!t);
      if (t) img.setPosition(center(t.x), center(t.y));
    });

    this.feverTint.setAlpha(sim.feverTicks > 0 ? 0.12 + 0.05 * Math.sin(this.time.now / 120) : 0);

    if (this.interactive !== 'plan') this.hoverTile.clear();
    // range ring of the selected bot
    this.rangeRing.clear();
    if (this.selected !== null && sim.turrets[this.selected]) {
      const t = sim.turrets[this.selected];
      const r = t.card === 'heal' ? HEAL_RANGE : TURRET[t.kind].range;
      this.rangeRing.fillStyle(t.card === 'heal' ? 0xff6b9a : 0x4cc9f0, 0.15);
      this.rangeRing.lineStyle(4, t.card === 'heal' ? 0xff6b9a : 0x4cc9f0, 0.8);
      this.rangeRing.fillCircle(center(t.x), center(t.y), r * T);
      this.rangeRing.strokeCircle(center(t.x), center(t.y), r * T);
    }
  }

  private makeVirus(id: number, kind: keyof typeof VIRUS) {
    const size = VIRUS[kind].size * T;
    const root = this.add.container(0, 0);
    const glow = this.add.circle(0, 0, size * 0.55, 0x7bd88f, 0.45).setVisible(false);
    const img = this.add.image(0, 0, kind).setDisplaySize(size, size);
    const net = this.add.image(0, 0, 'netTex').setDisplaySize(size * 1.05, size * 1.05).setVisible(false);
    const bar = this.add.graphics();
    root.add([glow, img, net, bar]);
    root.setScale(0.2);
    this.tweens.add({ targets: root, scale: 1, duration: 250, ease: 'Back.out' });
    this.tweens.add({ targets: img, angle: { from: -6, to: 6 }, duration: kind === 'zoomer' ? 160 : 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.layerUnits.add(root);
    const sp = { root, img, bar, net, glow };
    this.virusSprites.set(id, sp);
    return sp;
  }

  /* ------------------------------------------------------------ effects */

  handleEvents(evs: SimEvent[]) {
    for (const e of evs) {
      switch (e.t) {
        case 'zap': {
          const sp = this.virusSprites.get(e.virus);
          if (!sp) break;
          const fromX = e.source === 'tap' ? sp.root.x : center(e.fromX);
          const fromY = e.source === 'tap' ? sp.root.y - T : center(e.fromY);
          this.bolt(fromX, fromY, sp.root.x, sp.root.y, e.ping ? 0xc0c0c0 : e.source === 'tap' ? 0xffffff : 0x4cc9f0);
          if (e.ping) this.spark(sp.root.x, sp.root.y - 10, 0xdddddd, 6);
          else this.tweens.add({ targets: sp.img, alpha: 0.4, duration: 60, yoyo: true });
          break;
        }
        case 'pop':
          this.popFx(center(e.x), center(e.y), e.kind);
          break;
        case 'infect': {
          const s = this.cellSprites[e.cell];
          if (s) {
            this.spark(s.x, s.y, 0x9bd16b, 10);
            this.cameras.main.shake(120, 0.003);
          }
          break;
        }
        case 'heal': {
          const s = this.cellSprites[e.cell];
          if (s) {
            this.bolt(center(e.fromX), center(e.fromY), s.x, s.y, 0xff6b9a);
            this.hearts(s.x, s.y);
          }
          break;
        }
        case 'netThrow': {
          const n = this.add.image(center(e.fromX), center(e.fromY), 'netTex').setDisplaySize(T * 0.3, T * 0.3);
          this.layerFx.add(n);
          this.tweens.add({ targets: n, x: center(e.x), y: center(e.y), displayWidth: T * 0.8, displayHeight: T * 0.8, angle: 180, duration: 220, onComplete: () => n.destroy() });
          break;
        }
        case 'crack': {
          const sp = this.virusSprites.get(e.virus);
          if (sp) this.spark(sp.root.x, sp.root.y, 0x8d99ae, 14);
          break;
        }
        case 'bump': {
          const sp = this.scoutSprites[e.scout];
          if (sp) this.tweens.add({ targets: sp.root, angle: { from: -10, to: 10 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => sp.root.setAngle(0) });
          break;
        }
        case 'fever':
          this.cameras.main.flash(250, 255, 140, 40);
          break;
      }
    }
  }

  private bolt(x1: number, y1: number, x2: number, y2: number, color: number) {
    const g = this.add.graphics();
    this.layerFx.add(g);
    const n = 6;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 22;
      pts.push(new Phaser.Math.Vector2(x1 + (x2 - x1) * k + j, y1 + (y2 - y1) * k + j));
    }
    g.lineStyle(12, color, 0.35);
    g.strokePoints(pts);
    g.lineStyle(5, 0xffffff, 1);
    g.strokePoints(pts);
    this.tweens.add({ targets: g, alpha: 0, duration: 160, onComplete: () => g.destroy() });
  }

  private spark(x: number, y: number, color: number, count: number) {
    const p = this.add.particles(x, y, 'dot', { speed: { min: 80, max: 260 }, scale: { start: 0.9, end: 0 }, lifespan: 420, tint: color, emitting: false });
    this.layerFx.add(p);
    p.explode(count);
    this.time.delayedCall(600, () => p.destroy());
  }

  private hearts(x: number, y: number) {
    const p = this.add.particles(x, y, 'dot', { speedY: { min: -160, max: -60 }, speedX: { min: -50, max: 50 }, scale: { start: 1, end: 0 }, lifespan: 600, tint: [0xff6b9a, 0xffffff], emitting: false });
    this.layerFx.add(p);
    p.explode(10);
    this.time.delayedCall(800, () => p.destroy());
  }

  private popFx(x: number, y: number, kind: keyof typeof VIRUS) {
    const size = VIRUS[kind].size * T;
    const ring = this.add.circle(x, y, size * 0.4, 0xffffff, 0).setStrokeStyle(6, 0xffffff, 0.9);
    this.layerFx.add(ring);
    this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    const p = this.add.particles(x, y, 'dot', {
      speed: { min: 120, max: 320 },
      scale: { start: 0.8, end: 0 },
      lifespan: 450,
      tint: kind === 'zoomer' ? [0xb388ff, 0xffffff] : kind === 'shellby' ? [0xffb703, 0xffffff] : [0xa6e22e, 0xffffff],
      emitting: false,
    });
    this.layerFx.add(p);
    p.explode(14);
    this.time.delayedCall(600, () => p.destroy());
  }

  /** a little celebration over the cells at the end of a won level */
  celebrate() {
    for (const s of this.cellSprites) {
      this.tweens.add({ targets: s, y: s.y - 18, duration: 180, yoyo: true, repeat: 3, delay: Math.random() * 200, ease: 'Quad.out' });
      this.hearts(s.x, s.y);
    }
  }

  /* ------------------------------------------------------------ input */

  private toTile(p: Phaser.Input.Pointer): [number, number] {
    return [Math.floor(p.worldX / T), Math.floor(p.worldY / T)];
  }

  private onPointer(p: Phaser.Input.Pointer) {
    if (this.interactive === 'plan') {
      const [x, y] = this.toTile(p);
      this.hooks.onTile(x, y);
    } else if (this.interactive === 'run' && this.sim) {
      // generous hit area for small fingers: nearest virus within 0.9 tile
      let best: number | null = null;
      let bestD = T * 0.9;
      for (const [id, sp] of this.virusSprites) {
        const d = Math.hypot(sp.root.x - p.worldX, sp.root.y - p.worldY);
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
      if (best !== null) this.hooks.onVirusTap(best);
    }
  }

  private onHover(p: Phaser.Input.Pointer) {
    this.hoverTile.clear();
    if (this.interactive !== 'plan' || !this.placing || !this.sim) return;
    const [x, y] = this.toTile(p);
    const geo = geometry(this.level);
    if (x < 0 || y < 0 || x >= geo.w || y >= geo.h) return;
    const ok = geo.tiles[y][x] === 'tissue' && !this.sim.turrets.some((t) => t.x === x && t.y === y) && !this.sim.scouts.some((s) => s.x === x && s.y === y);
    this.hoverTile.lineStyle(5, ok ? 0x4cc9f0 : 0xe63946, 0.9);
    this.hoverTile.strokeRoundedRect(x * T + 4, y * T + 4, T - 8, T - 8, 16);
    if (ok) {
      this.hoverTile.fillStyle(0x4cc9f0, 0.1);
      this.hoverTile.fillCircle(center(x), center(y), TURRET[this.placing].range * T);
    }
  }

  /** Flash a tile red (e.g. cannot place here). */
  flashTile(x: number, y: number) {
    const r = this.add.rectangle(center(x), center(y), T - 8, T - 8, 0xe63946, 0.5);
    this.layerFx.add(r);
    this.tweens.add({ targets: r, alpha: 0, duration: 400, onComplete: () => r.destroy() });
  }

  /** Point at a tile with a bouncing hand (tutorial). */
  pointAt(x: number, y: number) {
    const ring = this.add.circle(center(x), center(y), T * 0.45, 0xffffff, 0).setStrokeStyle(6, 0xffffff, 1);
    this.layerUi.add(ring);
    this.tweens.add({ targets: ring, scale: 1.3, alpha: 0, duration: 700, repeat: 3, onComplete: () => ring.destroy() });
  }

  /** used by the editor to show which block is running */
  static opIcon(op: BlockOp): string {
    return `i_${op}`;
  }
}
