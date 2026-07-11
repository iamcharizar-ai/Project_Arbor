// Vault bridge via the File System Access API (Chromium only) — same pattern
// LifeOS uses (src/lib/vaultSync.ts), so ARBOR can be a static deploy and
// still read/write the vault with zero server round-trip: the browser holds
// a directory handle and touches files directly on disk. Nothing about the
// vault's contents ever reaches Vercel or any server.
//
// Scoped to System/arbor/ (not the whole vault) — least privilege.
import { idbDel, idbGet, idbSet } from './idb.js'

const HANDLE_KEY = 'arbor-vault-dir-handle'
const REALM_FILES = ['cal', 'mob', 'mov', 'mus', 'aes', 'dex', 'tec', 'wel', 'soc']

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
  return { realms, skills, progress, season, log, errors }
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
