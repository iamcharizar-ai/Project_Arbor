# Arbor skill-tree audit (Phase 1: research only)

Date: 2026-11-06. Scope: all 313 nodes in `data/skills/{cal,mob,mov}.json` across 17 branches, plus `core/meta.ts`. **Revision 3 (applied):** the patch below was applied to the repo after you approved it, including the doorway-bar answer. Every proposed change below is collected in **Appendix A** as one patch. I applied it to a scratch copy of the repo and ran `tools/arbor-validate.mjs` there: **347 skills, ok**. That means no cycles, no dangling prerequisites (`req`), no duplicate ids, and every node has a pose.

**Revision 2 (same day): your answers to the eight open questions are folded in.** They're recorded in Section 4, and the findings and patch below already reflect them:
- **Handstand:** thresholds moved to 10/30/60.
- **Flexibility:** stays in seconds, with the position that counts defined in each note.
- **Variants:** three pure width variants are cut.
- **90° push-up:** `hspu-90` is no longer merged; it's a different skill.
- **Gym-only:** the list is rebuilt for your home kit.
- **Movement arts:** ten nodes added.

**Revision 3:** you approved the full patch and said your home bar is a doorway bar. The patch was applied to `data/`, `core/` and `src/lib/store.js`, `npm run validate` reports 347 skills ok, and `npm run build` passes. `npm run core` was run with `--local`, so `core/skills.ts` is regenerated here but **not yet copied into Life OS and Strong** (run `npm run core` when you want them to pick the tree up).

## 1. Summary

| Type | Findings | Ids touched | High | Medium | Low |
|---|---|---|---|---|---|
| add (new node) | 44 | 44 new ids | 15 | 24 | 5 |
| cut / merge | 8 | 12 (10 firm, 2 optional) | 2 | 5 | 1 |
| move (branch) | 3 | 8 | 0 | 3 | 0 |
| reorder (`req` fix, standalone) | 17 | 17 | 3 | 10 | 4 |
| criteria (thresholds / tiers) | 7 | ~20 | 2 | 4 | 1 |
| rename (name only) | 2 | 2 | 1 | 0 | 1 |
| coach metadata (`core/meta.ts` sets) | 2 | 8 | 1 | 1 | 0 |

**State of the tree.** The calisthenics core is solid. The planche, front lever, back lever, dip and pull-up ladders follow Overcoming Gravity's progression charts (Steven Low; "OG2" below) closely, and the elite tier is real and correctly ordered at the top.

The problems are in three places:

1. **A few standard steps are missing.** The advanced tuck front lever, ring dip, kneeling rollout, straddle press negative and straddle one-arm handstand are all missing. Each of these is the single most-cited step in its ladder.
2. **Prerequisites (`req`) were set by feel, not by mechanics.**
   - The nordic curl is gated by the sissy squat, which is a quad movement.
   - The one-arm handstand needs a freestanding HSPU.
   - The flare needs a full planche.
   - The 1990 needs a one-arm handstand.
   - The hollowback handstand doesn't need a handstand at all.
3. **Domains you know less well are thin.**
   - Posterior chain: there is no hinge line at all.
   - Plyometrics are absent.
   - Gymnastics foundations are missing: bridge kickover, walkovers, front handspring and the cast.
   - Flexibility is measured in seconds held, which is not how any source measures flexibility.

Bloat is real but small: one exact duplicate (no-handed cartwheel = aerial), two process nodes, two trivial yoga poses, and three pure width variants. Branches with **no findings**: Kicks. Branches that are **essentially fine** with one minor fix: Physical Foundations, Dance (gaps only, nothing wrong).

How I worked:
- I verified every claim through four parallel research passes: strength, legs/mobility, yoga/acro/bar, and tricking/breaking/dance.
- I trusted no single weak source. Where only a blog or app supports something, the finding is marked Medium or Low and says so.
- Thresholds are labelled with their source, or marked "unsourced" where I had to choose a number.

### Migration mechanics (applies to every cut, merge and unit change)

- **Cut ids leave orphan rows.** Ledger rows for a cut id stay in Supabase. `foldArbor` still folds them into `progress[id]`, and nothing renders them, so they are harmless orphans.
- **Decided (Q4): one alias, `{ 'no-handed-cartwheel': 'aerial' }`.** It is applied to `p.skillId` at the top of the `skill` branch in `core/model.ts:foldArbor`. Because `core/` ships into Life OS and Strong via `npm run core`, all three apps then agree.
  - It is the only merge where both ids record the same kind of value (tier ticks).
  - `compression-foundation` stores tier ticks but `lsit-compression` stores reps, so aliasing it would write a value `rankOf` ignores. It is cut without an alias.
  - The cut variants and process nodes have no equivalent to carry into.
- **Unit to tiers resets rank.** Changing a node from `unit`+`t` to `tiers` makes `rankOf` read `lvl` instead of `cur`, so the node shows as locked until you re-tick it.
- **Threshold changes can drop rank.** Changing `t` recomputes rank live and may push a skill below its stored `maxRank`, which surfaces as "fell".
- **No sibling app hard-codes these ids.** I grepped `lifeos/` and `strong/` for every id proposed for a cut or move. The only hit is Strong's own exercise id `hanging-leg-raise`, which is unaffected because ids don't change.

## 2. Findings by branch

Format: **[type · confidence] ids**: change. Then the JSON (new nodes in full; changes as a fragment to merge), the pose, sources and a one-line rationale.

### Physical Foundations

**[cut · Medium] `compression-foundation`.** It is a near-duplicate of `lsit-compression` (Core). Its own unlock tier is "Seated leg lifts ×10"; `lsit-compression` is the same exercise counted 10/20/30.
- Change: `{"hip-compression-arm-balance": {"req": ["wrist-loading-yoga", "lsit-compression"]}}`.
- Migration: the only dependent is `hip-compression-arm-balance` (repointed). Alias `compression-foundation → lsit-compression`. Remove its `skillPoses.js` entry.
- Source: the tree's own tier text (inference). Rationale: the same exercise as two nodes.

The other three foundations are fine.

### Horizontal Push

**[move · Medium] `pelican-curl`, `hefesto`, `iron-cross`, `iron-cross-fly`, `straight-arm-rto-dip` → Vertical Pull.**
- These are pulling skills. Hefesto and pelican are biceps-led elbow flexion. Steven Low classes a skill as pulling when the centre of mass moves toward the hands, lists the iron cross as a pulling static, and calls the maltese and Victorian borderline. OG2 puts the cross in its Pulling chart and the maltese in Pushing.
- In Horizontal Push the coach schedules them as **push** days: wrong rest-day logic for the biceps/lats. `rto-support-hold`, `rto-dip` and `maltese` stay where they are.
- Change: `{"pelican-curl": {"branch": "Vertical Pull", "req": ["rto-support-hold", "korean-dip"]}, "hefesto": {"branch": "Vertical Pull", "req": ["pelican-curl", "full-bl"]}, "iron-cross-fly": {"branch": "Vertical Pull"}, "straight-arm-rto-dip": {"branch": "Vertical Pull"}, "iron-cross": {"branch": "Vertical Pull"}}`.
- The new prereqs follow the hefesto tutorials: Korean dip and back-lever shoulder extension (calisteniapp; calisthenicsworld asks for a 5 s back lever).
- Sources: https://stevenlow.org/the-fundamentals-of-bodyweight-strength-training/ · https://stevenlow.org/ironcross/ · OG2 charts https://www.calisthenics-101.co.uk/wp-content/uploads/2020/05/Overcoming-Gravity-2nd-Edition-Exercise-Charts.pdf · https://www.gornation.com/blogs/calisthenics-exercises/ring-pelican-bicep-curl · https://calisteniapp.com/articles/hefesto-tutorial
- I rejected a separate "Rings" branch: `BRANCH_CATEGORY` maps one branch to one category, and ring work mixes push and pull.

**[add · High] `ring-dip`.** OG2's ring-dip column runs ring dip negatives → ring dips → … → RTO dips. The r/bodyweightfitness wiki asks for 3×8 bar dips first. The tree jumps from bar dip straight to RTO support and RTO dip.
```json
{"id":"ring-dip","branch":"Horizontal Push","name":"Ring Dip","req":["dip","support-hold"],"unit":"reps","t":[3,8,12],"note":"Rings not turned out. Bar dips 3×8 first; the step before RTO dips"}
```
*(cal.json)*
- Also: `{"rto-dip": {"req": ["rto-support-hold", "ring-dip"]}}`. Pose: reuse `dipBottom`. Add to `GYM_ONLY`.
- Sources: OG2 charts (above) · https://r.datuan.dev/r/bodyweightfitness/wiki/exercises/dip (wiki mirror)

**[note · decided] `ninety-deg-pushup` and `hspu-90` both stay.** I first proposed merging them. Thenx and Gornation use "90° push-up" and "90° HSPU" for the same handstand → 90° → handstand movement. But you confirmed (Q6) that your `ninety-deg-pushup` is the planche-position press from the 90° hold, which is a different skill. Only its note changes, to stop the confusion:
- `{"ninety-deg-pushup": {"note": "2026 goal: 1 clean 90° push-up. From the 90° hold, press up in the planche position and back down — not the handstand version (that is hspu-90)"}}`.
- No change to `req`.

**[cut · Medium, decided] `wide-pushup`, `bulgarian-dip`, `bulgarian-row`.** You left this one to me (Q3).
- **Cut:** these three are pure hand-width changes to an existing node. They gate nothing, and they wouldn't pass the bar a new addition has to meet.
- **Kept:** `chest-dip`, because it gates `archer-dip`.
- **Migration:** nothing `req`s any of the three; none is in `meta.ts`. Remove their `skillPoses.js` entries. No alias: their reps aren't pushup / dip / row reps.

**[cut · High] `planche-program-8wk`.** It is a training block: its tiers are "Block written / 4 weeks in / Block complete". Your own rule (fc2fd11 removed `warmup-protocol`, `skill-session-design`, `deload-and-pain-rules`) says process nodes are clutter.
- Migration: nothing `req`s it; it isn't in `meta.ts`. Remove its `skillPoses.js` entry; orphaned ledger rows are harmless.

**[add · Medium] `elevated-oap`.** OG2 lists "Elevated OA PU" at level 5, between archer push-ups and one-arm negatives. The tree jumps from archer to a full-depth one-arm negative.
```json
{"id":"elevated-oap","branch":"Horizontal Push","name":"Elevated One-Arm Push-Up","req":["archer-pushup"],"unit":"reps","t":[3,6,10],"note":"Hand on a bench or box; lower the surface as it gets easier"}
```
*(cal.json)*
- Also: `{"oap-eccentric": {"req": ["elevated-oap"]}}`. Pose: reuse `pushupOne`. Source: OG2 charts.

**[reorder · Low] `maltese`.** Consider adding `wide-grip-planche` to its `req`: `["full-planche", "iron-cross", "wide-grip-planche"]`. No cycle, because `wide-grip-planche` requires `full-planche`. Not in the tested patch.
- OG2 builds the maltese through RTO and wall maltese push-ups, not a wide planche hold. Only calisthenicsworld describes widening the hands gradually.
- Sources: OG2 · https://calisthenicsworld.org/?p=790

Everything else in this branch is consistent with OG2. The frog / piked-straddle planche steps are discussed under Rejected, and the width-variant cut is above.

### Vertical Push

**[add · High] `straddle-press-negative`.** OG2's press column runs wall straddle press negatives → elevated straddle press → straddle press. The tree goes straight from handstand + pancake to the full press.
```json
{"id":"straddle-press-negative","branch":"Vertical Push","name":"Straddle Press Negative","req":["handstand"],"unit":"reps","t":[1,3,5],"note":"Lower from handstand to straddle stand under control; then elevated presses from a box"}
```
*(cal.json)*
- Also: `{"press-to-handstand": {"req": ["handstand", "pancake", "straddle-press-negative"]}}`. Pose: reuse `pressHS`. Add to `BALANCE`. Source: OG2 charts.

