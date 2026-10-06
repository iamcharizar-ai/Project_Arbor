import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-600.css'
import '@fontsource/silkscreen/latin-400.css'
import '@fontsource/silkscreen/latin-700.css'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)

// PWA install is optional; it just makes the notepad feel native. Prod only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker registration failed; carrying on without offline support', err)))
}
