// Build-time snapshot of the unified body-skill tree. The skill list is the
// shared core's (core/skills.ts, generated from data/skills/*.json by
// `npm run core`), so Arbor, Life OS and Strong always agree on it.
import familiesFile from '../../data/realms.json'
import progressSeed from '../../data/progress.json'
import { SKILLS } from '../../core/skills.ts'

export const BUNDLED = {
  families: familiesFile.families || [],
  skills: SKILLS,
  progress: progressSeed || {},
}
