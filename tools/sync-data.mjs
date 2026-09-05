// Optional: copy a vault System/arbor snapshot into data/ (cal/mob/mov only),
// then validate. The app no longer needs a live vault — this is just for
// refreshing the bundled tree. Usage: node tools/sync-data.mjs [path]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const SRC = process.argv[2] || 'G:\\My Drive\\My Files\\Obsidian Vault\\System\\arbor'
const DEST = join(REPO, 'data')
const FAMILIES = ['cal', 'mob', 'mov']

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

console.log(`Syncing ${SRC} → data/ (body-skill families only)`)
copy('progress.json')
for (const r of FAMILIES) copy(join('skills', `${r}.json`))

console.log('\nValidating snapshot…')
execFileSync('node', [join(HERE, 'arbor-validate.mjs'), DEST], { stdio: 'inherit' })
console.log('\nSnapshot refreshed. Rebuild + redeploy to publish it.')
