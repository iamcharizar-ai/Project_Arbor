import React, { useState } from 'react'
import { skillById } from '../lib/store.js'
import { SLOT_LABEL, fmtAmount } from '../lib/workout.js'
import { useSessions, deleteWorkout, totalsOf } from '../lib/sessions.js'
import { Px, SkillIcon } from './Pixel.jsx'
import { ConfirmBar } from './WorkoutLive.jsx'

export const dateLabel = (iso) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export function fmtDuration(ms) {
  const m = Math.max(0, Math.round(ms / 60000))
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}

/** The finished workout: totals, records, every set. Used right after finishing and from history. */
export default function WorkoutSummary({ id, celebrate, onBack, onPick }) {
  const { workouts } = useSessions()
  const [ask, setAsk] = useState(null)
  const w = workouts.find((x) => x.id === id)

  if (!w) {
    return (
      <>
        <header className="lv-top">
          <button type="button" className="icon-btn" onClick={onBack} aria-label="Back"><Px name="arrow" u={2} className="flip" /></button>
          <h2 className="lv-h">Workout</h2>
        </header>
        <div className="lv-scroll"><p className="search-empty">This workout no longer exists.</p></div>
      </>
    )
  }

  const t = totalsOf(w)
  const records = w.records || []

  return (
    <>
      <header className="lv-top">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back"><Px name="arrow" u={2} className="flip" /></button>
        <h2 className="lv-h">{celebrate ? 'Done' : 'Workout'}</h2>
      </header>

      <div className="lv-scroll">
        {celebrate && (
          <div className="lv-celebrate">
            <span className="lv-badge" aria-hidden="true"><Px name="star" u={5} /></span>
            <h3>Workout complete</h3>
            {records.length > 0 && <p className="gold">{records.length} new best{records.length > 1 ? 's' : ''}</p>}
          </div>
        )}

        <section className="lv-card">
          <h3 className="lv-session-title">{w.name}</h3>
          <small className="lv-muted">{dateLabel(w.finishedAt)}</small>
          <div className="lv-stats">
            <div><small>Duration</small><b>{fmtDuration(new Date(w.finishedAt).getTime() - new Date(w.startedAt).getTime())}</b></div>
            <div><small>Sets</small><b>{t.sets}</b></div>
            {t.reps > 0 && <div><small>Reps</small><b>{t.reps.toLocaleString('en-IN')}</b></div>}
            {t.seconds > 0 && <div><small>Hold</small><b>{t.seconds >= 120 ? `${Math.round(t.seconds / 60)}m` : `${t.seconds}s`}</b></div>}
          </div>
          {w.note && <p className="lv-session-note">{w.note}</p>}
        </section>

        {records.length > 0 && (
          <section className="lv-card">
            <h3 className="lv-sec">New bests</h3>
            <ul className="lv-prs">
              {records.map((r) => {
                const sk = skillById(r.skillId)
                return (
                  <li key={r.skillId}>
                    <Px name="bolt" u={2} className="gold" />
                    <span className="lv-pr-text">
                      <button type="button" onClick={() => sk && onPick(sk)}>{sk?.name || r.skillId}</button>
                      <small>{r.from > 0 ? `${r.from} to ${r.to} ${r.unit}` : `first ${fmtAmount(r.unit, r.to)}`}{r.tier ? ` · now ${r.tier}` : ''}</small>
                    </span>
                    <b>{fmtAmount(r.unit, r.to)}</b>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {w.exercises.map((e, i) => {
          const sk = skillById(e.skillId)
          return (
            <section key={i} className="lv-card">
              <button type="button" className="lv-name sm" onClick={() => sk && onPick(sk)}>
                {sk && <SkillIcon id={sk.id} status="unlocked" />}
                <span>{sk?.name || e.skillId}<small>{SLOT_LABEL[e.slot] || ''}</small></span>
              </button>
              <ol className="lv-done-sets">
                {e.sets.map((v, k) => <li key={k}><span>{k + 1}</span>{e.unit === 'sec' ? `${v}s` : `${v} reps`}</li>)}
              </ol>
              {e.note && <p className="lv-muted">{e.note}</p>}
            </section>
          )
        })}

        <div className="lv-stack">
          {celebrate && <button type="button" className="primary" onClick={onBack}>Done</button>}
          <button
            type="button"
            className="lv-btn danger wide"
            onClick={() => setAsk({ text: 'Delete this workout from your history? Your skill bests stay as they are.', yes: 'Delete', danger: true, run: () => { deleteWorkout(w.id); onBack() } })}
          >
            Delete workout
          </button>
        </div>
      </div>

      <ConfirmBar ask={ask} onClose={() => setAsk(null)} />
    </>
  )
}
