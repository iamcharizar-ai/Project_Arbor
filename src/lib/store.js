import { useSyncExternalStore } from 'react'
import { BUNDLED } from './bundledTree.js'
import { createLedger } from '../../core/ledger.ts'

// Local-first store. Progress + the PR log live in localStorage so the app
// works offline. When the shared ledger is configured (VITE_SUPABASE_*), every
// change is also a `skill` event there, so Life OS and Strong see the same
// progress and can log practice on Arbor's behalf.

const STORAGE_KEY = 'arbor-progress-v4'
const LEGACY_KEY = 'arbor-tree-cache-v3'
const LOG_CAP = 400

export const STATUS_KEYS = ['locked', 'unlocked', 'inprogress', 'mastered']
export const STATUS_LABEL = {
  locked: 'Locked',
  unlocked: 'Unlocked',
  inprogress: 'In progress',
  mastered: 'Mastered',
}
export const RANK = { locked: 0, unlocked: 1, inprogress: 2, mastered: 3 }
export const POINTS = { locked: 0, unlocked: 10, inprogress: 25, mastered: 60 }

const ADAPT_GRACE_MS = 60 * 60 * 1000

// Local calendar day (YYYY-MM-DD). Log lines are stamped in local time, so
// everything that compares against "today" must use local time too.
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ── static skill index (skills never change at runtime) ─────────────────────
const SKILLS = BUNDLED.skills
const BY_ID = new Map(SKILLS.map((s) => [s.id, s]))
export const skillById = (id) => BY_ID.get(id)

// ── tiny external stores ────────────────────────────────────────────────────
function createEmitter() {
  const ls = new Set()
  return {
    on: (l) => { ls.add(l); return () => ls.delete(l) },
    emit: () => ls.forEach((l) => l()),
  }
}

let toast = null
const toastBus = createEmitter()
export const useToast = () => useSyncExternalStore(toastBus.on, () => toast)
function pushToast(next) { toast = next; toastBus.emit() }

let state = {
  skills: SKILLS,
  progress: {},
  logLines: [],
  pulse: { n: 0, status: null },
}
const bus = createEmitter()
export const getState = () => state
export const useTree = () => useSyncExternalStore(bus.on, getState)

// ── persistence ─────────────────────────────────────────────────────────────
// A test fixture used to ship in data/progress.json (mastered → fell, 0 reps)
// and got baked into every visitor's saved state. Drop it wherever it turns up.
const isSeedFixture = (id, r) => id === 'one-arm-pushup' && r?.fell === true && r.maxRank === 3 && !r.cur

function sanitize(progress) {
  const out = {}
  for (const [id, r] of Object.entries(progress || {})) {
    if (!BY_ID.has(id) || !r || typeof r !== 'object' || isSeedFixture(id, r)) continue
    out[id] = r
  }
  return out
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* private mode / corrupt */ }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) return { progress: JSON.parse(legacy).progress || {}, logLines: [] }
  } catch { /* ignore */ }
  return null
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      progress: state.progress,
      logLines: state.logLines,
    }))
  } catch { /* quota */ }
}

function hydrate() {
  const saved = loadPersisted()
  // The bundled seed is only the starting point for a brand-new device; after
  // that the saved record is the truth (no zombie seed entries).
  const progress = sanitize(saved ? saved.progress : BUNDLED.progress)
  const logLines = Array.isArray(saved?.logLines) ? saved.logLines.slice(-LOG_CAP) : []
  state = { ...state, progress, logLines }
}

hydrate()
// Another tab logged something — adopt it instead of clobbering it later.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    hydrate()
    bus.emit()
  })
}

// ── per-skill helpers ───────────────────────────────────────────────────────
export function rec(id, progress = state.progress) { return progress[id] || {} }
export function weightOf(skill) { return skill.w || 1 }

function statusFrom(skill, r) {
  if (skill.unit) {
    const cur = r.cur ?? skill.cur ?? 0
    const [u, p, m] = skill.t
    if (cur >= m) return 'mastered'
    if (cur >= p) return 'inprogress'
    if (cur >= u) return 'unlocked'
    return 'locked'
  }
  const lvl = Math.min(3, Math.max(0, r.lvl ?? skill.lvl ?? 0))
  return STATUS_KEYS[lvl]
}

export function statusOf(skill, progress = state.progress) {
  return statusFrom(skill, progress[skill.id] || {})
}

export function valueOf(skill, progress = state.progress) {
  const r = progress[skill.id] || {}
  return skill.unit ? (r.cur ?? skill.cur ?? 0) : (r.lvl ?? skill.lvl ?? 0)
}

