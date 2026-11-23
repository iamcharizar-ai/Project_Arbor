// The live workout and the workout history. Modelled on Strong's: every tap is
// saved on the device so a running workout survives closing the tab, and
// finished workouts become the PREVIOUS column for the next one.
//
// Deliberately LOCAL ONLY. Strong publishes a `workout` event to the shared
// ledger, and Life OS ticks its Gym habit from that, so a calisthenics session
// must not emit one. What does sync is the skill tree itself: finishing saves
// any new best through store.setValue, exactly like Log PR.
import { useSyncExternalStore } from 'react'
import { skillById, statusOf, valueOf, setValue, markPracticed, STATUS_LABEL } from './store.js'
import { prescribe } from './workout.js'

const ACTIVE_KEY = 'arbor-session-v1'
const HISTORY_KEY = 'arbor-workouts-v1'
const HISTORY_CAP = 200

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch { /* quota / private mode */ }
}

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)

const validActive = (a) => a && typeof a === 'object' && Array.isArray(a.exercises) && typeof a.startedAt === 'string'
const cleanActive = (a) => {
  if (!validActive(a)) return null
  const exercises = a.exercises.filter((e) => e && skillById(e.skillId) && Array.isArray(e.sets) && e.rx)
  return { ...a, exercises }
}

let state = {
  active: cleanActive(read(ACTIVE_KEY, null)),
  workouts: (Array.isArray(read(HISTORY_KEY, [])) ? read(HISTORY_KEY, []) : []).filter((w) => w && w.id && Array.isArray(w.exercises)),
}
const listeners = new Set()
const on = (l) => { listeners.add(l); return () => listeners.delete(l) }
const set = (patch) => {
  state = { ...state, ...patch }
  if ('active' in patch) write(ACTIVE_KEY, state.active)
  if ('workouts' in patch) write(HISTORY_KEY, state.workouts)
  listeners.forEach((l) => l())
}

export const getSessions = () => state
export const useSessions = () => useSyncExternalStore(on, getSessions)

// ── building a live exercise ────────────────────────────────────────────────
/** A plan item { id, slot, role } -> a live exercise with its prescription frozen. */
export function makeExercise(item, progress, uidOverride) {
  const skill = skillById(item.id)
  const p = prescribe(skill, item.role, progress)
  return {
    uid: uidOverride || uid(),
    skillId: item.id,
    slot: item.slot,
    role: item.role,
    note: '',
    rx: { mode: p.mode, unit: p.unit, amount: p.amount, rest: p.rest, best: p.best, hint: p.hint },
    sets: Array.from({ length: p.sets }, () => ({ v: '', done: false })),
  }
}

export function startSession({ items, focus, where, name }, progress) {
  set({
    active: {
      id: uid(),
      name: name || 'Workout',
      focus,
      where,
      startedAt: new Date().toISOString(),
      note: '',
      exercises: items.map((it) => makeExercise(it, progress)),
    },
  })
}

export function updateActive(fn) {
  if (state.active) set({ active: fn(state.active) })
}
export const discardSession = () => set({ active: null })

// ── history helpers ─────────────────────────────────────────────────────────
/** The sets (numbers) from the most recent finished workout that included this skill. */
export function previousSets(skillId, workouts = state.workouts) {
  for (const w of workouts) {
    const e = w.exercises.find((x) => x.skillId === skillId)
    if (e && e.sets.length) return e.sets
  }
  return null
}

export function deleteWorkout(id) {
  set({ workouts: state.workouts.filter((w) => w.id !== id) })
}

/** Totals for a finished workout. Reps and held seconds are different things, so they stay apart. */
export function totalsOf(w) {
  let sets = 0, reps = 0, seconds = 0
  for (const e of w.exercises) {
    sets += e.sets.length
    const sum = e.sets.reduce((n, v) => n + v, 0)
    if (e.unit === 'sec') seconds += sum
    else reps += sum
  }
  return { sets, reps, seconds }
}

// ── finishing ───────────────────────────────────────────────────────────────
/** Sets the user ticked off. */
export const doneSetsOf = (e) => e.sets.filter((s) => s.done && s.v !== '').map((s) => Number(s.v))

/** Typed-in numbers that were never ticked (these are dropped on finish). */
export const looseSets = (a) => a.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done && s.v !== '').length, 0)
export const doneCount = (a) => a.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

/**
 * Save the running workout. For each exercise, the best ticked set beats your current best ->
 * saved to the skill tree as a new best (same path as Log PR, so it syncs and tiers up);
 * otherwise the skill is just marked practised. Returns the saved workout, or null if nothing was ticked.
 */
export function finishSession() {
  const a = state.active
  if (!a) return null
  const exercises = []
  const records = []
  for (const e of a.exercises) {
    const sets = doneSetsOf(e)
    const skill = skillById(e.skillId)
    if (!sets.length || !skill) continue
    exercises.push({ skillId: e.skillId, slot: e.slot, role: e.role, unit: e.rx.unit, note: (e.note || '').trim(), sets })
    const best = Math.max(...sets)
    const before = valueOf(skill)
    if (best > before) {
      const from = statusOf(skill)
      setValue(skill, best)
      const to = statusOf(skill)
      records.push({ skillId: e.skillId, unit: e.rx.unit, from: before, to: best, tier: from !== to ? STATUS_LABEL[to] : null })
    } else {
      markPracticed(skill)
    }
  }
  if (!exercises.length) return null
  const w = {
    id: a.id,
    name: (a.name || '').trim() || 'Workout',
    focus: a.focus,
    where: a.where,
    startedAt: a.startedAt,
    finishedAt: new Date().toISOString(),
    note: (a.note || '').trim(),
    exercises,
    records,
  }
  set({ workouts: [w, ...state.workouts].slice(0, HISTORY_CAP), active: null })
  return w
}
