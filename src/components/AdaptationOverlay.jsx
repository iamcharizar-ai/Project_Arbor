import React, { useEffect, useRef, useState } from 'react'
import { useTree, STATUS_LABEL } from '../lib/store.js'
import { wheelURL } from '../lib/pixel/sprites.js'

// The "the wheel has turned" moment: when a skill crosses a tier the wheel
// gives one stepped spin in the middle of the screen with the new tier's name.
// It is purely decorative (pointer-events: none), short, and only animates
// transform/opacity on a small element — the old full-screen dimmed overlay
// with an animated drop-shadow filter was one of the heaviest things in the app.
//
// Keyed by pulse.n so every crossing mounts a fresh element and the CSS
// animation starts from frame 0 on its own.
const DURATION_MS = 1300

export default function AdaptationOverlay() {
  const tree = useTree()
  const [shown, setShown] = useState(null)
  const lastN = useRef(tree.pulse?.n || 0)
  const timer = useRef(null)

  useEffect(() => {
    const pulse = tree.pulse
    if (!pulse || pulse.n === lastN.current) return
    lastN.current = pulse.n
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    clearTimeout(timer.current)
    setShown(pulse)
    timer.current = setTimeout(() => setShown(null), DURATION_MS)
  }, [tree.pulse])

  useEffect(() => () => clearTimeout(timer.current), [])

  if (!shown) return null
  return (
    <div key={shown.n} className={`adapt ${shown.status}`} aria-hidden="true">
      <img className="adapt-wheel" src={wheelURL()} alt="" draggable="false" />
      <div className="adapt-word">{STATUS_LABEL[shown.status]}</div>
    </div>
  )
}