export function staleInfo(skill, progress = state.progress) {
  const r = progress[skill.id] || {}
  if (!r.asOf) return null
  const days = Math.floor((Date.now() - new Date(r.asOf).getTime()) / 86400000)
  const st = statusOf(skill, progress)
  if ((st === 'inprogress' || st === 'unlocked') && days > 45) return { kind: 'stale', days }
  if (st === 'mastered' && days > 90) return { kind: 'reverify', days }
  return null
}

// ── derived data, computed once per progress object ─────────────────────────
let derivedFor = null
let derivedVal = null

/** Everything the UI derives from `progress`: statuses, counts, XP, the frontier. */
export function derive(s = state) {
  if (derivedFor === s.progress) return derivedVal
  const statusById = new Map()
  const counts = { locked: 0, unlocked: 0, inprogress: 0, mastered: 0 }
  let pts = 0, max = 0
  for (const k of s.skills) {
    const st = statusOf(k, s.progress)
    statusById.set(k.id, RANK[st])
    counts[st]++
    pts += POINTS[st] * weightOf(k)
    max += POINTS.mastered * weightOf(k)
  }
  const frontier = s.skills.filter((k) => {
    const r = statusById.get(k.id)
    if (r === 1 || r === 2) return true
    if (r === 3) return false
    return (k.req || []).every((id) => (statusById.get(id) ?? 0) >= 2)
  })
  derivedFor = s.progress
  derivedVal = { statusById, counts, pts, max: max || 1, total: s.skills.length, frontier }
  return derivedVal
}
export const useDerived = () => derive(useTree())

export const overallStats = (s = state) => derive(s)
export const frontierSkills = (s = state) => derive(s).frontier

// ── journal-derived stats ───────────────────────────────────────────────────
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dailyQuest(s = state) {
  const cands = derive(s).frontier
  if (!cands.length) return []
  let seed = 0
  for (const c of dayKey()) seed = (seed * 31 + c.charCodeAt(0)) >>> 0
  const rand = mulberry32(seed)
  const scored = cands
    .map((k) => ({ k, w: (staleInfo(k, s.progress) ? 2 : 1) + rand() }))
    .sort((a, b) => b.w - a.w)
  const picks = []
  const seen = new Set()
  for (const { k } of scored) {
    if (picks.length >= 3) break
    if (seen.has(k.family) && scored.length > 6) continue
    picks.push(k)
    seen.add(k.family)
  }
  for (const { k } of scored) {
    if (picks.length >= 3) break
    if (!picks.includes(k)) picks.push(k)
  }
  return picks
}

export function weekStats(s = state) {
  const cutoff = dayKey(new Date(Date.now() - 6 * 86400000))
  let ticks = 0, ups = 0
  for (const l of s.logLines) {
    if (l.date < cutoff) continue
    ticks++
    if (l.up) ups++
  }
  return { ticks, ups }
}

export function todayLog(s = state) {
  const day = dayKey()
  return s.logLines.filter((l) => l.date === day).reverse()
}

export function recentSkills(s = state, n = 8) {
  const seen = new Set()
  const out = []
  for (let i = s.logLines.length - 1; i >= 0 && out.length < n; i--) {
    const id = s.logLines[i].id
    if (seen.has(id)) continue
    seen.add(id)
    const skill = BY_ID.get(id)
    if (skill) out.push(skill)
  }
  return out
}

export function streakDays(s = state) {
  const days = new Set(s.logLines.map((l) => l.date))
  if (!days.size) return 0
  let streak = 0
  const d = new Date()
  // A tick today or yesterday can start the streak (don't break at midnight
  // before the session is logged).
  if (!days.has(dayKey(d)) && !days.has(dayKey(new Date(Date.now() - 86400000)))) return 0
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  while (days.has(dayKey(d))) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ── mutations ───────────────────────────────────────────────────────────────
function stamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return { date: dayKey(d), time: `${p(d.getHours())}:${p(d.getMinutes())}` }
}

/**
 * Apply a new value. `remote` = it came from the ledger (another device, or
 * Life OS / Strong): same bookkeeping, but no toast, no celebration, no re-emit.
 */
