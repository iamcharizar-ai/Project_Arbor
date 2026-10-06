// Optional: copy a vault System/arbor snapshot into data/ (cal/mob/mov only),
// then validate. The app no longer needs a live vault — this is just for
// refreshing the bundled tree. Usage: node tools/sync-data.mjs [path]
//
// All-or-nothing: the snapshot is staged in a temp dir, every source file must exist, the staged
// copy must validate, and only then does data/ get replaced. A bad or half-synced vault leaves
// the bundled tree exactly as it was.
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..')
const SRC = process.argv[2] || 'G:\\My Drive\\My Files\\Obsidian Vault\\System\\arbor'
const DEST = join(REPO, 'data')
const FAMILIES = ['cal', 'mob', 'mov']
const FILES = ['progress.json', ...FAMILIES.map((r) => join('skills', `${r}.json`))]

if (!existsSync(SRC)) {
  console.error(`✗ vault source not found: ${SRC}\n  (pass the System/arbor path as an argument)`)
  process.exit(1)
}

const missing = FILES.filter((rel) => !existsSync(join(SRC, rel)))
if (missing.length) {
  console.error(`✗ snapshot incomplete, nothing changed. Missing in ${SRC}:\n${missing.map((m) => `    ${m}`).join('\n')}`)
  process.exit(1)
}

const STAGE = mkdtempSync(join(tmpdir(), 'arbor-sync-'))
try {
  console.log(`Staging ${SRC} (body-skill families only)`)
  for (const rel of FILES) {
    const to = join(STAGE, rel)
    mkdirSync(dirname(to), { recursive: true })
    writeFileSync(to, readFileSync(join(SRC, rel)))
    console.log(`  ✓ ${rel}`)
  }

  console.log('\nValidating snapshot…')
  let valid = true
  try {
    execFileSync('node', [join(HERE, 'arbor-validate.mjs'), STAGE], { stdio: 'inherit' })
  } catch {
    valid = false
  }

  if (valid) {
    console.log('\nInstalling into data/')
    for (const rel of FILES) {
      const to = join(DEST, rel)
      mkdirSync(dirname(to), { recursive: true })
      writeFileSync(to, readFileSync(join(STAGE, rel)))
      console.log(`  ✓ ${rel}`)
    }
    console.log('\nSnapshot refreshed. Rebuild + redeploy to publish it.')
  } else {
    console.error('\n✗ snapshot failed validation, nothing changed (data/ is untouched).')
    process.exitCode = 1 // not process.exit(): the finally below has to clean up the staging dir
  }
} finally {
  rmSync(STAGE, { recursive: true, force: true })
}
