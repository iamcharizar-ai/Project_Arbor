import React from 'react'

// The eight-handled wheel. It turns once per growth point earned — adaptation
// made visible. Pure SVG, one element, cheap to render.
export default function Wheel({ turns = 0, size = 120, className = '' }) {
  const spokes = Array.from({ length: 8 }, (_, i) => i * 45)
  return (
    <div className={`wheel ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="-60 -60 120 120"
        className="wheel-svg"
        style={{ transform: `rotate(${turns}deg)` }}
        aria-hidden="true"
      >
        {/* rim */}
        <circle r="38" className="wheel-rim" />
        <circle r="30" className="wheel-rim thin" />
        {/* eight handles: spoke + grip beyond the rim */}
        {spokes.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <line x1="0" y1="-8" x2="0" y2="-38" className="wheel-spoke" />
            <rect x="-2.6" y="-53" width="5.2" height="12" rx="2.4" className="wheel-handle" />
            <circle cy="-44" r="1.6" className="wheel-pin" />
          </g>
        ))}
        {/* hub */}
        <circle r="8" className="wheel-hub" />
        <circle r="3" className="wheel-eye" />
      </svg>
    </div>
  )
}