function applyValue(skill, value, { at = new Date().toISOString(), day = dayKey(), remote = false } = {}) {
  const prev = rec(skill.id)
  const before = statusOf(skill)
  const fromVal = valueOf(skill)
  const num = Number.isFinite(value) ? Math.round(value) : fromVal

  const r = { ...prev, asOf: day, at }
  if (skill.unit) r.cur = Math.max(0, num)
  else r.lvl = Math.max(0, Math.min(3, num))
  const after = statusFrom(skill, r)
  const newVal = skill.unit ? r.cur : r.lvl

  // "Climbed back": dropping below a previous best and later recovering it
  // (after at least an hour off) earns an adaptation gear.
  const afterRank = RANK[after]
  const prevMax = r.maxRank || 0
  if (afterRank < prevMax) {
    if (!r.fell) { r.fell = true; r.fellAt = Date.now() }
  } else if (r.fell) {
    if (Date.now() - (r.fellAt || Date.now()) >= ADAPT_GRACE_MS) r.adapt = (r.adapt || 0) + 1
    r.fell = false
    delete r.fellAt
  }
  r.maxRank = Math.max(prevMax, afterRank)

  let logLines = state.logLines
  const up = afterRank > RANK[before]
  if (fromVal !== newVal) {
    const line = {
      ...(remote ? { ...stamp(new Date(at)), date: day } : stamp()), id: skill.id, name: skill.name,
      from: fromVal, to: newVal, unit: skill.unit || 'tier', status: after, up,
    }
    logLines = [...logLines, line].slice(-LOG_CAP)
    if (!remote) pushToast({
      id: Date.now(),
      msg: up ? `${skill.name} > ${STATUS_LABEL[after]}` : `${skill.name}  ${fromVal} > ${newVal} ${line.unit}`,
      status: after,
      up,
    })
  }

  state = {
    ...state,
    progress: { ...state.progress, [skill.id]: r },
    logLines,
    pulse: up && !remote ? { n: (state.pulse?.n || 0) + 1, status: after, skillId: skill.id } : state.pulse,
  }
  return newVal
}

export function setValue(skill, value) {
  const newVal = applyValue(skill, value)
  persist()
  bus.emit()
  ledger.emit('skill', { skillId: skill.id, value: newVal, kind: skill.unit ? 'cur' : 'lvl' })
}

// ── shared ledger ───────────────────────────────────────────────────────────
let sync = { status: 'off', pending: 0 }
const syncBus = createEmitter()
export const useSync = () => useSyncExternalStore(syncBus.on, () => sync)

function onLedgerEvents(events, boot) {
  let changed = false
  for (const ev of events) {
    const p = ev.payload || {}
    const skill = BY_ID.get(String(p.skillId || ''))
    if (!skill) continue
    const r = rec(skill.id)
    if (typeof p.value === 'number') {
      if (r.at && ev.at <= r.at) continue // already have this (or something newer)
      applyValue(skill, p.value, { at: ev.at, day: ev.day, remote: true })
      changed = true
    } else if (p.done === true && (!r.asOf || ev.day > r.asOf)) {
      // practised without a new number: it still counts as "touched"
      state = { ...state, progress: { ...state.progress, [skill.id]: { ...r, asOf: ev.day } } }
      changed = true
    }
  }
  // First sync from this device: publish anything logged here before sync existed.
  if (boot) {
    for (const [id, r] of Object.entries(state.progress)) {
      const skill = BY_ID.get(id)
      if (!skill || r.at) continue
      const value = skill.unit ? r.cur : r.lvl
      if (typeof value !== 'number') continue
      // Backdated to the start of its day: this is the bundled seed or an old local value, so any real
      // event logged elsewhere (even offline, flushed later) must beat it under last-write-wins.
      const day = r.asOf || dayKey()
      const ev = ledger.emit('skill', { skillId: id, value, kind: skill.unit ? 'cur' : 'lvl', done: false }, day, `${day}T00:00:00.000Z`)
      state = { ...state, progress: { ...state.progress, [id]: { ...state.progress[id], at: ev.at } } }
      changed = true
    }
  }
  if (changed) { persist(); bus.emit() }
}

const LEDGER_OFF = import.meta.env.VITE_SUPABASE_DISABLE === '1'
const ledger = createLedger({
  // VITE_SUPABASE_DISABLE=1 forces local-only mode even when keys are present,
  // so dev / test runs can never write to the real ledger.
  url: LEDGER_OFF ? undefined : import.meta.env.VITE_SUPABASE_URL,
  key: LEDGER_OFF ? undefined : import.meta.env.VITE_SUPABASE_ANON_KEY,
  app: 'arbor',
  types: ['skill'],
  onEvents: onLedgerEvents,
  onStatus: (status, pending) => { sync = { status, pending }; syncBus.emit() },
})
ledger.start()

export function tickNext(skill) {
  const val = valueOf(skill)
  if (skill.unit) {
    const next = (skill.t || []).find((th) => val < th)
    setValue(skill, next != null ? next : val + 1)
  } else {
    setValue(skill, Math.min(3, val + 1))
  }
}
