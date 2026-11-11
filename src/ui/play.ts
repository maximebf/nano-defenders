import Phaser from 'phaser';
import { h, img, svg } from './dom';
import { ICON } from './icons';
import { ProgramEditor } from './editor';
import { mentor, starRuleIcon, starRuleLabel, WORLD_NAMES, type Screen } from './screens';
import { BoardScene, T } from '../game/BoardScene';
import { Sim } from '../sim/sim';
import { canPlace, GRID_H, GRID_W } from '../sim/grid';
import { levelById, nextLevel } from '../levels';
import { save, persist, recordResult, isWorldDone } from '../save';
import { sfx, say, stopVoice, text, playMusic } from '../audio/audio';
import { go } from '../main';
import type { Card, Input, LevelDef, Setup, SimEvent, TimedInput, TurretKind } from '../sim/types';

const CARD_LABEL: Record<Card, string> = { nearest: 'Le plus proche', strongest: 'Le plus fort', heal: 'Soigner' };
const BOT_LABEL: Record<TurretKind, string> = { zappy: 'Zappy', netter: 'Filo' };
const TICK_MS = 100;

type Phase = 'plan' | 'run' | 'replay' | 'done';

function defaultSetup(level: LevelDef): Setup {
  return {
    bots: [],
    programs: (level.scouts ?? []).map(() => ({ v: 1 as const, blocks: [] })),
    slotCards: (level.slots ?? []).map(() => 'nearest' as Card),
  };
}

function cloneSetup(s: Setup): Setup {
  return JSON.parse(JSON.stringify(s));
}

export function playScreen(params: { id: string }): Screen {
  const level = levelById(params.id);
  if (!level) {
    setTimeout(() => go('map'));
    return { el: h('div') };
  }
  return new PlayController(level).screen();
}

class PlayController {
  private setup: Setup;
  private phase: Phase = 'plan';
  private sim: Sim;
  private scene!: BoardScene;
  private game!: Phaser.Game;
  private acc = 0;
  private speed: number;
  private paused = false;
  private pendingInputs: Input[] = [];
  private log: TimedInput[] = [];
  private lastLog: TimedInput[] = [];
  private lastSetup: Setup | null = null;
  private placing: TurretKind | null = null;
  private selected: { kind: 'bot' | 'slot'; index: number } | null = null;
  private editor: ProgramEditor | null = null;

  private root!: HTMLElement;
  private panel!: HTMLElement;
  private controls!: HTMLElement;
  private overlay!: HTMLElement;
  private hud!: HTMLElement;
  private hintEl!: HTMLElement;

  constructor(private level: LevelDef) {
    const saved = save.setups[level.id];
    this.setup = saved ? cloneSetup(saved) : defaultSetup(level);
    // drop bots that no longer fit (level data may have changed)
    this.setup.bots = this.setup.bots.filter((b, i, all) => canPlace(level, all.slice(0, i), b.x, b.y));
    this.setup.programs = (level.scouts ?? []).map((_, i) => this.setup.programs[i] ?? { v: 1, blocks: [] });
    this.setup.slotCards = (level.slots ?? []).map((_, i) => this.setup.slotCards?.[i] ?? 'nearest');
    this.sim = new Sim(level, this.setup);
    this.speed = save.settings.speed;
    this.placing = this.firstPlaceable();
  }

  screen(): Screen {
    const level = this.level;
    const board = h('div', { class: 'board' });
    this.hud = h('div', { class: 'hud' });
    this.panel = h('div', { class: 'panel-body' });
    this.controls = h('div', { class: 'controls' });
    this.overlay = h('div', { class: 'overlay hidden' });
    this.hintEl = h('div', { class: 'hint-slot' });
    const toggle = h('button', { class: 'btn view-toggle', onclick: () => { this.root.classList.toggle('show-panel'); this.game?.scale.refresh(); } }, svg(ICON.map), svg(ICON.code));
    this.root = h(
      'div',
      { class: `screen play world-bg-${level.world}` },
      h(
        'div',
        { class: 'play-main' },
        h('div', { class: 'board-wrap' }, board, this.hud),
        h(
          'div',
          { class: 'panel' },
          h(
            'div',
            { class: 'panel-top' },
            h('button', { class: 'btn round small', 'aria-label': 'Retour', onclick: () => { sfx.tap(); go('levels', { world: level.world }); } }, svg(ICON.back)),
            h('div', { class: 'panel-title' }, h('b', null, level.id), ' ', level.name),
            h('button', { class: 'btn round small', 'aria-label': 'Aide', onclick: () => this.showHint(true) }, h('b', null, '?')),
          ),
          this.hintEl,
          this.panel,
          this.controls,
        ),
      ),
      toggle,
      this.overlay,
    );

    if (import.meta.env.DEV) (window as unknown as { __play: unknown }).__play = this;
    // Phaser needs its parent in the page to measure it
    requestAnimationFrame(() => this.mountBoard(board));
    playMusic(level.world, false);
    this.renderPanel();
    this.renderControls();
    this.renderHud();
    if ((save.fails[level.id] ?? 0) >= 2) setTimeout(() => this.showHint(false), 400);
    else setTimeout(() => this.firstHint(), 500);
    return {
      el: this.root,
      destroy: () => {
        stopVoice();
        this.editor?.destroy();
        this.game?.destroy(true);
      },
    };
  }

