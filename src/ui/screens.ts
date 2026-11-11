import { h, img, svg } from './dom';
import { ICON } from './icons';
import { WORLDS, levelById } from '../levels';
import { save, persist, starCount, isLevelUnlocked, isWorldUnlocked, isWorldDone, resetSave, exportSave, importSave } from '../save';
import { say, sfx, stopVoice, text, unlockAudio, playMusic, preloadVoice } from '../audio/audio';
import { go } from '../main';
import type { LevelDef, StarRule } from '../sim/types';

export interface Screen {
  el: HTMLElement;
  destroy?: () => void;
}

export const WORLD_NAMES = ['Le Nez', 'La Gorge', 'Le Sang'];

function button(icon: keyof typeof ICON, cls: string, onclick: () => void, label?: string) {
  return h('button', { class: `btn ${cls}`, onclick: () => { sfx.tap(); onclick(); }, 'aria-label': label ?? icon }, svg(ICON[icon]), label && !cls.includes('round') ? h('span', null, label) : null);
}

/** Pixel with a speech bubble that shows (and says) lines one by one. */
export function mentor(lines: string[], opts: { big?: boolean; onDone?: () => void } = {}) {
  const bubble = h('div', { class: 'bubble' });
  const replay = h('button', { class: 'btn round small speak', 'aria-label': 'réécouter', onclick: () => run() }, svg(ICON.speak));
  const el = h('div', { class: `mentor ${opts.big ? 'big' : ''}` }, img('pixel', 'pixel-img'), h('div', { class: 'bubble-wrap' }, bubble, replay));
  const run = () =>
    say(lines, (id, i) => {
      bubble.textContent = text(id);
      bubble.classList.remove('pop');
      void bubble.offsetWidth;
      bubble.classList.add('pop');
      el.dataset.line = String(i);
    }).then(() => opts.onDone?.());
  bubble.textContent = text(lines[0]);
  setTimeout(run, 150);
  return el;
}

/* ------------------------------------------------------------------ title */

export function titleScreen(): Screen {
  const start = () => {
    unlockAudio();
    const el = document.documentElement;
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (!standalone && el.requestFullscreen && !/iPhone|iPad/.test(navigator.userAgent)) el.requestFullscreen().catch(() => undefined);
    playMusic(0, false);
    if (!save.seenIntro || !save.bodyName) go('naming');
    else go('map');
  };
  const el = h(
    'div',
    { class: 'screen title' },
    h('div', { class: 'title-floaters' }, img('snifflet', 'floater f1'), img('zoomer', 'floater f2'), img('shellby', 'floater f3'), img('zappy', 'floater f4'), img('scout', 'floater f5')),
    h('h1', { class: 'logo' }, h('span', null, 'Nano'), h('span', null, 'Défenseurs')),
    img('pixel', 'title-pixel'),
    h('button', { class: 'btn big go', onclick: start }, svg(ICON.play), h('span', null, 'Jouer')),
    h('div', { class: 'corner' }, button('gear', 'round', () => { unlockAudio(); go('settings'); }, 'Réglages')),
  );
  return { el };
}

/* ------------------------------------------------------------------ naming */

export function namingScreen(): Screen {
  const input = h('input', { class: 'name-input', maxlength: '14', placeholder: 'Nom de ton ami', value: save.bodyName, autocomplete: 'off', autocapitalize: 'words' }) as HTMLInputElement;
  const ok = () => {
    const name = input.value.trim() || 'Nino';
    save.bodyName = name.charAt(0).toUpperCase() + name.slice(1);
    save.seenIntro = true;
    persist();
    sfx.go();
    void say(['name_ok']);
    go('map');
  };
  const suggestions = ['Nino', 'Lila', 'Max', 'Zoé', 'Tom', 'Mia'].map((n) =>
    h('button', { class: 'chip', onclick: () => { sfx.tap(); input.value = n; } }, n),
  );
  const el = h(
    'div',
    { class: 'screen naming' },
    mentor(['hello', 'name_ask'], { big: true }),
    h('div', { class: 'name-box' }, input, h('div', { class: 'chips' }, suggestions), h('button', { class: 'btn big go', onclick: ok }, svg(ICON.next), h('span', null, "C'est parti"))),
  );
  return { el, destroy: stopVoice };
}

