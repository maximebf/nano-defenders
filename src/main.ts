import './style.css';
import { loadSave, save } from './save';
import { titleScreen, namingScreen, mapScreen, levelsScreen, briefingScreen, settingsScreen, type Screen } from './ui/screens';
import { playScreen } from './ui/play';

type Route = 'title' | 'naming' | 'map' | 'levels' | 'briefing' | 'play' | 'settings' | 'back';
type Params = Record<string, unknown>;

const SCREENS: Record<Exclude<Route, 'back'>, (p: any) => Screen> = {
  title: titleScreen,
  naming: namingScreen,
  map: mapScreen,
  levels: levelsScreen,
  briefing: briefingScreen,
  play: playScreen,
  settings: settingsScreen,
};

const app = document.getElementById('app')!;
let current: Screen | null = null;
const history: [Route, Params][] = [];

export function go(route: Route, params: Params = {}): void {
  if (route === 'back') {
    history.pop();
    const prev = history.pop() ?? (['title', {}] as [Route, Params]);
    return go(prev[0], prev[1]);
  }
  history.push([route, params]);
  if (history.length > 20) history.shift();
  current?.destroy?.();
  const screen = SCREENS[route](params);
  current = screen;
  app.replaceChildren(screen.el);
  applySettings();
}

export function applySettings(): void {
  document.body.classList.toggle('left-handed', save.settings.leftHanded);
}

async function boot() {
  await loadSave();
  // A quick way to open a level while developing: ?level=3-2
  const params = new URLSearchParams(location.search);
  const lvl = params.get('level');
  if (lvl) go('play', { id: lvl });
  else go('title');
}

// Prevent iOS double-tap zoom and long-press menus inside the game.
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => undefined));
}

void boot();
