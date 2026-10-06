// Optional: copy a vault System/arbor snapshot into data/ (cal/mob/mov only),
// then validate. The app no longer needs a live vault — this is just for
// refreshing the bundled tree. Usage: node tools/sync-data.mjs [path]
//
// All-or-nothing: the snapshot is staged in a temp dir, every source file must exist, the staged
// copy must validate, and only then does data/ get replaced. A bad or half-synced vault leaves
// the bundled tree exactly as it was.
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, rmSync, renameSync } from 'node:fs'
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
  // the validator reads the skill families only; progress.json has to parse too
  try {
    const p = JSON.parse(readFileSync(join(STAGE, 'progress.json'), 'utf8'))
    if (p === null || typeof p !== 'object' || Array.isArray(p)) throw new Error('not an object')
    console.log('progress.json — ok')
  } catch (e) {
    console.error(`  ✗ progress.json: ${e.message}`)
    valid = false
  }

  if (valid) {
    // Two steps so a failed write cannot leave a half-written file: every new file is first written
    // beside its target, then each is swapped in with a rename (atomic per file). Other files in
    // data/ are never touched.
    console.log('\nInstalling into data/')
    const next = FILES.map((rel) => ({ rel, to: join(DEST, rel), tmp: join(DEST, rel) + '.new' }))
    try {
      for (const f of next) {
        mkdirSync(dirname(f.to), { recursive: true })
        writeFileSync(f.tmp, readFileSync(join(STAGE, f.rel)))
      }
    } catch (e) {
      for (const f of next) rmSync(f.tmp, { force: true })
      throw e
    }
    for (const f of next) {
      renameSync(f.tmp, f.to)
      console.log(`  ✓ ${f.rel}`)
    }
    console.log('\nSnapshot refreshed. Rebuild + redeploy to publish it.')
  } else {
    console.error('\n✗ snapshot failed validation, nothing changed (data/ is untouched).')
    process.exitCode = 1 // not process.exit(): the finally below has to clean up the staging dir
  }
} finally {
  rmSync(STAGE, { recursive: true, force: true })
}
