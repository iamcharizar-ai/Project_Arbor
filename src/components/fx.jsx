import React, { useEffect, useRef, useState } from 'react'

// ── reactbits-style effects, built native (no deps) ──────────────────────

/** Decrypted/scramble text — glyphs resolve left to right. */
export function ScrambleText({ text, className = '', speed = 28 }) {
  const [out, setOut] = useState(text)
  useEffect(() => {
    const GLYPHS = '!<>-_\\/[]{}—=+*^?#░▒▓'
    let frame = 0
    let raf
    const tick = () => {
      frame++
      const resolved = Math.floor(frame / 2)
      let s = ''
      for (let i = 0; i < text.length; i++) {
        if (i < resolved) s += text[i]
        else if (text[i] === ' ') s += ' '
        else s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
      }
      setOut(s)
      if (resolved < text.length) raf = setTimeout(() => requestAnimationFrame(tick), speed)
    }
    tick()
    return () => clearTimeout(raf)
  }, [text, speed])
  return <span className={className}>{out}</span>
}

/** Animated count-up number. */
export function CountUp({ value, decimals = 1, duration = 900, className = '' }) {
  const [n, setN] = useState(value)
  const fromRef = useRef(value)
  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    let raf
    const tick = (t) => {
      const k = Math.min(1, (t - start) / duration)
      const e = 1 - Math.pow(1 - k, 3)
      setN(from + (value - from) * e)
      if (k < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <span className={className}>{n.toFixed(decimals)}</span>
}

/** Click spark — tiny rays burst from every click, app-wide. */
export function ClickSpark() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const onClick = (e) => {
      const s = document.createElement('span')
      s.className = 'click-spark'
      s.style.left = e.clientX + 'px'
      s.style.top = e.clientY + 'px'
      for (let i = 0; i < 8; i++) {
        const r = document.createElement('i')
        r.style.setProperty('--a', `${i * 45}deg`)
        s.appendChild(r)
      }
      el.appendChild(s)
      setTimeout(() => s.remove(), 500)
    }
    window.addEventListener('click', onClick)
    return () => window.removeEventListener('click', onClick)
  }, [])
  return <div ref={ref} className="click-spark-layer" aria-hidden="true" />
}
