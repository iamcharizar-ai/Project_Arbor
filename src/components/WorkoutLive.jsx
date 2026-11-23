import React, { memo, useEffect, useMemo, useState } from 'react'
import { useTree, statusOf, skillById, STATUS_LABEL } from '../lib/store.js'
import { SLOT_LABEL, planFor, swapExercise } from '../lib/workout.js'
import {
  useSessions, updateActive, discardSession, finishSession, previousSets, makeExercise, doneCount, looseSets,
} from '../lib/sessions.js'
import { Px, SkillIcon } from './Pixel.jsx'

const cleanNum = (v) => v.replace(/\D/g, '').slice(0, 4)

/** Keeps the screen on while you train (same as Strong). */
function useWakeLock() {
  useEffect(() => {
    const wl = navigator.wakeLock
    if (!wl) return undefined
    let lock = null
    const get = () => { if (document.visibilityState === 'visible') wl.request('screen').then((l) => { lock = l }, () => {}) }
    get()
    document.addEventListener('visibilitychange', get)
    return () => { document.removeEventListener('visibilitychange', get); lock?.release?.() }
  }, [])
}

export function Clock({ since }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const s = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n) => String(n).padStart(2, '0')
  return <span className="lv-clock">{h ? `${h}:${p(m)}` : m}:{p(sec)}</span>
}

/** A small in-dialog yes/no, in place of the browser's confirm(). */
export function ConfirmBar({ ask, onClose }) {
  if (!ask) return null
  return (
    <div className="lv-confirm" role="alertdialog" aria-label={ask.text}>
      <div className="lv-confirm-box">
        <p>{ask.text}</p>
        <div>
          <button type="button" className="lv-btn" onClick={onClose}>Cancel</button>
          <button type="button" className={`lv-btn ${ask.danger ? 'danger' : 'go'}`} autoFocus onClick={() => { onClose(); ask.run() }}>{ask.yes}</button>
        </div>
      </div>
    </div>
  )
}

const patchEx = (uid, fn) => updateActive((a) => ({ ...a, exercises: a.exercises.map((e) => (e.uid === uid ? fn(e) : e)) }))
const setSet = (uid, i, patch) => patchEx(uid, (e) => ({ ...e, sets: e.sets.map((s, k) => (k === i ? { ...s, ...patch } : s)) }))

const ExerciseCard = memo(function ExerciseCard({ ex, prev, status, onPick, onSwap, onRemove }) {
  const skill = skillById(ex.skillId)
  const [menu, setMenu] = useState(false)
  const [noteOpen, setNoteOpen] = useState(Boolean(ex.note))
  const [stuck, setStuck] = useState(false)
  const plan = useMemo(() => planFor(ex.rx, ex.role, ex.sets.length, prev), [ex.rx, ex.role, ex.sets.length, prev])
  const unit = ex.rx.unit === 'sec' ? 'sec' : 'reps'
  const head = unit === 'sec' ? 'SEC' : 'REPS'
  const fmtPrev = (n) => (unit === 'sec' ? `${n}s` : String(n))

  useEffect(() => {
    if (!stuck) return undefined
    const t = setTimeout(() => setStuck(false), 1800)
    return () => clearTimeout(t)
  }, [stuck])

  const focus = (i) => document.getElementById(`in-${ex.uid}-${i}`)?.focus()

  // Ghost (placeholder) for a set: the nearest number typed in an earlier set of this exercise
  // (people usually repeat it), else the plan target from last session. Same rule as Strong.
  const ghost = (i) => {
    let v = plan.targets[Math.min(i, plan.targets.length - 1)]
    for (let j = i - 1; j >= 0; j--) if (ex.sets[j].v !== '') { v = ex.sets[j].v; break }
    return v
  }

  const tick = (i) => {
    const set = ex.sets[i]
    if (set.done) return setSet(ex.uid, i, { done: false })
    const g = ghost(i)
    const v = set.v !== '' ? set.v : /^\d+$/.test(g) ? g : ''
    if (v === '' || v === '0') return focus(i)
    setSet(ex.uid, i, { v, done: true })
  }

  const act = (fn) => { fn(); setMenu(false) }
  const hint = stuck ? 'No other exercise fits this slot' : plan.hint

  return (
    <section className="lv-card" id={`ex-${ex.uid}`}>
      <div className="lv-head">
        <button type="button" className="lv-name" onClick={() => onPick(skill)} title="Open this skill">
          <SkillIcon id={skill.id} status={status} />
          <span>
            {skill.name}
            <small>
              {SLOT_LABEL[ex.slot]} · <span className={`status-tag sm ${status}`}>{STATUS_LABEL[status]}</span> · rest {ex.rx.rest}s
            </small>
          </span>
        </button>
        <button type="button" className={`icon-btn ${menu ? 'on' : ''}`} onClick={() => setMenu((m) => !m)} aria-label="Exercise options" aria-expanded={menu}>
          <span className="lv-dots" aria-hidden="true">...</span>
        </button>
      </div>

      {menu && (
        <div className="lv-menu">
          <button type="button" onClick={() => act(() => { if (!onSwap(ex.uid)) setStuck(true) })}><Px name="dice" u={2} /> Swap</button>
          <button type="button" onClick={() => act(() => setNoteOpen(true))}><Px name="pencil" u={2} /> Note</button>
          <button type="button" className="danger" onClick={() => act(() => onRemove(ex))}><Px name="close" u={2} /> Remove</button>
        </div>
      )}

      {noteOpen && (
        <textarea
          className="lv-note"
          rows={Math.min(4, Math.max(1, Math.ceil(ex.note.length / 34)))}
          placeholder="Note for this exercise"
          value={ex.note}
          onChange={(e) => patchEx(ex.uid, (x) => ({ ...x, note: e.target.value }))}
          onBlur={() => { if (!ex.note.trim()) setNoteOpen(false) }}
        />
      )}

      {hint && <p className={`lv-hint ${plan.up && !stuck ? 'up' : ''} ${stuck ? 'stuck' : ''}`}>{hint}</p>}

      <div className="lv-sets" role="table" aria-label={`${skill.name} sets`}>
        <div className="lv-row head" role="row">
          <span>SET</span><span>PREVIOUS</span><span>{head}</span><span aria-label="Done"><Px name="check" u={2} /></span>
        </div>
        {ex.sets.map((set, i) => (
          <div key={i} className={`lv-row ${set.done ? 'done' : ''}`} role="row">
            <span className="lv-n">{i + 1}</span>
            <span className="lv-prev">{prev?.[i] != null ? fmtPrev(prev[i]) : '-'}</span>
            <input
              id={`in-${ex.uid}-${i}`}
              inputMode="numeric"
              value={set.v}
              placeholder={ghost(i) || 'max'}
              aria-label={`Set ${i + 1} ${head}`}
              onChange={(e) => setSet(ex.uid, i, { v: cleanNum(e.target.value) })}
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => { if (e.key === 'Enter') tick(i) }}
            />
            <button type="button" className="lv-tick" onClick={() => tick(i)} aria-pressed={set.done} aria-label={`Set ${i + 1} done`}>
              {set.done && <Px name="check" u={3} />}
            </button>
          </div>
        ))}
      </div>

      <div className="lv-actions">
        <button type="button" className="lv-btn" onClick={() => patchEx(ex.uid, (e) => ({ ...e, sets: [...e.sets, { v: '', done: false }] }))}>+ Set</button>
        {ex.sets.length > 1 && (
          <button type="button" className="lv-btn" onClick={() => patchEx(ex.uid, (e) => ({ ...e, sets: e.sets.slice(0, -1) }))}>- Set</button>
        )}
      </div>
    </section>
  )
})

