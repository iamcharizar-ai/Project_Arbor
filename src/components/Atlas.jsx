import React from 'react'
import { useTree, realmStats, overallStats } from '../lib/store.js'
import { ScrambleText, CountUp, Spotlight } from './fx.jsx'

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

export default function Atlas({ onOpen }) {
  const tree = useTree()
  const all = overallStats(tree)
  const vitality = all.pts / all.max

  return (
    <main className="atlas">
      <section className="atlas-hero">
        <div className="core" style={{ '--v': vitality }}>
          <div className="core-glow" /><div className="core-orb" />
        </div>
        <h1>
          <ScrambleText text="The tree is" />{' '}
          <em><CountUp value={vitality * 100} />%</em>{' '}
          <ScrambleText text="grown" />
        </h1>
        <p className="atlas-sub">
          {all.counts.mastered} mastered · {all.counts.inprogress} in progress · {all.counts.unlocked} unlocked · {all.counts.locked} locked — {all.total} skills across {tree.realms.length} realms
        </p>
        {tree.error && tree.loaded && <p className="atlas-warn">⚠ {tree.error}</p>}
      </section>

      <Spotlight className="realm-grid">
        {tree.realms.map((r, i) => {
          const s = realmStats(r.id, tree)
          const pct = s.max ? s.pts / s.max : 0
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
                </div>
              </div>
              <span className="realm-enter">→</span>
              <span className="card-glare" />
            </button>
          )
        })}
      </Spotlight>

      <footer className="atlas-foot">
        <span className="legend"><i className="sw locked" /> locked</span>
        <span className="legend"><i className="sw unlocked" /> unlocked — entry criterion hit</span>
        <span className="legend"><i className="sw inprogress" /> in progress — building volume</span>
        <span className="legend"><i className="sw mastered" /> mastered — the dedicated target, hit</span>
      </footer>
    </main>
  )
}
