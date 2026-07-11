import React, { useRef, useEffect } from 'react'

// Ambient drifting motes — the organism's breath. Density and glow scale with vitality.
export default function Particles({ vitality, hue }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas.getContext('2d')
    let w, h, raf
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      w = canvas.width = innerWidth * DPR
      h = canvas.height = innerHeight * DPR
      canvas.style.width = innerWidth + 'px'
      canvas.style.height = innerHeight + 'px'
    }
    resize()
    window.addEventListener('resize', resize)

    const count = Math.round(40 + vitality * 120)
    const motes = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight,
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.12,
      vy: -0.05 - Math.random() * 0.22, // drift upward — growth
      a: 0.08 + Math.random() * 0.3,
      tw: Math.random() * Math.PI * 2,
    }))

    let t = 0
    const tick = () => {
      t += 0.008
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
        ctx.fillStyle = `hsla(${hue}, 40%, 72%, ${alpha})`
        ctx.fill()
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [vitality, hue])

  return <canvas ref={ref} className="particles" aria-hidden="true" />
}