**[add + reorder · High] `straddle-oahs`, `one-arm-handstand`.**
- The real one-arm handstand ladder is: straddle weight shift → fingertip assist → straddle OAHS → legs together. Yuri Marmerstein says legs-together is about 2–3 years beyond the straddle version.
- OG2 keeps the OAHS in its own column, separate from the freestanding HSPU. No source requires a freestanding HSPU or a press first, so the current `req` gates a balance skill behind two unrelated strength skills.
```json
{"id":"straddle-oahs","branch":"Vertical Push","name":"Straddle One-Arm Handstand","req":["handstand"],"unit":"sec","t":[2,5,10],"note":"Straddle weight shift → fingertip assist → free straddle OAHS. Legs-together comes much later"}
```
*(cal.json)*
- Also: `{"one-arm-handstand": {"req": ["straddle-oahs"]}}`. Pose: reuse `handstandOne`. Add to `BALANCE` and to `STRICT`: sources want about a 60 s handstand before one-arm work, and STRICT makes it wait for "in progress" on `handstand`. Thresholds are unsourced.
- Sources: https://lostartofhandbalancing.com/one-arm-handstand-training/ · https://www.gymnasticbodies.com/forum/topic/11279-one-arm-handstand · OG2

**[reorder · Medium] `hspu`, `freestanding-hspu`.** `hspu` (the wall version, after `assisted-hspu`) requires a freestanding `handstand`, so the coach can't give you HSPU strength work until you can balance. OG2 runs the wall HSPU in the pushing column, independent of the free handstand. Move the balance gate to the freestanding version.
- Change: `{"hspu": {"req": ["assisted-hspu"]}, "freestanding-hspu": {"req": ["hspu", "handstand"]}}`. Source: OG2.

