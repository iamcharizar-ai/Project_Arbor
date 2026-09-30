import React, { useEffect, useMemo, useState } from 'react'
import { useTree, statusOf, valueOf, setValue, tickNext, rec, staleInfo, skillById, STATUS_LABEL, STATUS_KEYS, RANK } from '../lib/store.js'
import { Px, SkillIcon } from './Pixel.jsx'

const TIER_NAMES = ['Unlocked', 'In progress', 'Mastered']

export default function Panel({ skill, onClose, onFocus }) {
  const tree = useTree()
  const status = statusOf(skill, tree.progress)
  const val = valueOf(skill, tree.progress)
  const r = rec(skill.id, tree.progress)
  const stale = staleInfo(skill, tree.progress)
  const fellBelow = (r.maxRank || 0) > RANK[status]
  const [draft, setDraft] = useState(String(val))
  useEffect(() => { setDraft(String(val)) }, [val, skill.id])
  const reqs = useMemo(() => (skill.req || []).map(skillById).filter(Boolean), [skill])

  const commitDraft = () => {
    const n = Number(draft)
    if (Number.isFinite(n) && n !== val) setValue(skill, n)
    else setDraft(String(val))
  }
  const bump = (by) => setValue(skill, val + by)

  return (
    <aside className="panel" key={skill.id} aria-label={`${skill.name} details`}>
      <button className="icon-btn panel-close" onClick={onClose} aria-label="Close"><Px name="close" /></button>
      <div className={`status-tag ${status}`}>{STATUS_LABEL[status]}</div>
      {(r.adapt || 0) > 0 && (
        <div className="callout adapt"><Px name="gear" /> climbed back x{r.adapt}</div>
      )}
      <div className="panel-head">
        <SkillIcon id={skill.id} status={status} size={2} className="panel-figure" />
        <div>
          <h2 className="panel-title">
            {skill.star && <Px name="star" className="gold" />} {skill.name}
          </h2>
          <p className="panel-branch">{skill.branch}</p>
        </div>
      </div>

      {stale && (
        <p className={`callout ${stale.kind}`}>
          {stale.kind === 'stale'
            ? `Untouched for ${stale.days} days. Retest it.`
            : `Mastered ${stale.days} days ago. Physical skills perish, so re-verify.`}
        </p>
      )}
      {fellBelow && (
        <p className="callout memory">Was {STATUS_LABEL[STATUS_KEYS[r.maxRank]]} before. Climb back to earn a gear.</p>
      )}

      {skill.unit ? (
        <>
          <div className="stepper">
            <button className="step" onClick={() => bump(-1)} aria-label="Minus one"><Px name="minus" u={3} /></button>
            <div className="stepper-value">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={draft}
                aria-label={`Current ${skill.unit}`}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              />
              <span className="unit">{skill.unit}</span>
            </div>
            <button className="step" onClick={() => bump(1)} aria-label="Plus one"><Px name="plus" u={3} /></button>
          </div>
          <div className="quick">
            <button type="button" onClick={() => bump(1)}>+1</button>
            <button type="button" onClick={() => bump(5)}>+5</button>
            {(skill.t || []).map((th, i) => (
              val < th ? (
                <button key={th} type="button" className={`jump t${i}`} onClick={() => setValue(skill, th)}>
                  <Px name="arrow" /> {th} {skill.unit}
                </button>
              ) : null
            ))}
          </div>
          <div className="tier-list">
            {skill.t.map((th, i) => (
              <div key={i} className={`tier t${i} ${val >= th ? 'hit' : ''}`}>
                <span className="tier-name">{TIER_NAMES[i]}</span>
                <span className="tier-crit">{th} {skill.unit}</span>
                <span className="tier-check">{val >= th && <Px name="check" />}</span>
              </div>
            ))}
          </div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={skill.t[2]} aria-valuenow={Math.min(val, skill.t[2])}>
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
                type="button"
                className={`tier tier-btn t${i} ${hit ? 'hit' : ''}`}
                onClick={() => setValue(skill, hit && val === i + 1 ? i : i + 1)}
                aria-pressed={hit}
                title={hit ? 'Click to un-set' : 'Click when achieved'}
              >
                <span className="tier-name">{TIER_NAMES[i]}</span>
                <span className="tier-crit">{skill.tiers?.[k]}</span>
                <span className="tier-check">{hit && <Px name="check" />}</span>
              </button>
            )
          })}
        </div>
      )}

      {status !== 'mastered' && (
        <button className="primary" type="button" onClick={() => tickNext(skill)}>
          Tick next tier
        </button>
      )}

      {reqs.length > 0 && (
        <div className="panel-reqs">
          <h3>Prerequisites</h3>
          {reqs.map((p) => {
            const st = statusOf(p, tree.progress)
            return (
              <button key={p.id} className={`req-chip ${st}`} type="button" onClick={() => onFocus?.(p)}>
                <SkillIcon id={p.id} status={st} />
                <span className="req-name">{p.name}</span>
                <em>{STATUS_LABEL[st]}</em>
              </button>
            )
          })}
        </div>
      )}

      {skill.note && <p className="panel-note">{skill.note}</p>}
      {status === 'mastered' && <p className="panel-flavor">Mastered</p>}
      <p className="panel-asof">
        {r.asOf ? `last logged ${r.asOf}` : 'not logged yet'} · saved on this device
      </p>
    </aside>
  )
}
