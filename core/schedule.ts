// The weekly gym split, shared so the coach can plan calisthenics around it and
// Life OS can show today's session. Strong owns the routines themselves; ids
// here match its routine ids.
import type { Category } from './meta.ts'

export interface GymDay {
  routineId: string
  name: string
  /** skill categories the morning block should stay away from (trained hard that evening) */
  avoid: Category[]
  /** categories the gym add-on skills are drawn from, in preference order */
  addon: Category[]
}

/** Indexed by Date#getDay(): 0 = Sunday. */
export const GYM_WEEK: GymDay[] = [
  { routineId: 'd7-arms-delts', name: 'Arms + Delts Pump', avoid: [], addon: ['bar', 'pull'] },
  { routineId: 'd1-chest-delts', name: 'Upper Chest + Side Delts', avoid: ['push'], addon: ['push'] },
  { routineId: 'd2-lats-biceps', name: 'Lats + Rear Delts + Biceps', avoid: ['pull'], addon: ['pull', 'bar'] },
  { routineId: 'd3-legs', name: 'Legs', avoid: ['legs'], addon: [] },
  { routineId: 'd4-delts-triceps', name: 'Side Delts + Triceps', avoid: ['push'], addon: ['push'] },
  { routineId: 'd5-back-biceps', name: 'Back Thickness + Biceps', avoid: ['pull'], addon: ['bar', 'pull'] },
  { routineId: 'd6-chest-flys', name: 'Chest Flys + Side Delts', avoid: ['push'], addon: ['push'] },
]

export const gymDayFor = (day: string): GymDay => GYM_WEEK[new Date(day + 'T12:00:00').getDay()]

/**
 * The session that is next in the split. Like Strong, it follows the last workout finished and not the calendar, so a missed
 * day never skips a muscle group. The split runs Monday first; with no workout on record the calendar day stands in.
 */
export function nextGymDay(workouts: Record<string, { type: string }>, day: string): GymDay {
  const cycle = [...GYM_WEEK.slice(1), GYM_WEEK[0]]
  const last = Object.keys(workouts).sort().reverse().map((d) => cycle.findIndex((g) => g.name === workouts[d].type)).find((i) => i !== -1)
  return last === undefined ? gymDayFor(day) : cycle[(last + 1) % cycle.length]
}
