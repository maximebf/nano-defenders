// Hand-made SVG icons (64x64 viewBox), thick and rounded for small fingers and young eyes.

const S = (body: string) =>
  `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICON = {
  // ---- blocks ----
  move: S(`<path d="M32 54V14" stroke="#1d3557" stroke-width="10" fill="none"/><path d="M16 28 32 11 48 28" stroke="#1d3557" stroke-width="10" fill="none"/><path d="M32 54V14" stroke="#fff" stroke-width="4" fill="none"/><path d="M16 28 32 11 48 28" stroke="#fff" stroke-width="4" fill="none"/>`),
  turnLeft: S(`<path d="M46 54V34c0-8-6-14-14-14H18" stroke="#1d3557" stroke-width="10" fill="none"/><path d="M26 8 14 20l12 12" stroke="#1d3557" stroke-width="10" fill="none"/><path d="M46 54V34c0-8-6-14-14-14H18" stroke="#fff" stroke-width="4" fill="none"/><path d="M26 8 14 20l12 12" stroke="#fff" stroke-width="4" fill="none"/>`),
  turnRight: S(`<path d="M18 54V34c0-8 6-14 14-14h14" stroke="#1d3557" stroke-width="10" fill="none"/><path d="M38 8l12 12-12 12" stroke="#1d3557" stroke-width="10" fill="none"/><path d="M18 54V34c0-8 6-14 14-14h14" stroke="#fff" stroke-width="4" fill="none"/><path d="M38 8l12 12-12 12" stroke="#fff" stroke-width="4" fill="none"/>`),
  wait: S(`<circle cx="32" cy="34" r="22" fill="#fff" stroke="#1d3557" stroke-width="5"/><path d="M32 20v14l9 7" stroke="#1d3557" stroke-width="5" fill="none"/><path d="M26 6h12" stroke="#1d3557" stroke-width="5"/>`),
  zap: S(`<path d="M36 4 14 36h16l-4 24 24-34H34z" fill="#ffe14d" stroke="#1d3557" stroke-width="4"/>`),
  net: S(`<path d="M8 14q24 10 48 0-4 24-24 42Q12 38 8 14z" fill="#ff9f43" stroke="#1d3557" stroke-width="4"/><path d="M14 22l32 22M22 18l26 24M32 18l14 14M50 22 18 44M42 18 16 36M32 18 14 30" stroke="#1d3557" stroke-width="2" fill="none" opacity=".7"/>`),
  repeat: S(`<path d="M14 30a18 18 0 0 1 32-10M50 34a18 18 0 0 1-32 10" stroke="#fff" stroke-width="5" fill="none"/><path d="M46 8v12H34M18 56V44h12" stroke="#fff" stroke-width="5" fill="none"/>`),

  // ---- behaviour cards ----
  nearest: S(`<circle cx="32" cy="32" r="24" fill="#fff" stroke="#1d3557" stroke-width="4"/><circle cx="32" cy="32" r="14" fill="#ffd6e0" stroke="#e63946" stroke-width="4"/><circle cx="32" cy="32" r="5" fill="#e63946"/><path d="M32 2v10M32 52v10M2 32h10M52 32h10" stroke="#1d3557" stroke-width="4"/>`),
  strongest: S(`<circle cx="32" cy="38" r="20" fill="#a6e22e" stroke="#1d3557" stroke-width="4"/><path d="M12 38H6M58 38h-6M32 58v6M17 24l-4-4M47 24l4-4M17 52l-4 4M47 52l4 4" stroke="#1d3557" stroke-width="4"/><path d="M20 20l4-14 8 8 8-8 4 14z" fill="#ffd166" stroke="#1d3557" stroke-width="4"/><path d="M24 40q8 8 16 0" stroke="#1d3557" stroke-width="4" fill="none"/><circle cx="25" cy="33" r="3" fill="#1d3557"/><circle cx="39" cy="33" r="3" fill="#1d3557"/>`),
  heal: S(`<path d="M32 56S6 40 6 22c0-8 6-14 13-14 6 0 10 3 13 8 3-5 7-8 13-8 7 0 13 6 13 14 0 18-26 34-26 34z" fill="#ff6b9a" stroke="#1d3557" stroke-width="4"/><path d="M32 22v18M23 31h18" stroke="#fff" stroke-width="6"/>`),

  // ---- buttons ----
  play: S(`<path d="M20 10v44l36-22z" fill="currentColor"/>`),
  pause: S(`<rect x="14" y="10" width="12" height="44" rx="4" fill="currentColor"/><rect x="38" y="10" width="12" height="44" rx="4" fill="currentColor"/>`),
  step: S(`<path d="M12 12v40l26-20z" fill="currentColor"/><rect x="42" y="12" width="10" height="40" rx="3" fill="currentColor"/>`),
  slow: S(`<ellipse cx="30" cy="38" rx="20" ry="12" fill="currentColor"/><circle cx="52" cy="36" r="6" fill="currentColor"/><path d="M16 48l-2 6M42 48l2 6" stroke="currentColor" stroke-width="5"/><path d="M18 34h24M24 28v12M36 28v12" stroke="#000" stroke-opacity=".25" stroke-width="3"/>`),
  normal: S(`<path d="M18 12v40l30-20z" fill="currentColor"/>`),
  fast: S(`<path d="M6 12v40l26-20z" fill="currentColor"/><path d="M32 12v40l26-20z" fill="currentColor"/>`),
  home: S(`<path d="M8 30 32 8l24 22" stroke="currentColor" stroke-width="7" fill="none"/><path d="M16 28v26h12V40h8v14h12V28" fill="currentColor"/>`),
  retry: S(`<path d="M50 34a18 18 0 1 1-6-16" stroke="currentColor" stroke-width="7" fill="none"/><path d="M48 6v16H32" stroke="currentColor" stroke-width="7" fill="none"/>`),
  next: S(`<path d="M10 32h38" stroke="currentColor" stroke-width="8"/><path d="M32 14l18 18-18 18" stroke="currentColor" stroke-width="8" fill="none"/>`),
  back: S(`<path d="M54 32H16" stroke="currentColor" stroke-width="8"/><path d="M32 14 14 32l18 18" stroke="currentColor" stroke-width="8" fill="none"/>`),
  gear: S(`<path d="M32 6l5 7 8-2 2 8 8 3-3 8 5 6-6 5 2 8-8 2-3 8-8-3-6 5-5-6-8 2-2-8-8-3 3-8-5-6 6-5-2-8 8-2 3-8 8 3z" fill="currentColor"/><circle cx="32" cy="32" r="9" fill="#fff"/>`),
  bin: S(`<path d="M14 18h36l-4 38H18z" fill="currentColor"/><path d="M8 16h48M24 16v-6h16v6" stroke="currentColor" stroke-width="6" fill="none"/><path d="M26 26v22M38 26v22" stroke="#fff" stroke-width="4"/>`),
  map: S(`<path d="M6 14l16-6 20 6 16-6v42l-16 6-20-6-16 6z" fill="currentColor"/><path d="M22 8v42M42 14v42" stroke="#fff" stroke-width="3"/>`),
  code: S(`<rect x="6" y="10" width="22" height="20" rx="5" fill="currentColor"/><rect x="34" y="10" width="22" height="20" rx="5" fill="currentColor"/><rect x="6" y="36" width="22" height="20" rx="5" fill="currentColor"/><rect x="34" y="36" width="22" height="20" rx="5" fill="currentColor" opacity=".5"/>`),
  fever: S(`<path d="M26 8a6 6 0 0 1 12 0v28a12 12 0 1 1-12 0z" fill="#fff" stroke="#1d3557" stroke-width="4"/><circle cx="32" cy="46" r="8" fill="#e63946"/><path d="M32 20v26" stroke="#e63946" stroke-width="6"/><path d="M44 14h6M44 22h6M44 30h6" stroke="#1d3557" stroke-width="3"/>`),
  star: S(`<path d="M32 4l8 18 19 2-14 13 4 19-17-10-17 10 4-19L5 24l19-2z" fill="currentColor" stroke="#1d3557" stroke-width="3"/>`),
  lock: S(`<rect x="12" y="28" width="40" height="30" rx="6" fill="currentColor"/><path d="M20 28v-8a12 12 0 0 1 24 0v8" stroke="currentColor" stroke-width="7" fill="none"/>`),
  replay: S(`<rect x="6" y="10" width="52" height="38" rx="6" fill="currentColor"/><path d="M26 20v18l14-9z" fill="#fff"/><path d="M14 56h36" stroke="currentColor" stroke-width="5"/>`),
  sound: S(`<path d="M8 24h12l14-12v40L20 40H8z" fill="currentColor"/><path d="M42 22a14 14 0 0 1 0 20M48 14a24 24 0 0 1 0 36" stroke="currentColor" stroke-width="5" fill="none"/>`),
  music: S(`<path d="M24 46V14l28-6v32" stroke="currentColor" stroke-width="5" fill="none"/><circle cx="18" cy="46" r="8" fill="currentColor"/><circle cx="46" cy="40" r="8" fill="currentColor"/>`),
  voice: S(`<rect x="22" y="6" width="20" height="32" rx="10" fill="currentColor"/><path d="M14 30a18 18 0 0 0 36 0M32 48v10M22 58h20" stroke="currentColor" stroke-width="5" fill="none"/>`),
  hand: S(`<path d="M22 56c-6-6-12-14-12-20 0-4 4-4 6-2l6 6V12a4 4 0 0 1 8 0v18-4a4 4 0 0 1 8 0v6-2a4 4 0 0 1 8 0v4a4 4 0 0 1 8 0v12c0 8-4 14-8 18z" fill="currentColor"/>`),
  speak: S(`<path d="M8 24h12l14-12v40L20 40H8z" fill="currentColor"/><path d="M42 22a14 14 0 0 1 0 20" stroke="currentColor" stroke-width="5" fill="none"/>`),
  cell: S(`<circle cx="32" cy="32" r="24" fill="#ff8fa3" stroke="#1d3557" stroke-width="4"/><circle cx="32" cy="36" r="9" fill="#e5547a"/><circle cx="25" cy="26" r="3" fill="#1d3557"/><circle cx="39" cy="26" r="3" fill="#1d3557"/>`),
  bot: S(`<rect x="12" y="14" width="40" height="34" rx="10" fill="#fff" stroke="#1d3557" stroke-width="4"/><rect x="18" y="20" width="28" height="18" rx="5" fill="#4cc9f0"/><circle cx="26" cy="29" r="3" fill="#1d3557"/><circle cx="38" cy="29" r="3" fill="#1d3557"/><path d="M32 14V6" stroke="#1d3557" stroke-width="4"/><circle cx="32" cy="5" r="3" fill="#4cc9f0"/><path d="M20 48v8M44 48v8" stroke="#1d3557" stroke-width="5"/>`),
  tap: S(`<circle cx="32" cy="22" r="14" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="6 5"/><path d="M28 60c-4-4-8-10-8-14 0-3 3-3 5-1l3 3V22a3 3 0 0 1 6 0v14l2-1a3 3 0 0 1 6 2l2-1a3 3 0 0 1 5 3v6c0 6-3 12-6 15z" fill="currentColor"/>`),
};

export type IconName = keyof typeof ICON;

/** data: URL for using an icon as an image (e.g. Phaser textures). */
export function iconDataUrl(name: IconName): string {
  return 'data:image/svg+xml;base64,' + btoa(ICON[name]);
}
