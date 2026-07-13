import React from 'react'

// The eight-ball wheel. It turns once per growth point earned — adaptation
// made visible. A single image, cheap to render.
export default function Wheel({ turns = 0, size = 120, className = '' }) {
  return (
    <div className={`wheel ${className}`} style={{ width: size, height: size }}>
      <img
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
