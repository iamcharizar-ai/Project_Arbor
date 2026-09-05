import { useSyncExternalStore } from 'react'
import { BUNDLED } from './bundledTree.js'

// Local-first store. Progress + the PR log live in localStorage so the app
// works offline with no vault folder. A v3 cache is migrated on first load.

const STORAGE_KEY = 'arbor-progress-v4'
const LEGACY_KEY = 'arbor-tree-cache-v3'

export const STATUS_LABEL = {
  locked: 'Locked',
  unlocked: 'Unlocked',
  inprogress: 'In progress',
  mastered: 'Mastered',
}
export const STATUS_DESC = {
  locked: 'locked — prerequisites not yet trained',
  unlocked: 'unlocked — entry criterion hit',
  inprogress: 'in progress — building the PR',
  mastered: 'mastered — the target, hit',
}
const RANK = { locked: 0, unlocked: 1, inprogress: 2, mastered: 3 }
export const POINTS = { locked: 0, unlocked: 10, inprogress: 25, mastered: 60 }

const ADAPT_GRACE_MS = 60 * 60 * 1000

// Local calendar day (YYYY-MM-DD). Log lines are stamped in local time, so
// everything that compares against "today" must use local time too — the old
// toISOString() key was UTC, which made todayLog/streak/week drift for hours
// after midnight in any timezone east of UTC.
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

let bursts = {}
export function burstOf(id) { return bursts[id] || 0 }

let toast = null
const toastListeners = new Set()
export function subscribeToast(l) { toastListeners.add(l); return () => toastListeners.delete(l) }
export function getToast() { return toast }
export function useToast() { return useSyncExternalStore(subscribeToast, getToast) }
function pushToast(next) {
  toast = next
  toastListeners.forEach((l) => l())
}

let state = {
  loaded: true,
  families: BUNDLED.families,
  skills: BUNDLED.skills,
  progress: { ...BUNDLED.progress },
  logLines: [],
  pulse: { n: 0, status: null },
}

const listeners = new Set()
function emit() { listeners.forEach((l) => l()) }
export function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }
export function getState() { return state }
export function useTree() { return useSyncExternalStore(subscribe, getState) }

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* private mode */ }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const c = JSON.parse(legacy)
      return { progress: c.progress || {}, logLines: [] }
    }
  } catch { /* ignore */ }
  return null
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      progress: state.progress,
      logLines: state.logLines.slice(-400),
    }))
  } catch { /* quota */ }
}

export function initStore() {
  const saved = loadPersisted()
  if (saved) {
    state = {
      ...state,
      progress: { ...BUNDLED.progress, ...(saved.progress || {}) },
      logLines: Array.isArray(saved.logLines) ? saved.logLines : [],
    }
  }
  emit()
}

export function rec(id) { return state.progress[id] || {} }
export function weightOf(skill) { return skill.w || 1 }

export function statusOf(skill, progress = state.progress) {
  const r = progress[skill.id] || {}
  if (skill.unit) {
    const cur = r.cur ?? skill.cur ?? 0
    const [u, p, m] = skill.t
    if (cur >= m) return 'mastered'
    if (cur >= p) return 'inprogress'
    if (cur >= u) return 'unlocked'
    return 'locked'
  }
  const lvl = r.lvl ?? skill.lvl ?? 0
  return ['locked', 'unlocked', 'inprogress', 'mastered'][lvl]
}