  private mountBoard(board: HTMLElement) {
    const level = this.level;
    const scene = new BoardScene();
    this.scene = scene;
    this.game = new Phaser.Game({
      type: new URLSearchParams(location.search).get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
      parent: board,
      width: GRID_W * T,
      height: GRID_H * T,
      transparent: true,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { activePointers: 3 },
      banner: false,
      render: { antialias: true, roundPixels: false },
      scene: [],
    });
    this.game.scene.add('board', scene, true, {
      level,
      hooks: {
        onTile: (x: number, y: number) => this.onTile(x, y),
        onVirusTap: (id: number) => this.onVirusTap(id),
        onFrame: (dt: number) => this.frame(dt),
      },
    });
    this.game.events.once('board-ready', () => {
      scene.setSim(this.sim);
      this.syncScene();
    });
  }

  /* ------------------------------------------------------------ plan phase */

  private remaining(kind: TurretKind): number {
    return (this.level.bots[kind] ?? 0) - this.setup.bots.filter((b) => b.kind === kind).length;
  }

  private firstPlaceable(): TurretKind | null {
    return (['zappy', 'netter'] as TurretKind[]).find((k) => this.remaining(k) > 0) ?? null;
  }

  private setupChanged() {
    save.setups[this.level.id] = cloneSetup(this.setup);
    persist();
    this.sim = new Sim(this.level, this.setup);
    this.scene?.setSim(this.sim);
    this.syncScene();
    this.renderPanel();
    this.renderControls();
  }

  private syncScene() {
    if (!this.scene) return;
    const fixed = (this.level.fixedBots?.length ?? 0) + (this.level.slots?.length ?? 0);
    this.scene.selected = this.selected ? (this.selected.kind === 'slot' ? (this.level.fixedBots?.length ?? 0) + this.selected.index : fixed + this.selected.index) : null;
    this.scene.placing = this.phase === 'plan' ? this.placing : null;
    this.scene.interactive = this.phase === 'plan' ? 'plan' : this.phase === 'run' ? 'run' : 'none';
  }

  private onTile(x: number, y: number) {
    if (this.phase !== 'plan') return;
    const botIndex = this.setup.bots.findIndex((b) => b.x === x && b.y === y);
    const slotIndex = (this.level.slots ?? []).findIndex((s) => s.x === x && s.y === y);
    if (botIndex >= 0) {
      if (this.selected?.kind === 'bot' && this.selected.index === botIndex && !this.level.cards) {
        // second tap on a selected bot without cards: pick it back up
        this.removeBot(botIndex);
        return;
      }
      sfx.tap();
      this.selected = { kind: 'bot', index: botIndex };
      this.syncScene();
      this.renderPanel();
      return;
    }
    if (slotIndex >= 0) {
      sfx.tap();
      this.selected = { kind: 'slot', index: slotIndex };
      this.syncScene();
      this.renderPanel();
      return;
    }
    const kind = this.placing && this.remaining(this.placing) > 0 ? this.placing : this.firstPlaceable();
    if (!kind) {
      if (this.selected) {
        this.selected = null;
        this.syncScene();
        this.renderPanel();
      } else if (this.level.bots.zappy || this.level.bots.netter) this.scene.flashTile(x, y);
      return;
    }
    if (!canPlace(this.level, this.setup.bots, x, y)) {
      sfx.bump();
      this.scene.flashTile(x, y);
      return;
    }
    this.setup.bots.push({ kind, x, y, card: 'nearest' });
    this.selected = { kind: 'bot', index: this.setup.bots.length - 1 };
    if (this.remaining(kind) <= 0) this.placing = this.firstPlaceable();
    sfx.place();
    this.setupChanged();
  }

