# ARBOR - a living skill tree for real life

**Live**: https://arbor-umber.vercel.app · 445 skills across 11 realms · React + Vite (JavaScript)

**Status (as of 2026-07-21)**: v3.0 bundles the skill tree at build time, so it runs standalone with no vault connection required — the description below (file-backed via a connected Obsidian folder) was the original v1/v2 design and still works if you connect a vault, but the deployed build no longer needs one. Built solo, self-taught, no backend server.


ARBOR is a visual "skill tree" website, like the ones in video games, but for real-life self-improvement. Instead of leveling up a fake character, you level up actual skills - calisthenics, guitar, mobility, coding, and more - and watch a glowing tree of nodes fill in as you improve.

## The idea in plain terms

Video game skill trees make progress feel satisfying: you see a map of skills, some locked, some in progress, some mastered, and unlocking one opens up the next. ARBOR brings that same feeling to real skills you're actually working on in daily life. Skills are grouped into "realms" (categories) like calisthenics, mobility, movement arts, guitar, aesthetics, dexterity, tech, building wealth, and stage presence.

Each skill has clear criteria for three stages:
- Locked / not started
- Unlocked / in progress
- Mastered

## How it stores your progress

There's no traditional database or backend server. Instead, ARBOR reads and writes directly to a folder of files that live in the user's personal notes app (Obsidian). Think of it like ARBOR being a fancy, animated window into a set of plain text files:

- The list of skills and realms is defined in JSON files (edited directly, like a config)
- Your current progress on each skill is saved back into a JSON file automatically as you use the app
- Every change you make is also logged with a timestamp, so there's a full history of your growth over time

Because of this, your data never leaves your own computer - the website itself is just code; all your actual progress stays in your own files. The browser asks for permission once to access that folder, then remembers it for next time.

The app also automatically refreshes what it shows every 45 seconds and whenever you switch back to the tab, so if the underlying files change (for example, edited by another tool), you'll see it reflected without needing to reload the page.

## Running it on your own computer

    npm install
    npm run dev        # opens at http://localhost:5178
    npm run build       # produces a production-ready version

On first visit, click "Connect vault folder" and choose the specific folder ARBOR is allowed to read/write - it only touches that one folder, nothing else on your computer.

## What's inside the code

- `src/lib/vaultSync.js` - handles reading/writing to your files and remembering permission
- `src/lib/store.js` - keeps track of your live progress, XP, and skill statuses
- `src/lib/layout.js` - arranges the skill tree into a clean, readable layout
- `src/components/Realm.jsx` - draws the actual skill tree you see and click around
- `src/components/Atlas.jsx` - the overview screen showing progress across all categories
- `src/components/Panel.jsx` - the detail popup when you click into a single skill
- `src/components/fx.jsx` - small animation effects (text scrambles, number count-ups, click sparks)

## Who this is for

This was built as a personal tool, so it's tailored to one person's specific skills and goals - but the underlying idea (a file-backed, animated skill tree with no server needed) could be adapted to track any set of real-world goals.
