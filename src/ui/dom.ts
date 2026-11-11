type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

/** Tiny element builder: h('div', { class: 'x', onclick: fn }, child, ...) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'html') el.innerHTML = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export function svg(markup: string, cls = ''): HTMLElement {
  const span = document.createElement('span');
  span.className = `icon ${cls}`.trim();
  span.innerHTML = markup;
  return span;
}

export function img(name: string, cls = ''): HTMLImageElement {
  return h('img', { src: `assets/img/${name}.png`, class: cls, alt: '', draggable: 'false' });
}