  private removeBot(i: number) {
    this.setup.bots.splice(i, 1);
    this.selected = null;
    this.placing = this.placing && this.remaining(this.placing) > 0 ? this.placing : this.firstPlaceable();
    sfx.remove();
    this.setupChanged();
  }

  private setCard(card: Card) {
    if (!this.selected) return;
    if (this.selected.kind === 'bot') this.setup.bots[this.selected.index].card = card;
    else this.setup.slotCards![this.selected.index] = card;
    sfx.place();
    void say([`c_${card}`]);
    this.setupChanged();
  }

  /* ------------------------------------------------------------ panel */

  private renderPanel() {
    const level = this.level;
    const parts: (HTMLElement | null)[] = [];
    const locked = this.phase !== 'plan';

    // bots to place
    const kinds = (['zappy', 'netter'] as TurretKind[]).filter((k) => (level.bots[k] ?? 0) > 0);
    if (kinds.length) {
      parts.push(
        h(
          'div',
          { class: 'section' },
          h('div', { class: 'section-title' }, 'Tes robots'),
          h(
            'div',
            { class: 'bot-palette' },
            kinds.map((k) =>
              h(
                'button',
                {
                  class: `bot-card ${this.placing === k ? 'on' : ''} ${this.remaining(k) <= 0 ? 'empty' : ''}`,
                  disabled: locked,
                  onclick: () => {
                    sfx.tap();
                    this.placing = k;
                    this.selected = null;
                    this.syncScene();
                    this.renderPanel();
                    void say([`n_${k}`]);
                  },
                },
                img(k),
                h('span', { class: 'bot-name' }, BOT_LABEL[k]),
                h('span', { class: 'bot-count' }, `×${this.remaining(k)}`),
              ),
            ),
          ),
          !locked && this.setup.bots.length === 0 ? h('p', { class: 'tip' }, svg(ICON.hand), 'Touche une case rose pour poser un robot.') : null,
        ),
      );
    }

    // selected bot: card choice / remove
    if (this.selected && !locked) {
      const sel = this.selected;
      const card = sel.kind === 'bot' ? this.setup.bots[sel.index]?.card : this.setup.slotCards![sel.index];
      const bot = sel.kind === 'bot' ? this.setup.bots[sel.index] : null;
      const cards = level.cards && (!bot || bot.kind === 'zappy') ? level.cards : null;
      parts.push(
        h(
          'div',
          { class: 'section selected-bot' },
          h('div', { class: 'section-title' }, sel.kind === 'slot' ? `Robot ${sel.index + 1}` : BOT_LABEL[bot!.kind], cards ? ' : choisis sa carte' : ''),
          cards
            ? h(
                'div',
                { class: 'cards' },
                cards.map((c) =>
                  h('button', { class: `card ${card === c ? 'on' : ''} card-${c}`, onclick: () => this.setCard(c) }, svg(ICON[c]), h('span', null, CARD_LABEL[c])),
                ),
              )
            : null,
          bot ? h('button', { class: 'btn small remove', onclick: () => this.removeBot(sel.index) }, svg(ICON.bin), h('span', null, 'Enlever')) : null,
        ),
      );
    }

    // slot overview (World 2)
    if (level.slots && !this.selected) {
      parts.push(
        h(
          'div',
          { class: 'section' },
          h('div', { class: 'section-title' }, 'Une carte pour chaque robot'),
          h(
            'div',
            { class: 'slot-list' },
            level.slots.map((_, i) =>
              h(
                'button',
                {
                  class: 'slot-item',
                  disabled: locked,
                  onclick: () => {
                    sfx.tap();
                    this.selected = { kind: 'slot', index: i };
                    this.syncScene();
                    this.renderPanel();
                  },
                },
                h('span', { class: 'slot-num' }, String(i + 1)),
                img('zappy'),
                svg(ICON[this.setup.slotCards![i]], 'slot-card'),
              ),
            ),
          ),
          !locked ? h('p', { class: 'tip' }, svg(ICON.hand), 'Touche un robot pour changer sa carte.') : null,
        ),
      );
    }

    // program editor (World 3)
    if (level.scouts?.length) {
      if (!this.editor) {
        this.editor = new ProgramEditor(this.setup.programs[0], level.blocks ?? [], level.blockBudget ?? 8, () => this.setupChanged());
      }
      this.editor.setLocked(locked);
      parts.push(this.editor.el);
    }

    this.panel.replaceChildren(...parts.filter((p): p is HTMLElement => !!p));
  }

