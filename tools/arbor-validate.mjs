// Validates the unified body-skill tree: parse, duplicate ids, dangling reqs,
// missing tiers/unit, and cycles. Usage: node tools/arbor-validate.mjs [data-dir]
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.argv[2] || 'data'
const FAMILIES = ['cal', 'mob', 'mov']

let errors = 0
const fail = (msg) => { errors++; console.error('  ✗ ' + msg) }

const skills = []
for (const r of FAMILIES) {
  const file = join(ROOT, 'skills', r + '.json')
  let data
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    fail(`${r}.json: parse error — ${e.message}`)
    continue
  }
  for (const s of data.skills || []) skills.push({ ...s, family: r })
  console.log(`${r}.json — ${(data.skills || []).length} skills`)
}

const ids = new Set()
for (const s of skills) {
  if (!s.id) { fail(`skill missing id (${s.name})`); continue }
  if (ids.has(s.id)) fail(`${s.id} duplicate id`)
  ids.add(s.id)
  const hasTiers = s.tiers && s.tiers.u && s.tiers.p && s.tiers.m
  const hasUnit = s.unit && Array.isArray(s.t) && s.t.length === 3
  if (!hasTiers && !hasUnit) fail(`${s.id} has neither tiers{u,p,m} nor unit+t[3]`)
  if (!s.branch) fail(`${s.id} missing branch`)
}

for (const s of skills) {
  for (const req of s.req || []) {
    if (!ids.has(req)) fail(`${s.id} req "${req}" not found in the unified tree`)
  }
  if (s.xref) fail(`${s.id} still has xref — fold into req`)
}

const reqMap = Object.fromEntries(skills.map((s) => [s.id, (s.req || []).filter((x) => ids.has(x))]))
const color = {}
const reported = new Set()
const dfs = (id, stack) => {
  color[id] = 1
  for (const req of reqMap[id] || []) {
    if (color[req] === 1) {
      const cyc = stack.slice(stack.indexOf(req)).concat(req).join(' → ')
      if (!reported.has(cyc)) { reported.add(cyc); fail(`req cycle — ${cyc}`) }
    } else if (color[req] !== 2) {
      dfs(req, stack.concat(req))
    }
  }
  color[id] = 2
}
for (const s of skills) if (color[s.id] === undefined) dfs(s.id, [s.id])

console.log(`\n${skills.length} skills in the unified tree`)
if (errors) {
  console.error(`\n${errors} error(s)`)
  process.exit(1)
}
console.log('ok')
