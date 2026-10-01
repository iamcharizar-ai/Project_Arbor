// One-off data migration (kept for the record): fixes two prerequisite bugs and
// adds the Bar Dynamics branch — freestyle swing/spin work on the high bar.
//   node tools/add-bar-dynamics.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const f = 'data/skills/cal.json'
const j = JSON.parse(readFileSync(f, 'utf8'))
const by = Object.fromEntries(j.skills.map((s) => [s.id, s]))

// ── graph fixes ──
by['pistol-squat'].req = ['pistol-box-negative'] // shrimp squat is a harder peer, not a prerequisite
by['handstand-bail'].req = by['handstand-bail'].req.filter((r) => r !== 'cartwheel') // a pirouette bail needs no cartwheel
if (!by['handstand-bail'].req.includes('wall-handstand')) by['handstand-bail'].req.push('wall-handstand')

const B = 'Bar Dynamics'
const S = (id, name, req, u, p, m, extra = {}) => ({ id, branch: B, name, icon: '', req, tiers: { u, p, m }, ...extra })
const dyn = [
  S('bar-swing', 'Bar Swing', ['active-hang'], 'Controlled hollow-to-arch swing, hips leading', 'Swing to shoulder height at both ends', 'Big relaxed swing with a regrip at the dead point', { kind: 'foundation' }),
  S('swing-regrip', 'Swing Hop & Regrip', ['bar-swing'], 'Release and regrip both hands at the back-swing peak', 'Hop with visible air time', 'Hop between grips (over to under) on consecutive swings', { kind: 'foundation' }),
  S('monkey-bar-traverse', 'Monkey Bar Traverse', ['active-hang'], 'Traverse the full set, one rung at a time', 'Skip a rung, there and back', 'Skip two rungs with a swing between each', { star: true }),
  S('lache', 'Lache (Bar to Bar)', ['swing-regrip', 'monkey-bar-traverse'], 'Release from a swing and catch a bar within reach', 'Clear a 1 m gap', 'Clear 1.5 m or link several in a row'),
  S('bar-kip', 'Bar Kip', ['bar-swing', 'toes-to-bar'], 'Kip to support from a jump or with a band', 'Clean long-hang kip to support', '3 consecutive kips'),
  S('back-hip-circle', 'Back Hip Circle', ['pullover'], 'Cast and circle with bent arms or a spot', 'Clean straight-arm circle back to support', '3 circles connected'),
  S('underswing-dismount', 'Underswing Dismount', ['bar-swing', 'toes-to-bar'], 'Toes to the bar, shoot out and land on your feet', 'Shoot past 1.5 m with a stuck landing', 'Cast underswing from support past 2 m'),
  S('bar-180', 'Swing 180', ['swing-regrip'], 'Half turn on the bar with one hand always on', 'Release both hands, turn 180 and catch', 'Linked 180s in both directions'),
  S('pull-180', '180 Pull-Up', ['explosive-pullup-chest'], 'Explosive pull, switch grip at the top', 'Pull, turn 180 in the air, catch', '3 in a row, both directions'),
  S('pull-360', '360 Pull (Bar Spin)', ['pull-180', 'waist-pullup'], 'Full 360 with a low catch', 'Clean 360 caught with bent arms', '360 into another pull without resetting', { star: true }),
  S('swing-360', 'Swing 360', ['bar-180'], 'Release at the front peak, spin 360, catch any way', 'Clean catch with both hands together', 'Linked straight into the next swing', { star: true }),
  S('bar-540', '540', ['pull-360', 'swing-360'], '540 landing on the ground under the bar', '540 caught on the bar', 'Consistent on demand'),
  S('bar-720', '720', ['bar-540'], '720 attempted with a safe bail', '720 caught', 'Consistent on demand', { star: true }),
  S('muscle-up-360', 'Muscle-Up 360', ['muscle-up', 'pull-360'], 'Muscle-up, spin 360 above the bar, land in support with a spot', 'Clean catch in support', 'Linked into a dip or second rep'),
  S('alley-oop', 'Alley-Oop', ['swing-360'], 'Back-swing release with a half turn', 'Full alley-oop 360 caught', 'Linked from a swing without a reset'),
  S('baby-giant', 'Baby Giant', ['bar-kip', 'back-hip-circle'], 'Cast to horizontal and swing down under control', 'Bent-arm circle back to support', '3 baby giants connected'),
  S('giant', 'Giant Swing', ['baby-giant'], 'Giant with straps or a spot', 'One clean giant, straight arms', '3 giants connected', { star: true }),
  S('shrimp-flip', 'Shrimp Flip', ['swing-regrip', 'back-hip-circle'], 'Forward rotation over the bar with a spot or into a pit', 'Shrimp flip caught on the bar', 'Linked from a swing'),
  S('flyaway', 'Flyaway', ['underswing-dismount'], 'Tucked flyaway into a pit or with a spot', 'Tucked flyaway to feet on a mat', 'Layout flyaway, stuck landing', { star: true }),
  S('front-flyaway', 'Front Flyaway', ['flyaway'], 'Front flyaway with a spot', 'To feet on a mat', 'Stuck landing on demand'),
  S('geinger', 'Geinger', ['giant', 'flyaway', 'swing-360'], 'Drilled into a pit with a spot', 'Release, half turn, regrasp', 'Linked out of a giant'),
]
j.skills = j.skills.filter((s) => s.branch !== B)
j.skills.push(...dyn)
writeFileSync(f, JSON.stringify(j, null, 2) + '\n')

