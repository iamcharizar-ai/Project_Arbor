import React from 'react'
import { useTree, realmStats, overallStats, statusOf, frontierSkills, dailyQuest, weekStats, recentEvents, seasonStats, STATUS_DESC } from '../lib/store.js'
import { ScrambleText, CountUp } from './fx.jsx'
import Wheel from './Wheel.jsx'

function Ring({ pct, hue, size = 54 }) {
  const deg = pct * 360
  return (
    <div className="ring" style={{
      width: size, height: size,
      background: `conic-gradient(hsl(${hue} 55% 62%) ${deg}deg, rgba(255,255,255,0.07) ${deg}deg)`,
    }}>
      <span>{Math.round(pct * 100)}<em>%</em></span>
    </div>
  )
}

export default function Atlas({ onOpen, onFocus }) {
  const tree = useTree()
  const all = overallStats(tree)
  const vitality = all.pts / all.max
  const week = weekStats(tree)
  const quest = dailyQuest(tree)
  const events = recentEvents(tree)
  const season = seasonStats(tree)
  const frontier = frontierSkills(tree)
  const turns = all.pts / 10 // one visible wheel-turn per awakening's worth of points

  return (
    <main className="atlas">
      <section className="atlas-hero">
        <Wheel turns={turns} size={124} className="hero-wheel" />
        <h1>
          <ScrambleText text="The wheel has turned" />{' '}
          <em><CountUp value={all.pts} decimals={0} /></em>{' '}
          <ScrambleText text="times" />
        </h1>
        <p className="atlas-sub">
          {all.counts.mastered} adapted · {all.counts.inprogress} adapting · {all.counts.unlocked} awakened · {all.counts.locked} sealed — {all.total} skills across {tree.realms.length} realms
          <span className="atlas-lifetime" title="lifetime completion — every skill fully adapted"> · lifetime {(vitality * 100).toFixed(1)}%</span>
        </p>
        {week.ticks > 0 && (
          <p className="atlas-week">
            this week: {week.ticks} {week.ticks === 1 ? 'tick' : 'ticks'}
            {week.ups > 0 && <span className="wk-up"> · {week.ups} adaptation{week.ups > 1 ? 's' : ''} ▲</span>}
            {week.downs > 0 && <span className="wk-down"> · {week.downs} regression{week.downs > 1 ? 's' : ''} ▼ — the wheel remembers</span>}
          </p>
        )}
        {season && (
          <div className="season" title={season.ends ? `ends ${season.ends}` : ''}>
            <span className="season-name">{season.name}</span>
            <div className="season-track"><div style={{ width: `${(season.pct * 100).toFixed(1)}%` }} /></div>
            <span className="season-num">{(season.pct * 100).toFixed(0)}%</span>
          </div>
        )}
        {tree.error && tree.loaded && <p className="atlas-warn">⚠ {tree.error}</p>}
        {tree.fileErrors?.length > 0 && (
          <p className="atlas-warn">⚠ {tree.fileErrors.join(' · ')} — showing the rest of the tree</p>
        )}
      </section>

      {quest.length > 0 && (
        <section className="quest">
          <h3 className="quest-title">Today's adaptations</h3>
          <div className="quest-row">
            {quest.map((k) => {
              const st = statusOf(k, tree.progress)
              return (
                <button key={k.id} className={`quest-card ${st}`} onClick={() => onFocus(k)}>
                  <span className="quest-icon">{k.icon || '◆'}</span>
                  <span className="quest-body">
                    <span className="quest-name">{k.name}</span>
                    <span className="quest-meta">{tree.realms.find((r) => r.id === k.realm)?.name || k.realm} · {STATUS_DESC[st].split(' — ')[0]}</span>
                  </span>
                  <span className="quest-go">→</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      <div className="realm-grid">
        {tree.realms.map((r, i) => {
          const s = realmStats(r.id, tree)
          const pct = s.max ? s.pts / s.max : 0
          const next = frontier.filter((k) => k.realm === r.id).length
          return (
            <button key={r.id} className="realm-card" style={{ '--hue': r.hue, '--i': i }} onClick={() => onOpen(r.id)}>
              <Ring pct={pct} hue={r.hue} />
              <div className="realm-card-body">
                <h2>{r.name}</h2>
                <p>{r.sub}</p>
                <p className="realm-end">🏁 {r.end}</p>
                <div className="dots">
                  {s.counts.mastered > 0 && <span className="dot mastered">{s.counts.mastered}</span>}
                  {s.counts.inprogress > 0 && <span className="dot inprogress">{s.counts.inprogress}</span>}
                  {s.counts.unlocked > 0 && <span className="dot unlocked">{s.counts.unlocked}</span>}
                  <span className="dot locked">{s.counts.locked}</span>
                  {next > 0 && <span className="dot frontier" title="actionable right now">next {next}</span>}
                </div>
              </div>
              <span className="realm-enter">→</span>
              <span className="card-glare" />
            </button>
          )
        })}
      </div>

      {events.length > 0 && (
        <section className="ledger">
          <h3 className="quest-title">Recent turns of the wheel</h3>
          <ul className="ledger-list">
            {events.map((e, i) => (
              <li key={i} className={e.up ? 'up' : e.down ? 'down' : ''}>
                <span className="ledger-date">{e.date} {e.time}</span>
                <span className="ledger-name">{e.name}</span>
                <span className="ledger-detail">{e.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="atlas-foot">
        <span className="legend"><i className="sw locked" /> {STATUS_DESC.locked}</span>
        <span className="legend"><i className="sw unlocked" /> {STATUS_DESC.unlocked}</span>
        <span className="legend"><i className="sw inprogress" /> {STATUS_DESC.inprogress}</span>
        <span className="legend"><i className="sw mastered" /> {STATUS_DESC.mastered}</span>
      </footer>
    </main>
  )
}
