import React, { useEffect, useRef } from 'react'
import { glyphURL, figureURL, wheelURL } from '../lib/pixel/sprites.js'
import { STATUS_KEYS } from '../lib/store.js'

/** A pixel glyph tinted by the surrounding text colour. `u` = CSS px per art pixel. */
export function Px({ name, u = 2, className = '' }) {
  const g = glyphURL(name)
  const mask = `url(${g.url})`
  return (
    <span
      aria-hidden="true"
      className={`px ${className}`}
      style={{ width: g.w * u, height: g.h * u, WebkitMaskImage: mask, maskImage: mask }}
    />
  )
}

/** The skill's body-position pictogram, tinted for its status. size: 1 → 24px, 2 → 48px. */
export function SkillIcon({ id, status = 'unlocked', size = 1, className = '' }) {
  const key = typeof status === 'number' ? STATUS_KEYS[status] : status
  return (
    <img
      className={`skill-icon ${className}`}
      src={figureURL(id, key)}
      width={24 * size}
      height={24 * size}
      alt=""
      draggable="false"
    />
  )
}

/**
 * The brand wheel. Rests at `turns` degrees (stepped, so it clicks round like a
 * dial) and does one stepped spin whenever `pulse.n` bumps.
 */
export function Wheel({ turns = 0, size = 32, pulse = null, className = '' }) {
  const ref = useRef(null)
  const last = useRef(pulse?.n || 0)
  useEffect(() => {
    if (!pulse || pulse.n === last.current) return
    last.current = pulse.n
    const el = ref.current
    if (!el?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    el.animate(
      [{ transform: `rotate(${turns}deg)` }, { transform: `rotate(${turns + 360}deg)` }],
      { duration: 640, easing: 'steps(8, end)' },
    )
  }, [pulse, turns])
  const step = Math.floor(turns / 15) * 15
  return (
    <span className={`wheel ${className}`} style={{ width: size, height: size }}>
      <img ref={ref} src={wheelURL()} alt="" draggable="false" style={{ transform: `rotate(${step}deg)` }} />
    </span>
  )
}
