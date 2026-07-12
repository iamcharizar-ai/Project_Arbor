import { useSyncExternalStore } from 'react'
import * as vault from './vaultSync.js'

// ── vault-backed store ────────────────────────────────────────────────────
// Tree definition + progress live in the Obsidian vault (System/arbor/*).
// Sync is via the File System Access API (vaultSync.js) — serverless, works
// identically on localhost and the static Vercel deploy. localStorage is
// only an offline read cache.

const CACHE_KEY = 'arbor-tree-cache-v3'

// realms where a "mastered" is a perishable physical fact, not a certificate
export const PHYSICAL_REALMS = new Set(['cal', 'mob', 'mov', 'aes', 'dex'])

let state = {
  loaded: false,
  error: null,
  fileErrors: [], // per-file read problems (one broken JSON ≠ dead tree)
  syncStatus: vault.supported() ? 'disconnected' : 'unsupported', // disconnected | need-perm | ready | unsupported
  realms: [],
  skills: [],
  progress: {},
  season: null, // optional System/arbor/season.json: { name, ends, ids: [] }
  logLines: [], // parsed tail of progress-log.md (the momentum layer)
  pending: 0,
}
let handle = null
const listeners = new Set()

function emit() { listeners.forEach((l) => l()) }
export function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }
export function getState() { return state }
export function useTree() { return useSyncExternalStore(subscribe, getState) }

function cache() {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ realms: state.realms, skills: state.skills, progress: state.progress }))
}

function loadCache() {
  const c = localStorage.getItem(CACHE_KEY)
  return c ? JSON.parse(c) : null
}

export async function initVault() {
  const { handle: h, status } = await vault.loadSavedHandle()
  handle = h
  if (status === 'ready') {
    await pullTree()
  } else {
    const c = loadCache()
    state = { ...state, loaded: true, syncStatus: status, ...(c || {}) }
    emit()
  }
  startAutoRefresh()
}

async function pullTree() {
  try {
    const d = await vault.readTree(handle)
    const fatal = d.errors.length > 0 && d.skills.length === 0
    state = {
      ...state,
      loaded: true,
      syncStatus: 'ready',
      error: fatal ? 'Could not read the vault folder — ' + d.errors[0] : null,
      fileErrors: fatal ? [] : d.errors,
      realms: d.realms,
      skills: d.skills,
      progress: d.progress,
      season: d.season,
      logLines: parseLog(d.log),
    }
    if (!fatal) cache()
    else {
      const c = loadCache()
      state = { ...state, ...(c || {}) }
    }
  } catch (e) {
    const c = loadCache()
    state = { ...state, loaded: true, error: 'Could not read the vault folder — ' + (e?.message || e), ...(c || {}) }
  }
  emit()
}

export async function connectVault() {
  try {
    handle = await vault.connect()
    await pullTree()
  } catch {
    /* user cancelled the picker */
  }
}

export async function authorizeVault() {
  const { handle: h } = await vault.loadSavedHandle()
  handle = h
  if (handle && (await vault.authorize(handle))) await pullTree()
}

export async function disconnectVault() {
  await vault.disconnect()
  handle = null
  state = { ...state, syncStatus: 'disconnected' }
  emit()
}

// Re-read the vault on window focus + a slow poll, so agent edits to
// skills/*.json and progress.json show up without a manual reload. Skipped
// while a local change is still being flushed (never clobber a pending tick).
let refreshTimer = null
function startAutoRefresh() {
  if (refreshTimer) return
  const refresh = () => {
    if (!handle || state.syncStatus !== 'ready') return
    if (document.visibilityState !== 'visible') return
    if (state.pending > 0 || Object.keys(flushTimers).length > 0) return
    pullTree()
  }
  window.addEventListener('focus', refresh)
  refreshTimer = setInterval(refresh, 45000)
}

// ── status derivation (Mahoraga vocabulary, stable underlying keys) ──────
export const STATUS_LABEL = { locked: 'Sealed', unlocked: 'Awakened', inprogress: 'Adapting', mastered: 'Adapted' }
export const STATUS_DESC = {
  locked: 'sealed — not yet begun',
  unlocked: 'awakened — entry criterion hit',
  inprogress: 'adapting — building volume',
  mastered: 'adapted — the dedicated target, hit',
}
const RANK = { locked: 0, unlocked: 1, inprogress: 2, mastered: 3 }
export const POINTS = { locked: 0, unlocked: 10, inprogress: 25, mastered: 60 }

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

// ── staleness (R3): asOf dates finally mean something ────────────────────
export function staleInfo(skill, progress = state.progress) {
  const r = progress[skill.id] || {}
  if (!r.asOf) return null // never ticked in-app — unknown, not stale
  const days = Math.floor((Date.now() - new Date(r.asOf).getTime()) / 86400000)
  const st = statusOf(skill, progress)
  if ((st === 'inprogress' || st === 'unlocked') && days > 45) return { kind: 'stale', days }
  if (st === 'mastered' && PHYSICAL_REALMS.has(skill.realm) && days > 90) return { kind: 'reverify', days }
  return null
}

// ── frontier (R2): what is actionable right now ───────────────────────────
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

// ── daily quest (R3): today's adaptations, deterministic per day ──────────
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
  for (const c of new Date().toISOString().slice(0, 10)) seed = (seed * 31 + c.charCodeAt(0)) >>> 0
  const rand = mulberry32(seed)
  const scored = cands
    .map((k) => ({ k, w: (staleInfo(k, s.progress) ? 2 : 1) + rand() }))
    .sort((a, b) => b.w - a.w)
  const picks = []
  const realmsSeen = new Set()
  for (const { k } of scored) {
    if (picks.length >= 3) break
    if (realmsSeen.has(k.realm) && scored.length > 6) continue
    picks.push(k)
    realmsSeen.add(k.realm)
  }
  for (const { k } of scored) {
    if (picks.length >= 3) break
    if (!picks.includes(k)) picks.push(k)
  }
  return picks
}

