import React, { useEffect, useRef, useState } from 'react'
import { useTree, STATUS_LABEL } from '../lib/store.js'

// The "the wheel has turned" moment, full-screen: when a skill crosses a tier,
// the screen dims and the wheel does ONE weighted spin — a heavy two-turn
// rotation that decelerates and snaps to rest, with a single scale+glow pulse
// at the peak in that tier's colour. One spin, not a ratchet.
// One-shot, self-dismissing, decorative (pointer-events:none).
//
// Keyed by pulse.n so every crossing mounts a FRESH element — the CSS keyframe
// then plays from the start on its own, no requestAnimationFrame restart dance
// (which would stall on a throttled/backgrounded tab). A new pulse mid-flight
// just remounts for the new skill; the timer restarts with it.
const STATUS_GLOW = { unlocked: '#ffffff', inprogress: '#e91e8c', mastered: '#b8e986' }
const SPIN_DEG = 720 // one spin = two full turns ("360 or double of that")
const SPIN_MS = 700
const DURATION_MS = SPIN_MS + 700

function spinKeyframes(glow) {
  // single decelerating turn: fast off the line, easing hard into the landing,
  // with one scale+glow swell that peaks partway through and settles by the end.
  return [
    { offset: 0, transform: 'rotate(0deg) scale(0.9)', filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' },
    { offset: 0.55, transform: `rotate(${SPIN_DEG * 0.72}deg) scale(1.18)`, filter: `drop-shadow(0 0 22px ${glow}) drop-shadow(0 0 6px ${glow})` },
    { offset: 1, transform: `rotate(${SPIN_DEG}deg) scale(1)`, filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))' },
  ]
}

function AdaptWheel({ status }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !el.animate) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const glow = STATUS_GLOW[status] || STATUS_GLOW.unlocked
    el.animate(spinKeyframes(glow), { duration: SPIN_MS, easing: 'cubic-bezier(0.12, 0.8, 0.2, 1)', fill: 'forwards' })
  }, [status])
  return (
    <div ref={ref} className="adapt-wheel-spin">
      <img src="/wheel.png" alt="" className="wheel-svg" draggable="false" />
    </div>
  )
}

export default function AdaptationOverlay() {
  const tree = useTree()
  const [shown, setShown] = useState(null) // the pulse currently being displayed, or null
  const lastN = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    const pulse = tree.pulse
    if (!pulse || pulse.n === lastN.current) return
    lastN.current = pulse.n
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    clearTimeout(timerRef.current)
    setShown(pulse)
    timerRef.current = setTimeout(() => setShown(null), DURATION_MS)
  }, [tree.pulse])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (!shown) return null

  return (
    <div key={shown.n} className={`adapt-overlay active ${shown.status}`} aria-hidden="true">
      <div className="adapt-overlay-content">
        <AdaptWheel status={shown.status} />
        <div className={`adapt-overlay-status ${shown.status}`}>{STATUS_LABEL[shown.status]}</div>
      </div>
    </div>
  )
}
