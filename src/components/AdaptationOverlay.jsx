import React, { useEffect, useRef, useState } from 'react'
import { useTree, STATUS_LABEL, STATUS_DESC } from '../lib/store.js'
import Wheel from './Wheel.jsx'

// The "the wheel has turned" moment, made big: when a skill crosses a tier,
// the screen dims, a large wheel spins center-screen (reusing Wheel.jsx's own
// spin+glow animation — same `pulse` object, so the big wheel and the tiny
// topbar one move in perfect sync for free), and the skill + new tier print
// beneath it. One-shot, ~2.4s, self-dismissing.
//
// Keyed by pulse.n so every crossing mounts a FRESH element — the CSS keyframe
// then plays from the start on its own, no requestAnimationFrame restart dance
// (which would stall on a throttled/backgrounded tab). A new pulse mid-flight
// just remounts for the new skill; the timer restarts with it.
//
// Deliberately DECORATIVE: pointer-events:none throughout, so a bulk value-
// entry session (many tiers crossed back-to-back) is never blocked waiting on
// this to fade.
const DURATION_MS = 2400

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
        <Wheel size={220} turns={0} pulse={shown} />
        <div className="adapt-overlay-name">{shown.skillName}</div>
        <div className={`adapt-overlay-status ${shown.status}`}>{STATUS_LABEL[shown.status]}</div>
        <div className="adapt-overlay-desc">{STATUS_DESC[shown.status]}</div>
      </div>
    </div>
  )
}
