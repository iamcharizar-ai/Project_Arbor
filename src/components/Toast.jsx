import React, { useEffect, useState } from 'react'
import { useToast } from '../lib/store.js'

export default function Toast() {
  const toast = useToast()
  const [shown, setShown] = useState(null)

  useEffect(() => {
    if (!toast) return
    setShown(toast)
    const t = setTimeout(() => setShown((cur) => (cur?.id === toast.id ? null : cur)), 1600)
    return () => clearTimeout(t)
  }, [toast])

  if (!shown) return null
  return (
    <div className={`pr-toast ${shown.status} ${shown.up ? 'up' : ''}`} role="status">
      {shown.up ? '✦ ' : ''}{shown.msg}
    </div>
  )
}