**[move · Medium] `crow-pose` → Arm Balances; `assisted-handstand` req → `["pike-pushup"]`.**
- Crow is a yoga arm balance (Kakasana/Bakasana; Yoga Journal's pose type "Arm Balance"), and four Arm Balances nodes already chain off it.
- Hand-balancing coaches say crow builds wrists but doesn't teach handstand balance, so it shouldn't gate `assisted-handstand`.
- The coach is unaffected: `crow-pose` is in `BALANCE`, which overrides branch.
- Sources: https://www.yogajournal.com/pose/crane-pose/ · https://www.skool.com/awesome-ninja-fitness/crow-wont-get-you-a-handstand · https://antranik.org/the-crow-pose/

**[add · Medium] `handstand-walk`.** It's a distinct named skill with its own progressions (CrossFit Journal, Legendary Strength), and the one most handstand trainees meet. The distance thresholds are unsourced.
```json
{"id":"handstand-walk","branch":"Vertical Push","name":"Handstand Walk","req":["freestanding-kickups"],"unit":"m","t":[5,10,20],"note":"Controlled steps, shoulders open, no running to save it"}
```
*(cal.json)*
- Pose: reuse `handstand`. Add to `BALANCE`.
- Sources: http://journal.crossfit.com/2010/12/dogtownhswalk.tpl · https://legendarystrength.com/handstand-articles/how-to-walk-on-your-hands/

**[criteria · Medium, decided] `handstand` t 5/10/20 → 10/30/60 s.** Coaching gates commonly use about 30 s freestanding before HSPU/press work and about 60 s before one-arm work. You chose to move it (Q1).
- Change: `{"handstand": {"t": [10, 30, 60], "note": "Prime goal. 2026: 10s ⭐ (now the unlock), then 30s. 60s is the usual gate before one-arm work. Balance drills first, not just wall time."}}`.
- Effect: a logged 5–9 s handstand drops from unlocked to locked, and anything 10–29 s reads as unlocked instead of in progress. The star and `GOALS` entry are untouched.
- Sources: https://www.strongfirst.com/journey-handstand-push-part-2/ · https://lostartofhandbalancing.com/one-arm-handstand-training/

### Vertical Pull

**[add · High] `ring-muscle-up`.** OG2 lists muscle-ups separately from the strict bar muscle-up. Rings require holding the false grip through the transition, with no regrip; the bar requires getting the chest around it. The tree's `muscle-up` is the bar version (it requires the straight-bar dip), yet `false-grip-transition` (ring-specific) currently feeds only that bar path.
```json
{"id":"ring-muscle-up","branch":"Vertical Pull","name":"Ring Muscle-Up","req":["false-grip-transition","ring-dip","chest-pullup"],"unit":"reps","t":[1,3,5],"note":"False grip held through the transition — no regrip, unlike the bar"}
```
*(cal.json)*
- Pose: reuse `muscleUp`. Add to `GYM_ONLY`.
- Sources: OG2 · https://gmb.io/muscle-up/ · https://dieringe.com/blog/how-to-muscle-up

**[add · Medium] `adv-tuck-human-flag`.** OG2's flag column runs tuck → advanced tuck → straddle → full. The tree jumps from tuck to straddle.
```json
{"id":"adv-tuck-human-flag","branch":"Vertical Pull","name":"Adv. Tuck Human Flag","req":["tuck-human-flag"],"unit":"sec","t":[2,5,8],"note":"Hips open, knees tucked — between tuck and straddle"}
```
*(cal.json)*
- Also: `{"straddle-human-flag": {"req": ["adv-tuck-human-flag"]}}`. Pose: reuse `flagTuck`. Source: OG2.

**[move · Medium] `hanging-leg-raise`, `toes-to-bar` → Core.** `windshield-wipers`, the same hanging pattern, already lives in Core, and these are trunk-flexion skills. In Vertical Pull they eat a **pull** slot and pull rest days. `bar-kip` still `req`s `toes-to-bar`; that's fine across branches. Source: rationale only, no external claim.

**[rename · Low] `dead-hang-human-flag` → name "Vertical Flag".** Antranik's progression starts with the vertical flag (straight arms, body vertical, 20–30 s), and this node's note describes that position. Name only; the id stays.
- Sources: https://antranik.org/human-flag-tutorial/ · OG2

### Horizontal Pull

**[add + reorder · High] `adv-tuck-fl`.** This is the most-cited front-lever step, and the tree has an advanced tuck *row* but no advanced tuck *hold*.
- OG2: tuck FL (level 4) → advanced tuck (level 5) → straddle (6) → half-lay / one-leg (7) → full (8).
- Antranik puts one-leg *after* advanced tuck.
- Your planche and back lever ladders both already have the advanced tuck.
```json
{"id":"adv-tuck-fl","branch":"Horizontal Pull","name":"Adv. Tuck Front Lever","req":["tuck-fl"],"unit":"sec","t":[5,10,15],"note":"Back flat, hips open to 90° — the standard step after the tuck"}
```
*(cal.json)*
- Also: `{"adv-single-leg-tuck-fl": {"req": ["adv-tuck-fl", "single-leg-tuck-fl"]}, "adv-tuck-fl-row": {"req": ["tuck-fl-row", "adv-tuck-fl"]}}`. Pose: reuse `flAdv`.
- The xlsx lists "advanced tucked front lever"; fc2fd11 missed it.
- Sources: OG2 · https://antranik.org/progression-exercises-for-static-holds/

**[cut · Medium] `back-lever-skin-cat-volume`.** It's `skin-the-cat` again at higher reps (3/6/10 vs 1/3/5): a volume prescription, not a skill. Its other prerequisite, `bridge-wheel`, has no source as a back-lever gate; OG2's back-lever column starts from German hang / skin the cat.
- Change: `{"tuck-bl": {"req": ["skin-the-cat"]}}`.
- Migration: the only dependent is `tuck-bl` (repointed). Remove it from `GYM_ONLY` and `skillPoses.js`. Alias it to `skin-the-cat` only if you want its reps to count there.
- Source: OG2.

**[add · Medium] `archer-row`.** OG2 has archer rows at level 4, before one-arm rows, and the r/bodyweightfitness one-arm-row technique thread uses it as the bridge. The tree jumps from inverted row to one-arm row.
```json
{"id":"archer-row","branch":"Horizontal Pull","name":"Archer Row","req":["inverted-row"],"unit":"reps","t":[4,8,12],"note":"Reps per side; the bridge to the one-arm row"}
```
*(cal.json)*
- Also: `{"one-arm-inverted-row": {"req": ["archer-row"]}}`. Pose: reuse `rowTop`.
- Sources: OG2 · https://red.ks32.dev/r/bodyweightfitness/comments/2rr456/technique_thursday_one_arm_inverted_rows

**[cut · Low, optional] `frog-back-lever`, `piked-straddle-back-lever`.** I found no credible source for either step: not OG2, not Antranik. The back lever's advanced-tuck → straddle jump is also smaller than the planche's.
- Change if cut: `{"straddle-bl": {"req": ["adv-tuck-bl"]}}`.
- Migration: dependents are `piked-straddle-back-lever` (cut with it) and `straddle-bl` (repointed). Not in the tested patch; trivially safe. Owner's call.

### Core

**[add · High] `kneeling-ab-rollout`** and **[add · High] `ab-rollout-negative`.** OG2's ab-wheel column runs knees → ramp → eccentric → full, and Legendary Strength runs the same order. The tree goes from a hollow hold straight to the standing rollout (your 2026 goal).
```json
{"id":"kneeling-ab-rollout","branch":"Core","name":"Kneeling Ab Rollout","req":["plank"],"unit":"reps","t":[5,10,15],"note":"Full extension from the knees, hips never sag"}
```
*(cal.json)*
```json
{"id":"ab-rollout-negative","branch":"Core","name":"Standing Rollout Negative","req":["kneeling-ab-rollout","hollow-body"],"unit":"reps","t":[1,3,5],"note":"Roll out from standing to the floor under control, or rollouts up a ramp"}
```
*(cal.json)*
- Also: `{"ab-rollout": {"req": ["ab-rollout-negative"]}}`. Pose: reuse `rollout` for both.
- Sources: OG2 · https://legendarystrength.com/how-to-progress-to-full-rollouts-using-ab-wheel/

**[reorder · Medium] `windshield-wipers`.** Currently `req: ["dragon-flag"]`. Hanging wipers build from hanging knee/leg raises and toes-to-bar (SARCO+, Catalyst Athletics), and no source links them to the dragon flag.
- Change: `{"windshield-wipers": {"req": ["toes-to-bar"]}}`.
- Sources: https://akuaku.org/Sarco+/progression-hanging-leg-raise-progression.html · https://performancemenu.com/article/84/Windshield-Wiper/

**[add · Medium] `high-v-sit`.** OG2 grades the V-sit by angle, from 45° to about 170°, before the manna at level 13. The tree goes from a basic V-sit straight to the tucked manna.
```json
{"id":"high-v-sit","branch":"Core","name":"High V-Sit","req":["v-sit"],"unit":"sec","t":[2,5,10],"note":"Legs well past vertical toward the face, hands still in front — the bridge to manna"}
```
*(cal.json)*
- Also: `{"tucked-manna": {"req": ["high-v-sit"]}}`. Pose: reuse `vSit`. Source: OG2.

**[criteria · Medium] `v-sit` t 1/2/3 → 2/5/10.** The FIG Code requires strength holds to be held 2 s (with a deduction under 2.0 s), so a 1 s unlock is below "it counts". The elite 1–3 s ladders (`maltese` 1/3/5, `victorian-cross` 1/2/3) are consistent with that rule and stay.
- Sources: https://www.gymnastics.sport/publicdir/rules/files/es_%202022-2024%20MAG%20CoP.pdf · https://www.scitepress.org/Papers/2016/60847/60847.pdf

`lsit` 10/20/30 matches the common 30 s floor L-sit gate (Antranik), so no change there.

### Legs

**[reorder · High] `nordic-negative` is gated by `sissy-squat`.** The sissy squat is knee extension (quads); the nordic is eccentric knee flexion (hamstrings), and no hamstring progression uses a quad movement as a step. The r/bodyweightfitness hinge progression is: Romanian deadlift → single-leg deadlift (5–8 reps per leg) → banded nordic negatives → nordic. Its alternate path is eccentric hamstring slides → slides → single-leg slides. Keep `sissy-squat` as the gate for `reverse-nordic-curl`, which is also quad work.
- Change: `{"nordic-negative": {"req": ["nordic-anchor-setup", "single-leg-rdl", "hamstring-slide"]}}`.
- Sources: https://asdjflk.github.io/r/bodyweightfitness/wiki/exercises/hinge (wiki mirror) · Alt et al. 2023, J Athl Train, PMID 35984720 (nordic variations graded 69–154% of standard load)

**[add · High] `single-leg-rdl`, [add · High] `hamstring-slide`, [add · Medium] `single-leg-glute-bridge`.** This is the missing hinge / hip-extension line. The glute bridge is the slide's start position; the single-leg version is also a validated test, the single-leg hamstring bridge (Freckleton 2014, BJSM). Two-leg glute bridges, hip thrusts and back extensions are rejected (Section 3).
```json
{"id":"single-leg-rdl","branch":"Legs","name":"Single-Leg Romanian Deadlift","req":["single-leg-balance"],"unit":"reps","t":[5,8,12],"note":"Bodyweight hinge, reps per leg, back flat, hips square"}
```
*(cal.json)*
```json
{"id":"hamstring-slide","branch":"Legs","name":"Hamstring Slide","req":["single-leg-glute-bridge"],"unit":"reps","t":[3,6,10],"note":"From the bridge top, slide the heels out on socks/sliders. Eccentric first, then full, then single-leg"}
```
*(cal.json)*
```json
{"id":"single-leg-glute-bridge","branch":"Legs","name":"Single-Leg Glute Bridge","kind":"foundation","req":[],"unit":"reps","t":[10,15,25],"note":"Reps per side, hips level, full hip extension at the top"}
```
*(cal.json)*
- Pose for `single-leg-rdl`: **NEW `hingeOne`**. Torso horizontal (pointing left), head neutral, arms hanging straight down, standing leg vertical, free leg extended straight back, level with the torso. Suggested `{ t: 270, hd: -10, a: [180, 180], l: [180, 180], m: [90, 90] }`; tune with `npm run sprites`.
- Pose for `single-leg-glute-bridge` and `hamstring-slide`: **NEW `gluteBridge`**. Supine, shoulders and head on the floor, hips lifted so shoulder–hip–knee is one line. Near thigh angled up from the hips, near shin vertical to the floor, far leg extended straight in line with the torso, arms flat on the floor. Suggested `{ t: 255, hd: 10, a: [100, 95], l: [65, 180], m: [70, 70] }`.
- Thresholds: SL-RDL 5–8 is from the wiki; the bridge and slide numbers are unsourced. I couldn't extract Freckleton's rep norms.
- Sources: wiki hinge page (above) · https://bjsm.bmj.com/content/48/8/713

**[add · High] `bulgarian-split-squat`.** The r/bodyweightfitness squat progression is split squat → Bulgarian split squat (work up to 3×8) → shrimp squat. Shrimp's levels then run beginner (knee and toes down) → intermediate (knee only) → advanced (holding the heel), which fits your starred node. The tree jumps from split squat to shrimp.
```json
{"id":"bulgarian-split-squat","branch":"Legs","name":"Bulgarian Split Squat","req":["split-squat"],"unit":"reps","t":[5,8,12],"note":"Rear foot elevated, reps per leg. 3×8 before shrimp work"}
```
*(cal.json)*
- Also: `{"shrimp-squat": {"req": ["bulgarian-split-squat"]}}`. Pose: reuse `lunge`.
- Source: https://asdjflk.github.io/r/bodyweightfitness/wiki/exercises/squat

**[add · Medium] `vertical-jump`, `broad-jump`, `depth-jump`.** Plyometrics are absent from the tree. NSCA-style progressions go jumps in place → standing jumps → multiple hops → bounds → box drills → depth jumps, with depth jumps last and from low boxes. Landing competency comes first, hence the `safe-landing` prerequisite.
```json
{"id":"vertical-jump","branch":"Legs","name":"Vertical Jump","req":["safe-landing","bw-squat"],"unit":"cm","t":[41,49,57],"note":"Standing jump-and-reach height. Thresholds = adult male 25th/50th/75th percentile"}
```
*(cal.json)*
```json
{"id":"broad-jump","branch":"Legs","name":"Standing Broad Jump","req":["safe-landing","bw-squat"],"unit":"cm","t":[190,210,235],"note":"Two-foot takeoff, stuck landing — no step back counts"}
```
*(cal.json)*
```json
{"id":"depth-jump","branch":"Legs","name":"Depth Jump","req":["vertical-jump","broad-jump"],"tiers":{"u":"Step off a 30 cm box, stick the landing quietly","p":"Step off 30 cm and rebound straight up, short ground contact","m":"Rebound off 45 cm, jump height no lower than your standing jump"},"note":"Highest-intensity plyometric — last in the ladder, low boxes only"}
```
*(cal.json)*
- Thresholds:
  - Vertical jump: Canadian Health Measures Survey, men 20–24, 25th/50th/75th percentile = 41/49/57 cm (via fitnessnorms aggregator; Medium).
  - Broad jump: FitBack norms for 18-year-old males, 186/211/234 cm, rounded (Tomkinson 2023 via aggregator; Low–Medium for adults).
  - Depth jump: tier heights follow the NSCA's low-box guidance.
- Poses: reuse `tuckJump` for the two jumps and `landing` for the depth jump.
- These are in Legs, so the coach will schedule them. If you want them browsable-only, put them in `Acrobatics Foundations` instead.
- Sources: https://us.humankinetics.com/blogs/excerpt/exercise-progressions-to-take-your-workout-to-the-next-level · https://open-exam-prep.com/exams/cscs/exercise-technique/plyometric-speed-training · https://fitnessnorms.pages.dev/strength/vertical-jump/male/age-20-24 · https://fitnessnorms.pages.dev/strength/standing-broad-jump/male/age-18/ · Davies et al. 2015, IJSPT, PMID 26618058

**[criteria · High] `single-leg-balance` t 30/45/60 s eyes open → eyes closed 10/20/30 s.**
- In Springer 2007's unipedal-stance norms, adults 18–39 averaged 44.7 s eyes open against a 45 s cap. Your progress tier sits at the ceiling and mastery is above it.
- The eyes-closed best-of-3 average is about 15 s.
- Change: `{"single-leg-balance": {"name": "Single-Leg Balance (Eyes Closed)", "t": [10, 20, 30]}}`.
- Migration: values already logged eyes-open will read as eyes-closed and overstate. Re-test once.
- Source: https://geriatrictoolkit.missouri.edu/balance/Normative_Values_for_the_Unipedal_Stance_Test_Springer-JGPT.pdf

**[reorder · Medium] `pistol-box-negative` + `ankle-mobility-squat`.** The wiki names ankle dorsiflexion as the usual pistol limiter, but the pistol line never requires it.
- Change: `{"pistol-box-negative": {"req": ["single-leg-balance", "cossack-squat", "ankle-mobility-squat"]}}`.
- Source: the squat wiki page above.

**[add · Medium] `copenhagen-plank`.** This is adductor strength with strong evidence behind it. Ishøi 2016 (RCT) found eccentric adduction strength up 35.7% in 8 weeks. Harøy 2019 (BJSM, 652 players) found 41% lower odds of groin problems. The guideline ladder runs short lever → long lever. It is **not** a middle-split prerequisite (no source), so it gates nothing; it passes on criterion 1. The tier hold times are unsourced.
```json
{"id":"copenhagen-plank","branch":"Legs","name":"Copenhagen Plank","req":["side-plank"],"tiers":{"u":"Short lever (knee on the bench) 3×10 s each side","p":"Long lever (foot on the bench) 3×10 s each side","m":"Long-lever dynamic reps, 8 each side"},"note":"Adductor strength; groin-injury prevention"}
```
*(cal.json)*
- Pose: reuse `sidePlank`.
- Sources: https://www.ucviden.dk/en/publications/large-eccentric-strength-increase-using-the-copenhagen-adduction- · Harøy et al., PMID 29891614 · https://richtlijnendatabase.nl/gerelateerde_documenten/f/28887/Voorbeeld%20preventiestrategie%20acute%20Liesblessure.pdf

`calf-raise` 10/18/30 single-leg is in line with Hébert-Losier 2017 (median of 24 single-leg heel rises; PMID 28886865), so no change there.

### Bar Dynamics

**[rename · High] `geinger` → name "Gienger".** The skill is named after Eberhard Gienger. "Geinger" is the street-workout spelling (GORNATION). Name only; the id stays.
- Sources: https://en.wikipedia.org/wiki/Gienger · https://ighof.com/inductees/2007_Eberhard_Gienger.php

**[add · High] `cast`.** USA Gymnastics' compulsory levels run pullover → cast → back hip circle (Level 1). Cast to horizontal comes at women's Level 4, and baby giant / giant at men's Level 5. `back-hip-circle` already says "cast" in its own unlock tier, and `baby-giant`'s unlock tier is "cast to horizontal", yet the cast isn't a node.
```json
{"id":"cast","branch":"Bar Dynamics","name":"Cast","req":["pullover"],"tiers":{"u":"Hips push off the bar from front support and return","p":"Cast to horizontal, straight arms","m":"Cast above horizontal"},"note":"Starts back hip circles and every giant"}
```
*(cal.json)*
- Also: `{"back-hip-circle": {"req": ["pullover", "cast"]}, "baby-giant": {"req": ["bar-kip", "back-hip-circle", "cast"]}}`. Pose: reuse `hipCircle`.
- Sources: https://usagnj.com/wp-content/uploads/2020/10/proposed-elements-for-the-2021-2029-eleme-nts-for-the-Womens-Compulsory-program.pdf · https://ngja.org/wp-content/uploads/2022/10/HB-COMPULSORY-Routine-Eval-2022-1.pdf

**[reorder · Medium] `geinger` req `["giant","flyaway","swing-360"]` → `["giant","flyaway"]`.** The Gienger is a back salto with a half twist out of a giant, regrasping the bar. The street-workout `swing-360` isn't part of that path.
- Source: Wikipedia Gienger (above).

**[criteria · Low] `swing-360` unlock tier text.** It says "release at the front peak"; Calisteniapp releases the swing 360 at the back of the swing. Check against your own technique before changing.
- Source: https://calisteniapp.com/exercises/360_swing/EX238

The rest is fine. The men's sheet confirms the tap swing → flyaway before giants order. Your `bar-swing` tiers already describe the tap swing.

### Mobility Foundations

**[cut · Medium] `shoulder-mobility-drills`.** Its tiers are "tried / in the weekly routine / open enough": a drill routine, not a testable position. `shoulder-flexion` already covers the outcome.
- Change: `{"shoulder-dislocates": {"req": ["shoulder-flexion"]}}`.
- Migration: the only dependent is `shoulder-dislocates` (repointed). Remove its `skillPoses.js` entry.

**[criteria · Medium] Make `ankle-dorsiflexion`, `shoulder-flexion` and `hip-rotation` tiers observable.** Today several tiers read "in the weekly routine" or "range increasing", which can't be checked. Keep `tiers` (no migration) and rewrite the text with test numbers:
- `ankle-dorsiflexion`: "Knee-to-wall 8 cm / 10 cm / 12 cm". Healthy-adult mean is 11.9 ± 2.7 cm (Hoch 2011); athletes under 10 cm jumped and sprinted worse.
- `shoulder-flexion`: "Back to the wall, ribs down: arms reach 150° / 170° / 180° (thumbs to the wall)". 180° is the textbook normal, and community mean is about 160° (Gill 2020).
- `hip-rotation`: "Seated internal rotation 30° / 40° / 45°, both sides". AAOS normal is about 42° internal / 44° external.
- `thoracic-extension`: I found no credible extension norm. Leave it, or switch to the quadruped lumbar-locked rotation test, where 50° or more counts as unrestricted (Whetstone 2024). Low.
- Sources: https://www.scribd.com/document/476804751/hoch2011-pdf · https://fitnessnorms.pages.dev/flexibility/shoulder-flexion · Gill 2020, PMID 33046038 · https://pmc.ncbi.nlm.nih.gov/articles/PMC4410069/table/T2 · https://ijspt.scholasticahq.com/article/116154

**[criteria · Medium] `active-flexibility-basics`.** As written, it's a method ("end-range contractions understood"), which by your rule is a process node. But static-active flexibility is a measurable capacity (Kurz): the gap between active and passive range. Re-tier it rather than cut it, since four nodes depend on it.
- Suggested tiers: "Active straight-leg raise within 30° of passive / within 20° / within 10°". The active knee-extension literature uses about 20° (active) and 10° (passive) as cut-offs. The exact numbers are mine, so Low on those.
- Source: https://www.koreascience.or.kr/article/JAKO202317752800013.pdf

`deep-squat-hold` 30/60/120 s has no clinical standard; it is plausible, so I left it. `cat-cow` is fine.

### Flexibility

**[criteria · High] Flexibility is measured in seconds held.** `touching-toes`, `pike-compression-stretch`, `pancake`, `middle-split`, `front-split`, `standing-split` and `bridge-wheel` all use sec 10/20/30. Hold time is a training *dose*: Bandy 1997 found 30 s effective and 60 s no better, and ACSM recommends 10–30 s. Every assessment source measures **range**. A 2022 systematic review of gymnastics flexibility tests found them mostly linear (cm). The men's gymnastics tool scores split clearance in cm. Pole-physio programs gate entry levels at within 20 cm and within 5 cm of the floor.

Proposed tiers (each node becomes `tiers`, dropping `unit`/`t`):

| id | u | p | m |
|---|---|---|---|
| touching-toes | Fingertips to the floor, knees straight | Palms flat | Knuckles flat |
| pike-compression-stretch | Chest to thighs with hands at ankles | Chest flat on the thighs | Chest flat, hands past the feet |
| pancake | Elbows to the floor, back flat | Chest to the floor | Chest flat, legs wide, back flat |
| middle-split | Hips ≤ 20 cm from the floor | ≤ 5 cm | Floor, no hands |
| front-split | Hips ≤ 20 cm, hips square | ≤ 5 cm | Floor both sides, square |
| standing-split | Leg at 135° | 160° | 180° |
| bridge-wheel | Straight arms, head off the floor | Shoulders over the wrists | Hands within a hand-length of the heels |

- Confidence: High that seconds is wrong; Medium on the exact cut-offs. The pancake, splits and toes tiers are sourced; the standing-split and wheel tiers are mine (Low).

**Decided (Q2): keep logging in seconds, but define the position a second counts in.**
- The table above would have turned these into ticks and stopped you logging seconds, so it is *not* in the patch.
- Instead each node keeps `unit: "sec"` and `t: [10, 20, 30]`, and its `note` names the end-range position a second only counts in. Thirty seconds at end range is the dose Bandy found effective.
- The early range steps live in the nodes before these (pike compression, middle- and front-split strength).
- No migration; nothing resets.

```json
{"touching-toes": {"note": "Standing forward fold. Seconds count only with palms flat on the floor, knees straight"},
 "pike-compression-stretch": {"note": "Seconds count only with the chest on the thighs, knees straight"},
 "pancake": {"note": "2026 goal: 30s ⭐. Seconds count only with the chest on the floor and the back flat. Unlocks press-to-handstand."},
 "middle-split": {"note": "Seconds count only with the hips on the floor, no hands holding you up"},
 "front-split": {"note": "= Hanumanasana. Seconds count only with the hips on the floor and square, each side"},
 "standing-split": {"note": "Seconds count only with hands on the floor and the raised leg at 160° or more"},
 "bridge-wheel": {"note": "Urdhva Dhanurasana. Seconds count only with straight arms and shoulders stacked over the wrists"}}
```

- Side effect: under this definition your existing logged seconds may overstate, if they were logged short of these positions. Re-test each once.
- Sources: Bandy 1997, PMID 9327823 · https://digibug.ugr.es/handle/10481/72617 · Sleeper 2016, PMID 27999723 · https://www.thepolephysio.com/middles-and-pancakes · https://tom-merrick-sbc2.squarespace.com/blog/how-flexible-are-you

**[reorder · Medium] `middle-split-strength` req `["pancake"]` → `["hip-rotation"]`.** The pancake and the middle split are trained in parallel, and the split needs different muscles. Kurz builds the middle split on the horse stance, progressed by width, not a fixed 60 s hold. Consider rewording that tier too.
- Sources: https://antranik.org/horse-stance/ · https://easyflexibility.com/blogs/flexibility-pearls/if-i-can-do-one-type-of-split-why-can-t-i-do-another-type-of-split-part-2

**[add · Medium] `couch-stretch`.** The front split needs hip-flexor length, but the tree gates it only on pike work (hamstrings).
```json
{"id":"couch-stretch","branch":"Flexibility","name":"Couch Stretch","req":[],"tiers":{"u":"Rear knee at the wall, shin up it, front foot down","p":"Torso upright, glute squeezed, no low-back arch","m":"Upright with the hips fully open — hip flexors never limit a split"},"note":"Hip-flexor length the front split needs; the pike work only covers hamstrings"}
```
*(mob.json)*
- Also: `{"front-split-strength": {"req": ["pike-compression-stretch", "couch-stretch"]}}`. Pose: reuse `lunge`.
- Sources: https://easyflexibility.com/blogs/flexibility-pearls/if-i-can-do-one-split-while-can-t-i-do-another-part-1 · https://library.theprehabguys.com/vimeo-video/couch-stretch-front-split/

**[reorder · Low] `bridge-prep` + `shoulder-flexion`.** Tom Merrick treats shoulder flexion as the bridge's limiter, and the node already exists.
- Change: `{"bridge-prep": {"req": ["camel-pose", "joint-prep-wrists", "shoulder-flexion"]}}`.
- Source: https://tom-merrick-sbc2.squarespace.com/blog/how-flexible-are-you

**[add · Medium] `wheel-dropback`.** Ashtanga's finishing sequence goes Urdhva Dhanurasana → drop-backs → stand-ups. It's the established next rung after the wheel, and the step most backbend curricula take before scorpion-depth spinal extension.
```json
{"id":"wheel-dropback","branch":"Flexibility","name":"Drop-Back to Wheel","req":["bridge-wheel"],"tiers":{"u":"Walk down a wall into wheel","p":"Drop back from standing to wheel, unspotted","m":"Drop back and stand back up"}}
```
*(mob.json)*
- Pose: reuse `wheel`.
- Sources: https://yoga.dasa.ncsu.edu/wp-content/uploads/sites/47/2016/07/Ashtanga-IntermediateSeries.pdf · https://yogainternational.com/article/view/how-to-drop-back-into-urdhva-dhanurasana-from-standing

### Arm Balances

**[add + reorder · Medium] `bhujapidasana`, `firefly-pose`.**
- Bhujapidasana (shoulder-pressing pose) threads the arms the same way as Tittibhasana (firefly), with the thighs on the upper arms. It is in the Ashtanga Primary series, which comes before the Intermediate series that contains Tittibhasana.
- Side crow is not a firefly precursor in either Ashtanga or Iyengar, so the current `req` is wrong.
```json
{"id":"bhujapidasana","branch":"Arm Balances","name":"Shoulder-Press Pose","req":["hip-compression-arm-balance","wrist-loading-yoga"],"unit":"sec","t":[3,6,10],"note":"Bhujapidasana — thighs on the upper arms, ankles crossed; the entry to firefly"}
```
*(mob.json)*
- Also: `{"firefly-pose": {"req": ["bhujapidasana", "hip-compression-arm-balance"]}}`. Pose: reuse `firefly`.
- Sources: https://en.wikipedia.org/wiki/Tittibhasana · the Ashtanga Intermediate PDF above

**[reorder · Medium] `mayurasana` req `["crane-pose"]` → `["elbow-lever", "wrist-loading-yoga"]`.** Peacock uses the same elbows-in-the-belly lever as the elbow lever; the difference is hand position (fingers back). No source names crane as a prerequisite. `elbow-lever` is one of your goals and is untouched; this only makes mayurasana build on it.
- Sources: https://www.yogajournal.com/poses/challenge-pose-mayurasana/ · https://en.wikipedia.org/wiki/Mayurasana

**[reorder · Low] `crane-pose` req `["one-legged-crow"]` → `["crow-pose"]`.** Crane is crow with straightened arms. One-legged crow is a separate variant, not a step.
- Sources: https://en.wikipedia.org/wiki/Bakasana · https://antranik.org/the-crow-pose/

**[reorder · Low] `twist-mobility` req `["wrist-loading-yoga"]` → `[]`.** A seated twist doesn't load the wrists, so this is a logic fix with no source needed.

`wrist-loading-yoga` overlaps `joint-prep-wrists`, but its 5-minute bodyweight-on-hands tier is a distinct, testable step, so I kept it.

### Yoga Holds

**[reorder · High] `hollowback-handstand` req `["scorpion-pose"]` → `["scorpion-pose", "handstand"]`.** Yoga Journal requires a solid handstand (30 s at the wall) and enters the hollowback from the handstand. The star is untouched.
- Source: https://www.yogajournal.com/poses/how-to-practice-hollow-back-handstand/

**[reorder · Medium] `mermaid-pose` req `["king-dance"]` → `["pigeon-stretch", "camel-pose"]`.** Mermaid is a variation of one-legged king pigeon and builds on pigeon plus camel.
- Sources: https://liforme.com/blog/pigeon-pose-variations/ · https://www.yogajournal.com/poses/shoulder-saver

**[add + reorder · Medium] `bow-pose`; `king-dance` req → `["tree-pose", "bow-pose"]`.** Yoga Journal's prep list for Natarajasana is backbend-heavy: bow, camel, one-legged king pigeon. Tree pose is only mentioned in passing as balance practice. Bow is the missing backbend gate, so it earns a node.
```json
{"id":"bow-pose","branch":"Yoga Holds","name":"Bow Pose","req":[],"unit":"sec","t":[15,30,45],"note":"Dhanurasana — ankles held, thighs and chest off the floor"}
```
*(mob.json)*
- Pose: **NEW `bow`**. Prone on the belly. Chest and thighs lifted off the floor, knees bent with the shins pointing up, arms reaching back to hold the ankles, head lifted. Suggested `{ t: 280, hd: -30, a: [100, 60], l: [80, 330] }`; or reuse `camel` as a stand-in.
- Source: https://www.yogajournal.com/poses/lord-of-the-dance-pose/

**[cut · Medium] `warrior-ii`, `chair-pose`.** Your rule: trivial poses earn a node only if they gate something. Neither gates anything, and I found no progression ladder for either. `boat-pose` stays: it has a real ladder (bent-knee → Paripurna → Ardha Navasana) and is distinct from the L-sit. `tree-pose` stays because it gates `king-dance`.
- Migration: nothing `req`s either. Remove both `skillPoses.js` entries.
- Confidence is Medium because "no ladder" is a negative finding resting on your own rule.
- Source: https://en.wikipedia.org/wiki/Navasana

### Acrobatics Foundations

**[cut/merge · High] `no-handed-cartwheel` = `aerial`; `aerial-drills` becomes a real step.** Gymnastics and coaching sources define the aerial cartwheel as the no-handed cartwheel, and USA Gymnastics calls it the side aerial. The real ladder is fast cartwheel → one-handed cartwheel → aerial off a raised panel mat → aerial on the floor. Today `aerial-drills` is a drill bucket ("every drill in the aerial toolbox owned").
- Change: cut `no-handed-cartwheel`, plus `{"aerial-drills": {"name": "Aerial Lead-Ups", "req": ["cartwheel-pop"], "tiers": {"u": "One-handed cartwheel, both sides", "p": "Aerial off a raised panel mat or downhill, unspotted", "m": "Raised-surface aerial lands every time — ready for flat ground"}}}`.
- The id is kept, and its meaning ("aerial drills") still fits.
- Migration: `no-handed-cartwheel`'s only dependent was `aerial-drills` (repointed). Alias `no-handed-cartwheel → aerial`. Remove its `skillPoses.js` entry.
- Sources: https://gymnasticshq.com/how-to-do-an-aerial-cartwheel/ · https://legendarystrength.com/how-to-do-a-no-handed-cartwheel/ · USA Gymnastics compulsory PDF (above)

**[add · High] `bridge-kickover`, `front-handspring`, `back-walkover`.** These are the USA Gymnastics compulsory foundations:
- Level 2: bridge back kickover.
- Level 3: round-off back handspring.
- Level 4: front handspring step-out, back walkover.
- Level 5: front tuck.

The kickover is the foundation before the back handspring. The front handspring, not the backflip, gates the front tuck. The back walkover runs parallel to the back handspring and is a standard named skill.
```json
{"id":"bridge-kickover","branch":"Acrobatics Foundations","name":"Bridge Kickover","req":["bridge-wheel"],"tiers":{"u":"Kickover from bridge with a spot or off a raised surface","p":"From a bridge on flat ground, one leg leads over","m":"Handstand down to bridge, kick back over"}}
```
*(mov.json)*
```json
{"id":"front-handspring","branch":"Acrobatics Foundations","name":"Front Handspring","req":["cartwheel","wall-handstand"],"tiers":{"u":"Front handspring over a block or with a spot","p":"Front handspring step-out on flat ground","m":"Two-foot landing, rebound ready for a front tuck"}}
```
*(mov.json)*
```json
{"id":"back-walkover","branch":"Acrobatics Foundations","name":"Back Walkover","req":["bridge-kickover","wall-handstand"],"tiers":{"u":"Back walkover with a spot","p":"Unspotted, legs split through handstand","m":"Connected, straight arms, filmed"}}
```
*(mov.json)*
- Also: `{"back-handspring": {"req": ["roundoff", "bridge-kickover"]}, "front-flip": {"req": ["front-handspring", "jump-tuck-landing"]}}`. The front-flip change is listed again under Flips & Twists.
- Poses: reuse `handstandArch` (kickover, walkover) and `handspring` (front handspring).
- Sources: USA Gymnastics compulsory PDF · https://thegymnasticsguide.com/breaking-down-level-4-floor/ · https://childrenshospital.org/sites/default/files/2024-06/sports-injury-return-to-gymnastics-protocol.pdf

### Kicks

No findings. The kick chain (round, crescent, hook → tornado / pop 360 → cheat 540 → 540 hook → hyperhook / jackknife / cheat 900, plus pop 540 / 720) matches Loopkicks' spin-kick families. The prerequisites are sensible.

### Flips & Twists

**[reorder · High] `moon-kick` req `["butterfly-kick"]` → `["gainer"]`.** The moon kick is a gainer-family trick ("a gainer with a hook kick"), and Loopkicks files it under gainers.
- Sources: https://en.wikipedia.org/wiki/Moon_kick · https://www.loopkickstricking.com/tricktionary/backward-tricks

**[add · Medium + reorder · High] `cheat-gainer`; `corkscrew` req `["aerial","backflip"]` → `["cheat-gainer","b-twist"]`.** The cork takes off from one foot out of a cheat, like gainers and unlike backflips; the aerial has nothing to do with it. Tricking-reference lists cheat gainer + butterfly twist as its prerequisites, and Flashmavi says learn the gainer first.
```json
{"id":"cheat-gainer","branch":"Flips & Twists","name":"Cheat Gainer","req":["trampoline-spotting","tornado-kick"],"tiers":{"u":"First landed cheat gainer (spotted / soft ground)","p":"3 in a row unassisted","m":"Clean in a filmed line"},"note":"The cork's real entry: one-foot takeoff out of a cheat"}
```
*(mov.json)*
- Pose: reuse `flipBack`.
- Sources: Loopkicks backward tricks (above) · https://tricking-reference.vercel.app/corkscrew · https://www.flashmavi.com/learn/corkscrew-capoeira-xma-wushu · https://www.blackbeltdrills.com/tricking-1/videos/weaver-cheat-gainer

**[reorder · Medium] `butterfly-kick` req `["aerial"]` → `["crescent-kick"]`.** The b-kick is called the easiest Wushu jump kick, and the Parkour Wiki uses it as a step *toward* the aerial, not after it.
- Sources: https://www.flashmavi.com/learn/wushu-butterfly-kick · https://parkour.fandom.com/wiki/Aerial

**[reorder · Medium] `raiz` req `["aerial"]` → `["tornado-kick", "cartwheel"]`.** Loopkicks puts the raiz in Outside tricks and the aerial in Inside tricks, and the raiz setup is "exactly like the 540".
- Sources: https://www.loopkickstricking.com/tricktionary/outside-tricks · https://lalaue.com/moves/raiz/

**[reorder · Medium] `macaco` req `["kip-up"]` → `["bridge-wheel", "cartwheel"]`.** Macaco courses build on thoracic mobility, elevated bridges and hip extension; the kip-up never appears.
- Sources: https://faridherrera.thinkific.com/courses/macacocourse · https://lalaue.com/moves/macaco/

`front-flip` req `["backflip"]` → `["front-handspring", "jump-tuck-landing"]` is the same change listed under Acrobatics Foundations (counted once). Tricking sources disagree on which flip comes first, but none requires the backflip, and gymnastics puts the front tuck after the front handspring.

### Breaking

**[add + reorder · Medium] `double-leg-circles`; `flare` req `["windmills","full-planche"]` → `["v-sit","double-leg-circles"]`.**
- Coach Sommer on the GymnasticBodies forum: "circles first are a must". Another member adds "you dont need a planche".
- Wikipedia gives double-leg circles on a mushroom as the flare progression.
- Requiring a full planche (elite) for a flare isn't how anyone learns it. No source made windmills a prerequisite either.
```json
{"id":"double-leg-circles","branch":"Breaking","name":"Double-Leg Circles","req":["lsit"],"tiers":{"u":"Circles on a mushroom or floor with a spot","p":"5 continuous circles","m":"Circles with the legs straddling — the flare's base"}}
```
*(mov.json)*
- Pose: reuse `flare`.
- Sources: https://www.gymnasticbodies.com/forum/topic/176-flares-where-to-start · https://en.wikipedia.org/wiki/Flare_(acrobatic_move)

**[add + reorder · Medium] `two-thousand`; `nineties` req `["backspin","one-arm-handstand"]` → `["two-thousand"]`.** Bboy Dojo calls the 2000 easier than its predecessor, the 1990. Its 1990 tutorial never asks for a static one-arm hold. A dream-tier OAHS gate makes the 1990 effectively unreachable.
```json
{"id":"two-thousand","branch":"Breaking","name":"2000 (Stacked-Hand Spin)","req":["handstand"],"tiers":{"u":"One rotation with hands stacked","p":"3 continuous rotations","m":"In a power-move set, filmed"}}
```
*(mov.json)*
- Pose: reuse `nineties`.
- Sources: https://bboydojo.com/breaking-training/how-to-do-2000s/ · https://bboydojo.com/breaking-training/how-to-do-1990s/

**[add · Medium] `go-downs`.** Red Bull's judging criteria name "Top Rock steps, Go Downs, Footwork, Freezes, Power Moves and Transitions" as the foundation. The tree has every element except go-downs, and your combo-reel tiers already expect an "entry".
```json
{"id":"go-downs","branch":"Breaking","name":"Go-Downs","req":["toprock"],"tiers":{"u":"One go-down from toprock into footwork","p":"Three different go-downs on the beat","m":"Go-downs flow straight into footwork in a round"},"note":"Drops from toprock to the floor (knee drop, sweep, baseball slide)"}
```
*(mov.json)*
- Also: `{"combo-reel-30s": {"req": ["six-step", "windmills", "freeze-basics", "go-downs"]}}`. Pose: reuse `sixStep`.
- Sources: https://www.redbull.com/us-en/judges-criteria-breaking-competitions · https://littlevillagemag.com/breaking/

Lead checked: **`power-move-conditioning` stays.** Baby mills and nutcracker windmills are windmill *variations* learned after windmills, so they can't replace it. Bboy Focus's windmill course itself opens with a "Stage Zero" of building blocks.
- Sources: https://en.wikipedia.org/wiki/Windmill_(breakdancing_move) · https://bboydojo.com/breaking-training/how-to-do-baby-windmills/ · https://learn.bboydojo.com/how-to-windmill/

### Dance

**[add · High] `popping-hit`.** Popping "is centered around" the hit, and Steezy's starter plan runs hits → arm waves → body waves → gliding. The branch's illusion line (waves, glides, airwalk) comes out of popping, but the hit is missing.
```json
{"id":"popping-hit","branch":"Dance","name":"Hit (Pop)","req":["dance-musicality"],"tiers":{"u":"Clean arm and chest hits on the beat","p":"Hits through the whole body, on 1 and 3 or every beat","m":"Hits land exactly on the music at any tempo"},"note":"The foundation popping is built on"}
```
*(mov.json)*
- Pose: reuse `music`.
- Sources: https://en.wikipedia.org/wiki/Popping · https://www.steezy.co/posts/everything-you-need-to-start-your-popping-training

**[add + reorder · Medium] `side-glide`; `moonwalk` req `["body-wave"]` → `["side-glide"]`.** Steezy teaches the backslide without any waving. Dance Spirit says to master the side glide first.
```json
{"id":"side-glide","branch":"Dance","name":"Side Glide","req":[],"tiers":{"u":"Side glide one direction, 2 m","p":"Both directions, smooth to music","m":"In a filmed reel"}}
```
*(mov.json)*
- Pose: reuse `glide`.
- Sources: https://www.steezy.co/posts/how-to-do-the-moonwalk-backslide · https://dancespirit.com/learn_the_glide/

### Movement arts: families you asked for (Q5)

These are real families, but no existing node needed them. Prerequisite sourcing is thinner than in the rest of the report, so several are Low. Each says where its `req` comes from.

**[add · Medium] `touchdown-raiz`.** Tricking-reference lists the TDR at its Beginner tier with "Raiz" as the prerequisite. Wikipedia calls it a powerful setup for advanced tricks.
```json
{"id":"touchdown-raiz","branch":"Flips & Twists","name":"Touchdown Raiz","req":["raiz"],"tiers":{"u":"First touchdown raiz, hand down, landed","p":"3 in a row","m":"Used as a setup into another trick, filmed"},"note":"TDR — the raiz with a hand touch; a setup for advanced outside tricks"}
```
*(mov.json)*
- Pose: reuse `macaco`, which is the pose `raiz` uses.
- Sources: https://tricking-reference.vercel.app/touchdown-raiz · https://en.wikipedia.org/wiki/Tricking_(martial_arts)

**[add · Low] `sideswipe`.** Tricking-reference lists it at Beginner tier and the Tricking Bible groups it as an invert-kick trick. Its prerequisites are behind a paywall, so the `req` (tornado kick + cartwheel) is my inference.
```json
{"id":"sideswipe","branch":"Flips & Twists","name":"Sideswipe","req":["tornado-kick","cartwheel"],"tiers":{"u":"First landed sideswipe (soft ground)","p":"3 in a row","m":"Clean in a filmed line"},"note":"Beginner-tier invert-kick trick"}
```
*(mov.json)*
- Pose: reuse `aerial`.
- Sources: https://tricking-reference.vercel.app/ · https://www.scribd.com/doc/253449097/The-Tricking-Bible

**[add · Low] `double-leg`.** It's the capoeira armada dupla: both legs kick through a spinning takeoff. Lalaue says the raiz's technique is similar to the armada dupla and rates the double leg advanced. Tricking-reference uses "good Doubleleg" as the prerequisite for the doubleleg hook. The `req` (raiz + tornado kick) is my inference from those.
```json
{"id":"double-leg","branch":"Flips & Twists","name":"Double Leg","req":["raiz","tornado-kick"],"tiers":{"u":"First landed double leg","p":"3 in a row","m":"Clean in a filmed line"},"note":"Capoeira armada dupla — both legs kick through a spinning takeoff; base of the cheat 720 double leg"}
```
*(mov.json)*
- Pose: reuse `kick540`.
- Sources: https://en.wikipedia.org/wiki/Double_Leg_(trick) · https://lalaue.com/moves/armada-dupla/ · https://lalaue.com/moves/raiz/

**[add · Low] `trick-combo`.** Loopkicks treats transitions (swingthrough, vanish…) as how tricks link, not as tricks, so this is one milestone for linking, not one node per transition. The `req` and tiers are mine.
```json
{"id":"trick-combo","branch":"Flips & Twists","name":"First Linked Combo","req":["cheat-540","butterfly-kick"],"tiers":{"u":"Two tricks linked by a swingthrough or vanish, no reset step","p":"Three tricks linked, same direction","m":"Filmed combo of four or more using two different transitions"}}
```
*(mov.json)*
- Pose: reuse `reel`.
- Sources: https://www.loopkickstricking.com/tricktionary/transitions · https://en.wikipedia.org/wiki/Tricking_(martial_arts)

**[add · Medium] `turtles`, [add · Low] `crickets`, [add · Medium] `jackhammer`.**
- Bboy Dojo says turtles are "technically a float", that people commonly begin with the turtle freeze (already in `freeze-basics`), and that the handstand is the basis of any turtle.
- It calls the cricket "a type of float" and says you should already be able to do a cricket before a jackhammer.
- Turtles → crickets is my inference from both being floats: Low.
```json
{"id":"turtles","branch":"Breaking","name":"Turtles","req":["freeze-basics"],"tiers":{"u":"Turtle freeze walked through a half rotation","p":"One full rotation on the hands","m":"3 continuous rotations"}}
```
*(mov.json)*
```json
{"id":"crickets","branch":"Breaking","name":"Crickets","req":["turtles"],"tiers":{"u":"Float held, first hand-to-hand turns","p":"One full rotation","m":"3 continuous rotations"}}
```
*(mov.json)*
```json
{"id":"jackhammer","branch":"Breaking","name":"Jackhammer","req":["crickets"],"tiers":{"u":"First one-hand hop rotation","p":"One full rotation on one hand","m":"3 continuous rotations, filmed"}}
```
*(mov.json)*
- Pose: reuse `freeze` for all three. A dedicated float pose (elbows in the abdomen, body horizontal on the hands, like `elbowLever` with knees tucked) would read better; optional.
- Sources: https://bboydojo.com/breaking-training/how-to-do-turtles/ · https://bboydojo.com/breaking-training/how-to-do-jackhammers/ · https://en.wikipedia.org/wiki/Float_(breakdancing_move)

**[add · Medium] `lock-point`, [add · Medium] `wrist-roll`, [add · Low] `scooby-doo`.** This is a locking sub-line in Dance.
- Campbellock names the Lock (Uplock), the Points and Wrist Rolls among Don Campbell's moves, "now considered as the fundamental moves of Locking".
- The Scooby Doo (credited to Jimmy "Scoo B Doo" Foster) is sourced only from community glossaries.
```json
{"id":"lock-point","branch":"Dance","name":"Lock & Point","req":["dance-musicality"],"tiers":{"u":"Clean lock (the uplock) and point on the beat","p":"Lock-point combos for 8 counts both sides","m":"Locks and points hit with character in a freestyle, filmed"},"note":"Don Campbell's fundamentals of locking"}
```
*(mov.json)*
```json
{"id":"wrist-roll","branch":"Dance","name":"Wrist Roll","req":["lock-point"],"tiers":{"u":"Wrist rolls travelling up the body","p":"Wrist roll into a point on the beat","m":"Rolls used as accents in a locking routine"}}
```
*(mov.json)*
```json
{"id":"scooby-doo","branch":"Dance","name":"Scooby Doo","req":["lock-point"],"tiers":{"u":"Muscle-man lock then two kicks, slow","p":"On the beat, both sides","m":"In a locking routine, filmed"},"note":"Credited to Jimmy \"Scoo B Doo\" Foster"}
```
*(mov.json)*
- Poses: reuse `music` (lock & point, scooby doo) and `wave` (wrist roll).
- Sources: https://campbellock.dance/about-locking/the-campbellock-aka-locking-moves/ · https://en.wikipedia.org/wiki/Locking_(dance) · https://www.steezy.co/posts/what-is-locking

### Cross-cutting: coach metadata (`core/meta.ts`)

**[meta · High, decided] `GYM_ONLY` rebuilt for your home kit (Q7).** Home is a pull-up bar, parallettes, an ab wheel, a 5 kg assistance band, and 2.5 / 5 kg dumbbells; everything else is at the gym.
- **Add** (rings, dip bars or a low bar):
  - `hefesto`
  - `ring-dip` (new)
  - `ring-muscle-up` (new)
  - `korean-dip`, which needs a hip-height bar or dip bars
  - `assisted-inverted-row`, `inverted-row`, `archer-row` (new) and `one-arm-inverted-row`, which need a low bar or rings; a pull-up bar is too high
- **Remove:**
  - `support-hold`: parallettes give you a support hold at home.
  - `back-lever-skin-cat-volume` (cut) and `bulgarian-row` (cut). `bulgarian-row` was never in the list.
- **Unchanged, but worth knowing:**
  - `weighted-pullup` (5/15/30 kg) stays home-trainable for the unlock only. Your dumbbells top out around 5–10 kg on a belt, so beyond that it's a gym lift.
  - **Doorway bar (confirmed):** the whole back-lever line (`tuck-bl` to `full-bl`) and the front-lever rows and pull-up (`tuck-fl-row`, `adv-tuck-fl-row`, `straddle-fl-row`, `full-fl-row`, `fl-pullup`) are now in `GYM_ONLY`, because a doorway bar has no clearance for the body to swing level beneath it. The front-lever holds themselves stay home-trainable. `adv-tuck-human-flag` is also gym-only, like the rest of the flag line.
- **Decided (Q8):** plyometrics stay in Legs and get scheduled on leg days. `depth-jump` needs only a 30–45 cm step or box, so it stays home-trainable.

**[meta · Medium] `BALANCE` and `STRICT`.**
- Add the new handstand-line nodes `straddle-press-negative`, `straddle-oahs` and `handstand-walk` to `BALANCE`, so they're scheduled as balance (like `press-to-handstand`), not pressing.
- Add `straddle-oahs` to `STRICT`, so it opens only once `handstand` is "in progress".

No `BRANCH_CATEGORY` change: every addition lands in an existing branch. `GOALS` and every `star` are untouched. One star node, `shrimp-squat`, and one goal node, `elbow-lever` (via `mayurasana`), gain or feed new prerequisite edges; neither changes what you're aiming at.

## 3. Rejected candidates

| Candidate | Source of the lead | Why dropped |
|---|---|---|
| Close / wide / neutral / towel / frenchie / arched-back pull-ups, knee-to-elbow push-up, sphinx push-up | xlsx | Grip, width or tempo variations: fail all three criteria. |
| Mantle chin/pull-up, finger- or towel-assisted one-arm pulls | xlsx | Assistance variants of the existing one-arm negatives. |
| Tuck / straddle front-lever pull-ups, ice cream makers | xlsx | Variations between existing FL row and FL pull-up nodes; no gap. |
| Bodyweight curl, Y / T raises, face pull, bodyweight skull crusher, chest fly | xlsx; "pull isolation looks thin" lead | Accessories. Steven Low's conditioning advice for straight arms is German hangs and support holds; "curls before planche" came only from a forum user. Nothing in the tree depends on them. The lead is right that isolation is thin, but that isn't a skill gap. |
| Two-leg glute bridge, hip thrust, back extension, reverse hyper | xlsx; hinge lead | Two-leg bridge is trivial (single-leg chosen). None of the calisthenics progressions I checked uses back extensions or reverse hypers, and they need gym equipment. |
| Step-up → deep step-up | r/bodyweightfitness alternate pistol path | Real (High), but it's an *alternate* route; the tree already bridges to the pistol via box negatives and cossacks. |
| Box jump, pogo hops, bounding | plyometric literature | Box height is equipment-dependent and measures the same quality as the vertical jump; pogos and bounds are low-intensity drills, not milestones. |
| Wall sit, sprints | xlsx | Not on the path to any tree skill. |
| Handstand shrugs, handstand / headstand leg raise | xlsx | Accessory drills. |
| Pike press, tuck (bent-arm) press | OG2 | Real distinct skills (OG2 level 9 / 5), but your press goal is straddle and nothing depends on them. Add the pike press later if you want it. |
| Ring planche as its own node | OG2 (level 14) | Real but much harder than the floor planche; no node depends on it. Maltese work already implies rings. |
| Cutting `frog-planche`, `piked-straddle-planche` | Research found them niche | Inconsistently defined (Gymless puts the frog before advanced tuck; Bodyweight Training Arena matches your order). But advanced tuck → straddle is the biggest wall in planche training, and micro-steps there are useful. Kept, unlike the back-lever pair. |
| Front walkover, front hip circle, clear hip circle, front giant, cast to handstand | USA Gymnastics levels | Real compulsory skills, but none gates a node in the tree (back giants, flyaways, Gienger). |
| Forearm wheel (Dwi Pada Viparita Dandasana), Kapotasana, Warrior III, half moon | Yoga backbend / balance ladders | Real, but no source makes them prerequisites for any tree node; the drop-back covers the next backbend rung. |
| Tricking transitions as nodes (swingthrough, vanish, missleg…) | Loopkicks | Loopkicks treats them as a classification of how tricks link, not as milestones. Covered instead by the single `trick-combo` milestone. |
| Gainer switch | Loopkicks | Real, but not in the families you asked for (Q5); the sideswipe, touchdown raiz and double leg were added. |
| Baby mills, nutcracker windmill | windmill lead | Variations learned *after* the windmill. |
| Coffee grinder | Bboy Dojo | Called a "gateway" to flares by one source only; the footwork node covers it. |
| Headstand / shoulder freezes | Wikipedia | Freeze variants inside the existing freeze nodes. |
| Fresno, dime stop, groove / bounce | dance sources | Medium-Low sourcing; nothing here depends on them. (The locking line was added per Q5.) |
| Bar "tornado 360" | Calisteniapp | Single app source. |
| Cutting `power-move-conditioning`, `boat-pose`, `wrist-loading-yoga` | Your leads / my first pass | See their sections: each turned out to be a real step or testable. |

**On the xlsx.** The unknown-author sheet (~300 rows, organised by movement pattern with muscle groups) is clearly where fc2fd11 drew its push-up dands, dip family, Makarov and dragon squats. Diffing it against the current tree, almost everything it lists is either already in the tree or a variation. Its genuine residual leads, each verified independently above, were the advanced tuck front lever, the Bulgarian split squat and the "bodyweight leg curl" (hamstring slide). Its frog front lever and frog / piked-straddle back levers are the steps I couldn't source.

## 4. Owner decisions (answered 2026-11-06)

| # | Question | Your answer | What it changed |
|---|---|---|---|
| 1 | Handstand 5/10/20 s or the coaching gates? | Move it | `handstand` t → 10/30/60, note updated. |
| 2 | Flexibility in range tiers or seconds? | My choice, but you log in seconds | Seconds kept. Each of the seven notes now names the end-range position a second counts in. No reset. |
| 3 | Keep the width/lean variants? | My choice | Cut `wide-pushup`, `bulgarian-dip`, `bulgarian-row`. Kept `chest-dip` (gates `archer-dip`). |
| 4 | Alias map or lose progress on merged ids? | Don't mind | Alias only `no-handed-cartwheel → aerial` (same value type). Everything else is cut without an alias. |
| 5 | Add the movement-arts families? | Yes | Ten nodes: touchdown raiz, sideswipe, double leg, first linked combo; turtles → crickets → jackhammer; lock & point, wrist roll, scooby doo. |
| 6 | What is your 90° push-up? | The planche-position press from the 90° hold | No merge; `hspu-90` stays. `ninety-deg-pushup` note clarified. |
| 7 | Rings at home? | Home: pull-up bar, parallettes, ab wheel, 5 kg band, 2.5/5 kg dumbbells | `GYM_ONLY` rebuilt (see coach metadata): rows, Korean dip and ring work go in; `support-hold` comes out. |
| 8 | Plyometrics in the coach? | Yes | They stay in Legs. |

**Resolved after this table:** your home bar is a doorway bar (see coach metadata), and you approved the full patch, which has been applied.

## Appendix A: the tested patch

Apply order: removals, then field changes (merged into the existing node), then additions. Then add the pose map entries, then the three new poses, using the suggested joint angles. These are stand-ins: tune them with `npm run sprites`. Then update `core/meta.ts` (GYM_ONLY / BALANCE / STRICT as above), then `npm run validate`, then `npm run core`. Applied to a scratch copy of the repo, the validator reported: `347 skills in the unified tree — ok`.

```json
{
  "remove": [
    "planche-program-8wk",
    "back-lever-skin-cat-volume",
    "no-handed-cartwheel",
    "compression-foundation",
    "warrior-ii",
    "chair-pose",
    "shoulder-mobility-drills",
    "wide-pushup",
    "bulgarian-dip",
    "bulgarian-row"
  ],
  "change": {
    "hip-compression-arm-balance": {
      "req": [
        "wrist-loading-yoga",
        "lsit-compression"
      ]
    },
    "shoulder-dislocates": {
      "req": [
        "shoulder-flexion"
      ]
    },
    "tuck-bl": {
      "req": [
        "skin-the-cat"
      ]
    },
    "aerial-drills": {
      "name": "Aerial Lead-Ups",
      "req": [
        "cartwheel-pop"
      ],
      "tiers": {
        "u": "One-handed cartwheel, both sides",
        "p": "Aerial off a raised panel mat or downhill, unspotted",
        "m": "Raised-surface aerial lands every time — ready for flat ground"
      }
    },
    "ninety-deg-pushup": {
      "note": "2026 goal: 1 clean 90° push-up. From the 90° hold, press up in the planche position and back down — not the handstand version (that is hspu-90)"
    },
    "pelican-curl": {
      "branch": "Vertical Pull",
      "req": [
        "rto-support-hold",
        "korean-dip"
      ]
    },
    "hefesto": {
      "branch": "Vertical Pull",
      "req": [
        "pelican-curl",
        "full-bl"
      ]
    },
    "iron-cross-fly": {
      "branch": "Vertical Pull"
    },
    "straight-arm-rto-dip": {
      "branch": "Vertical Pull"
    },
    "iron-cross": {
      "branch": "Vertical Pull"
    },
    "rto-dip": {
      "req": [
        "rto-support-hold",
        "ring-dip"
      ]
    },
    "oap-eccentric": {
      "req": [
        "elevated-oap"
      ]
    },
    "press-to-handstand": {
      "req": [
        "handstand",
        "pancake",
        "straddle-press-negative"
      ]
    },
    "one-arm-handstand": {
      "req": [
        "straddle-oahs"
      ]
    },
    "assisted-handstand": {
      "req": [
        "pike-pushup"
      ]
    },
    "crow-pose": {
      "branch": "Arm Balances"
    },
    "hspu": {
      "req": [
        "assisted-hspu"
      ]
    },
    "freestanding-hspu": {
      "req": [
        "hspu",
        "handstand"
      ]
    },
    "hanging-leg-raise": {
      "branch": "Core"
    },
    "toes-to-bar": {
      "branch": "Core"
    },
    "windshield-wipers": {
      "req": [
        "toes-to-bar"
      ]
    },
    "adv-single-leg-tuck-fl": {
      "req": [
        "adv-tuck-fl",
        "single-leg-tuck-fl"
      ]
    },
    "adv-tuck-fl-row": {
      "req": [
        "tuck-fl-row",
        "adv-tuck-fl"
      ]
    },
    "one-arm-inverted-row": {
      "req": [
        "archer-row"
      ]
    },
    "ab-rollout": {
      "req": [
        "ab-rollout-negative"
      ]
    },
    "tucked-manna": {
      "req": [
        "high-v-sit"
      ]
    },
    "v-sit": {
      "t": [
        2,
        5,
        10
      ]
    },
    "nordic-negative": {
      "req": [
        "nordic-anchor-setup",
        "single-leg-rdl",
        "hamstring-slide"
      ]
    },
    "shrimp-squat": {
      "req": [
        "bulgarian-split-squat"
      ]
    },
    "pistol-box-negative": {
      "req": [
        "single-leg-balance",
        "cossack-squat",
        "ankle-mobility-squat"
      ]
    },
    "single-leg-balance": {
      "name": "Single-Leg Balance (Eyes Closed)",
      "t": [
        10,
        20,
        30
      ]
    },
    "middle-split-strength": {
      "req": [
        "hip-rotation"
      ]
    },
    "front-split-strength": {
      "req": [
        "pike-compression-stretch",
        "couch-stretch"
      ]
    },
    "bridge-prep": {
      "req": [
        "camel-pose",
        "joint-prep-wrists",
        "shoulder-flexion"
      ]
    },
    "firefly-pose": {
      "req": [
        "bhujapidasana",
        "hip-compression-arm-balance"
      ]
    },
    "mayurasana": {
      "req": [
        "elbow-lever",
        "wrist-loading-yoga"
      ]
    },
    "crane-pose": {
      "req": [
        "crow-pose"
      ]
    },
    "twist-mobility": {
      "req": []
    },
    "hollowback-handstand": {
      "req": [
        "scorpion-pose",
        "handstand"
      ]
    },
    "mermaid-pose": {
      "req": [
        "pigeon-stretch",
        "camel-pose"
      ]
    },
    "king-dance": {
      "req": [
        "tree-pose",
        "bow-pose"
      ]
    },
    "back-handspring": {
      "req": [
        "roundoff",
        "bridge-kickover"
      ]
    },
    "front-flip": {
      "req": [
        "front-handspring",
        "jump-tuck-landing"
      ]
    },
    "butterfly-kick": {
      "req": [
        "crescent-kick"
      ]
    },
    "raiz": {
      "req": [
        "tornado-kick",
        "cartwheel"
      ]
    },
    "macaco": {
      "req": [
        "bridge-wheel",
        "cartwheel"
      ]
    },
    "moon-kick": {
      "req": [
        "gainer"
      ]
    },
    "corkscrew": {
      "req": [
        "cheat-gainer",
        "b-twist"
      ]
    },
    "nineties": {
      "req": [
        "two-thousand"
      ]
    },
    "flare": {
      "req": [
        "v-sit",
        "double-leg-circles"
      ]
    },
    "combo-reel-30s": {
      "req": [
        "six-step",
        "windmills",
        "freeze-basics",
        "go-downs"
      ]
    },
    "moonwalk": {
      "req": [
        "side-glide"
      ]
    },
    "geinger": {
      "name": "Gienger",
      "req": [
        "giant",
        "flyaway"
      ]
    },
    "back-hip-circle": {
      "req": [
        "pullover",
        "cast"
      ]
    },
    "baby-giant": {
      "req": [
        "bar-kip",
        "back-hip-circle",
        "cast"
      ]
    },
    "straddle-human-flag": {
      "req": [
        "adv-tuck-human-flag"
      ]
    },
    "handstand": {
      "t": [
        10,
        30,
        60
      ],
      "note": "Prime goal. 2026: 10s ⭐ (now the unlock), then 30s. 60s is the usual gate before one-arm work. Balance drills first, not just wall time."
    },
    "touching-toes": {
      "note": "Standing forward fold. Seconds count only with palms flat on the floor, knees straight"
    },
    "pike-compression-stretch": {
      "note": "Seconds count only with the chest on the thighs, knees straight"
    },
    "pancake": {
      "note": "2026 goal: 30s ⭐. Seconds count only with the chest on the floor and the back flat. Unlocks press-to-handstand."
    },
    "middle-split": {
      "note": "Seconds count only with the hips on the floor, no hands holding you up"
    },
    "front-split": {
      "note": "= Hanumanasana. Seconds count only with the hips on the floor and square, each side"
    },
    "standing-split": {
      "note": "Seconds count only with hands on the floor and the raised leg at 160° or more"
    },
    "bridge-wheel": {
      "note": "Urdhva Dhanurasana. Seconds count only with straight arms and shoulders stacked over the wrists"
    }
  },
  "add": [
    {
      "family": "cal",
      "node": {
        "id": "adv-tuck-fl",
        "branch": "Horizontal Pull",
        "name": "Adv. Tuck Front Lever",
        "req": [
          "tuck-fl"
        ],
        "unit": "sec",
        "t": [
          5,
          10,
          15
        ],
        "note": "Back flat, hips open to 90° — the standard step after the tuck"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "ring-dip",
        "branch": "Horizontal Push",
        "name": "Ring Dip",
        "req": [
          "dip",
          "support-hold"
        ],
        "unit": "reps",
        "t": [
          3,
          8,
          12
        ],
        "note": "Rings not turned out. Bar dips 3×8 first; the step before RTO dips"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "elevated-oap",
        "branch": "Horizontal Push",
        "name": "Elevated One-Arm Push-Up",
        "req": [
          "archer-pushup"
        ],
        "unit": "reps",
        "t": [
          3,
          6,
          10
        ],
        "note": "Hand on a bench or box; lower the surface as it gets easier"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "straddle-press-negative",
        "branch": "Vertical Push",
        "name": "Straddle Press Negative",
        "req": [
          "handstand"
        ],
        "unit": "reps",
        "t": [
          1,
          3,
          5
        ],
        "note": "Lower from handstand to straddle stand under control; then elevated presses from a box"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "straddle-oahs",
        "branch": "Vertical Push",
        "name": "Straddle One-Arm Handstand",
        "req": [
          "handstand"
        ],
        "unit": "sec",
        "t": [
          2,
          5,
          10
        ],
        "note": "Straddle weight shift → fingertip assist → free straddle OAHS. Legs-together comes much later"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "handstand-walk",
        "branch": "Vertical Push",
        "name": "Handstand Walk",
        "req": [
          "freestanding-kickups"
        ],
        "unit": "m",
        "t": [
          5,
          10,
          20
        ],
        "note": "Controlled steps, shoulders open, no running to save it"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "ring-muscle-up",
        "branch": "Vertical Pull",
        "name": "Ring Muscle-Up",
        "req": [
          "false-grip-transition",
          "ring-dip",
          "chest-pullup"
        ],
        "unit": "reps",
        "t": [
          1,
          3,
          5
        ],
        "note": "False grip held through the transition — no regrip, unlike the bar"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "adv-tuck-human-flag",
        "branch": "Vertical Pull",
        "name": "Adv. Tuck Human Flag",
        "req": [
          "tuck-human-flag"
        ],
        "unit": "sec",
        "t": [
          2,
          5,
          8
        ],
        "note": "Hips open, knees tucked — between tuck and straddle"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "archer-row",
        "branch": "Horizontal Pull",
        "name": "Archer Row",
        "req": [
          "inverted-row"
        ],
        "unit": "reps",
        "t": [
          4,
          8,
          12
        ],
        "note": "Reps per side; the bridge to the one-arm row"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "kneeling-ab-rollout",
        "branch": "Core",
        "name": "Kneeling Ab Rollout",
        "req": [
          "plank"
        ],
        "unit": "reps",
        "t": [
          5,
          10,
          15
        ],
        "note": "Full extension from the knees, hips never sag"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "ab-rollout-negative",
        "branch": "Core",
        "name": "Standing Rollout Negative",
        "req": [
          "kneeling-ab-rollout",
          "hollow-body"
        ],
        "unit": "reps",
        "t": [
          1,
          3,
          5
        ],
        "note": "Roll out from standing to the floor under control, or rollouts up a ramp"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "high-v-sit",
        "branch": "Core",
        "name": "High V-Sit",
        "req": [
          "v-sit"
        ],
        "unit": "sec",
        "t": [
          2,
          5,
          10
        ],
        "note": "Legs well past vertical toward the face, hands still in front — the bridge to manna"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "bulgarian-split-squat",
        "branch": "Legs",
        "name": "Bulgarian Split Squat",
        "req": [
          "split-squat"
        ],
        "unit": "reps",
        "t": [
          5,
          8,
          12
        ],
        "note": "Rear foot elevated, reps per leg. 3×8 before shrimp work"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "single-leg-glute-bridge",
        "branch": "Legs",
        "name": "Single-Leg Glute Bridge",
        "kind": "foundation",
        "req": [],
        "unit": "reps",
        "t": [
          10,
          15,
          25
        ],
        "note": "Reps per side, hips level, full hip extension at the top"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "hamstring-slide",
        "branch": "Legs",
        "name": "Hamstring Slide",
        "req": [
          "single-leg-glute-bridge"
        ],
        "unit": "reps",
        "t": [
          3,
          6,
          10
        ],
        "note": "From the bridge top, slide the heels out on socks/sliders. Eccentric first, then full, then single-leg"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "single-leg-rdl",
        "branch": "Legs",
        "name": "Single-Leg Romanian Deadlift",
        "req": [
          "single-leg-balance"
        ],
        "unit": "reps",
        "t": [
          5,
          8,
          12
        ],
        "note": "Bodyweight hinge, reps per leg, back flat, hips square"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "vertical-jump",
        "branch": "Legs",
        "name": "Vertical Jump",
        "req": [
          "safe-landing",
          "bw-squat"
        ],
        "unit": "cm",
        "t": [
          41,
          49,
          57
        ],
        "note": "Standing jump-and-reach height. Thresholds = adult male 25th/50th/75th percentile"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "broad-jump",
        "branch": "Legs",
        "name": "Standing Broad Jump",
        "req": [
          "safe-landing",
          "bw-squat"
        ],
        "unit": "cm",
        "t": [
          190,
          210,
          235
        ],
        "note": "Two-foot takeoff, stuck landing — no step back counts"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "depth-jump",
        "branch": "Legs",
        "name": "Depth Jump",
        "req": [
          "vertical-jump",
          "broad-jump"
        ],
        "tiers": {
          "u": "Step off a 30 cm box, stick the landing quietly",
          "p": "Step off 30 cm and rebound straight up, short ground contact",
          "m": "Rebound off 45 cm, jump height no lower than your standing jump"
        },
        "note": "Highest-intensity plyometric — last in the ladder, low boxes only"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "copenhagen-plank",
        "branch": "Legs",
        "name": "Copenhagen Plank",
        "req": [
          "side-plank"
        ],
        "tiers": {
          "u": "Short lever (knee on the bench) 3×10 s each side",
          "p": "Long lever (foot on the bench) 3×10 s each side",
          "m": "Long-lever dynamic reps, 8 each side"
        },
        "note": "Adductor strength; groin-injury prevention"
      }
    },
    {
      "family": "cal",
      "node": {
        "id": "cast",
        "branch": "Bar Dynamics",
        "name": "Cast",
        "req": [
          "pullover"
        ],
        "tiers": {
          "u": "Hips push off the bar from front support and return",
          "p": "Cast to horizontal, straight arms",
          "m": "Cast above horizontal"
        },
        "note": "Starts back hip circles and every giant"
      }
    },
    {
      "family": "mob",
      "node": {
        "id": "couch-stretch",
        "branch": "Flexibility",
        "name": "Couch Stretch",
        "req": [],
        "tiers": {
          "u": "Rear knee at the wall, shin up it, front foot down",
          "p": "Torso upright, glute squeezed, no low-back arch",
          "m": "Upright with the hips fully open — hip flexors never limit a split"
        },
        "note": "Hip-flexor length the front split needs; the pike work only covers hamstrings"
      }
    },
    {
      "family": "mob",
      "node": {
        "id": "wheel-dropback",
        "branch": "Flexibility",
        "name": "Drop-Back to Wheel",
        "req": [
          "bridge-wheel"
        ],
        "tiers": {
          "u": "Walk down a wall into wheel",
          "p": "Drop back from standing to wheel, unspotted",
          "m": "Drop back and stand back up"
        }
      }
    },
    {
      "family": "mob",
      "node": {
        "id": "bow-pose",
        "branch": "Yoga Holds",
        "name": "Bow Pose",
        "req": [],
        "unit": "sec",
        "t": [
          15,
          30,
          45
        ],
        "note": "Dhanurasana — ankles held, thighs and chest off the floor"
      }
    },
    {
      "family": "mob",
      "node": {
        "id": "bhujapidasana",
        "branch": "Arm Balances",
        "name": "Shoulder-Press Pose",
        "req": [
          "hip-compression-arm-balance",
          "wrist-loading-yoga"
        ],
        "unit": "sec",
        "t": [
          3,
          6,
          10
        ],
        "note": "Bhujapidasana — thighs on the upper arms, ankles crossed; the entry to firefly"
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "bridge-kickover",
        "branch": "Acrobatics Foundations",
        "name": "Bridge Kickover",
        "req": [
          "bridge-wheel"
        ],
        "tiers": {
          "u": "Kickover from bridge with a spot or off a raised surface",
          "p": "From a bridge on flat ground, one leg leads over",
          "m": "Handstand down to bridge, kick back over"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "back-walkover",
        "branch": "Acrobatics Foundations",
        "name": "Back Walkover",
        "req": [
          "bridge-kickover",
          "wall-handstand"
        ],
        "tiers": {
          "u": "Back walkover with a spot",
          "p": "Unspotted, legs split through handstand",
          "m": "Connected, straight arms, filmed"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "front-handspring",
        "branch": "Acrobatics Foundations",
        "name": "Front Handspring",
        "req": [
          "cartwheel",
          "wall-handstand"
        ],
        "tiers": {
          "u": "Front handspring over a block or with a spot",
          "p": "Front handspring step-out on flat ground",
          "m": "Two-foot landing, rebound ready for a front tuck"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "cheat-gainer",
        "branch": "Flips & Twists",
        "name": "Cheat Gainer",
        "req": [
          "trampoline-spotting",
          "tornado-kick"
        ],
        "tiers": {
          "u": "First landed cheat gainer (spotted / soft ground)",
          "p": "3 in a row unassisted",
          "m": "Clean in a filmed line"
        },
        "note": "The cork's real entry: one-foot takeoff out of a cheat"
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "two-thousand",
        "branch": "Breaking",
        "name": "2000 (Stacked-Hand Spin)",
        "req": [
          "handstand"
        ],
        "tiers": {
          "u": "One rotation with hands stacked",
          "p": "3 continuous rotations",
          "m": "In a power-move set, filmed"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "double-leg-circles",
        "branch": "Breaking",
        "name": "Double-Leg Circles",
        "req": [
          "lsit"
        ],
        "tiers": {
          "u": "Circles on a mushroom or floor with a spot",
          "p": "5 continuous circles",
          "m": "Circles with the legs straddling — the flare's base"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "go-downs",
        "branch": "Breaking",
        "name": "Go-Downs",
        "req": [
          "toprock"
        ],
        "tiers": {
          "u": "One go-down from toprock into footwork",
          "p": "Three different go-downs on the beat",
          "m": "Go-downs flow straight into footwork in a round"
        },
        "note": "Drops from toprock to the floor (knee drop, sweep, baseball slide)"
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "popping-hit",
        "branch": "Dance",
        "name": "Hit (Pop)",
        "req": [
          "dance-musicality"
        ],
        "tiers": {
          "u": "Clean arm and chest hits on the beat",
          "p": "Hits through the whole body, on 1 and 3 or every beat",
          "m": "Hits land exactly on the music at any tempo"
        },
        "note": "The foundation popping is built on"
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "side-glide",
        "branch": "Dance",
        "name": "Side Glide",
        "req": [],
        "tiers": {
          "u": "Side glide one direction, 2 m",
          "p": "Both directions, smooth to music",
          "m": "In a filmed reel"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "touchdown-raiz",
        "branch": "Flips & Twists",
        "name": "Touchdown Raiz",
        "req": [
          "raiz"
        ],
        "tiers": {
          "u": "First touchdown raiz, hand down, landed",
          "p": "3 in a row",
          "m": "Used as a setup into another trick, filmed"
        },
        "note": "TDR — the raiz with a hand touch; a setup for advanced outside tricks"
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "sideswipe",
        "branch": "Flips & Twists",
        "name": "Sideswipe",
        "req": [
          "tornado-kick",
          "cartwheel"
        ],
        "tiers": {
          "u": "First landed sideswipe (soft ground)",
          "p": "3 in a row",
          "m": "Clean in a filmed line"
        },
        "note": "Beginner-tier invert-kick trick"
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "double-leg",
        "branch": "Flips & Twists",
        "name": "Double Leg",
        "req": [
          "raiz",
          "tornado-kick"
        ],
        "tiers": {
          "u": "First landed double leg",
          "p": "3 in a row",
          "m": "Clean in a filmed line"
        },
        "note": "Capoeira armada dupla — both legs kick through a spinning takeoff; base of the cheat 720 double leg"
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "trick-combo",
        "branch": "Flips & Twists",
        "name": "First Linked Combo",
        "req": [
          "cheat-540",
          "butterfly-kick"
        ],
        "tiers": {
          "u": "Two tricks linked by a swingthrough or vanish, no reset step",
          "p": "Three tricks linked, same direction",
          "m": "Filmed combo of four or more using two different transitions"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "turtles",
        "branch": "Breaking",
        "name": "Turtles",
        "req": [
          "freeze-basics"
        ],
        "tiers": {
          "u": "Turtle freeze walked through a half rotation",
          "p": "One full rotation on the hands",
          "m": "3 continuous rotations"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "crickets",
        "branch": "Breaking",
        "name": "Crickets",
        "req": [
          "turtles"
        ],
        "tiers": {
          "u": "Float held, first hand-to-hand turns",
          "p": "One full rotation",
          "m": "3 continuous rotations"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "jackhammer",
        "branch": "Breaking",
        "name": "Jackhammer",
        "req": [
          "crickets"
        ],
        "tiers": {
          "u": "First one-hand hop rotation",
          "p": "One full rotation on one hand",
          "m": "3 continuous rotations, filmed"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "lock-point",
        "branch": "Dance",
        "name": "Lock & Point",
        "req": [
          "dance-musicality"
        ],
        "tiers": {
          "u": "Clean lock (the uplock) and point on the beat",
          "p": "Lock-point combos for 8 counts both sides",
          "m": "Locks and points hit with character in a freestyle, filmed"
        },
        "note": "Don Campbell's fundamentals of locking"
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "wrist-roll",
        "branch": "Dance",
        "name": "Wrist Roll",
        "req": [
          "lock-point"
        ],
        "tiers": {
          "u": "Wrist rolls travelling up the body",
          "p": "Wrist roll into a point on the beat",
          "m": "Rolls used as accents in a locking routine"
        }
      }
    },
    {
      "family": "mov",
      "node": {
        "id": "scooby-doo",
        "branch": "Dance",
        "name": "Scooby Doo",
        "req": [
          "lock-point"
        ],
        "tiers": {
          "u": "Muscle-man lock then two kicks, slow",
          "p": "On the beat, both sides",
          "m": "In a locking routine, filmed"
        },
        "note": "Credited to Jimmy \"Scoo B Doo\" Foster"
      }
    }
  ],
  "poses": {
    "adv-tuck-fl": "flAdv",
    "ring-dip": "dipBottom",
    "elevated-oap": "pushupOne",
    "straddle-press-negative": "pressHS",
    "straddle-oahs": "handstandOne",
    "handstand-walk": "handstand",
    "ring-muscle-up": "muscleUp",
    "adv-tuck-human-flag": "flagTuck",
    "archer-row": "rowTop",
    "kneeling-ab-rollout": "rollout",
    "ab-rollout-negative": "rollout",
    "high-v-sit": "vSit",
    "bulgarian-split-squat": "lunge",
    "single-leg-glute-bridge": "gluteBridge",
    "hamstring-slide": "gluteBridge",
    "single-leg-rdl": "hingeOne",
    "vertical-jump": "tuckJump",
    "broad-jump": "tuckJump",
    "depth-jump": "landing",
    "copenhagen-plank": "sidePlank",
    "cast": "hipCircle",
    "couch-stretch": "lunge",
    "wheel-dropback": "wheel",
    "bow-pose": "bow",
    "bhujapidasana": "firefly",
    "bridge-kickover": "handstandArch",
    "back-walkover": "handstandArch",
    "front-handspring": "handspring",
    "cheat-gainer": "flipBack",
    "two-thousand": "nineties",
    "double-leg-circles": "flare",
    "go-downs": "sixStep",
    "popping-hit": "music",
    "side-glide": "glide",
    "touchdown-raiz": "macaco",
    "sideswipe": "aerial",
    "double-leg": "kick540",
    "trick-combo": "reel",
    "turtles": "freeze",
    "crickets": "freeze",
    "jackhammer": "freeze",
    "lock-point": "music",
    "wrist-roll": "wave",
    "scooby-doo": "music"
  },
  "newPoses": {
    "gluteBridge": "{ t: 255, hd: 10, a: [100, 95], l: [65, 180], m: [70, 70], props: [F] }",
    "hingeOne": "{ t: 270, hd: -10, a: [180, 180], l: [180, 180], m: [90, 90], props: [F] }",
    "bow": "{ t: 280, hd: -30, a: [100, 60], l: [80, 330], props: [F] }"
  },
  "meta": {
    "GYM_ONLY_add": [
      "hefesto",
      "ring-dip",
      "ring-muscle-up",
      "korean-dip",
      "assisted-inverted-row",
      "inverted-row",
      "archer-row",
      "one-arm-inverted-row"
    ],
    "GYM_ONLY_remove": [
      "support-hold",
      "back-lever-skin-cat-volume"
    ],
    "BALANCE_add": [
      "straddle-press-negative",
      "straddle-oahs",
      "handstand-walk"
    ],
    "STRICT_add": [
      "straddle-oahs"
    ],
    "foldArbor_alias": {
      "no-handed-cartwheel": "aerial"
    }
  }
}
```
