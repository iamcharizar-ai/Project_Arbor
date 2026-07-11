# ARBOR — living skill tree, vault-synced

The frontend over Rishabh's Obsidian vault goals: 288 skills across 9 realms (calisthenics, mobility, movement arts, guitar, aesthetics, dexterity, tech, wealth/empire ladder, presence), each with explicit **Unlocked / In Progress / Mastered** criteria. WINGS-style grid (icon circles, straight edges), minimalist dark UI with reactive effects.

## Run

```
npm install
npm run dev     # → http://localhost:5178
npm run build   # static bundle in dist/
```

Deployed: static site on Vercel (see `Mini Notes/Arbor Planner.md` for the live URL). First visit → click **Connect vault folder** and pick `System/arbor` inside the vault; Chrome keeps the handle across visits (re-grant after a browser restart).

## Architecture — the vault IS the database, the browser IS the bridge

There is **no server**. ARBOR is a pure static app; vault sync uses the File System Access API (`src/lib/vaultSync.js`, Chromium only — same pattern as LifeOS). The browser holds a `readwrite` directory handle scoped to `System/arbor/` (least privilege, never the whole vault) persisted in IndexedDB. Vault contents never leave the machine — the deploy host only serves code.

- Definitions (agent-edited): `realms.json` + `skills/{cal,mob,mov,mus,aes,dex,tec,wel,soc}.json`
- Current values: `progress.json` (app writes; agents may read/write)
- History: `progress-log.md` — every tick appends `- YYYY-MM-DD HH:mm · id · Name · from → to · status`

The app re-reads the vault on window focus and every 45s (skipped while a tick is mid-flush), so agent edits appear without a manual reload. localStorage is only an offline read cache; ticks made while disconnected are kept locally but **not** synced retroactively.

## Code map

- `src/lib/vaultSync.js` — File System Access bridge: handle persistence, tree read, progress write + log append
- `src/lib/store.js` — vault-backed store: optimistic writes, debounced flush, auto-refresh, status derivation, XP/vitality
- `src/lib/layout.js` — tidy-tree layout snapped to a grid, branches wrap into rows
- `src/components/Realm.jsx` — React Flow canvas, circle nodes, straight status-colored edges
- `src/components/Atlas.jsx` — realm overview with progress rings + end goals
- `src/components/Panel.jsx` — skill detail: stepper (numeric) or tier buttons (rubric)
- `src/components/fx.jsx` — ScrambleText, CountUp, ClickSpark, Spotlight (reactbits-style, no deps)

Vault-side docs: `Mini Notes/Arbor Planner.md` (incl. the roadmap) + CLAUDE.md "System Layer" section.
