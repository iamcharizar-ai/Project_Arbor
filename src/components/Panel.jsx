import React, { useEffect, useMemo, useState } from 'react'
import { useTree, statusOf, valueOf, setValue, tickNext, rec, staleInfo, STATUS_LABEL } from '../lib/store.js'

const TIER_NAMES = ['Unlocked', 'In progress', 'Mastered']
const RANK_LABEL = ['Locked', 'Unlocked', 'In progress', 'Mastered']

export default function Panel({ skill, onClose, onFocus }) {
  const tree = useTree()
  const status = statusOf(skill)
  const val = valueOf(skill)
  const r = rec(skill.id)
  const stale = staleInfo(skill)
  const fellBelow = (r.maxRank || 0) > ['locked', 'unlocked', 'inprogress', 'mastered'].indexOf(status)
  const [draft, setDraft] = useState(String(val))
  useEffect(() => { setDraft(String(val)) }, [val, skill.id])
  const byId = useMemo(() => Object.fromEntries(tree.skills.map((s) => [s.id, s])), [tree.skills])
  const reqs = (skill.req || []).map((id) => byId[id]).filter(Boolean)

  const commitDraft = () => {
    const n = Number(draft)
    if (Number.isFinite(n)) setValue(skill, n)
  }

  return (
    <aside className="panel" key={skill.id}>
      <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
      <div className={`panel-status ${status}`}>{STATUS_LABEL[status]}</div>
      {(r.adapt || 0) > 0 && (
        <div className="panel-adapt">⚙ climbed back ×{r.adapt}</div>
      )}
      <h2 className="panel-title">
        <span className="panel-icon">{skill.icon}</span>
        {skill.star && <span className="node-star">✦ </span>}{skill.name}
      </h2>
      <p className="panel-branch">{skill.branch}</p>

      {stale && (
        <p className={`panel-stale ${stale.kind}`}>
          {stale.kind === 'stale'
            ? `untouched for ${stale.days} days — retest it`
            : `mastered ${stale.days} days ago — physical skills perish; re-verify`}
        </p>
      )}
      {fellBelow && (
        <p className="panel-memory">Was {RANK_LABEL[r.maxRank]} before. Climb back to earn ⚙.</p>
      )}

      {skill.unit ? (
        <>
          <div className="panel-current">
            <button className="step" onClick={() => { setValue(skill, val - 1); setDraft(String(Math.max(0, val - 1))) }}>−</button>
            <div className="panel-value">
              <input
                type="number"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); commitDraft() } }}
              />
              <span className="unit">{skill.unit}</span>
            </div>
            <button className="step" onClick={() => { setValue(skill, val + 1); setDraft(String(val + 1)) }}>+</button>
          </div>
          <div className="pr-quick">
            <button type="button" onClick={() => { setValue(skill, val + 1); setDraft(String(val + 1)) }}>+1</button>
            <button type="button" onClick={() => { setValue(skill, val + 5); setDraft(String(val + 5)) }}>+5</button>
            {(skill.t || []).map((th, i) => (
              val < th ? (
                <button key={th} type="button" className={`jump t${i}`} onClick={() => { setValue(skill, th); setDraft(String(th)) }}>
                  → {th} {skill.unit}
                </button>
              ) : null
            ))}
          </div>
          <div className="tier-list">
            {skill.t.map((th, i) => (
              <div key={i} className={`tier ${val >= th ? 'hit' : ''}`}>
                <span className="tier-name">{TIER_NAMES[i]}</span>
                <span className="tier-crit">{th} {skill.unit}</span>
                <span className="tier-check">{val >= th ? '✓' : ''}</span>
              </div>
            ))}
          </div>
          <div className="panel-progressbar">
            <div style={{ width: `${Math.min(100, (val / skill.t[2]) * 100)}%` }} />
          </div>
        </>
      ) : (
        <div className="tier-list">
          {['u', 'p', 'm'].map((k, i) => {
            const hit = val >= i + 1
            return (
              <button
                key={k}
                className={`tier tier-btn ${hit ? 'hit' : ''}`}
                onClick={() => setValue(skill, hit && val === i + 1 ? i : i + 1)}
                title={hit ? 'Click to un-set' : 'Click when achieved'}
              >
                <span className="tier-name">{TIER_NAMES[i]}</span>
                <span className="tier-crit">{skill.tiers?.[k]}</span>
                <span className="tier-check">{hit ? '✓' : ''}</span>
              </button>
            )
          })}
        </div>
      )}

      {status !== 'mastered' && (
        <button className="pr-tick" type="button" onClick={() => { tickNext(skill); setDraft(String(valueOf(skill))) }}>
          Tick next tier
        </button>
      )}

      {reqs.length > 0 && (
        <div className="panel-reqs">
          <h3>Prerequisites</h3>
          {reqs.map((p) => {
            const st = statusOf(p)
            return (
              <button key={p.id} className={`req-chip ${st}`} type="button" onClick={() => onFocus?.(p)}>
                <span>{p.icon}</span> {p.name}
                <em>{STATUS_LABEL[st]}</em>
              </button>
            )
          })}
        </div>
      )}

      {skill.note && <p className="panel-note">{skill.note}</p>}
      {status === 'mastered' && <p className="panel-flavor">Mastered.</p>}
      <p className="panel-asof">
        {r.asOf ? `last logged ${r.asOf}` : 'not logged yet'} · saved on this device
      </p>
    </aside>
  )
}