export function valueOf(skill) {
  const r = rec(skill.id)
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

export function frontierSkills(s = state) {
  const byId = Object.fromEntries(s.skills.map((k) => [k.id, k]))
  return s.skills.filter((k) => {
    const st = statusOf(k, s.progress)
    if (st === 'unlocked' || st === 'inprogress') return true
    if (st !== 'locked') return false
    const reqs = k.req || []
    return reqs.every((r) => {
      const p = byId[r]
      return p && RANK[statusOf(p, s.progress)] >= 2
    })
  })
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function dailyQuest(s = state) {
  const cands = frontierSkills(s)
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
    const skill = s.skills.find((k) => k.id === id)
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
  const today = dayKey(d)
  const yest = dayKey(new Date(Date.now() - 86400000))
  if (!days.has(today) && !days.has(yest)) return 0
  if (!days.has(today)) d.setDate(d.getDate() - 1)
  for (;;) {
    const key = dayKey(d)
    if (!days.has(key)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return {
    date: dayKey(d),
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  }
}

export function setValue(skill, value) {
  const before = statusOf(skill)
  const fromVal = valueOf(skill)
  const r = { ...rec(skill.id), asOf: dayKey() }
  if (skill.unit) r.cur = Math.max(0, value)
  else r.lvl = Math.max(0, Math.min(3, value))
  state = { ...state, progress: { ...state.progress, [skill.id]: r } }
  const after = statusOf(skill)
  const newVal = skill.unit ? r.cur : r.lvl

  const afterRank = RANK[after]
  const prevMax = r.maxRank || 0
  if (afterRank < prevMax) {
    if (!r.fell) { r.fell = true; r.fellAt = Date.now() }
  } else if (r.fell && afterRank >= prevMax) {
    if (Date.now() - (r.fellAt || Date.now()) >= ADAPT_GRACE_MS) r.adapt = (r.adapt || 0) + 1
    r.fell = false
    delete r.fellAt
  }
  r.maxRank = Math.max(prevMax, afterRank)
  state = { ...state, progress: { ...state.progress, [skill.id]: r } }

  if (fromVal !== newVal) {
    const { date, time } = stamp()
    const line = {
      date, time, id: skill.id, name: skill.name,
      from: fromVal, to: newVal,
      unit: skill.unit || 'tier',
      status: after,
      up: RANK[after] > RANK[before],
    }
    state = { ...state, logLines: [...state.logLines, line] }
    const unit = skill.unit || 'tier'
    const msg = line.up
      ? `${skill.name} → ${STATUS_LABEL[after]}`
      : `${skill.name}  ${fromVal} → ${newVal} ${unit}`
    pushToast({ id: Date.now(), msg, status: after, up: line.up })
  }

  if (RANK[after] > RANK[before]) {
    bursts = { ...bursts, [skill.id]: Date.now() }
    setTimeout(() => { bursts = { ...bursts }; delete bursts[skill.id]; emit() }, 900)
    state = { ...state, pulse: { n: (state.pulse?.n || 0) + 1, status: after, skillId: skill.id, skillName: skill.name } }
  }

  persist()
  emit()
}

export function tickNext(skill) {
  if (skill.unit) {
    const val = valueOf(skill)
    const next = (skill.t || []).find((th) => val < th)
    setValue(skill, next != null ? next : val + 1)
    return
  }
  setValue(skill, Math.min(3, valueOf(skill) + 1))
}

export function overallStats(s = state) {
  const counts = { locked: 0, unlocked: 0, inprogress: 0, mastered: 0 }
  let pts = 0, max = 0
  for (const k of s.skills) {
    const st = statusOf(k, s.progress)
    counts[st]++
    pts += POINTS[st] * weightOf(k)
    max += POINTS.mastered * weightOf(k)
  }
  return { total: s.skills.length, counts, pts, max: max || 1 }
}

export function familyStats(familyId, s = state) {
  const skills = s.skills.filter((k) => k.family === familyId)
  const counts = { locked: 0, unlocked: 0, inprogress: 0, mastered: 0 }
  let pts = 0, max = 0
  for (const k of skills) {
    const st = statusOf(k, s.progress)
    counts[st]++
    pts += POINTS[st] * weightOf(k)
    max += POINTS.mastered * weightOf(k)
  }
  return { total: skills.length, counts, pts, max: max || 1 }
}

initStore()