/* ------------------------------------------------------------------ body map */

// zone positions on the body drawing (percent of the figure box)
const ZONES = [
  { world: 1, x: 50, y: 13, name: WORLD_NAMES[0] },
  { world: 2, x: 50, y: 25, name: WORLD_NAMES[1] },
  { world: 3, x: 38, y: 47, name: WORLD_NAMES[2] },
];

function bodySvg(): string {
  // a friendly rounded character silhouette
  return `<svg viewBox="0 0 200 300" class="body-svg" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="skin" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffd3b5"/><stop offset="1" stop-color="#f7b796"/></linearGradient></defs>
    <g stroke="#1d3557" stroke-width="5" stroke-linejoin="round" fill="url(#skin)">
      <path d="M58 150 Q30 190 34 228 Q36 240 46 236 Q52 200 70 170 Z"/>
      <path d="M142 150 Q170 190 166 228 Q164 240 154 236 Q148 200 130 170 Z"/>
      <path d="M78 215 L72 285 Q72 296 86 296 L98 296 L100 230 L102 296 L114 296 Q128 296 128 285 L122 215 Z"/>
      <path d="M70 92 Q100 82 130 92 Q150 100 148 150 L140 222 Q100 236 60 222 L52 150 Q50 100 70 92 Z"/>
      <circle cx="100" cy="46" r="40"/>
    </g>
    <path d="M70 92 Q100 82 130 92 Q150 100 148 150 L140 222 Q100 236 60 222 L52 150 Q50 100 70 92 Z" fill="#ffd166" stroke="#1d3557" stroke-width="5"/><path d="M60 150 Q100 160 140 150" stroke="#f4a259" stroke-width="8" fill="none" opacity=".6"/>
    <circle cx="86" cy="42" r="5" fill="#1d3557"/><circle cx="114" cy="42" r="5" fill="#1d3557"/>
    <path d="M86 62 Q100 72 114 62" stroke="#1d3557" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="76" cy="56" r="6" fill="#ff8fa3" opacity=".6"/><circle cx="124" cy="56" r="6" fill="#ff8fa3" opacity=".6"/>
  </svg>`;
}

export function mapScreen(): Screen {
  playMusic(0, false);
  const figure = h('div', { class: 'body-figure', html: bodySvg() });
  for (const z of ZONES) {
    const unlocked = isWorldUnlocked(z.world);
    const done = isWorldDone(z.world);
    const stars = WORLDS[z.world - 1].reduce((n, l) => n + starCount(l.id), 0);
    figure.append(
      h(
        'button',
        {
          class: `zone ${unlocked ? '' : 'locked'} ${done ? 'done' : ''}`,
          style: `left:${z.x}%;top:${z.y}%`,
          onclick: () => {
            if (!unlocked) return sfx.bump();
            sfx.tap();
            go('levels', { world: z.world });
          },
        },
        h('span', { class: 'zone-dot' }, unlocked ? String(z.world) : svg(ICON.lock)),
        h('span', { class: 'zone-name' }, z.name, unlocked ? h('small', null, `★ ${stars}/18`) : null),
      ),
    );
  }
  const el = h(
    'div',
    { class: 'screen map' },
    h('div', { class: 'topbar' }, button('home', 'round', () => go('title'), 'Accueil'), h('h2', null, `Le corps de ${save.bodyName || 'ton ami'}`), button('gear', 'round', () => go('settings'), 'Réglages')),
    h('div', { class: 'map-body' }, figure, mentor(['map_hello'])),
  );
  return { el, destroy: stopVoice };
}

/* ------------------------------------------------------------------ level select */

