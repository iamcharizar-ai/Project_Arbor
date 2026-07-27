import React from 'react'
import { createPortal } from 'react-dom'

// Portalled to <body> on purpose: .realm-canvas carries `z-index: 1`, which
// makes it a stacking context — anything rendered inside it is trapped below
// the detail panel (z-index 100) no matter how high its own z-index climbs.
// Every edit-mode dialog goes through here so it lands above the whole app.
export default function Modal({ onClose, children }) {
  return createPortal(
    <div className="skill-editor-scrim" onClick={onClose}>
      {children}
    </div>,
    document.body,
  )
}
