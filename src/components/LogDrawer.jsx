import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  useTree, useDerived, statusOf, valueOf, setValue, tickNext, todayLog, recentSkills, dailyQuest,
  skillById, STATUS_LABEL, STATUS_KEYS,
} from '../lib/store.js'
import { findSkills } from '../lib/search.js'
import { Px, SkillIcon } from './Pixel.jsx'

function QuickRow({ skill, onPick }) {
  const st = statusOf(skill)
  const val = valueOf(skill)
  return (
    <div className="log-row">
      <button className="log-row-main" type="button" onClick={() => onPick(skill)}>
        <SkillIcon id={skill.id} status={st} />
        <span className="search-name">{skill.name}</span>
        <span className="search-where">{skill.branch}</span>
        <span className={`status-tag sm ${st}`}>{STATUS_LABEL[st]}</span>
      </button>
      <div className="log-row-actions">
        {skill.unit ? (
          <>
            <button type="button" onClick={() => setValue(skill, val + 1)} title={`+1 ${skill.unit}`}>+1</button>
            <button type="button" onClick={() => tickNext(skill)} title="jump to next tier">next</button>
          </>
        ) : (
          <button type="button" onClick={() => tickNext(skill)} disabled={val >= 3}>tick</button>
        )}
      </div>
    </div>
  )
}

export default function LogDrawer({ open, onClose, onPick }) {
  if (!open) return null
  return <LogBody onClose={onClose} onPick={onPick} />
}

// Mounted only while open: the recent/quest/frontier lists are not recomputed
// on every progress change while the drawer is closed.
function LogBody({ onClose, onPick }) {
  const tree = useTree()
  const derived = useDerived()
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const session = useMemo(() => todayLog(tree), [tree.logLines])
  const recent = useMemo(() => recentSkills(tree), [tree.logLines])
  const next = useMemo(() => derived.frontier.slice(0, 8), [derived])
  const quest = useMemo(() => dailyQuest(tree), [tree.progress])
  const results = useMemo(() => findSkills(tree.skills, q, 10), [q, tree.skills])

  return (
    <div className="veil log-veil" onClick={onClose}>
      <div className="dialog log-drawer" role="dialog" aria-modal="true" aria-label="Log a PR" onClick={(e) => e.stopPropagation()}>
        <header className="log-head">
          <h2>Log a PR</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><Px name="close" /></button>
        </header>
        <input
          ref={inputRef}
          className="log-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a skill, then +1 or tick"
          spellCheck={false}
          aria-label="Search a skill to log"
        />

        {results.length > 0 && (
          <section className="log-section">
            <h3>Matches</h3>
            {results.map((k) => <QuickRow key={k.id} skill={k} onPick={onPick} />)}
          </section>
        )}

        {session.length > 0 && (
          <section className="log-section">
            <h3>This session</h3>
            <ul className="session-list">
              {session.map((l, i) => (
                <li key={`${l.id}-${l.time}-${i}`}>
                  <span className="session-time">{l.time}</span>
                  <button type="button" onClick={() => { const sk = skillById(l.id); if (sk) onPick(sk) }}>{l.name}</button>
                  <span className={`session-delta ${l.up ? 'up' : ''}`}>{l.from} to {l.to} {l.unit}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {quest.length > 0 && !q.trim() && (
          <section className="log-section">
            <h3>Today's focus</h3>
            {quest.map((k) => <QuickRow key={k.id} skill={k} onPick={onPick} />)}
          </section>
        )}

        {!q.trim() && recent.length > 0 && (
          <section className="log-section">
            <h3>Last session</h3>
            {recent.map((k) => <QuickRow key={k.id} skill={k} onPick={onPick} />)}
          </section>
        )}

        {!q.trim() && (
          <section className="log-section">
            <h3>Next unlocks</h3>
            {next.map((k) => <QuickRow key={k.id} skill={k} onPick={onPick} />)}
          </section>
        )}
      </div>
    </div>
  )
}
