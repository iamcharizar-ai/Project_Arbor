import React, { useState, useEffect, useCallback } from 'react'
import Tree from './components/Tree.jsx'
import Panel from './components/Panel.jsx'
import Search from './components/Search.jsx'
import LogDrawer from './components/LogDrawer.jsx'
import Toast from './components/Toast.jsx'
import Wheel from './components/Wheel.jsx'
import AdaptationOverlay from './components/AdaptationOverlay.jsx'
import { ClickSpark } from './components/fx.jsx'
import { useTree, overallStats, weekStats, streakDays } from './lib/store.js'

export default function App() {
  const tree = useTree()
  const [selected, setSelected] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [focus, setFocus] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setSelected(null); setSearchOpen(false); setLogOpen(false) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((s) => !s)
        setLogOpen(false)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setLogOpen((s) => !s)
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const goTo = useCallback((skill) => {
    setSearchOpen(false)
    setLogOpen(false)
    setSelected(skill)
    setFocus({ id: skill.id, t: Date.now() })
  }, [])

  const stats = overallStats(tree)
  const week = weekStats(tree)
  const streak = streakDays(tree)
  const vitality = stats.max ? stats.pts / stats.max : 0

  return (
    <div className="app">
      <ClickSpark />
      <AdaptationOverlay />
      <header className="topbar">
        <button className="brand" onClick={() => { setSelected(null); setFilter('all') }}>
          <Wheel turns={stats.pts / 10} size={18} className="brand-wheel" pulse={tree.pulse} />
          ARBOR
        </button>
        <span className="app-version" title={`ARBOR v${__APP_VERSION__}`}>v{__APP_VERSION__}</span>
        <nav className="crumbs">
          <span className="crumb-sep">/</span>
          <span className="crumb">body skills</span>
        </nav>
        <div className="top-right">
          <button className="search-btn log-btn" onClick={() => setLogOpen(true)} title="Log a PR">
            ✎ log PR <kbd>Ctrl L</kbd>
          </button>
          <button className="search-btn" onClick={() => setSearchOpen(true)} title="Find a skill">
            ⌕ <kbd>Ctrl K</kbd>
          </button>
          <div className="vitality" title={`${stats.pts} / ${stats.max} XP · lifetime ${(vitality * 100).toFixed(1)}%`}>
            <span className="vitality-num">⚙ {stats.pts}</span>
            <span className="vitality-meta">{(vitality * 100).toFixed(1)}%</span>
            {streak > 0 && <span className="vitality-streak">{streak}d streak</span>}
            {week.ticks > 0 && <span className="vitality-week">+{week.ticks} this wk</span>}
          </div>
        </div>
      </header>

      <div className="view-container">
        <Tree
          onSelect={setSelected}
          selectedId={selected?.id}
          focus={focus}
          filter={filter}
          onFilter={setFilter}
        />
      </div>

      {selected && (
        <Panel
          skill={selected}
          onClose={() => setSelected(null)}
          onFocus={goTo}
        />
      )}
      <Search open={searchOpen} onClose={() => setSearchOpen(false)} onPick={goTo} />
      <LogDrawer open={logOpen} onClose={() => setLogOpen(false)} onPick={goTo} />
      <Toast />
    </div>
  )
}
