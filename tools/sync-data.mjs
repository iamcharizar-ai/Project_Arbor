// Refresh the bundled snapshot: copy the vault's System/arbor tree into the
// repo's data/ folder (what bundledTree.js bakes into the build), then
// validate it. Run before a redeploy so the deployed static tree matches the
// vault. Usage: node tools/sync-data.mjs [path-to-System/arbor]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const SRC = process.argv[2] || 'G:\\My Drive\\My Files\\Obsidian Vault\\System\\arbor'
const DEST = join(REPO, 'data')
const REALMS = ['cal', 'mob', 'mov', 'mus', 'aes', 'dex', 'tec', 'car', 'fin', 'bok', 'soc']

if (!existsSync(SRC)) {
  console.error(`✗ vault source not found: ${SRC}\n  (pass the System/arbor path as an argument)`)
  process.exit(1)
}

const copy = (rel) => {
  const from = join(SRC, rel)
  const to = join(DEST, rel)
  mkdirSync(dirname(to), { recursive: true })
  writeFileSync(to, readFileSync(from))
  console.log(`  ✓ ${rel}`)
}

console.log(`Syncing ${SRC} → data/`)
copy('realms.json')
copy('progress.json')
for (const r of REALMS) copy(join('skills', `${r}.json`))

// validate the freshly-copied snapshot (fails the sync on a bad tree)
console.log('\nValidating snapshot…')
execFileSync('node', [join(HERE, 'arbor-validate.mjs'), DEST], { stdio: 'inherit' })
console.log('\nSnapshot refreshed. Rebuild + redeploy to publish it.')
