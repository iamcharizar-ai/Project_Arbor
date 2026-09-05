# ARBOR — calisthenics skill tree & PR notepad

**Live**: https://arbor-umber.vercel.app

A single-page skill tree for body skills: calisthenics progressions, mobility / flexibility / balance, and movement arts (flips, tricking, dance). Log a hold-time or rep PR after a session, tick a skill, and watch the next unlock light up.

Inspired by the feel of [Wings](https://wingssw.com/#/skilltree) — one canvas, pan/zoom, clear difficulty order — while keeping the ARBOR identity.

## What it tracks

One unified tree (not 12 life-admin realms):

- **Calisthenics** — push, pull, core, legs (planche, front lever, handstand, muscle-up, pistol, …)
- **Mobility & Balance** — flexibility, yoga holds, arm balances
- **Movement Arts** — acrobatics, kicks, flips, breaking, dance

Career, CAT, music, finance, books, and the rest were removed. Progress is a local notepad: PRs persist in `localStorage` and work offline. No vault-folder prompt.

Each skill has four states:

- **Locked** — prerequisites not yet trained
- **Available** — entry criterion hit
- **Training** — building volume
- **Mastered** — the dedicated target, hit

Numeric skills use a 3-threshold ladder (e.g. push-up 10 / 20 / 40 reps). Rubric skills are three ticks.

## Using it

    npm install
    npm run dev        # http://localhost:5178
    npm run build
    npm run validate   # skill-graph sanity check

- **Ctrl+K** — jump to a skill
- **Ctrl+L** — log a PR (search, last session, next unlocks, +1 / tick)
- Click a node for the detail panel: stepper, jump-to-threshold, tick next tier

## Code map

- `src/lib/store.js` — progress, XP, streak, local persistence
- `src/lib/layout.js` — columnar progression layout
- `src/components/Tree.jsx` — the pan/zoom canvas
- `src/components/Panel.jsx` / `LogDrawer.jsx` — PR logging
- `data/skills/{cal,mob,mov}.json` — the tree

## Who this is for

A personal calisthenics / movement trainer notepad — grind a progression, log the session PR, see what unlocked. Later an AI trainer can write the same local progress records.
