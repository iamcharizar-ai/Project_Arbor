// Tiny subsequence fuzzy matcher shared by Search (Ctrl+K) and the PR log.
export function score(query, text) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let qi = 0, s = 0, streak = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++
      streak++
      s += 1 + streak * 0.5 + (ti === 0 || t[ti - 1] === ' ' ? 2 : 0)
    } else streak = 0
  }
  return qi === q.length ? s : -1
}

export function findSkills(skills, query, limit = 12) {
  if (!query.trim()) return []
  return skills
    .map((k) => ({ k, s: score(query, `${k.name} ${k.branch}`) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.k)
}
