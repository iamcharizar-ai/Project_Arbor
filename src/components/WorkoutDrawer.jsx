import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTree, statusOf, skillById, STATUS_LABEL } from '../lib/store.js'
import {
  FOCUS, WARMUP, SLOT_LABEL, generateWorkout, swapExercise, prescribe, summarize,
} from '../lib/workout.js'
import { useSessions, startSession, totalsOf } from '../lib/sessions.js'
import { Px, SkillIcon } from './Pixel.jsx'
import WorkoutLive from './WorkoutLive.jsx'
import WorkoutSummary, { dateLabel, fmtDuration } from './WorkoutSummary.jsx'

const KEY = 'arbor-workout-v1'
const WHERE = {
  home: { label: 'Home', note: 'Floor, doorway bar, parallettes. No rings, dip bars or low bar.' },
  gym: { label: 'Gym', note: 'Everything, including rings, dip bars and a bar with clearance.' },
}
const ROLE_NOTE = {
  keep: 'Mastered: easy sets to keep it sharp',
  reach: 'Next unlock: give it a go, no fixed target',
}

function load() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY))
    if (j && FOCUS[j.focus] && WHERE[j.where] && Array.isArray(j.items)) {
      const items = j.items.filter((it) => it && skillById(it.id) && FOCUS.full.slots.includes(it.slot) && ['build', 'keep', 'reach'].includes(it.role))
      if (items.length) return { where: j.where, focus: j.focus, items }
    }
  } catch { /* private mode / corrupt */ }
  return null
}

function save(w) {
  try { localStorage.setItem(KEY, JSON.stringify(w)) } catch { /* quota */ }
}
const forget = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }

export default function WorkoutDrawer({ open, onClose, onPick }) {
  if (!open) return null
  return <WorkoutBody onClose={onClose} onPick={onPick} />
}

// Mounted only while open. Three views, like Strong: the plan you are about to
// run, the live workout (resumes if one is running), and the finished summary.
function WorkoutBody({ onClose, onPick }) {
  const { active } = useSessions()
  const [summary, setSummary] = useState(null) // { id, celebrate }

  let view
  if (summary) view = <WorkoutSummary id={summary.id} celebrate={summary.celebrate} onBack={() => setSummary(null)} onPick={onPick} />
  else if (active) view = <WorkoutLive active={active} onClose={onClose} onPick={onPick} onFinished={(id) => setSummary({ id, celebrate: true })} />
  else view = <WorkoutPlan onClose={onClose} onPick={onPick} onOpenWorkout={(id) => setSummary({ id, celebrate: false })} />

  return (
    <div className="veil workout-veil" onClick={onClose}>
      <div className="dialog workout" role="dialog" aria-modal="true" aria-label="Workout" onClick={(e) => e.stopPropagation()}>
        {view}
      </div>
    </div>
  )
}

