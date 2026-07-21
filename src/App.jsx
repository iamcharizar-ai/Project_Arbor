import React, { useState, useEffect, useCallback } from 'react'
import Atlas from './components/Atlas.jsx'
import Realm from './components/Realm.jsx'
import Panel from './components/Panel.jsx'
import Wheel from './components/Wheel.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import { ClickSpark } from './components/fx.jsx'
import Search from './components/Search.jsx'
import { useTree, initVault, connectVault, authorizeVault, overallStats, weekStats } from './lib/store.js'

function VaultBanner({ tree }) {
  if (tree.syncStatus === 'ready') return null
  if (tree.syncStatus === 'unsupported') {
    return (
      <div className="vault-banner warn">
        This browser can't sync to the vault (needs Chrome/Edge). Showing a read-only cached tree.
      </div>
    )
  }
  if (tree.syncStatus === 'need-perm') {
    return (
      <div className="vault-banner">
        <span>Vault access needs to be re-granted (browser restarted).</span>
        <button onClick={authorizeVault}>Re-authorize</button>
      </div>
    )
  }
  return (
    <div className="vault-banner">
      <span>Showing the bundled snapshot. Connect the vault to sync live edits and save ticks.</span>
      <button onClick={connectVault}>Connect vault folder (System/arbor)</button>
    </div>
  )
}

export default function App() {
  const tree = useTree()
  const [view, setView] = useState('atlas') // 'atlas' | realmId
  const [selected, setSelected] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [focus, setFocus] = useState(null) // { id, t } — jump target on the realm canvas

  useEffect(() => { initVault() }, [])
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { setSelected(null); setSearchOpen(false) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((s) => !s) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // search result / quest card → open the realm, select + center the node
  const goTo = useCallback((skill) => {
    setSearchOpen(false)
    setView(skill.realm)
    setSelected(skill)
    setFocus({ id: skill.id, t: Date.now() })
  }, [])

  const stats = overallStats(tree)
  const week = weekStats(tree)
  const vitality = stats.max ? stats.pts / stats.max : 0
  const realm = tree.realms.find((r) => r.id === view)

  if (!tree.loaded) {
    return (
      <div className="app loading">
        <Wheel turns={120} size={90} className="loading-wheel" />
        <p className="loading-text">the wheel turns…</p>
      </div>
    )
  }

  return (
    <div className="app" style={{ '--realm-hue': realm ? realm.hue : 252 }}>
      <ClickSpark />
      <header className="topbar">
        <button className="brand" onClick={() => { setView('atlas'); setSelected(null) }}>
          <Wheel turns={stats.pts / 10} size={18} className="brand-wheel" />
          ARBOR
        </button>
        {realm && (
          <nav className="crumbs">
            <span className="crumb-sep">/</span>
            <span className="crumb">{realm.name}</span>
          </nav>
        )}
        <div className="top-right">
          <button className="search-btn" onClick={() => setSearchOpen(true)} title="Find a skill">
            ⌕ <kbd>Ctrl K</kbd>
          </button>
          <span className={`sync-dot ${tree.syncStatus === 'ready' ? 'live' : 'off'}`} title="Vault sync status">
            {tree.pending > 0 ? '⇅ syncing' : tree.syncStatus === 'ready' ? '● vault' : '○ offline'}
          </span>
          <div className="vitality" title={`${stats.pts} / ${stats.max} growth points · lifetime ${(vitality * 100).toFixed(1)}%`}>
            <span className="vitality-num">⚙ {stats.pts}</span>
            {week.ticks > 0 && <span className="vitality-week">+{week.ticks} this wk</span>}
          </div>
        </div>
      </header>

      <VaultBanner tree={tree} />

      <AnimatePresence mode="wait">
        {view === 'atlas' ? (
          <motion.div key="atlas" className="view-container" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.3 }}>
            <Atlas onOpen={(id) => setView(id)} onFocus={goTo} />
          </motion.div>
        ) : (
          <motion.div key="realm" className="view-container" layoutId={`realm-${view}`} initial={{ opacity: 0, borderRadius: 24 }} animate={{ opacity: 1, borderRadius: 0 }} exit={{ opacity: 0 }} transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}>
            <Realm key={view} realmId={view} onSelect={setSelected} selectedId={selected?.id} focus={focus} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && <Panel skill={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
      <Search open={searchOpen} onClose={() => setSearchOpen(false)} onPick={goTo} />
    </div>
  )
}
