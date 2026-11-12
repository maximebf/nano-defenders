import { h, svg } from './dom';
import { ICON } from './icons';
import { planOffline, type Plan } from '../offline';

/**
 * Makes sure the whole game is stored on the device before it starts.
 * Shows nothing when everything is already there; otherwise a progress bar.
 * Resolves when the game can start.
 */
export async function loadingScreen(app: HTMLElement): Promise<void> {
  // ask the browser not to clear our storage when space runs low
  void navigator.storage?.persist?.().catch(() => false);

  let plan: Plan | null;
  try {
    plan = await planOffline();
  } catch {
    return; // Cache Storage unavailable (private browsing…): just play online
  }
  if (!plan) return;
  // nothing to download, or offline with a full copy stored: start right away
  if (plan.offline ? plan.installed : plan.todo.length === 0) return;

  const bar = h('div', { class: 'loading-fill' });
  const pct = h('div', { class: 'loading-pct' }, '0 %');
  const msg = h('p', { class: 'loading-msg' }, plan.installed ? 'Mise à jour du jeu…' : 'Préparation du jeu…');
  const hint = h('p', { class: 'loading-hint' }, plan.installed ? '' : 'Ensuite, tu pourras jouer même sans internet !');
  const actions = h('div', { class: 'loading-actions' });
  const el = h(
    'div',
    { class: 'screen title loading' },
    h('h1', { class: 'logo' }, h('span', null, 'Nano'), h('span', null, 'Défenseurs')),
    h('div', { class: 'loading-bot' }, svg(ICON.bot)),
    msg,
    h('div', { class: 'loading-bar' }, bar),
    pct,
    hint,
    actions,
  );
  app.replaceChildren(el);

  return new Promise<void>((resolve) => {
    const showError = (text: string, canPlay: boolean) => {
      msg.textContent = text;
      hint.textContent = '';
      actions.replaceChildren(
        ...[
          h('button', { class: 'btn big go', onclick: () => location.reload() }, svg(ICON.retry), h('span', null, 'Réessayer')),
          canPlay ? h('button', { class: 'btn big', onclick: () => resolve() }, svg(ICON.play), h('span', null, 'Jouer')) : null,
        ].filter((b): b is HTMLButtonElement => !!b),
      );
    };

    if (plan!.offline) {
      showError('Il faut internet la première fois pour télécharger le jeu.', false);
      return;
    }
    plan!
      .run(({ done, total }) => {
        const p = total ? Math.floor((done / total) * 100) : 100;
        bar.style.width = `${p}%`;
        pct.textContent = `${p} %`;
      })
      .then(() => resolve())
      .catch(() => showError('Le téléchargement s’est arrêté. Vérifie internet.', plan!.installed));
  });
}
