// Vault bridge via the File System Access API (Chromium only) — same pattern
// LifeOS uses (src/lib/vaultSync.ts), so ARBOR can be a static deploy and
// still read/write the vault with zero server round-trip: the browser holds
// a directory handle and touches files directly on disk. Nothing about the
// vault's contents ever reaches Vercel or any server.
//
// Scoped to System/arbor/ (not the whole vault) — least privilege.
import { idbDel, idbGet, idbSet } from './idb.js'

const HANDLE_KEY = 'arbor-vault-dir-handle'
const REALM_FILES = ['cal', 'mob', 'mov', 'mus', 'aes', 'dex', 'tec', 'car', 'cat', 'fin', 'bok', 'soc']

export function supported() {
  return 'showDirectoryPicker' in window
}

function msg(e) {
  return e && e.message ? e.message : String(e)
}

async function readJSON(dirHandle, name) {
  const fh = await dirHandle.getFileHandle(name)
  return JSON.parse(await (await fh.getFile()).text())
}

async function writeJSON(dirHandle, name, data) {
  const fh = await dirHandle.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(JSON.stringify(data, null, 2))
  await w.close()
}

// last ~40KB of the progress log — enough for weeks of history without
// paying to read a file that only ever grows
async function readLogTail(dirHandle) {
  try {
    const fh = await dirHandle.getFileHandle('progress-log.md')
    const f = await fh.getFile()
    const start = Math.max(0, f.size - 40000)
    return await f.slice(start).text()
  } catch {
    return ''
  }
}

// Tolerant tree read: one broken realm file must never take the whole tree
// down — agents hand-edit these JSONs. Collect per-file errors instead.
export async function readTree(dirHandle) {
  const errors = []
  let realms = []
  try {
    realms = (await readJSON(dirHandle, 'realms.json')).realms || []
  } catch (e) {
    errors.push('realms.json: ' + msg(e))
  }

  const skills = []
  const labels = {} // realmId -> { [branch]: { x, y, hidden } }
  let skillsDir = null
  try {
    skillsDir = await dirHandle.getDirectoryHandle('skills')
  } catch (e) {
    errors.push('skills/: ' + msg(e))
  }
  if (skillsDir) {
    for (const r of REALM_FILES) {
      try {
        const file = await readJSON(skillsDir, r + '.json')
        for (const s of file.skills) skills.push({ ...s, realm: r })
        // branch-title overrides live alongside the skills, in the same file:
        // moving/hiding/renaming a title is a realm-level edit, and keeping it
        // here means one file per realm still holds everything about that realm.
        if (file.labels) labels[r] = file.labels
      } catch (e) {
        errors.push('skills/' + r + '.json: ' + msg(e))
      }
    }
  }

  let progress = {}
  try {
    progress = await readJSON(dirHandle, 'progress.json')
  } catch (e) {
    errors.push('progress.json: ' + msg(e))
  }

  let season = null
  try {
    season = await readJSON(dirHandle, 'season.json') // optional
  } catch {
    /* no season file — fine */
  }

  const log = await readLogTail(dirHandle)
  return { realms, skills, progress, season, log, labels, errors }
}

// Writes are serialized through a queue so two debounced flushes can't
// interleave their read-modify-write of progress.json (lost-update guard —
// the file is shared with agents, who edit it between app reads).
let writeQueue = Promise.resolve()

export function writeProgress(dirHandle, id, rec, line) {
  const job = writeQueue.catch(() => {}).then(async () => {
    const progress = await readJSON(dirHandle, 'progress.json') // fresh read: keep agent edits to other keys
    progress[id] = rec
    await writeJSON(dirHandle, 'progress.json', progress)
    if (line) {
      const fh = await dirHandle.getFileHandle('progress-log.md', { create: true })
      const file = await fh.getFile()
      const existing = await file.text()
      const w = await fh.createWritable()
      await w.write(existing.replace(/\n*$/, '\n') + line + '\n')
      await w.close()
    }
  })
  writeQueue = job
  return job
}

