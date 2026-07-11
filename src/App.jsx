import React, { useState, useEffect } from 'react'
import Atlas from './components/Atlas.jsx'
import Realm from './components/Realm.jsx'
import Panel from './components/Panel.jsx'
import Particles from './components/Particles.jsx'
import { ClickSpark } from './components/fx.jsx'
import { useTree, initVault, connectVault, authorizeVault, overallStats } from './lib/store.js'

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
      <span>Not connected to the vault — showing {tree.skills.length ? 'a cached' : 'no'} tree. Ticks won't save until connected.</span>
      <button onClick={connectVault}>Connect vault folder (System/arbor)</button>
    </div>
  )
}

export default function App() {
  const tree = useTree()
  const [view, setView] = useState('atlas') // 'atlas' | realmId
  const [selected, setSelected] = useState(null)

  useEffect(() => { initVault() }, [])
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const stats = overallStats(tree)
  const vitality = stats.max ? stats.pts / stats.max : 0
  const realm = tree.realms.find((r) => r.id === view)

  if (!tree.loaded) {
    return (
      <div className="app loading">
        <div className="core" style={{ '--v': 0.3 }}><div className="core-glow" /><div className="core-orb" /></div>
        <p className="loading-text">growing arbor…</p>
      </div>
    )
  }

  return (
    <div className="app" style={{ '--realm-hue': realm ? realm.hue : 150 }}>
      <Particles vitality={vitality} hue={realm ? realm.hue : 150} />
      <ClickSpark />
      <header className="topbar">
        <button className="brand" onClick={() => { setView('atlas'); setSelected(null) }}>
          <span className="brand-mark" />
          ARBOR
        </button>
        {realm && (
          <nav className="crumbs">
            <span className="crumb-sep">/</span>
            <span className="crumb">{realm.name}</span>
          </nav>
        )}
        <div className="top-right">
          <span className={`sync-dot ${tree.syncStatus === 'ready' ? 'live' : 'off'}`} title="Vault sync status">
            {tree.pending > 0 ? '⇅ syncing' : tree.syncStatus === 'ready' ? '● vault' : '○ offline'}
          </span>
          <div className="vitality" title={`${stats.pts} / ${stats.max} growth points`}>
            <div className="vitality-track"><div className="vitality-fill" style={{ width: `${(vitality * 100).toFixed(1)}%` }} /></div>
            <span className="vitality-num">{(vitality * 100).toFixed(1)}%</span>
          </div>
        </div>
      </header>

      <VaultBanner tree={tree} />

      {view === 'atlas'
        ? <Atlas onOpen={(id) => setView(id)} />
        : <Realm key={view} realmId={view} onSelect={setSelected} selectedId={selected?.id} />}

      {selected && <Panel skill={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
