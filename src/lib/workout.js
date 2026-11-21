// Random calisthenics workout generator. Pure functions: no DOM, no store, so
// it can be tested in Node. The UI passes in the skill list + progress record.
//
// How a workout is built
// ──────────────────────
// A workout is a list of SLOTS (balance/skill work first while fresh, then
// push / pull / legs, core, and a mobility finisher). Each slot is filled from
// one of three pools, by ROLE:
//
//   build  – skills you are actively developing: Unlocked + In progress.
//            This is the bulk of every session (In progress is weighted a bit
//            higher; skills you haven't touched for a while come up more often).
//   keep   – ONE Mastered skill (max), picked from the ones you haven't done in
//            the longest time, at low volume so old skills don't rot.
//   reach  – ONE Locked skill (max) whose prerequisites are all In progress or
//            better, i.e. the next thing you are about to unlock. A few
//            "give it a go" sets, no fixed rep target.
//
// Locked skills with unmet prerequisites are never picked, and neither are
// Mastered skills that a harder unlocked skill has superseded. If a category has
// no "build" skill (a brand-new tree), its slot falls back to reach, then keep.
//
// Only skills measured in reps or seconds are used (weighted, rope climbs and
// jump heights have no sensible set/rep prescription) and only calisthenics /
// mobility categories (movement arts are never suggested), filtered by where
// you are training (home = doorway bar + floor, gym = anything).
import { categoryOf, canDo } from '../../core/meta.ts'
import { valueOf } from '../../core/model.ts'
import { analyse } from '../../core/coach.ts'

export const FOCUS = {
  full: { label: 'Full body', slots: ['balance', 'push', 'pull', 'legs', 'core', 'mobility'] },
  push: { label: 'Push', slots: ['balance', 'push', 'push', 'push', 'core', 'mobility'] },
  pull: { label: 'Pull', slots: ['balance', 'pull', 'pull', 'pull', 'core', 'mobility'] },
  legs: { label: 'Legs + core', slots: ['legs', 'legs', 'legs', 'core', 'core', 'mobility'] },
}

export const WARMUP = {
  full: 'Wrist circles, scap pushes and pulls, arm circles, bodyweight squats, then one easy set of your first move.',
  push: 'Wrist circles and rocks, scap push-ups, arm circles, then one easy set of your first move.',
  pull: 'Dead hang and scap pulls, arm circles, band or light rows if you have them, then one easy set of your first move.',
  legs: 'Leg swings, hip circles, ankle rocks, a few slow bodyweight squats, then one easy set of your first move.',
}

export const SLOT_LABEL = { balance: 'Skill', push: 'Push', pull: 'Pull', legs: 'Legs', core: 'Core', mobility: 'Mobility' }

const KEEP_CHANCE = 0.7
const REACH_CHANCE = 0.55
const RECENT_PENALTY = 0.25 // was in the previous workout
const SAME_BRANCH_PENALTY = 0.35
const LINKED_PENALTY = 0.05 // one is a prerequisite of the other: pointless to stack
const STALE_CAP_DAYS = 30

const daysSince = (rec) => {
  const stamp = rec?.asOf || (rec?.at || '').slice(0, 10)
  if (!stamp) return STALE_CAP_DAYS
  const d = Math.floor((Date.now() - new Date(stamp + 'T12:00:00').getTime()) / 86400000)
  return Math.max(0, Number.isFinite(d) ? d : STALE_CAP_DAYS)
}

/** Skills that can be prescribed as sets (reps or a timed hold), in a category we ever suggest. */
const usable = (s, where) => (s.unit === 'reps' || s.unit === 'sec') && Array.isArray(s.t) && categoryOf(s) !== 'out' && canDo(s, where)

/** Split the usable skills into build / keep / reach, per category. */
export function buildPools(skills, progress, where = 'home') {
  const a = analyse(skills, progress)
  const rankOf = (id) => a.rank.get(id) ?? 0
  const reqMet = (id) => rankOf(id) >= 2 || a.superseded.has(id)
  const pools = { build: {}, keep: {}, reach: {} }
  const add = (role, s) => { (pools[role][categoryOf(s)] ||= []).push(s) }
  for (const s of skills) {
    if (!usable(s, where)) continue
    const r = rankOf(s.id)
    if (r === 1 || r === 2) add('build', s)
    else if (r === 3) { if (!a.superseded.has(s.id)) add('keep', s) }
    else if (!a.superseded.has(s.id) && s.req.every(reqMet)) add('reach', s)
  }
  return { pools, rank: a.rank, superseded: a.superseded }
}

