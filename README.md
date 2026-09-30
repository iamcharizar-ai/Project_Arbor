# ARBOR — calisthenics skill tree & PR notepad

**Live**: https://arbor-umber.vercel.app

A single-page skill tree for body skills: calisthenics progressions, mobility / flexibility / balance, and movement arts (flips, tricking, dance). Log a hold-time or rep PR after a session, tick a skill, and watch the next unlock light up.

Inspired by the feel of [Wings](https://wingssw.com/#/skilltree) — one canvas, pan/zoom, clear difficulty order — in pixel art.

## What it tracks

One unified tree (292 skills, 16 branches):

- **Calisthenics** — push, pull, core, legs (planche, front lever, handstand, muscle-up, pistol, …)
- **Mobility & Balance** — flexibility, yoga holds, arm balances
- **Movement Arts** — acrobatics, kicks, flips, breaking, dance

Progress is a local notepad: PRs persist in `localStorage` and work offline (installable PWA). Each skill has four states — **locked**, **unlocked** (entry criterion hit), **in progress**, **mastered**. Numeric skills use a 3-threshold ladder (e.g. push-up 10 / 20 / 40 reps); rubric skills are three ticks.

## Using it

    npm install
    npm run dev        # http://localhost:5178
    npm run build
    npm run validate   # skill graph + pictogram coverage check

- **Drag** to pan, **scroll / pinch** to zoom, **double-click** empty space to zoom in, arrow keys / `+` `-` / `0` when the tree is focused
- **Ctrl+K** — jump to a skill · **Ctrl+L** — log a PR (search, last session, next unlocks, +1 / tick)
- Point at a skill to see its cross-branch prerequisites; click it for the detail panel

## How it's built

The tree is one `<canvas>` (no per-node DOM, no graph library). The render loop only runs while something moves; sprites are pre-baked (and mip-mapped) and blitted; off-screen nodes and edges are culled; everything snaps to device pixels. Zoom is a smoothed target so a burst of wheel events costs one draw per frame.

- `src/lib/treeRenderer.js` — canvas renderer: camera (smooth zoom, pinch, inertia), culling, LOD, hit-testing
- `src/lib/layout.js` — columnar progression layout (crossing-minimised), computed once
- `src/lib/store.js` — progress, XP, streak, persistence, derived data (memoised per change)
- `src/components/` — HUD, detail panel, search, PR log, toast, tier-up moment
- `data/skills/{cal,mob,mov}.json` — the tree

### Pixel art

There are no emoji or image assets. Every skill is drawn as a pictogram of the body position, generated from a few joint angles:

- `src/lib/pixel/figure.js` — pose → pixel grid (forward kinematics + Bresenham)
- `src/lib/pixel/poses.js` — the named poses
- `src/lib/pixel/skillPoses.js` — which pose pictures which skill
- `src/lib/pixel/art.js` / `sprites.js` — palette, UI glyphs, the wheel, sprite cache

Adding a skill: add it to the JSON, then map its id to a pose in `skillPoses.js` (`npm run validate` fails until you do). Preview all poses with `npm run sprites` (writes `sprite-sheet.png`); regenerate the PWA icons with `npm run icons`.

Fonts (Pixelify Sans, Silkscreen) are bundled via `@fontsource`, so the app works offline and has no third-party requests.

## Who this is for

A personal calisthenics / movement trainer notepad — grind a progression, log the session PR, see what unlocked. Later an AI trainer can write the same local progress records.
