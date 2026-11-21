import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTree, statusOf, skillById, STATUS_LABEL } from '../lib/store.js'
import {
  FOCUS, WARMUP, SLOT_LABEL, generateWorkout, swapExercise, prescribe, summarize,
} from '../lib/workout.js'
import { Px, SkillIcon } from './Pixel.jsx'

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

export default function WorkoutDrawer({ open, onClose, onPick }) {
  if (!open) return null
  return <WorkoutBody onClose={onClose} onPick={onPick} />
}

// Mounted only while open. The workout itself is persisted, so closing the
// dialog to look at a skill (or reloading the page) brings the same one back.
function WorkoutBody({ onClose, onPick }) {
  const tree = useTree()
  const [w, setW] = useState(() => load() || {
    where: 'home', focus: 'full',
    items: generateWorkout({ skills: tree.skills, progress: tree.progress, where: 'home', focus: 'full' }),
  })
  const [done, setDone] = useState(() => new Set())
  const [stuck, setStuck] = useState(null) // index of a row that had nothing to swap to
  const rollRef = useRef(null)
  useEffect(() => { save(w) }, [w])
  useEffect(() => { rollRef.current?.focus() }, [])
  useEffect(() => {
    if (stuck == null) return undefined
    const t = setTimeout(() => setStuck(null), 1800)
    return () => clearTimeout(t)
  }, [stuck])

  const roll = (next = {}, avoid = []) => {
    const where = next.where || w.where
    const focus = next.focus || w.focus
    setW({ where, focus, items: generateWorkout({ skills: tree.skills, progress: tree.progress, where, focus, avoid }) })
    setDone(new Set())
    setStuck(null)
  }

  const swap = (i) => {
    const items = swapExercise({ skills: tree.skills, progress: tree.progress, where: w.where, items: w.items, index: i })
    if (!items) { setStuck(i); return }
    setW({ ...w, items })
    setDone((d) => { const n = new Set(d); n.delete(i); return n })
  }

  const toggle = (i) => setDone((d) => { const n = new Set(d); if (n.has(i)) n.delete(i); else n.add(i); return n })

  const sum = useMemo(() => summarize(w.items, { get: skillById }, tree.progress), [w.items, tree.progress])

  return (
    <div className="veil workout-veil" onClick={onClose}>
      <div className="dialog workout" role="dialog" aria-modal="true" aria-label="Random workout" onClick={(e) => e.stopPropagation()}>
        <header className="wk-head">
          <div className="wk-title">
            <h2>Workout</h2>
            <p className="wk-sum">
              {sum.exercises} exercises · {sum.sets} sets · about {sum.minutes} min
              {done.size > 0 && <span className="wk-doneCount"> · {done.size}/{w.items.length} done</span>}
            </p>
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
                  const isDone = done.has(i)
                  return (
                    <li key={`${it.id}-${i}`} className={`wk-item ${isDone ? 'done' : ''}`}>
                      <button
                        type="button"
                        className="wk-check"
                        role="checkbox"
                        aria-checked={isDone}
                        aria-label={`${skill.name}: mark ${isDone ? 'not done' : 'done'}`}
                        onClick={() => toggle(i)}
                      >
                        {isDone && <Px name="check" u={3} />}
                      </button>
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
              <p className="wk-warm wk-cool"><b>Cool down</b> Shoulder and hip stretches, 2 minutes. Log your numbers with Log PR afterwards.</p>
            </>
          )}
        </div>

        <footer className="wk-foot">
          <button ref={rollRef} type="button" className="primary" onClick={() => roll({}, w.items.map((it) => it.id))}>
            <Px name="dice" u={2} /> Roll again
          </button>
        </footer>
      </div>
    </div>
  )
}
