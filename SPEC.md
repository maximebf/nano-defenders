# Nano Defenders — Game Specification (Draft v0.2)

Nov 11, 2026 · @maxime

## 1. Overview

**Nano Defenders** (working title) is a level-based game for web and mobile where a 7-year-old programs nanobots to help the immune system stop virus invasions. It opens as a simple tower defense and turns, world by world, into a visual programming puzzle game.

The core hook: *your fingers are too slow — so teach your bots to be fast for you.* Manual control exists early but becomes deliberately limited, so automating the bots is the only way to win later waves.

**Goals**

1. Fun first: a 7-year-old wants to play it without being asked.
2. Teach computational thinking step by step: sequence, loops, events, conditions, variables, functions, then pathfinding.
3. Grow with the child over several years (age 7 to 10+), staying fully visual: blocks only, no text code.
4. Run full screen in a browser with no install required: designed for iPad first, also on computer (for building and testing) and phone (backup on the go).

**Not in v1:** multiplayer, accounts, ads, purchases, app-store release, sandbox mode. Text code is out of scope for the whole game.

## 2. Player and design principles

The player is a 7-year-old French speaker who is still learning to read, plays 10–20 minute sessions on an iPad, and may play alone or with a parent. All game text and voice are in French, and every design choice below follows from that.

- **Icons before words.** Every block, button and goal has an icon. Text is short, and a generated French voice can read it aloud.
- **One new idea per level.** A new concept arrives alone, first shown by the mentor, then used, then combined with older ones.
- **Failing is safe and fast.** No lives, no game over. “The virus got through — try again”, with an instant restart and a replay of what happened.
- **Feedback over explanation.** Bots show the block they are running in a thought bubble; sounds and animations say what happened.
- **Optional mastery.** Winning gives 1 star. Extra stars for protecting every cell and for using fewer blocks, so short, elegant programs are rewarded.
- **Calm planning, urgent waves.** No timer while editing. Waves feel a little urgent from the start and the pressure rises level by level, with the Fever power always there to ease it.
- **Not scary.** Viruses are goofy, the body is colourful, nothing is gory, and nobody is “sick” in a worrying way.
- **Light but correct biology.** Cells have kid names in the game; their real names appear on the “body fact” card each world unlocks. Simplified, never wrong.

## 3. Core gameplay loop

Every level is the same short loop: plan the bots, program them, run the wave, and debug until the cells are safe. A level lasts 2–5 minutes and has 1–3 waves.

&#91;embedded content: core loop · 6 steps, 1 decision\]

Losing sends the player to a replay, then straight back to the editor with the program intact, so a failure is one fix away from a retry. From World 5, the plan phase reopens between waves so programs can be adjusted mid-level.

## 4. World and theme

The game takes place inside the body of a friendly character the child names at the start. Each world is a body zone, shown on a body-shaped world map that lights up as zones are cleaned.

**Three sides**

- **Viruses (enemies).** Cartoon invaders that enter the body and try to reach the zone’s healthy cells.
- **The immune system (allies, computer-controlled).** Real immune cells under kid names, simplified: they fight on their own, and the player’s bots help them.
- **Nanobots (the player’s units).** Tiny programmable robots. The player places them and writes their programs.

**Mentor.** A small robot guide (working name “Pixel”) introduces each level in 2–3 lines spoken by a generated French voice and gives hints after two failed attempts.

**Board.** Every level is a tile grid (roughly 16 × 10 tiles on tablet, fewer on phone). Viruses follow paths along vessels and tissue; walls are cell membranes. A grid keeps movement countable (“move 3”), which the programming worlds need, and makes pathfinding natural later.

**Immune memory as a mechanic.** Once a virus type is beaten, later levels can include ready-made antibodies against it. This mirrors how real immunity and vaccines work, and gives a body fact for free.

## 5. Progression

Each world teaches one programming concept, adds one new virus that *needs* that concept, and has 6–10 levels plus a boss. Worlds 1–5 are the target for the first year; 6–9 follow as the child grows.

| World (body zone) | Concept taught | New virus forcing it | What the player does |
| --- | --- | --- | --- |
| 1. Nose Gate | Tower defense basics | Snifflet (slow walker) | Places pre-programmed turret bots; taps to zap manually |
| 2. Throat | A program is an instruction | Zoomer (fast) | Picks one behaviour card per bot: “nearest”, “strongest”, “heal” |
| 3. Bloodstream | Sequence: order matters | Shellby (armoured) | Programs a moving bot: move, turn, zap, in order |
| 4. Lungs | Loops: repeat, forever | Splitter (splits in two) | Writes patrols that run forever |
| 5. Stomach | Events and sensors | Replicator (multiplies in cells) | “When virus seen → …”, “when hit → …” |
| 6. Lymph Node | Conditions: if / else | Mimic (changes colour) | Chooses the right tool for each virus type |
| 7. Bone Marrow | Variables and counting | Swarm (dozens of tiny ones) | Tracks energy, counts kills, manages stock |
| 8. Heart | Functions and teamwork | Hider (invisible until tagged) | Makes own blocks; bots send messages to each other |
| 9. Brain Maze | Pathfinding | Maze Crawler | Navigates mazes: wall-follow, then “spreading signal” search |

