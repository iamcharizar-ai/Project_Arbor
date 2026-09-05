import React, { useMemo, useRef, useState } from 'react'
import { useTree, statusOf, valueOf, setValue, tickNext, todayLog, recentSkills, frontierSkills, dailyQuest, STATUS_LABEL } from '../lib/store.js'

function score(query, text) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0, s = 0, streak = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++
      streak++
      s += 1 + streak * 0.5 + (ti === 0 || t[ti - 1] === ' ' ? 2 : 0)
    } else streak = 0
  }
  return qi === q.length ? s : -1
}

function QuickRow({ skill, onPick }) {
  const st = statusOf(skill)
  const val = valueOf(skill)
  return (
    <div className="log-row">
      <button className="log-row-main" type="button" onClick={() => onPick(skill)}>
        <span className="search-icon">{skill.icon || '◆'}</span>
        <span className="search-name">{skill.name}</span>
        <span className="search-where">{skill.branch}</span>
        <span className={`search-status ${st}`}>{STATUS_LABEL[st]}</span>
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
  const tree = useTree()
  const [q, setQ] = useState('')
  const inputRef = useRef(null)
  const session = todayLog(tree)
  const recent = recentSkills(tree)
  const next = useMemo(() => frontierSkills(tree).slice(0, 8), [tree.skills, tree.progress])
  const quest = dailyQuest(tree)

  const results = useMemo(() => {
    if (!q.trim()) return []
    return tree.skills
      .map((k) => ({ k, s: score(q, `${k.name} ${k.branch}`) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map((x) => x.k)
  }, [q, tree.skills])

  if (!open) return null

  return (
    <div className="log-veil" onClick={onClose}>
      <div className="log-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="log-head">
          <h2>Log a PR</h2>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <input
          ref={inputRef}
          className="log-search"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a skill — then +1 or tick"
          spellCheck={false}
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
                  <button type="button" onClick={() => {
                    const sk = tree.skills.find((s) => s.id === l.id)
                    if (sk) onPick(sk)
                  }}>{l.name}</button>
                  <span className={`session-delta ${l.up ? 'up' : ''}`}>
                    {l.from} → {l.to} {l.unit}
                  </span>
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