let p = readFileSync('core/pixel/poses.js', 'utf8')
if (!p.includes('barSwing')) {
  p = p.replace('  // ── horizontal pull ─', `  // ── bar dynamics ───────────────────────────────────────────────────────
  barSwing:   { t: 335, hd: 30, a: [350, 345], l: [150, 150], props: ['bar', 'speed'] },
  monkeyBars: { t: 10, hd: 30, a: [30, 20], b: [335, 345], l: [190, 205], m: [165, 175], props: ['bar', 'speed'] },
  barSpin:    { t: 0, hd: 25, a: [20, 350], b: [340, 10], l: [182, 195], props: ['bar', 'spin', 'twist'] },
  hipCircle:  { t: 0, hd: 25, a: [180, 180], l: [180, 170], props: ['bar', 'spin'] },
  giant:      { t: 180, a: [180, 180], l: [0, 0], m: [4, 358], props: ['bar', 'spin'] },
  lache:      { t: 60, hd: -20, a: [40, 40], l: [232, 250], props: ['speed', 'up'] },
  flyaway:    { t: 200, hd: -30, a: [100, 20], l: [20, 170], props: ['spin', 'speed'] },

  // ── horizontal pull ─`)
  writeFileSync('core/pixel/poses.js', p)
}
let m = readFileSync('core/pixel/skillPoses.js', 'utf8')
if (!m.includes('bar-swing')) {
  m = m.replace(/ {2}\/\/ Horizontal Pull\r?\n/, `  // Bar Dynamics
  'bar-swing': 'barSwing', 'swing-regrip': 'barSwing', 'monkey-bar-traverse': 'monkeyBars', 'lache': 'lache', 'bar-kip': 'toesBar',
  'back-hip-circle': 'hipCircle', 'underswing-dismount': 'lache', 'bar-180': 'barSpin', 'pull-180': 'barSpin', 'pull-360': 'barSpin',
  'swing-360': 'barSpin', 'bar-540': 'barSpin', 'bar-720': 'barSpin', 'muscle-up-360': 'barSpin', 'alley-oop': 'barSpin',
  'baby-giant': 'giant', 'giant': 'giant', 'shrimp-flip': 'flyaway', 'flyaway': 'flyaway', 'front-flyaway': 'flyaway', 'geinger': 'flyaway',
  // Horizontal Pull
`)
  writeFileSync('core/pixel/skillPoses.js', m)
}
console.log('bar dynamics:', dyn.length, 'skills')