export default function WorkoutLive({ active, onClose, onPick, onFinished }) {
  const tree = useTree()
  const { workouts } = useSessions()
  const [ask, setAsk] = useState(null)
  useWakeLock()

  const done = doneCount(active)

  const finish = () => {
    if (!done) {
      setAsk({ text: 'No sets are ticked, so there is nothing to save. Discard this workout?', yes: 'Discard', danger: true, run: discardSession })
      return
    }
    const go = () => { const w = finishSession(); if (w) onFinished(w.id) }
    const loose = looseSets(active)
    if (loose) {
      setAsk({
        text: `${loose} set${loose > 1 ? 's have' : ' has'} numbers but ${loose > 1 ? "aren't" : "isn't"} ticked. Those will be dropped. Finish anyway?`,
        yes: 'Finish', run: go,
      })
      return
    }
    go()
  }

  const swap = (uid) => {
    const index = active.exercises.findIndex((e) => e.uid === uid)
    const items = active.exercises.map((e) => ({ id: e.skillId, slot: e.slot, role: e.role }))
    const next = swapExercise({ skills: tree.skills, progress: tree.progress, where: active.where, items, index })
    if (!next) return false
    updateActive((a) => ({ ...a, exercises: a.exercises.map((e, k) => (k === index ? makeExercise(next[index], tree.progress, e.uid) : e)) }))
    return true
  }

  const remove = (ex) => {
    const go = () => updateActive((a) => ({ ...a, exercises: a.exercises.filter((e) => e.uid !== ex.uid) }))
    if (ex.sets.some((s) => s.done)) setAsk({ text: `Remove ${skillById(ex.skillId).name} and its ticked sets?`, yes: 'Remove', danger: true, run: go })
    else go()
  }

  return (
    <>
      <header className="lv-top">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back to the tree (the workout keeps running)">
          <Px name="arrow" u={2} className="flip" />
        </button>
        <input
          className="lv-title"
          value={active.name}
          onChange={(e) => updateActive((a) => ({ ...a, name: e.target.value }))}
          aria-label="Workout name"
        />
        <Clock since={active.startedAt} />
        <button type="button" className="lv-finish" onClick={finish}>Finish</button>
      </header>

      <div className="lv-scroll">
        <div className="lv-meta">
          <span><b>{done}</b> sets done</span>
          <span>{active.exercises.length} exercises</span>
        </div>

        <textarea
          className="lv-note"
          rows={1}
          placeholder="Workout note"
          value={active.note}
          onChange={(e) => updateActive((a) => ({ ...a, note: e.target.value }))}
        />

        {active.exercises.map((ex) => (
          <ExerciseCard
            key={ex.uid}
            ex={ex}
            prev={previousSets(ex.skillId, workouts)}
            status={statusOf(skillById(ex.skillId), tree.progress)}
            onPick={onPick}
            onSwap={swap}
            onRemove={remove}
          />
        ))}

        {!active.exercises.length && <p className="search-empty">No exercises left. Discard this workout to roll a new one.</p>}

        <button
          type="button"
          className="lv-btn danger wide"
          onClick={() => setAsk({ text: 'Discard this workout? Nothing from it will be saved.', yes: 'Discard', danger: true, run: discardSession })}
        >
          Discard workout
        </button>
      </div>

      <ConfirmBar ask={ask} onClose={() => setAsk(null)} />
    </>
  )
}