  private renderControls() {
    const c: HTMLElement[] = [];
    if (this.phase === 'plan') {
      c.push(h('button', { class: 'btn big go play-btn', onclick: () => this.start() }, svg(ICON.play), h('span', null, 'Go !')));
    } else if (this.phase === 'run' || this.phase === 'replay') {
      const speedBtn = (v: number, icon: keyof typeof ICON) =>
        h('button', { class: `btn round ${this.speed === v && !this.paused ? 'on' : ''}`, 'aria-label': icon, onclick: () => { sfx.tap(); this.speed = v; this.paused = false; this.renderControls(); } }, svg(ICON[icon]));
      c.push(
        h(
          'div',
          { class: 'run-row' },
          h('button', { class: `btn round ${this.paused ? 'on' : ''}`, 'aria-label': 'pause', onclick: () => { sfx.tap(); this.paused = !this.paused; this.renderControls(); } }, svg(ICON[this.paused ? 'play' : 'pause'])),
          h('button', { class: 'btn round', 'aria-label': 'pas à pas', onclick: () => { this.paused = true; this.step(); this.renderControls(); } }, svg(ICON.step)),
          speedBtn(0.5, 'slow'),
          speedBtn(1, 'normal'),
          speedBtn(2.5, 'fast'),
          h('button', { class: 'btn round stop', 'aria-label': 'arrêter', onclick: () => { sfx.tap(); this.backToPlan(); } }, h('b', { class: 'stop-square' })),
        ),
      );
    }
    this.controls.replaceChildren(...c);
  }

  private renderHud() {
    const sim = this.sim;
    const cells = h('div', { class: 'hud-item' }, svg(ICON.cell), h('b', null, `${sim.healthyCells}/${sim.cells.length}`));
    const waves = h('div', { class: 'hud-item' }, h('span', { class: 'hud-label' }, 'Vague'), h('b', null, `${Math.max(1, sim.wave)}/${sim.waveCount}`));
    const left = h('div', { class: 'hud-item' }, img('snifflet', 'hud-virus'), h('b', null, String(sim.virusesLeft)));
    this.hud.replaceChildren(cells, waves, left, this.phase === 'replay' ? h('div', { class: 'hud-item replay-tag' }, svg(ICON.replay), 'Revoir') : '');
    this.renderFever();
  }

  private feverEl: HTMLElement | null = null;
  private renderFever() {
    this.feverEl?.remove();
    this.feverEl = null;
    if (this.level.fever <= 0 || this.phase !== 'run') return;
    const sim = this.sim;
    this.feverEl = h(
      'button',
      { class: `btn fever-btn ${sim.feverLeft <= 0 ? 'used' : ''} ${sim.feverTicks > 0 ? 'active' : ''}`, 'aria-label': 'fièvre', onclick: () => this.queue({ t: 'fever' }) },
      svg(ICON.fever),
      h('span', { class: 'fever-pips' }, Array.from({ length: this.level.fever }, (_, i) => h('span', { class: `pip ${i < sim.feverLeft ? 'on' : ''}` }))),
    );
    this.root.querySelector('.board-wrap')?.append(this.feverEl);
  }

  /* ------------------------------------------------------------ run phase */

  private start() {
    const missing = this.level.scouts?.length && this.setup.programs[0].blocks.length === 0;
    if (missing) {
      sfx.bump();
      void say(['code_hint']);
      return;
    }
    if ((this.level.bots.zappy || this.level.bots.netter) && this.setup.bots.length === 0) {
      sfx.bump();
      void say(['place_hint']);
      return;
    }
    stopVoice();
    sfx.go();
    this.selected = null;
    this.lastSetup = cloneSetup(this.setup);
    this.sim = new Sim(this.level, this.setup);
    this.log = [];
    this.pendingInputs = [];
    this.acc = 0;
    this.paused = false;
    this.phase = 'run';
    this.hintEl.replaceChildren();
    this.root.classList.remove('show-panel');
    requestAnimationFrame(() => this.game.scale.refresh());
    this.scene.setSim(this.sim);
    this.syncScene();
    this.renderPanel();
    this.renderControls();
    this.renderHud();
    playMusic(this.level.world, true);
  }

