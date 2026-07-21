// Build-time snapshot of the tree, bundled straight from data/ (a mirror of
// the vault's System/arbor/). This is what makes ARBOR render on a fresh load
// with NO vault connected — the Vercel deploy, or any session before Chrome
// re-grants the folder handle. Vault sync (vaultSync.js) then OVERLAYS live
// realms/skills/progress on top of this base when it's available.
//
// Refresh the snapshot with `node tools/sync-data.mjs` (copies the vault into
// data/ + validates) before a redeploy.
import realmsFile from '../../data/realms.json'
import progressSeed from '../../data/progress.json'

// eager glob → { '../../data/skills/cal.json': { skills: [...] }, ... }
const skillFiles = import.meta.glob('../../data/skills/*.json', { eager: true, import: 'default' })

const realms = realmsFile.realms || []

const skills = []
for (const [path, file] of Object.entries(skillFiles)) {
  const realm = path.match(/([a-z]+)\.json$/)?.[1]
  if (!realm) continue
  for (const s of file.skills || []) skills.push({ ...s, realm })
}

export const BUNDLED = { realms, skills, progress: progressSeed || {} }