// ── momentum layer (R3): parse the progress log tail ──────────────────────
const LOG_RE = /^- (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · (\S+) · (.+?) · (.+)$/
const CROSS_RE = /(locked|unlocked|inprogress|mastered) → (locked|unlocked|inprogress|mastered)/

export function parseLog(text) {
  if (!text) return []
  const out = []
  for (const line of text.split('\n')) {
    const m = line.match(LOG_RE)
    if (!m) continue
    const cross = m[5].match(CROSS_RE)
    out.push({
      date: m[1], time: m[2], id: m[3], name: m[4], detail: m[5],
      up: cross ? RANK[cross[2]] > RANK[cross[1]] : false,
      down: cross ? RANK[cross[2]] < RANK[cross[1]] : false,
    })
  }
  return out
}

export function weekStats(s = state) {
  const cutoff = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
  let ticks = 0, ups = 0, downs = 0
  for (const l of s.logLines) {
    if (l.date < cutoff) continue
    ticks++
    if (l.up) ups++
    if (l.down) downs++
  }
  return { ticks, ups, downs }
}

export function recentEvents(s = state, n = 6) {
  return s.logLines.slice(-n).reverse()
}

// ── writes: optimistic + debounced vault sync + adaptation mechanic ───────
// A regression only "counts" (and can later earn a ⚙) if it stood for at
// least this long — quick reversals are treated as mis-click corrections.
const ADAPT_GRACE_MS = 60 * 60 * 1000

let bursts = {}
export function burstOf(id) { return bursts[id] || 0 }

const flushTimers = {}
const batchBase = {}

function stamp() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

async function flush(skill) {
  delete flushTimers[skill.id]
  const base = batchBase[skill.id]
  delete batchBase[skill.id]
  const r = rec(skill.id)
  const newVal = skill.unit ? (r.cur ?? skill.cur ?? 0) : (r.lvl ?? skill.lvl ?? 0)
  const newStatus = statusOf(skill)
  let line = null
  if (!base || base.val !== newVal) {
    const unitStr = skill.unit || 'tier'
    const fromVal = base ? base.val : '?'
    const statusPart = base && base.status !== newStatus ? ` · ${base.status} → ${newStatus}` : ` · ${newStatus}`
    const adaptPart = base && (r.adapt || 0) > (base.adapt || 0) ? ` · ⚙ adapted ×${r.adapt}` : ''
    line = `- ${stamp()} · ${skill.id} · ${skill.name} · ${fromVal} → ${newVal} ${unitStr}${statusPart}${adaptPart}`
  }
  cache()
  if (!handle || state.syncStatus !== 'ready') return
  state = { ...state, pending: state.pending + 1 }
  emit()
  try {
    await vault.writeProgress(handle, skill.id, r, line)
    state = { ...state, pending: Math.max(0, state.pending - 1) }
    if (line) {
      // reflect the new log line locally so the momentum strip stays live
      state = { ...state, logLines: [...state.logLines, ...parseLog(line)] }
    }
  } catch (e) {
    state = { ...state, pending: Math.max(0, state.pending - 1), error: 'sync failed — change kept locally (' + (e?.message || e) + ')' }
  }
  emit()
}

export function setValue(skill, value) {
  const before = statusOf(skill)
  if (!(skill.id in batchBase)) batchBase[skill.id] = { val: valueOf(skill), status: before, adapt: rec(skill.id).adapt || 0 }
  const r = { ...rec(skill.id), asOf: new Date().toISOString().slice(0, 10) }
  if (skill.unit) r.cur = Math.max(0, value)
  else r.lvl = Math.max(0, Math.min(3, value))
  state = { ...state, progress: { ...state.progress, [skill.id]: r } }
  const after = statusOf(skill)

  // Mahoraga mechanic: the wheel remembers. Fall below a rank you once held,
  // then climb back — that skill earns a permanent adaptation mark (⚙).
  // Grace window: a fall must STAND for a while before the climb-back counts.
  // Undoing a mis-click (click → unclick → click) is a correction, not a
  // failure — no ⚙ for that.
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

  if (RANK[after] > RANK[before]) {
    bursts = { ...bursts, [skill.id]: Date.now() }
    setTimeout(() => { bursts = { ...bursts }; delete bursts[skill.id]; emit() }, 1400)
  }
  clearTimeout(flushTimers[skill.id])
  flushTimers[skill.id] = setTimeout(() => flush(skill), 900)
  emit()
}

// ── aggregate stats (weighted, R4) ─────────────────────────────────────────
export function realmStats(realmId, s = state) {
  const skills = s.skills.filter((k) => k.realm === realmId)
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

// Season (R4): if System/arbor/season.json names a skill subset, progress is
// measured against THAT — a reachable cycle target, not the villa.
export function seasonStats(s = state) {
  if (!s.season || !Array.isArray(s.season.ids) || !s.season.ids.length) return null
  const set = new Set(s.season.ids)
  const skills = s.skills.filter((k) => set.has(k.id))
  if (!skills.length) return null
  let pts = 0, max = 0
  for (const k of skills) {
    pts += POINTS[statusOf(k, s.progress)] * weightOf(k)
    max += POINTS.mastered * weightOf(k)
  }
  return { name: s.season.name || 'Season', ends: s.season.ends || null, pct: pts / max, total: skills.length }
}
