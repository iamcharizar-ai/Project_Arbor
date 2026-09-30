// Build-time snapshot of the unified body-skill tree.
// cal + mob + mov are one canvas. Cross-file xrefs were folded into `req`
// when the unused realms were deleted; this loader just stamps `family`.
import familiesFile from '../../data/realms.json'
import progressSeed from '../../data/progress.json'
import cal from '../../data/skills/cal.json'
import mob from '../../data/skills/mob.json'
import mov from '../../data/skills/mov.json'

const FILES = { cal, mob, mov }
const families = familiesFile.families || []

// The vault export decorates text with emoji and arrows the pixel fonts don't
// have. Normalise them once here so every screen (and the canvas) stays in-font.
const clean = (t) =>
  typeof t !== 'string' ? t : t.replace(/\s*⭐/g, '').replace(/\s*✅/g, '').replace(/→/g, '>').replace(/\s{2,}/g, ' ').trim()

const skills = []
for (const [family, file] of Object.entries(FILES)) {
  for (const s of file.skills || []) {
    const { icon: _emoji, ...rest } = s // pictograms come from lib/pixel/skillPoses.js
    skills.push({
      ...rest,
      family,
      name: clean(s.name),
      note: clean(s.note),
      tiers: s.tiers && Object.fromEntries(Object.entries(s.tiers).map(([k, v]) => [k, clean(v)])),
    })
  }
}

export const BUNDLED = {
  families,
  skills,
  progress: progressSeed || {},
}
