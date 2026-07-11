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

export async function readTree(dirHandle) {
  const realms = (await readJSON(dirHandle, 'realms.json')).realms
  const skillsDir = await dirHandle.getDirectoryHandle('skills')
  const skills = []
  for (const r of REALM_FILES) {
    const file = await readJSON(skillsDir, r + '.json')
    for (const s of file.skills) skills.push({ ...s, realm: r })
  }
  const progress = await readJSON(dirHandle, 'progress.json')
  return { realms, skills, progress }
}

export async function writeProgress(dirHandle, id, rec, line) {
  const progress = await readJSON(dirHandle, 'progress.json')
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