**Pressure and Fever.** Waves feel a little urgent from World 1, and the pressure (virus speed, numbers, mixed types) rises with every level and world. Worlds 1–2 also allow tapping to zap. From World 3, the Fever power is the player’s permanent pressure valve: one tap slows every virus for a few seconds. It never goes away, but uses are limited (e.g. 3 per level), so programs still do most of the work.

**Pathfinding plan (World 9, later).** First a “go to nearest virus” block that does it for you. Then the child builds a wall-follower. Then a “spreading signal”: a chemical that floods outward tile by tile from the target, shown visually, and the bot climbs it. That is breadth-first search, taught without the name.

## 6. Programming system

The editor grows with the child in two modes, so a 7-year-old is never faced with nested text blocks on day one.

1. **Icon mode (Worlds 2–5).** Big picture blocks snapped in a horizontal strip, like ScratchJr (built for ages 5–7). One block is one step: to move three tiles, add three move blocks. Loops wrap blocks visually.
2. **Block mode (Worlds 6+).** Vertical Scratch-style blocks with short French words, nesting, if/else and variables. Built on Google Blockly, which ships French block translations.

The game stays visual to the end: there is no text-code mode.

**Block catalogue**

| Family | Blocks | Unlocked in |
| --- | --- | --- |
| Behaviour cards | target nearest, target strongest, heal cells | World 2 |
| Movement | move forward (n), turn left, turn right | World 3 |
| Timing | wait (n) | Later, once loops or timed puzzles give it a use |
| Actions | zap, throw net, shield, heal, spray antibodies, recharge | World 3 onward, one per world |
| Loops | repeat (n), forever, repeat until | World 4 |
| Events | when wave starts, when virus nearby, when hit, when energy low | World 5 |
| Sensors | virus ahead?, virus colour/shape, wall ahead?, cell health | World 5–6 |
| Logic | if, if / else, and, or, not | World 6 |
| Data | set / change variable, counter, compare | World 7 |
| Teamwork | send message, when message received, my own block | World 8 |
| Navigation | go to nearest virus (auto), follow signal, read signal value | World 9 |

**How programs run**

- Each bot runs its own program. The game is a fixed-step simulation (10 ticks per second).
- Action blocks take time (move = 5 ticks, zap = 3). Sensor and logic blocks are instant. Time per block is what makes a fast program matter.
- The simulation is fully deterministic: the same program on the same level always gives the same result. This makes replays exact and puzzles fair.
- Programs are interpreted by the game’s own small virtual machine, never run as raw JavaScript. It can pause, step one block, and highlight the running block. A cap on blocks per tick stops infinite loops from freezing the game.

**Puzzle constraints.** Each level sets which blocks are available, a block budget, and an energy budget (zaps cost energy). Budgets turn “any program” into “a good program”.

**Debugging tools**

- Running block lit up in the editor; same block shown in the bot’s thought bubble.
- Ghost preview: a dotted line shows where a moving bot will go before pressing Play.
- Speed controls: pause, step, slow, normal, fast.
- Replay after a loss, with a scrubber to find the moment it went wrong.
- Sound per block type, so a broken rhythm is heard as well as seen.

**Bot Lab.** Programs that worked can be saved as named “chips” and reused in later levels. The child builds a personal library, which motivates writing general programs instead of one-off ones.

## 7. Units

Every virus is designed so that it is easy to beat with the concept of its world and hard without it. Viruses are told apart by colour **and** shape, so colour is never the only clue.

Bot and virus names below are working names; French names come with the art. Virus images are generated by you with an image model.

**Nanobots (player)**

| Bot | Role | Unlocked |
| --- | --- | --- |
| Zappy | Fixed turret, zaps viruses in range | World 1 |
| Scout | Moves on the grid; the main programmable bot | World 3 |
| Netter | Throws nets that slow or hold viruses | World 3 |
| Medic | Repairs damaged healthy cells | World 5 |
| Tagger | Sprays antibodies that reveal and weaken viruses | World 6 |
| Caller | Sends messages to bots and calls immune cells | World 8 |

**Immune allies (computer-controlled)**

