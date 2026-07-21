// Validates the vault's skill JSONs: parse, duplicate ids, dangling req
// references (same-file), dangling xref references (cross-file, "realm:id"
// form), and that every skill has either tiers{u,p,m} or unit+t[3].
// Usage: node tools/arbor-validate.mjs [path-to-System/arbor]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.argv[2] || 'G:\\My Drive\\My Files\\Obsidian Vault\\System\\arbor'
const REALMS = ['cal', 'mob', 'mov', 'mus', 'aes', 'dex', 'tec', 'car', 'fin', 'bok', 'soc']

let errors = 0
const fail = (msg) => { errors++; console.error('  ✗ ' + msg) }

const byRealm = {}
for (const r of REALMS) {
  const file = join(ROOT, 'skills', r + '.json')
  let data
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    fail(`${r}.json: parse error — ${e.message}`)
    continue
  }
  byRealm[r] = data.skills || []
}

for (const r of Object.keys(byRealm)) {
  const skills = byRealm[r]
  const ids = new Set()
  console.log(`${r}.json — ${skills.length} skills`)
  for (const s of skills) {
    if (!s.id) { fail(`${r}: skill missing id (${s.name})`); continue }
    if (ids.has(s.id)) fail(`${r}:${s.id} duplicate id`)
    ids.add(s.id)
    const hasTiers = s.tiers && s.tiers.u && s.tiers.p && s.tiers.m
    const hasUnit = s.unit && Array.isArray(s.t) && s.t.length === 3
    if (!hasTiers && !hasUnit) fail(`${r}:${s.id} has neither tiers{u,p,m} nor unit+t[3]`)
    if (!s.branch) fail(`${r}:${s.id} missing branch`)
  }
  for (const s of skills) {
    for (const req of s.req || []) {
      if (!ids.has(req)) fail(`${r}:${s.id} req "${req}" not found in ${r}.json`)
    }
    for (const x of s.xref || []) {
      const m = /^([a-z]+):(.+)$/.exec(x)
      if (!m) { fail(`${r}:${s.id} xref "${x}" not in realm:id form`); continue }
      const [, xr, xid] = m
      if (!byRealm[xr]) { fail(`${r}:${s.id} xref realm "${xr}" unknown`); continue }
      if (!byRealm[xr].some((k) => k.id === xid)) fail(`${r}:${s.id} xref "${x}" target not found`)
    }
  }
}

const total = Object.values(byRealm).reduce((a, b) => a + b.length, 0)
console.log(errors ? `\n${errors} error(s) across ${total} skills` : `\nOK — ${total} skills, all references resolve`)
process.exit(errors ? 1 : 0)