const FALLBACK = { build: ['build', 'reach', 'keep'], keep: ['keep', 'build', 'reach'], reach: ['reach', 'build', 'keep'] }

function weightOf(s, role, ctx) {
  const r = ctx.rank.get(s.id) ?? 0
  const stale = daysSince(ctx.progress[s.id])
  let w
  if (role === 'build') {
    w = (r === 2 ? 3 : 2) * (1 + (Math.min(stale, STALE_CAP_DAYS) / STALE_CAP_DAYS) * 0.8)
    if (ctx.superseded.has(s.id)) w *= 0.4
  } else if (role === 'keep') {
    w = 1 + Math.min(stale, 60) / 10 // the longer it has sat, the likelier
  } else {
    w = 1
  }
  if (s.star) w *= 1.3
  if (ctx.avoid.has(s.id)) w *= RECENT_PENALTY
  if (ctx.branches.has(s.branch)) w *= SAME_BRANCH_PENALTY
  for (const p of ctx.picked) if (s.req.includes(p.id) || p.req.includes(s.id)) w *= LINKED_PENALTY
  return w
}

function pickOne(candidates, role, ctx, rng) {
  const scored = candidates.filter((s) => !ctx.ids.has(s.id)).map((s) => ({ s, w: weightOf(s, role, ctx) }))
  const total = scored.reduce((n, x) => n + x.w, 0)
  if (!scored.length || total <= 0) return null
  let t = rng() * total
  for (const x of scored) { t -= x.w; if (t <= 0) return x.s }
  return scored[scored.length - 1].s
}

/**
 * Try the wanted role first, then the fallbacks. "keep" and "reach" are capped
 * at one each per workout (`ctx.used`) unless `relax` is set. Returns { skill, role } or null.
 */
function fill(slot, role, ctx, rng, relax = false) {
  for (const r of FALLBACK[role]) {
    if (!relax && r !== 'build' && ctx.used[r]) continue
    const s = pickOne(ctx.pools[r][slot] || [], r, ctx, rng)
    if (s) return { skill: s, role: r }
  }
  return null
}

const makeCtx = (skills, progress, where, avoid) => {
  const built = buildPools(skills, progress, where)
  return { ...built, progress, avoid: new Set(avoid || []), ids: new Set(), picked: [], branches: new Set(), used: { keep: false, reach: false } }
}
const take = (ctx, skill, role) => {
  ctx.ids.add(skill.id); ctx.picked.push(skill); ctx.branches.add(skill.branch)
  if (role && role !== 'build') ctx.used[role] = true
}

/**
 * Roll a workout. `avoid` = skill ids to steer away from (the previous workout),
 * so "roll again" doesn't hand you the same session back.
 * Returns [{ id, slot, role }] in training order.
 */
export function generateWorkout({ skills, progress, where = 'home', focus = 'full', avoid = [], rng = Math.random }) {
  const slots = (FOCUS[focus] || FOCUS.full).slots
  const ctx = makeCtx(skills, progress, where, avoid)

  const strength = slots.map((s, i) => (s === 'balance' || s === 'mobility' ? -1 : i)).filter((i) => i >= 0)
  const keepIdx = rng() < KEEP_CHANCE ? strength[Math.floor(rng() * strength.length)] : -1
  const open = slots.map((_, i) => i).filter((i) => i !== keepIdx)
  const reachIdx = rng() < REACH_CHANCE ? open[Math.floor(rng() * open.length)] : -1

  const wanted = slots.map((_, i) => (i === keepIdx ? 'keep' : i === reachIdx ? 'reach' : 'build'))
  const out = slots.map(() => null)
  const run = (relax) => slots.forEach((slot, i) => {
    if (out[i]) return
    const got = fill(slot, wanted[i], ctx, rng, relax)
    if (!got) return
    take(ctx, got.skill, got.role)
    out[i] = { id: got.skill.id, slot, role: got.role }
  })
  run(false)
  // A brand-new tree has nothing "in progress": rather than hand back a one-exercise
  // workout, let the remaining slots all be reach skills.
  if (out.filter(Boolean).length < 4) run(true)
  return out.filter(Boolean)
}