export function levelsScreen(params: { world: number }): Screen {
  const w = params.world;
  playMusic(w, false);
  const list = WORLDS[w - 1].map((l) => {
    const unlocked = isLevelUnlocked(l.id);
    const s = save.stars[l.id] ?? [false, false, false];
    return h(
      'button',
      {
        class: `level-btn w${w} ${unlocked ? '' : 'locked'}`,
        onclick: () => {
          if (!unlocked) return sfx.bump();
          sfx.tap();
          go('briefing', { id: l.id });
        },
      },
      h('span', { class: 'level-num' }, unlocked ? `${l.index}` : svg(ICON.lock)),
      h('span', { class: 'level-name' }, l.name),
      h('span', { class: 'level-stars' }, s.map((on) => svg(ICON.star, `star ${on ? 'on' : ''}`))),
      l.index === 6 ? h('span', { class: 'boss-tag' }, 'Chef') : null,
    );
  });
  const el = h(
    'div',
    { class: `screen levels world-bg-${w}` },
    h('div', { class: 'topbar' }, button('back', 'round', () => go('map'), 'Retour'), h('h2', null, `${w}. ${WORLD_NAMES[w - 1]}`), h('span', { class: 'spacer' })),
    h('div', { class: 'level-grid' }, list),
  );
  return { el };
}

/* ------------------------------------------------------------------ briefing */

const INTRO_IMG: Record<string, string> = { zappy: 'zappy', netter: 'netter', scout: 'scout', snifflet: 'snifflet', bigSnifflet: 'bigSnifflet', zoomer: 'zoomer', shellby: 'shellby' };

export function starRuleLabel(r: StarRule): string {
  switch (r.kind) {
    case 'maxBots':
      return r.n === 1 ? '1 seul robot' : `${r.n} robots maximum`;
    case 'maxBlocks':
      return `${r.n} blocs maximum`;
    case 'noFever':
      return 'Sans la fièvre';
    case 'noTap':
      return 'Sans toucher les virus';
  }
}

export function starRuleIcon(r: StarRule): keyof typeof ICON {
  return r.kind === 'maxBots' ? 'bot' : r.kind === 'maxBlocks' ? 'code' : r.kind === 'noFever' ? 'fever' : 'tap';
}

export function briefingLines(level: LevelDef): string[] {
  return [1, 2, 3].map((i) => `L${level.id}_b${i}`).filter((id) => text(id) !== id);
}

export function briefingScreen(params: { id: string }): Screen {
  const level = levelById(params.id)!;
  playMusic(level.world, false);
  const lines = briefingLines(level);
  preloadVoice([...lines, `L${level.id}_hint`, `L${level.id}_fact`, 'win_1', 'win_2', 'win_3', 'lose']);
  let intro: HTMLElement | null = null;
  const t = level.intro;
  if (t) {
    let picture: HTMLElement;
    let line: string;
    if (t.kind === 'card') {
      picture = svg(ICON[t.id], 'intro-icon');
      line = `c_${t.id}`;
    } else if (t.kind === 'block') {
      picture = svg(ICON[t.id as keyof typeof ICON], 'intro-icon block-icon');
      line = `b_${t.id}`;
    } else if (t.kind === 'power') {
      picture = svg(ICON.fever, 'intro-icon');
      line = 'n_fever';
    } else {
      picture = img(INTRO_IMG[t.id], 'intro-img');
      line = `n_${t.id}`;
    }
    intro = h('button', { class: 'intro-card', onclick: () => void say([line]) }, h('span', { class: 'new-tag' }, 'Nouveau !'), picture, h('span', { class: 'intro-name' }, text(line).split(/[,.]/)[0]));
  }
  const g = level.map.join('').split('C').length - 1;
  const goals = h(
    'div',
    { class: 'goals' },
    h('div', { class: 'goal' }, svg(ICON.star, 'star on'), svg(ICON.cell), h('span', null, `Protège les ${g} cellules`)),
    h('div', { class: 'goal' }, svg(ICON.star, 'star on'), svg(ICON.heal), h('span', null, 'Aucune cellule malade à la fin')),
    h('div', { class: 'goal' }, svg(ICON.star, 'star on'), svg(ICON[starRuleIcon(level.star3)]), h('span', null, starRuleLabel(level.star3))),
  );
  const el = h(
    'div',
    { class: `screen briefing world-bg-${level.world}` },
    h('div', { class: 'topbar' }, button('back', 'round', () => go('levels', { world: level.world }), 'Retour'), h('h2', null, `${level.id} · ${level.name}`), h('span', { class: 'spacer' })),
    h('div', { class: 'brief-body' }, mentor(lines, { big: true }), h('div', { class: 'brief-side' }, intro, goals)),
    h('button', { class: 'btn big go', onclick: () => { sfx.go(); go('play', { id: level.id }); } }, svg(ICON.play), h('span', null, 'Allons-y')),
  );
  return { el, destroy: stopVoice };
}

