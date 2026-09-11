// Consensus: opinion gathered at scale on one question.
//
// A conversation is a set of statements people vote on — agree, disagree or
// pass — and the engine reads the vote matrix for the groups hiding in it.
// GovBlock owns every surface here; the clustering is Polis's, reached over
// its API (see ~/Code/long-poll for the evaluation and the headless spike).
//
// The conversations themselves are in Aurora (lib/consensus/store.ts, since
// 2026-09-11); the first eight were CompDem's own published data
// (github.com/compdemocracy/openData), so these pages could be built against
// rooms that actually clustered rather than a test with one participant.
//
// Polarity, which everything depends on: in the published export 1 is agree
// and -1 is disagree; over the API those are reversed. Both are normalised
// into named fields here so nothing downstream has to remember which is which.

export type Tally = {
  agree: number
  disagree: number
  pass: number
  /** How many people were shown the statement at all. */
  seen: number
}

export type Statement = {
  tid: number
  text: string
  /** 1 accepted, 0 not yet looked at, -1 pulled by a moderator. */
  moderated: number
  votes: Tally
  byGroup: Record<string, Tally>
}

export type Conversation = {
  slug: string
  title: string
  topic: string
  description: string
  source: string | null
  stats: {
    views: number
    voters: number
    commenters: number
    statements: number
    groups: number
    votes: number
  }
  groups: { id: number; size: number }[]
  statements: Statement[]
}

/** Shares of the people who saw a statement, as percentages that sum to 100. */
export function share(t: Tally) {
  if (!t.seen) return { agree: 0, disagree: 0, pass: 0 }
  const agree = (t.agree / t.seen) * 100
  const disagree = (t.disagree / t.seen) * 100
  return { agree, disagree, pass: 100 - agree - disagree }
}

/**
 * How far apart the groups are on a statement: the widest gap between any two
 * groups' rates of agreement. This is what "divisive" means — not that the
 * room is split down the middle, but that which group you are in predicts
 * your answer. A statement everyone half-agrees with is uncertain, not
 * divisive.
 */
export function divisiveness(s: Statement) {
  const rates = Object.values(s.byGroup)
    .filter((t) => t.seen >= 5)
    .map((t) => share(t).agree)
  if (rates.length < 2) return 0
  return Math.max(...rates) - Math.min(...rates)
}

/**
 * How much the groups agree with each other. The lowest rate of agreement in
 * any group, so a statement only scores when no group dissents — the honest
 * bar for "we all think this", and the reason a bare majority is not it.
 */
export function agreement(s: Statement) {
  const rates = Object.values(s.byGroup)
    .filter((t) => t.seen >= 5)
    .map((t) => share(t).agree)
  if (!rates.length) return share(s.votes).agree
  return Math.min(...rates)
}

/**
 * The statements a reader should be shown: everything a moderator accepted or
 * has not looked at yet. Only -1 is pulled — 1 means accepted, which is the
 * opposite of how it reads, and treating it as "hidden" silently drops every
 * approved statement in the conversation (caught 2026-09-10, before shipping).
 */
export const standing = (s: Statement) => s.moderated >= 0 && s.votes.seen >= 10

/** Statements everyone agrees on, strongest first. */
export function consensusStatements(c: Conversation, limit = 6) {
  return [...c.statements]
    .filter(standing)
    .sort((a, b) => agreement(b) - agreement(a))
    .slice(0, limit)
}

/** Statements that split the groups, widest gap first. */
export function divisiveStatements(c: Conversation, limit = 6) {
  return [...c.statements]
    .filter(standing)
    .sort((a, b) => divisiveness(b) - divisiveness(a))
    .slice(0, limit)
}