  private backToPlan() {
    this.phase = 'plan';
    this.overlay.classList.add('hidden');
    this.sim = new Sim(this.level, this.setup);
    this.scene.setSim(this.sim);
    this.editor?.setRunning(null);
    this.syncScene();
    this.renderPanel();
    this.renderControls();
    this.renderHud();
    playMusic(this.level.world, false);
    if ((save.fails[this.level.id] ?? 0) >= 2) this.showHint(false);
  }

  private queue(input: Input) {
    if (this.phase !== 'run') return;
    this.pendingInputs.push(input);
  }

  private onVirusTap(id: number) {
    if (!this.level.tapZap) return;
    this.queue({ t: 'tap', virus: id });
  }

  private frame(dt: number) {
    if (this.phase !== 'run' && this.phase !== 'replay') return;
    if (this.paused) {
      this.scene.alpha = 1;
      return;
    }
    this.acc += Math.min(dt, 100) * this.speed;
    let steps = 0;
    while (this.acc >= TICK_MS && steps < 10 && (this.phase === 'run' || this.phase === 'replay')) {
      this.acc -= TICK_MS;
      this.step();
      steps++;
    }
    this.scene.alpha = Math.min(1, this.acc / TICK_MS);
  }

  private step() {
    if (this.sim.status !== 'running') return;
    let inputs: Input[];
    const tick = this.sim.tick + 1;
    if (this.phase === 'replay') {
      inputs = this.lastLog.filter((l) => l.tick === tick).map((l) => l.input);
    } else {
      inputs = this.pendingInputs;
      this.pendingInputs = [];
      for (const input of inputs) this.log.push({ tick, input });
    }
    const evs = this.sim.step(inputs);
    this.scene.capture();
    this.scene.handleEvents(evs);
    this.react(evs);
    if (this.sim.status !== 'running') this.finish();
  }

  private react(evs: SimEvent[]) {
    let hud = false;
    let controls = false;
    for (const e of evs) {
      switch (e.t) {
        case 'zap':
          if (e.ping) sfx.ping();
          else sfx.zap();
          break;
        case 'pop':
          sfx.pop();
          hud = true;
          break;
        case 'infect':
          sfx.infect();
          hud = true;
          break;
        case 'heal':
          sfx.heal();
          hud = true;
          break;
        case 'netThrow':
          sfx.net();
          break;
        case 'crack':
          sfx.crack();
          break;
        case 'bump':
          sfx.bump();
          break;
        case 'spawn':
          hud = true;
          break;
        case 'wave':
          if (e.n > 1) {
            sfx.wave();
            this.banner(`Vague ${e.n} !`);
          }
          hud = true;
          break;
        case 'fever':
          sfx.fever();
          void say(['fever']);
          controls = true;
          break;
        case 'block':
          this.editor?.setRunning(e.path ? e.path[0] : null);
          if (e.op === 'move') sfx.move();
          else if (e.op === 'turnLeft' || e.op === 'turnRight') sfx.turn();
          else if (e.op === 'wait') sfx.wait();
          break;
      }
    }
    if (this.sim.feverTicks === 1) controls = true;
    if (hud) this.renderHud();
    if (controls) this.renderFever();
  }

  private banner(textContent: string) {
    const b = h('div', { class: 'banner' }, textContent);
    this.root.querySelector('.board-wrap')!.append(b);
    setTimeout(() => b.remove(), 1600);
  }

  private finish() {
    const wasReplay = this.phase === 'replay';
    this.phase = 'done';
    this.syncScene();
    this.editor?.setRunning(null);
    const r = this.sim.result();
    this.renderControls();
    playMusic(this.level.world, false);
    if (!wasReplay) {
      this.lastLog = this.log;
      recordResult(this.level.id, r.stars);
    }
    if (r.won) {
      sfx.win();
      this.scene.celebrate();
      setTimeout(() => this.showWin(r.stars), 1100);
    } else {
      sfx.lose();
      setTimeout(() => this.showLose(), 700);
    }
  }

  private replay() {
    if (!this.lastSetup) return;
    stopVoice();
    this.overlay.classList.add('hidden');
    this.sim = new Sim(this.level, this.lastSetup);
    this.acc = 0;
    this.paused = false;
    this.speed = 1;
    this.phase = 'replay';
    this.scene.setSim(this.sim);
    this.syncScene();
    this.renderControls();
    this.renderHud();
  }

  /* ------------------------------------------------------------ results */