// Realm-file writes (edit mode: create / reposition / re-link / delete, plus
// branch-title overrides). Same read-modify-write safety as writeProgress, but
// queued PER REALM FILE so a write to one realm never blocks a write to
// another's. Every job re-reads the file fresh inside the queue, so an agent's
// concurrent hand-edit elsewhere in the same file is preserved. Patches must
// not carry a `realm` field — realm is derived from the filename on read.
const skillWriteQueues = {} // realmId -> Promise chain

// `mutate` receives the parsed file and returns the file to write back.
function mutateRealmFile(dirHandle, realmId, mutate) {
  const prev = skillWriteQueues[realmId] || Promise.resolve()
  const job = prev.catch(() => {}).then(async () => {
    const skillsDir = await dirHandle.getDirectoryHandle('skills')
    const name = realmId + '.json'
    let file
    try {
      file = await readJSON(skillsDir, name)
    } catch {
      file = { skills: [] }
    }
    await writeJSON(skillsDir, name, mutate({ ...file, skills: file.skills || [] }))
  })
  skillWriteQueues[realmId] = job
  return job
}

const applyPatches = (skills, patches) => {
  const byId = new Map(patches.map((p) => [p.id, p.patch]))
  const next = skills.map((s) => (byId.has(s.id) ? { ...s, ...byId.get(s.id) } : s))
  // ids the file doesn't know yet are creates — append in the given order
  const known = new Set(skills.map((s) => s.id))
  for (const p of patches) if (!known.has(p.id)) next.push({ id: p.id, ...p.patch })
  return next
}

export function writeSkill(dirHandle, realmId, skillId, patch) {
  return writeSkills(dirHandle, realmId, [{ id: skillId, patch }])
}

// One file rewrite for many skills — a group move or a branch rename would
// otherwise queue N sequential rewrites of the same file.
export function writeSkills(dirHandle, realmId, patches) {
  return mutateRealmFile(dirHandle, realmId, (file) => ({
    ...file,
    skills: applyPatches(file.skills, patches),
  }))
}

// Delete skills and, in the same rewrite, strip every remaining reference to
// them from this file's req/xref lists — a dangling req would otherwise fail
// validation and drop the referring skill's edge on the next load.
export function deleteSkills(dirHandle, realmId, ids) {
  const gone = new Set(ids)
  return mutateRealmFile(dirHandle, realmId, (file) => ({
    ...file,
    skills: file.skills
      .filter((s) => !gone.has(s.id))
      .map((s) => {
        const req = (s.req || []).filter((r) => !gone.has(r))
        const xref = (s.xref || []).filter((x) => !gone.has(x.slice(realmId.length + 1)) || !x.startsWith(realmId + ':'))
        if (req.length === (s.req || []).length && xref.length === (s.xref || []).length) return s
        const next = { ...s, req }
        if (s.xref) next.xref = xref
        return next
      }),
  }))
}

// Branch-title overrides: { [branch]: { x, y, hidden } }. Written whole, since
// the app holds the complete map for the realm.
export function writeLabels(dirHandle, realmId, labels, patches = []) {
  return mutateRealmFile(dirHandle, realmId, (file) => {
    const next = { ...file, skills: applyPatches(file.skills, patches), labels }
    if (!Object.keys(labels).length) delete next.labels
    return next
  })
}

export async function loadSavedHandle() {
  const h = await idbGet(HANDLE_KEY)
  if (!h) return { handle: null, status: 'disconnected' }
  const perm = await h.queryPermission?.({ mode: 'readwrite' })
  return { handle: h, status: perm === 'granted' ? 'ready' : 'need-perm' }
}

export async function connect() {
  // Directory picker starts at the vault root by convention (Rishabh picks
  // System/arbor when prompted) — the id lets Chrome remember the last spot.
  const h = await window.showDirectoryPicker({ id: 'arbor-vault', mode: 'readwrite' })
  await idbSet(HANDLE_KEY, h)
  return h
}

export async function authorize(handle) {
  const perm = await handle.requestPermission?.({ mode: 'readwrite' })
  return perm === 'granted'
}

export async function disconnect() {
  await idbDel(HANDLE_KEY)
}