| In-game name (kid name) | Real name on the fact card | What it does in the game |
| --- | --- | --- |
| Le Sprinteur | Neutrophile | Fast first responder, short-lived |
| Grand Mangeur | Macrophage | Slow, eats tagged viruses |
| Le Fabricant | Lymphocyte B | Makes antibodies after meeting a virus; remembers it for later levels |
| Étiquettes collantes | Anticorps | Stick to viruses so others can find them |
| Le Chasseur | Lymphocyte T tueur | Clears infected cells before viruses multiply |
| La Fièvre | Fièvre | The player’s pressure-release power: slows every virus for a few seconds |

**Viruses (enemies)**

| Virus | Behaviour | What beats it |
| --- | --- | --- |
| Snifflet | Walks the path slowly | Any turret |
| Zoomer | Very fast | Bots placed and ready in advance |
| Shellby | Armoured: needs a net, then a zap | The right sequence |
| Splitter | Splits in two when hit | A loop that keeps zapping |
| Replicator | Enters a cell and multiplies after 5 s | An event that reacts at once |
| Mimic | Changes colour; each colour needs a different tool | if / else |
| Swarm | Dozens of tiny viruses | Counters and area attacks |
| Hider | Invisible until tagged | Two bots working together via messages |
| Maze Crawler | Takes changing routes through tissue | Pathfinding |
| Bosses | One per world, combines that world’s tricks | Everything learned so far |

## 8. Example levels

Four sample levels show how the same game shifts from placing towers to writing programs.

**1-1 “First Sneeze” (tower defense)**

- Map: one straight path from the nostril to a group of 6 healthy cells.
- Player: 2 Zappy turrets to place, tap a virus to zap it manually.
- Wave: 8 Snifflets, one every 2 seconds.
- Stars: win · no cell damaged · used only 1 turret.

**3-2 “Patrol the Vein” (sequence)**

- Map: an L-shaped vessel. Shellbys arrive at a fixed spot every 6 seconds.
- Player: 1 Scout. Blocks: move, turn left, turn right, net, zap. Budget: 6 blocks.
- Example solution: `move × 3 → turn right → move × 2 → net → zap`.
- Lesson: “zap, then net” fails; “net, then zap” works. Order matters.

**4-4 “Endless Drip” (loop)**

- Map: a loop-shaped airway. Splitters drip in forever until a 60-second timer ends.
- Player: 1 Scout. Blocks: move, turn, zap, repeat, forever. Budget: 5 blocks.
- Example solution: `forever [ move × 4 → zap → turn right ]`.
- Lesson: writing the patrol out step by step does not fit in 5 blocks; a loop does.

**6-3 “Red or Blue?” (condition)**

- Map: one gate tile where Mimics pass. Red Mimics need a net, blue ones a zap.
- Player: 1 Zappy with a program. Wrong tool = virus gets stronger.
- Example solution: `when virus nearby → if colour is red [ net ] else [ zap ]`.
- Lesson: one program that decides beats two fixed ones.

## 9. Screens and controls

The game is landscape-only, designed for a tablet first, and fills the screen on every device; on phones, map and editor take turns instead of sharing the screen.

**Full screen**

- iPad (main device): the game is added to the home screen as a web app (PWA) and opens like an app, with no browser bars. This is the normal way to launch it.
- Computer: a “Play” button enters browser full screen. iPhone: same home-screen install as the iPad. To confirm on the iPad in the first prototype.
- Safari cannot lock landscape, so holding the iPad upright shows a “turn your device” animation.

**Layout**

- iPad (main device): map on the left (about 60%), editor on the right, both always visible.
- Computer (building and testing): same layout; mouse and trackpad behave like touch.
- Phone (backup): one big toggle button switches between Map and Code.

**Touch rules for small hands**

- Touch targets at least 48 px; blocks bigger than that.
- Only tap and drag. No double-tap, no long-press, no precise gestures.
- Pinch to zoom the map; dragging a block out of the strip deletes it.
- Left-handed option mirrors the layout.

**Screens**

1. Title
2. Body map (world select)
3. Level select with stars
4. Briefing: mentor, goal icons, new block shown
5. Play: plan phase, then run phase
6. Results: stars, body fact, “next” / “retry” / “watch replay”
7. Bot Lab: saved programs
8. Settings: sound, voice, speed
9. Parent area (gated)

## 10. Art and sound

The look is bright, rounded 2D cartoon: warm pinks and reds for body tissue, white and cyan for bots, purple and green for viruses.

- **Viruses** have big goofy faces and pop into bubbles when beaten. No death animations.
- **Bots** have a small screen for a face that shows a mood and the block they are running.
- **Effects:** soft particles, a happy “cells saved” celebration at the end of each level, very little screen shake.
- **Music:** one light theme per world, calmer during planning, livelier during waves.
- **Sounds:** each block type has its own short beep, so a running program has a rhythm.
- **Voice:** Mentor lines in French from a generated voice, produced ahead of time as audio files.
- **Art sources:** viruses are generated by you with an image model, in one shared style (same outline, lighting, viewing angle, transparent background). Other art starts from free CC0 packs (e.g. Kenney.nl) until the style is settled.

