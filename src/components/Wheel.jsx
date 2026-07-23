import React, { useEffect, useRef } from 'react'

// The eight-ball wheel. `turns` is its resting angle (accumulates with growth
// points). When `pulse.n` bumps — a skill just crossed a tier — it fires a
// ONE-SHOT spin + a glow in that tier's colour (matching the node status
// colours), then settles back. One-shot only, per the Jul-13 perf decree: no
// idle/looping animation ever runs here.
const STATUS_GLOW = { unlocked: '#facc15', inprogress: '#f472b6', mastered: '#a3e635' }
// bigger tiers spin harder; all multiples of 360 so it lands back on `turns`
const SPIN_DEG = { unlocked: 360, inprogress: 720, mastered: 1080 }

export default function Wheel({ turns = 0, size = 120, className = '', pulse = null }) {
  const imgRef = useRef(null)
  const lastN = useRef(pulse?.n || 0)

  useEffect(() => {
    if (!pulse || pulse.n === lastN.current) return
    lastN.current = pulse.n
    const el = imgRef.current
    if (!el || !el.animate) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const glow = STATUS_GLOW[pulse.status] || '#facc15'
    const deg = SPIN_DEG[pulse.status] || 360
    el.animate(
      [
        { transform: `rotate(${turns}deg) scale(1)`, filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' },
        { transform: `rotate(${turns + deg * 0.5}deg) scale(1.22)`, filter: `drop-shadow(0 0 9px ${glow}) drop-shadow(0 0 3px ${glow})`, offset: 0.45 },
        { transform: `rotate(${turns + deg}deg) scale(1)`, filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' },
      ],
      { duration: 850, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    )
  }, [pulse, turns])

  return (
    <div className={`wheel ${className}`} style={{ width: size, height: size }}>
      <img
        ref={imgRef}
        src="/wheel.png"
        alt=""
        className="wheel-svg"
        style={{ transform: `rotate(${turns}deg)` }}
        aria-hidden="true"
        draggable="false"
      />
    </div>
  )
}
