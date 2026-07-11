import React, { useRef, useEffect } from 'react'

// Shadow motes — ambient drift, Ten-Shadows flavored: half carry the realm's
// hue, half the violet of the void. Perf-capped: DPR ≤ 1.25, ≤ 70 motes,
// ~30fps, and nothing at all under prefers-reduced-motion.
export default function Particles({ vitality, hue }) {
  const ref = useRef(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let w, h, raf
    const DPR = Math.min(window.devicePixelRatio || 1, 1.25)
    const resize = () => {
      w = canvas.width = innerWidth * DPR
      h = canvas.height = innerHeight * DPR
      canvas.style.width = innerWidth + 'px'
      canvas.style.height = innerHeight + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    const count = Math.min(70, Math.round(30 + vitality * 80))
    const motes = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.05 - Math.random() * 0.22, // drift upward — growth
      a: 0.07 + Math.random() * 0.26,
      tw: Math.random() * Math.PI * 2,
      shadow: i % 2 === 0, // violet void motes
    }))

    let t = 0
    let skip = false
    const tick = () => {
      raf = requestAnimationFrame(tick)
      skip = !skip
      if (skip) return // ~30fps is plenty for ambience
      t += 0.016
      ctx.clearRect(0, 0, w, h)
      for (const m of motes) {
        m.x += m.vx + Math.sin(t + m.tw) * 0.05
        m.y += m.vy
        if (m.y < -8) { m.y = innerHeight + 8; m.x = Math.random() * innerWidth }
        if (m.x < -8) m.x = innerWidth + 8
        if (m.x > innerWidth + 8) m.x = -8
        const alpha = m.a * (0.6 + 0.4 * Math.sin(t * 2 + m.tw))
        ctx.beginPath()
        ctx.arc(m.x * DPR, m.y * DPR, m.r * DPR, 0, Math.PI * 2)
        ctx.fillStyle = m.shadow
          ? `hsla(252, 55%, 70%, ${alpha})`
          : `hsla(${hue}, 40%, 72%, ${alpha})`
        ctx.fill()
      }
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [vitality, hue])

  return <canvas ref={ref} className="particles" aria-hidden="true" />
}