## 11. Technical architecture

A static web app in TypeScript with no server: Phaser draws the game, Blockly powers the block editor, and a separate simulation core holds all the rules.

&#91;embedded content: architecture · 7 parts\]

Programs flow from the editor to the bot VM; the simulation core applies the rules; the renderer only draws what the core says happened.

| Part | Choice | Why |
| --- | --- | --- |
| Language and build | TypeScript + Vite | Type safety for the rules engine, fast dev loop |
| Game rendering | Phaser 3 | Mature 2D engine, touch input, screen scaling, reads Tiled maps |
| Block editor | Google Blockly (block mode); custom HTML for icon mode | Blockly is proven for kids’ coding, supports custom blocks, touch and French |
| Level maps | Tiled map editor, exported as JSON | Free visual editor for grids and paths |
| Voice | French text-to-speech, generated ahead of time as audio files | Same voice on every device, works offline |
| Install and offline | PWA: web manifest + service worker | Home-screen install gives full screen on iPad and iPhone, plays offline |
| Saves | IndexedDB on the device | No account, no server |
| Hosting | Any static host (GitHub Pages, Netlify, Cloudflare Pages) | Free, simple |
| App stores (later) | Capacitor wrapper | Same code as native app if ever wanted |

**Key design rule: the simulation knows nothing about drawing.** The rules engine is plain TypeScript that takes a level and the bots’ programs and advances tick by tick. This allows unit tests, exact replays, and a headless “solver check” that proves every level is winnable with its block budget.

**Data formats**

- **Program:** a versioned JSON tree of blocks. Icon mode and Blockly both produce it; the bot VM runs it.
- **Level:** JSON with grid and paths (from Tiled), spawn points, waves (time, virus type, count), allowed blocks, block and energy budgets, star rules, mentor lines.

**Performance target:** 60 fps on your iPad, still playable on a phone, with up to 200 moving objects.

**Build process:** Claude Code builds the game on your computer. Keep this spec in the repository (e.g. `SPEC.md`) and build one roadmap phase at a time, testing in the computer’s browser before trying it on the iPad.

## 12. Saves, parents and safety

Nothing leaves the device: no account, no ads, no purchases, no chat, no tracking.

- **Saves:** automatic, local. Several player profiles for siblings. Export and import of a save file to move between devices.
- **Parent area:** behind a simple adult check. Unlock any level, reset progress, see which concepts the child has mastered, set a play-time reminder.
- **Gentle stops:** natural break points at the end of each world, and an optional “time for a break” nudge after a set time.
- **No outside links** from the child’s screens.
- **Privacy:** since no data is collected, there is nothing to consent to or store.

## 13. Roadmap

The first playable version (MVP) covers Worlds 1–3: enough to test whether your child enjoys the move from towers to programs. Each later phase starts only after playtesting the previous one with your child.

| Phase | Content | Done when |
| --- | --- | --- |
| 0. Paper prototype | Grid on paper, block cards, a parent plays the virus, the child “programs” a toy robot | The child understands “move, turn, zap” cards and asks to play again |
| 1. MVP | Worlds 1–3 (about 18 levels), icon mode editor, simulation core, bot VM, Phaser renderer, PWA, local saves | Playable start to finish on the iPad without help |
| 2. Loops and events | Worlds 4–5, Bot Lab, replay with scrubber, ghost preview | Child solves a loop level without a hint |
| 3. Conditions and data | Worlds 6–7, Blockly block mode, parent area | Child explains why an if/else works |
| 4. Teamwork | World 8, own blocks, bot messages, bosses | Two-bot levels solvable |
| 5. Pathfinding | World 9, spreading-signal search, level editor for the child | Child builds a level for you to solve |

## 14. Decisions and open questions

Your answers from the first review (11 Nov 2026) are now built into the sections above.

| Topic | Decision |
| --- | --- |
| Language | French only |
| Devices | iPad first, launched from the home screen; computer for building and testing; phone as backup |
| Who builds it | Claude Code, run on your computer |
| Cell names | Kid names in the game, real names on the fact cards |
| Pressure | A little urgent from the start, rising with levels; Fever stays for the whole game as the pressure valve |
| Sandbox mode | Not for now |
| Text code | Dropped entirely; the game stays block-based |
| Mentor voice | Generated French voice |
| Personal touches | Your child names the body; you generate the viruses with an image model |
| Title and mentor | Keep “Nano Defenders” and “Pixel” as working names |

**Still open**

- [ ] Final French title and mentor name, when you have them.