/**
 * Re-roll one exercise, keeping its slot and role (falling back like generation does).
 * Returns the new items, or null when there is no other exercise that fits.
 */
export function swapExercise({ skills, progress, where = 'home', items, index, rng = Math.random }) {
  const cur = items[index]
  if (!cur) return null
  const ctx = makeCtx(skills, progress, where, [cur.id])
  const byId = new Map(skills.map((s) => [s.id, s]))
  items.forEach((it, i) => {
    const s = byId.get(it.id)
    if (s && i !== index) take(ctx, s, it.role)
  })
  ctx.ids.add(cur.id) // never hand back the one you just swapped away
  const got = fill(cur.slot, cur.role, ctx, rng) || fill(cur.slot, cur.role, ctx, rng, true)
  if (!got) return null
  const next = items.slice()
  next[index] = { id: got.skill.id, slot: cur.slot, role: got.role }
  return next
}

// ── prescriptions ───────────────────────────────────────────────────────────
const roundHold = (n) => (n >= 20 ? Math.round(n / 5) * 5 : Math.max(2, Math.round(n)))

/**
 * Sets × amount for one exercise, from what you can currently do.
 *  build  – sub-maximal volume: ~65% of your best reps (~70% for holds), so every
 *           set is clean with reps in reserve. The harder the move (lower your
 *           best), the more sets of fewer reps: 5 sets when your best is ≤3 reps.
 *  keep   – 2 easy sets at half your best.
 *  reach  – 3 sets, as many reps / as long a hold as you can; no fixed number.
 *  skill  – (balance slot) the same as build, a touch lighter (60%) since it is
 *           practised fresh and often.
 *  mobility – 2 sets held at your best.
 */
export function prescribe(skill, role, progress) {
  const hold = skill.unit === 'sec'
  const cat = categoryOf(skill)
  const [u] = skill.t
  const cur = valueOf(skill, progress[skill.id])
  const word = hold ? 'sec' : 'reps'
  const next = skill.t.find((x) => x > cur)
  const best = `Best ${cur} ${word}`
  const base = { unit: word }

  if (role === 'reach' || cur < u) {
    return { ...base, hint: `${best}, first tier at ${u}`, mode: 'max', sets: 3, amount: u, rest: hold ? 75 : 90, workSec: hold ? u : u * 3.5 }
  }

  let sets, amount, rest
  if (cat === 'mobility') {
    sets = 2
    amount = hold ? roundHold(cur) : cur
    rest = 30
  } else if (role === 'keep') {
    sets = 2
    amount = hold ? roundHold(cur * 0.5) : Math.max(1, Math.round(cur * 0.5))
    rest = 45
  } else {
    const frac = cat === 'balance' ? 0.6 : hold ? 0.7 : 0.65
    amount = hold ? roundHold(cur * frac) : Math.max(1, Math.round(cur * frac))
    sets = hold ? (cur <= 10 ? 5 : cur <= 30 ? 4 : 3) : cur <= 3 ? 5 : cur <= 8 ? 4 : 3
    rest = cat === 'core' ? 60 : hold ? 75 : cur <= 5 ? 120 : 90
  }
  const hint = role === 'keep' ? `${best}. Easy sets, just keep it sharp` : next ? `${best}, next tier at ${next}` : `${best}, all tiers cleared`
  return { ...base, hint, mode: 'fixed', sets, amount, rest, workSec: hold ? amount : amount * 3.5 }
}

/** Total sets and a rough duration (work + rest, last rest dropped, plus a 4 min warm-up). */
export function summarize(items, byId, progress) {
  let sets = 0
  let sec = 0
  for (const it of items) {
    const s = byId.get(it.id)
    if (!s) continue
    const p = prescribe(s, it.role, progress)
    sets += p.sets
    sec += p.sets * p.workSec + (p.sets - 1) * p.rest + 45 // 45s to set up / change exercise
  }
  const minutes = Math.max(5, Math.round((sec / 60 + 4) / 5) * 5)
  return { exercises: items.length, sets, minutes }
}
