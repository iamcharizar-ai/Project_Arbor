import { useSyncExternalStore } from 'react'
import * as vault from './vaultSync.js'

// ── vault-backed store ────────────────────────────────────────────────────
// Tree definition + progress live in the Obsidian vault (System/arbor/*).
// Sync is via the File System Access API (vaultSync.js) — the same
// server-less pattern LifeOS uses, so this works identically whether ARBOR
// runs on localhost or is deployed as a static site (Vercel etc.): the
// browser holds a directory handle and touches vault files directly on
// disk. Vault contents never leave the machine. localStorage is only an
// offline cache for read display when the handle isn't connected/granted.

const CACHE_KEY = 'arbor-tree-cache-v3'

let state = {
  loaded: false,
  error: null,
  syncStatus: vault.supported() ? 'disconnected' : 'unsupported', // disconnected | need-perm | ready | unsupported
  realms: [],
  skills: [],
  progress: {},
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

async function pullTree() {
  try {
    const d = await vault.readTree(handle)
    state = { ...state, loaded: true, syncStatus: 'ready', error: null, realms: d.realms, skills: d.skills, progress: d.progress }
    cache()
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

// ── status derivation ─────────────────────────────────────────────────────
export const STATUS_LABEL = { locked: 'Locked', unlocked: 'Unlocked', inprogress: 'In Progress', mastered: 'Mastered' }
const RANK = { locked: 0, unlocked: 1, inprogress: 2, mastered: 3 }
export const POINTS = { locked: 0, unlocked: 10, inprogress: 25, mastered: 60 }

export function rec(id) { return state.progress[id] || {} }

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

// ── writes: optimistic + debounced vault sync ─────────────────────────────
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
    line = `- ${stamp()} · ${skill.id} · ${skill.name} · ${fromVal} → ${newVal} ${unitStr}${statusPart}`
  }
  cache()
  if (!handle || state.syncStatus !== 'ready') return
  state = { ...state, pending: state.pending + 1 }
  emit()
  try {
    await vault.writeProgress(handle, skill.id, r, line)
    state = { ...state, pending: Math.max(0, state.pending - 1) }
  } catch (e) {
    state = { ...state, pending: Math.max(0, state.pending - 1), error: 'sync failed — change kept locally (' + (e?.message || e) + ')' }
  }
  emit()
}

export function setValue(skill, value) {
  const before = statusOf(skill)
  if (!(skill.id in batchBase)) batchBase[skill.id] = { val: valueOf(skill), status: before }
  const r = { ...rec(skill.id), asOf: new Date().toISOString().slice(0, 10) }
  if (skill.unit) r.cur = Math.max(0, value)
  else r.lvl = Math.max(0, Math.min(3, value))
  state = { ...state, progress: { ...state.progress, [skill.id]: r } }
  const after = statusOf(skill)
  if (RANK[after] > RANK[before]) {
    bursts = { ...bursts, [skill.id]: Date.now() }
    setTimeout(() => { bursts = { ...bursts }; delete bursts[skill.id]; emit() }, 1400)
  }
  clearTimeout(flushTimers[skill.id])
  flushTimers[skill.id] = setTimeout(() => flush(skill), 900)
  emit()
}

// ── aggregate stats ───────────────────────────────────────────────────────
export function realmStats(realmId, s = state) {
  const skills = s.skills.filter((k) => k.realm === realmId)
  const counts = { locked: 0, unlocked: 0, inprogress: 0, mastered: 0 }
  let pts = 0
  for (const k of skills) { const st = statusOf(k, s.progress); counts[st]++; pts += POINTS[st] }
  return { total: skills.length, counts, pts, max: skills.length * POINTS.mastered || 1 }
}

export function overallStats(s = state) {
  const counts = { locked: 0, unlocked: 0, inprogress: 0, mastered: 0 }
  let pts = 0
  for (const k of s.skills) { const st = statusOf(k, s.progress); counts[st]++; pts += POINTS[st] }
  return { total: s.skills.length, counts, pts, max: s.skills.length * POINTS.mastered || 1 }
}
