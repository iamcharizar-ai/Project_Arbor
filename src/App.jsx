import React, { useState, useEffect, useCallback } from 'react'
import Tree from './components/Tree.jsx'
import Panel from './components/Panel.jsx'
import Search from './components/Search.jsx'
import LogDrawer from './components/LogDrawer.jsx'
import Toast from './components/Toast.jsx'
import AdaptationOverlay from './components/AdaptationOverlay.jsx'
import { Px, Wheel } from './components/Pixel.jsx'
import { useTree, useDerived, weekStats, streakDays } from './lib/store.js'

export default function App() {
  const tree = useTree()
  const stats = useDerived()
  const [selected, setSelected] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [focus, setFocus] = useState(null)
  const [filter, setFilter] = useState('all')
  const [pillar, setPillar] = useState(null)
  const [overview, setOverview] = useState(0)

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

  const week = weekStats(tree)
  const streak = streakDays(tree)
  const vitality = stats.pts / stats.max

  return (
    <div className="app">
      <AdaptationOverlay />
      <aside className="rail">
        <button
          className="brand"
          type="button"
          title="ARBOR: show the whole tree"
          onClick={() => { setSelected(null); setFilter('all'); setPillar(null); setOverview((n) => n + 1) }}
        >
          <Wheel turns={stats.pts / 10} size={40} pulse={tree.pulse} />
          <span>ARBOR</span>
        </button>
        <nav className="rail-nav">
          <button type="button" className={logOpen ? 'on' : ''} onClick={() => { setLogOpen(true); setSearchOpen(false) }} title="Log a PR (Ctrl L)">
            <Px name="pencil" u={3} />
            <span>Log PR</span>
          </button>
          <button type="button" className={searchOpen ? 'on' : ''} onClick={() => { setSearchOpen(true); setLogOpen(false) }} title="Find a skill (Ctrl K)">
            <Px name="search" u={3} />
            <span>Search</span>
          </button>
        </nav>
        <div className="rail-stats" title={`${stats.pts} / ${stats.max} XP · lifetime ${(vitality * 100).toFixed(1)}%`}>
          <span className="stat xp"><Px name="bolt" /> {stats.pts}</span>
          <span className="stat pct">{(vitality * 100).toFixed(1)}%</span>
          {streak > 0 && <span className="stat streak" title="day streak"><Px name="flame" /> {streak}d</span>}
          {week.ticks > 0 && <span className="stat week" title="ticks this week">+{week.ticks}</span>}
        </div>
      </aside>

      <main className="view-container">
        <Tree
          onSelect={setSelected}
          selectedId={selected?.id}
          focus={focus}
          filter={filter}
          onFilter={setFilter}
          pillar={pillar}
          onPillar={setPillar}
          overview={overview}
        />
      </main>

      {selected && <Panel skill={selected} onClose={() => setSelected(null)} onFocus={goTo} />}
      <Search open={searchOpen} onClose={() => setSearchOpen(false)} onPick={goTo} />
      <LogDrawer open={logOpen} onClose={() => setLogOpen(false)} onPick={goTo} />
      <Toast />
    </div>
  )
}
