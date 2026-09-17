// Ranked-choice counts from ballot rankings. One module for both sides: the
// loader (scripts/elections/load.mjs) counts every contest with it, and the
// simulator recounts in the browser when a reader removes a candidate, so the
// two can never disagree.
//
// A profile is one distinct ranking and how many ballots cast it:
// [ballots, first choice, second choice, …], candidates by index. The loader
// has already applied the ballot rules: a skipped rank is passed over, an
// overvote ends the ballot there, a candidate ranked twice counts at the
// higher rank, and every write-in is one candidate.
//
// The count is a single-winner instant runoff: each round, each ballot counts
// for its highest-ranked candidate still in; a candidate with more than half
// of those votes wins; otherwise the last-place candidate is out. A tie for
// last goes to the candidate who trailed in the latest round where they
// differed, then to the one with fewer first choices. Cities differ in small
// ways (San Francisco drops every hopeless candidate at once, New York drops
// write-ins first), which change a round count far more often than a winner.

export type Profile = number[]

export type Round = {
  /** Votes per candidate this round; null once a candidate is out. */
  votes: (number | null)[]
  /** Ballots with no candidate left to count for. */
  exhausted: number
  /** The candidate eliminated after this round; null in the last. */
  out: number | null
}

export type Count = {
  rounds: Round[]
  /** -1 when every candidate was removed. */
  winner: number
  /** Most first choices among the candidates in the count. */
  leader: number
}

export function instantRunoff(candidates: number, profiles: Profile[], removed: ReadonlySet<number> = new Set()): Count {
  const inCount = Array.from({ length: candidates }, (_, i) => !removed.has(i))
  const rounds: Round[] = []
  let leader = -1
  for (;;) {
    const votes = new Array<number>(candidates).fill(0)
    let exhausted = 0
    for (const p of profiles) {
      let counted = false
      for (let k = 1; k < p.length; k++) {
        if (inCount[p[k]]) {
          votes[p[k]] += p[0]
          counted = true
          break
        }
      }
      if (!counted) exhausted += p[0]
    }
    const shown = votes.map((v, i) => (inCount[i] ? v : null))
    const standing = votes.flatMap((_, i) => (inCount[i] ? [i] : []))
    if (!standing.length) {
      rounds.push({ votes: shown, exhausted, out: null })
      return { rounds, winner: -1, leader: -1 }
    }
    const top = standing.reduce((a, b) => (votes[b] > votes[a] ? b : a))
    if (leader < 0) leader = top
    const total = standing.reduce((s, i) => s + votes[i], 0)
    if (standing.length <= 2 || votes[top] * 2 > total) {
      rounds.push({ votes: shown, exhausted, out: null })
      return { rounds, winner: top, leader }
    }
    const out = standing.reduce((a, b) => (trails(b, a, votes, rounds) ? b : a))
    rounds.push({ votes: shown, exhausted, out })
    inCount[out] = false
  }
}

/** Whether candidate a is behind candidate b for elimination. */
function trails(a: number, b: number, votes: number[], earlier: Round[]) {
  if (votes[a] !== votes[b]) return votes[a] < votes[b]
  for (let r = earlier.length - 1; r >= 0; r--) {
    const va = earlier[r].votes[a] ?? 0
    const vb = earlier[r].votes[b] ?? 0
    if (va !== vb) return va < vb
  }
  // Candidates are indexed by first choices, most first.
  return a > b
}

/**
 * Head-to-head: wins[i][j] is how many ballots rank i above j, counting a
 * ranked candidate above an unranked one.
 */
export function headToHead(candidates: number, profiles: Profile[]): number[][] {
  const wins = Array.from({ length: candidates }, () => new Array<number>(candidates).fill(0))
  const ranked = new Uint8Array(candidates)
  for (const p of profiles) {
    ranked.fill(0)
    for (let k = 1; k < p.length; k++) {
      const i = p[k]
      for (let j = 0; j < candidates; j++) if (!ranked[j] && j !== i) wins[i][j] += p[0]
      ranked[i] = 1
    }
  }
  return wins
}

/** The candidate who beats every other head to head, or -1. */
export function condorcetWinner(wins: number[][], removed: ReadonlySet<number> = new Set()): number {
  const n = wins.length
  for (let i = 0; i < n; i++) {
    if (removed.has(i)) continue
    let beatsAll = true
    for (let j = 0; j < n && beatsAll; j++) if (j !== i && !removed.has(j) && wins[i][j] <= wins[j][i]) beatsAll = false
    if (beatsAll) return i
  }
  return -1
}