// The roll: pick focus + where, swap anything you don't fancy, then start.
function WorkoutPlan({ onClose, onPick, onOpenWorkout }) {
  const tree = useTree()
  const { workouts } = useSessions()
  const [w, setW] = useState(() => load() || {
    where: 'home', focus: 'full',
    items: generateWorkout({ skills: tree.skills, progress: tree.progress, where: 'home', focus: 'full' }),
  })
  const [stuck, setStuck] = useState(null) // index of a row that had nothing to swap to
  const startRef = useRef(null)
  useEffect(() => { save(w) }, [w])
  useEffect(() => { startRef.current?.focus() }, [])
  useEffect(() => {
    if (stuck == null) return undefined
    const t = setTimeout(() => setStuck(null), 1800)
    return () => clearTimeout(t)
  }, [stuck])

  const roll = (next = {}, avoid = []) => {
    const where = next.where || w.where
    const focus = next.focus || w.focus
    setW({ where, focus, items: generateWorkout({ skills: tree.skills, progress: tree.progress, where, focus, avoid }) })
    setStuck(null)
  }

  const swap = (i) => {
    const items = swapExercise({ skills: tree.skills, progress: tree.progress, where: w.where, items: w.items, index: i })
    if (!items) { setStuck(i); return }
    setW({ ...w, items })
  }

  const start = () => {
    if (!w.items.length) return
    forget() // the next roll is a fresh one
    startSession({ items: w.items, focus: w.focus, where: w.where, name: FOCUS[w.focus].label }, tree.progress)
  }

  const sum = useMemo(() => summarize(w.items, { get: skillById }, tree.progress), [w.items, tree.progress])
  const recent = workouts.slice(0, 5)

  return (
    <>
      <header className="wk-head">
        <div className="wk-title">
          <h2>Workout</h2>
          <p className="wk-sum">{sum.exercises} exercises · {sum.sets} sets · about {sum.minutes} min</p>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Px name="close" /></button>
      </header>

      <div className="wk-opts">
        <div className="wk-group" role="group" aria-label="Focus">
          {Object.entries(FOCUS).map(([id, f]) => (
            <button key={id} type="button" className={`chip ${w.focus === id ? 'on' : ''}`} aria-pressed={w.focus === id} onClick={() => w.focus !== id && roll({ focus: id })}>{f.label}</button>
          ))}
        </div>
        <div className="wk-group" role="group" aria-label="Where you are training">
          {Object.entries(WHERE).map(([id, x]) => (
            <button key={id} type="button" className={`chip alt ${w.where === id ? 'on' : ''}`} aria-pressed={w.where === id} onClick={() => w.where !== id && roll({ where: id })}>{x.label}</button>
          ))}
        </div>
        <p className="wk-note">{WHERE[w.where].note}</p>
      </div>

      <div className="wk-body">
        {w.items.length === 0 ? (
          <p className="search-empty">Nothing trainable here yet. Log a few skills first.</p>
        ) : (
          <>
            <p className="wk-warm"><b>Warm up</b> {WARMUP[w.focus]}</p>
            <ol className="wk-list">
              {w.items.map((it, i) => {
                const skill = skillById(it.id)
                if (!skill) return null
                const st = statusOf(skill, tree.progress)
                const p = prescribe(skill, it.role, tree.progress)
                return (
                  <li key={`${it.id}-${i}`} className="wk-item">
                    <div className="wk-main">
                      <div className="wk-meta">
                        <span className="wk-slot">{SLOT_LABEL[it.slot]}</span>
                        <span className={`status-tag sm ${st}`}>{STATUS_LABEL[st]}</span>
                      </div>
                      <button type="button" className="wk-name" onClick={() => onPick(skill)} title="Open this skill">
                        <SkillIcon id={skill.id} status={st} />
                        <span>{skill.name}</span>
                      </button>
                      <p className="wk-rx">
                        {p.mode === 'max' ? (
                          <><b>{p.sets} x max {p.unit === 'sec' ? 'hold' : 'reps'}</b><span>aim for {p.amount}{p.unit === 'sec' ? ' sec' : ''}</span></>
                        ) : (
                          <><b>{p.sets} x {p.amount}{p.unit === 'sec' ? ' sec' : ' reps'}</b></>
                        )}
                        <span>rest {p.rest}s</span>
                      </p>
                      <p className={`wk-hint ${stuck === i ? 'stuck' : ''}`}>
                        {stuck === i ? 'No other option for this slot' : [ROLE_NOTE[it.role], p.hint].filter(Boolean).join('. ')}
                      </p>
                    </div>
                    <button type="button" className="wk-swap" onClick={() => swap(i)} title="Swap for another exercise" aria-label={`Swap ${skill.name}`}>
                      <Px name="dice" u={2} />
                      <span>Swap</span>
                    </button>
                  </li>
                )
              })}
            </ol>
            <p className="wk-warm wk-cool"><b>Cool down</b> Shoulder and hip stretches, 2 minutes.</p>
          </>
        )}

        {recent.length > 0 && (
          <section className="wk-recent">
            <h3>Recent workouts</h3>
            <ul>
              {recent.map((r) => {
                const t = totalsOf(r)
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => onOpenWorkout(r.id)}>
                      <span className="wk-recent-name">{r.name}<small>{dateLabel(r.finishedAt)}</small></span>
                      <span className="wk-recent-meta">{t.sets} sets · {fmtDuration(new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime())}{r.records?.length ? ` · ${r.records.length} best${r.records.length > 1 ? 's' : ''}` : ''}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
      </div>

      <footer className="wk-foot two">
        <button type="button" className="lv-btn big" onClick={() => roll({}, w.items.map((it) => it.id))}>
          <Px name="dice" u={2} /> Roll again
        </button>
        <button ref={startRef} type="button" className="primary" onClick={start} disabled={!w.items.length}>
          Start workout
        </button>
      </footer>
    </>
  )
}