  private showWin(stars: [boolean, boolean, boolean]) {
    const level = this.level;
    const next = nextLevel(level.id);
    const worldDone = !next || next.world !== level.world;
    const count = stars.filter(Boolean).length;
    const starEls = stars.map((on, i) => svg(ICON.star, `big-star ${on ? 'on' : ''} s${i}`));
    const labels = [
      h('div', { class: 'star-label' }, svg(ICON.cell), 'Gagné'),
      h('div', { class: 'star-label' }, svg(ICON.heal), 'Toutes les cellules'),
      h('div', { class: 'star-label' }, svg(ICON[starRuleIcon(level.star3)]), starRuleLabel(level.star3)),
    ];
    const fact = h('div', { class: 'fact' }, h('div', { class: 'fact-title' }, 'Le savais-tu ?'), mentor([`L${level.id}_fact`]));
    const buttons = h(
      'div',
      { class: 'overlay-buttons' },
      h('button', { class: 'btn round', 'aria-label': 'Carte', onclick: () => { sfx.tap(); go(worldDone ? 'map' : 'levels', { world: level.world }); } }, svg(ICON.map)),
      h('button', { class: 'btn round', 'aria-label': 'Revoir', onclick: () => this.replay() }, svg(ICON.replay)),
      h('button', { class: 'btn round', 'aria-label': 'Rejouer', onclick: () => { sfx.tap(); this.backToPlan(); } }, svg(ICON.retry)),
      next && !worldDone
        ? h('button', { class: 'btn big go', onclick: () => { sfx.go(); go('briefing', { id: next.id }); } }, svg(ICON.next), h('span', null, 'Suivant'))
        : h('button', { class: 'btn big go', onclick: () => { sfx.go(); go('map'); } }, svg(ICON.map), h('span', null, 'Carte')),
    );
    const extra = worldDone ? h('div', { class: 'world-done' }, `${WORLD_NAMES[level.world - 1]} : tout propre !`) : null;
    this.overlay.replaceChildren(
      h('div', { class: 'overlay-card win' }, h('h2', null, count === 3 ? 'Parfait !' : 'Bravo !'), h('div', { class: 'stars' }, starEls), h('div', { class: 'star-labels' }, labels), extra, fact, buttons),
    );
    this.overlay.classList.remove('hidden');
    stars.forEach((on, i) => {
      if (on) setTimeout(() => { starEls[i].classList.add('pop'); sfx.star(i); }, 300 + i * 350);
    });
    const voice = [`win_${count}`];
    if (worldDone) voice.push(next ? 'world_done' : isWorldDone(3) ? 'all_done' : 'world_done');
    setTimeout(() => void say([...voice, `L${level.id}_fact`]), 600);
  }

  private showLose() {
    const fails = save.fails[this.level.id] ?? 0;
    this.overlay.replaceChildren(
      h(
        'div',
        { class: 'overlay-card lose' },
        img('cellSick', 'lose-img'),
        h('h2', null, 'Les virus sont passés…'),
        h('p', null, 'Pas grave ! On change le plan et on réessaie.'),
        h(
          'div',
          { class: 'overlay-buttons' },
          h('button', { class: 'btn', onclick: () => this.replay() }, svg(ICON.replay), h('span', null, 'Revoir')),
          h('button', { class: 'btn big go', onclick: () => { sfx.tap(); this.backToPlan(); } }, svg(ICON.retry), h('span', null, 'Réessayer')),
        ),
      ),
    );
    this.overlay.classList.remove('hidden');
    void say(fails >= 2 ? ['lose', `L${this.level.id}_hint`] : ['lose']);
  }

  /* ------------------------------------------------------------ mentor help */

  private firstHint() {
    if (this.phase !== 'plan') return;
    const l = this.level;
    if (l.slots) void say(['card_hint']);
    else if (l.scouts?.length && this.setup.programs[0].blocks.length === 0) void say(['code_hint']);
    else if ((l.bots.zappy || l.bots.netter) && this.setup.bots.length === 0) void say(['place_hint']);
  }

  private showHint(fromButton: boolean) {
    const id = `L${this.level.id}_hint`;
    if (text(id) === id) return;
    if (fromButton) sfx.tap();
    this.hintEl.replaceChildren(
      h('div', { class: 'hint' }, mentor([id]), h('button', { class: 'btn round small close', 'aria-label': 'fermer', onclick: () => { stopVoice(); this.hintEl.replaceChildren(); } }, h('b', null, '×'))),
    );
  }
}
