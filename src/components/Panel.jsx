import React from 'react'
import { useTree, statusOf, valueOf, setValue, rec, staleInfo, STATUS_LABEL } from '../lib/store.js'

const TIER_NAMES = ['Awakened', 'Adapting', 'Adapted']
const RANK_LABEL = ['Sealed', 'Awakened', 'Adapting', 'Adapted']

export default function Panel({ skill, onClose }) {
  useTree() // re-render on change
  const status = statusOf(skill)
  const val = valueOf(skill)
  const r = rec(skill.id)
  const stale = staleInfo(skill)
  const fellBelow = (r.maxRank || 0) > ['locked', 'unlocked', 'inprogress', 'mastered'].indexOf(status)

  return (
    <aside className="panel" key={skill.id}>
      <button className="panel-close" onClick={onClose} aria-label="Close">✕</button>
      <div className={`panel-status ${status}`}>{STATUS_LABEL[status]}</div>
      {(r.adapt || 0) > 0 && (
        <div className="panel-adapt" title="fell below a held rank, then re-earned it">⚙ adapted through failure ×{r.adapt}</div>
      )}
      <h2 className="panel-title">
        <span className="panel-icon">{skill.icon}</span>
        {skill.star && <span className="node-star">✦ </span>}{skill.name}
      </h2>
      <p className="panel-branch">{skill.branch}</p>

      {stale && (
        <p className={`panel-stale ${stale.kind}`}>
          {stale.kind === 'stale'
            ? `⏳ untouched for ${stale.days} days — retest or drop it`
            : `⚠ adapted ${stale.days} days ago — physical skills perish; re-verify it`}
        </p>
      )}
      {fellBelow && (
        <p className="panel-memory">The wheel remembers — this was {RANK_LABEL[r.maxRank]} before. Climb back to earn an adaptation ⚙.</p>
      )}

      {skill.unit ? (
        <>
          {/* ── Retro Arcade Stepper ── */}
          <div className="panel-current">
            <button className="step" onClick={() => setValue(skill, val - 1)}>−</button>
            <div className="panel-value">
              <input
                type="number"
                value={val}
                onChange={(e) => setValue(skill, Number(e.target.value) || 0)}
              />
              <span className="unit">{skill.unit}</span>
            </div>
            <button className="step" onClick={() => setValue(skill, val + 1)}>+</button>
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
        /* ── Chunky Toggle Buttons ── */
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
                <span className="tier-crit">{skill.tiers[k]}</span>
                <span className="tier-check">{hit ? '✓' : ''}</span>
              </button>
            )
          })}
        </div>
      )}

      {skill.note && <p className="panel-note">{skill.note}</p>}
      {skill.link && (
        <a
          className="panel-link"
          href={`obsidian://open?vault=${encodeURIComponent('Obsidian Vault')}&file=${encodeURIComponent(skill.link)}`}
        >
          ⧉ open in vault: {skill.link}
        </a>
      )}
      {status === 'mastered' && <p className="panel-flavor">It has adapted.</p>}
      <p className="panel-asof">
        {r.asOf ? `last updated ${r.asOf} · ` : ''}synced to vault: System/arbor
      </p>
    </aside>
  )
}
