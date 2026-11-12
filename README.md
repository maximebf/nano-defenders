# Nano Défenseurs

A French game for a 7-year-old: program nanobots to help the immune system stop virus invasions.
It starts as a tower defense and turns, world by world, into a visual programming game.
See [SPEC.md](SPEC.md) for the full design. This is the MVP: Worlds 1–3 (18 levels).

| World | Concept | What the child does |
| --- | --- | --- |
| 1. Le Nez | Tower defense | Places Zappy turrets, taps viruses to zap them |
| 2. La Gorge | A program is an instruction | Gives each robot a behaviour card: le plus proche / le plus fort / soigner |
| 3. Le Sang | Sequence: order matters | Programs Scout with picture blocks (avancer, tourner, attendre, filet, zap) |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, and on your local network (open it on the iPad)
npm test           # rules engine + "every level can be won with 3 stars" checks
npm run build      # static site in dist/, works offline once installed
```

On the iPad: open the address in Safari, then **Share → Add to Home Screen**. The game then opens full screen like an app and works offline. On first launch it shows a progress bar while it downloads the whole game (about 7 MB) to the device; after that it starts without internet. Updates only download the files that changed.

Note: an app on the Home Screen has its own storage, separate from Safari's, so the download also happens on its first launch from the Home Screen. That launch needs internet.
On a computer, "Jouer" switches the browser to full screen.

Developer shortcut: `?level=3-2` opens a level directly. Parents can unlock every level in **Réglages → Espace parents**.

## How it is built

```
src/sim/        rules engine: plain TypeScript, no drawing, deterministic (10 ticks/s)
  sim.ts        the world: viruses, cells, turrets, scouts, nets, fever
  vm.ts         the bot virtual machine that runs block programs (never JavaScript)
  units.ts      every number that tunes the game (speeds, ranges, cooldowns)
src/levels/     the 18 levels as data (ASCII maps + paths + waves)
src/game/       Phaser renderer: only draws what the simulation says happened
src/ui/         screens, icon-mode program editor, play controller
src/audio/      synthesised sound effects and music, voice playback
src/content/    every French line (also the source for the voice files)
tests/          unit tests, solver checks, balance reports
scripts/        art, voice and icon generation
```

## Art and voice

Characters are generated with Gemini (`gemini-3.1-flash-image`) in one shared style; the background is removed automatically.
Pixel's voice is generated with Gemini TTS (`gemini-2.5-flash-preview-tts`, voice "Puck") from `src/content/lines.json`.
Both scripts need `GEMINI_API_KEY` in a `.env` file (never committed) and cache what they generate, so re-running only pays for new or changed items.

```bash
node scripts/gen-images.mjs            # missing images only
node scripts/gen-images.mjs zoomer     # one image (delete assets-src/raw/zoomer.png first to redo it)
node scripts/gen-voice.mjs             # missing or changed voice lines only
node scripts/gen-icons.mjs             # home-screen icons from Pixel
```

If a voice file is missing, the game falls back to the device's French voice.

## Balance tools

```bash
BALANCE=report.txt npx vitest run tests/balance.test.ts   # greedy placements per level
BALANCE=report.txt npx vitest run tests/slots.test.ts     # every card combination (World 2)
BALANCE=report.txt npx vitest run tests/kid.test.ts       # random "child-like" placements
```
