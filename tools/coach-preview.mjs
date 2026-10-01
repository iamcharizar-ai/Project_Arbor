// Dev aid: print what the coach would plan for the next 7 days from a given start.
//   node tools/coach-preview.mjs
import { SKILLS, SKILL_BY_ID } from '../core/skills.ts'
import { planDay, workingSet, targetFor } from '../core/coach.ts'
import { categoryOf } from '../core/meta.ts'
import { emptyArbor, foldArbor, dayISO } from '../core/model.ts'
import { gymDayFor } from '../core/schedule.ts'

const at = '2026-10-01T05:00:00.000Z'
const start = ['pushup', 'pullup', 'lsit', 'crow-pose', 'pistol-squat'].map((id) => {
  const s = SKILL_BY_ID.get(id)
  return { device: 'x', at, day: '2026-10-01', type: 'skill', payload: { skillId: id, value: s.unit ? s.t[0] : 1, kind: s.unit ? 'cur' : 'lvl', done: false } }
})
let state = foldArbor(emptyArbor(), start)
console.log('WORKING SET:', workingSet(SKILLS, state.progress).map((s) => `${s.name} [${categoryOf(s)}]`).join(' · '), '\n')
const d = new Date('2026-10-05T08:00:00')
for (let i = 0; i < 7; i++) {
  const day = dayISO(d)
  const plan = planDay(SKILLS, state, day)
  const name = (id) => SKILL_BY_ID.get(id).name
  console.log(`${d.toLocaleDateString('en', { weekday: 'short' })} — gym: ${gymDayFor(day).name}`)
  console.log('  morning:', plan.morning.map((id) => `${name(id)} (${targetFor(SKILL_BY_ID.get(id), state.progress)})`).join(' | '))
  console.log('  gym +  :', plan.gym.map(name).join(' | ') || '-')
  // pretend everything planned was practised
  state = foldArbor(state, [...plan.morning, ...plan.gym].map((skillId) => ({ device: 'x', at: `${day}T07:00:00.000Z`, day, type: 'skill', payload: { skillId } })))
  d.setDate(d.getDate() + 1)
}
