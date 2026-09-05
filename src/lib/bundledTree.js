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

const skills = []
for (const [family, file] of Object.entries(FILES)) {
  for (const s of file.skills || []) skills.push({ ...s, family })
}

export const BUNDLED = {
  families,
  skills,
  progress: progressSeed || {},
}