/* ------------------------------------------------------------------ settings */

export function settingsScreen(): Screen {
  const toggle = (key: 'sound' | 'music' | 'voice' | 'leftHanded', icon: keyof typeof ICON, label: string) => {
    const b = h('button', { class: `toggle ${save.settings[key] ? 'on' : ''}` }, svg(ICON[icon]), h('span', null, label));
    b.onclick = () => {
      save.settings[key] = !save.settings[key];
      b.classList.toggle('on', save.settings[key]);
      persist();
      sfx.tap();
    };
    return b;
  };
  const speeds = [
    [0.5, 'slow', 'Lent'],
    [1, 'normal', 'Normal'],
    [2, 'fast', 'Rapide'],
  ] as const;
  const speedRow = h(
    'div',
    { class: 'speed-row' },
    speeds.map(([v, icon, label]) => {
      const b = h('button', { class: `toggle ${save.settings.speed === v ? 'on' : ''}` }, svg(ICON[icon]), h('span', null, label));
      b.onclick = () => {
        save.settings.speed = v;
        persist();
        speedRow.querySelectorAll('.toggle').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        sfx.tap();
      };
      return b;
    }),
  );

  // parent area behind a simple adult question
  const a = 6 + Math.floor(Math.random() * 4);
  const b = 6 + Math.floor(Math.random() * 4);
  const answer = h('input', { class: 'parent-input', inputmode: 'numeric', placeholder: `${a} × ${b} = ?` }) as HTMLInputElement;
  const parent = h('div', { class: 'parent hidden' });
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' }) as HTMLInputElement;
  fileInput.onchange = async () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    const ok = importSave(await f.text());
    alert(ok ? 'Sauvegarde importée.' : 'Fichier non reconnu.');
  };
  parent.append(
    h('label', { class: 'parent-row' }, h('input', { type: 'checkbox', checked: save.unlockAll, onchange: (e: Event) => { save.unlockAll = (e.target as HTMLInputElement).checked; persist(); } }), ' Débloquer tous les niveaux'),
    h('button', { class: 'btn small', onclick: () => { if (confirm('Effacer toute la progression ?')) { resetSave(); alert('Progression effacée.'); } } }, h('span', null, 'Effacer la progression')),
    h('button', { class: 'btn small', onclick: () => { const blob = new Blob([exportSave()], { type: 'application/json' }); const u = URL.createObjectURL(blob); const link = h('a', { href: u, download: 'nano-defenseurs-sauvegarde.json' }); link.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); } }, h('span', null, 'Exporter la sauvegarde')),
    h('button', { class: 'btn small', onclick: () => fileInput.click() }, h('span', null, 'Importer une sauvegarde')),
    h('button', { class: 'btn small', onclick: () => { save.seenIntro = false; persist(); go('naming'); } }, h('span', null, 'Changer le nom du corps')),
    fileInput,
  );
  answer.oninput = () => {
    if (Number(answer.value) === a * b) {
      parent.classList.remove('hidden');
      answer.remove();
    }
  };

  const el = h(
    'div',
    { class: 'screen settings' },
    h('div', { class: 'topbar' }, button('back', 'round', () => history.length > 1 ? go('back') : go('title'), 'Retour'), h('h2', null, 'Réglages'), h('span', { class: 'spacer' })),
    h(
      'div',
      { class: 'settings-body' },
      h('div', { class: 'toggles' }, toggle('sound', 'sound', 'Bruitages'), toggle('music', 'music', 'Musique'), toggle('voice', 'voice', 'Voix'), toggle('leftHanded', 'hand', 'Gaucher')),
      h('h3', null, 'Vitesse des vagues'),
      speedRow,
      h('h3', null, 'Espace parents'),
      answer,
      parent,
    ),
  );
  return { el };
}
