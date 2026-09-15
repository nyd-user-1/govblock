import MEMBERS from "@/lib/data/members-us.json"

// What the /gdelt demo reads out of the text GDELT hands back — the sentences
// that name the bill and the TV captions — without another call to anyone.
// A demo's analysis (Brendan, 2026-09-15: "feign a sentiment analysis"): word
// lists, not a model. Each function takes plain text and is cheap enough to run
// on every render of a static snapshot.

/* ------------------------------------------------------------ sentiment */

const WORDS: Record<string, number> = {
  // against
  fail: -2, failed: -2, fails: -2, failure: -2, stall: -1, stalled: -1, die: -2, died: -2, dead: -2, kill: -2, killed: -2,
  block: -1, blocked: -1, oppose: -1, opposed: -1, opposes: -1, assault: -3, attack: -2, attacks: -2, suppress: -3, suppression: -3,
  disenfranchise: -3, disenfranchised: -3, endanger: -2, endangering: -2, risk: -1, risks: -1, controversial: -1, restrictions: -1,
  restrict: -1, restrictive: -2, disappointing: -2, disappointed: -2, criminals: -3, fraud: -2, chaos: -2, crisis: -2, threat: -2,
  dangerous: -2, reject: -2, rejected: -2, refused: -1, protest: -1, veto: -1, thorn: -1, blame: -2, blames: -2, criticized: -2,
  impossible: -2, burden: -2, confusion: -1, purge: -2, wrong: -2, lie: -2, lies: -2, false: -2, damage: -2, harm: -2, disaster: -2,
  hobby: -1, sweeping: -1, strict: -1, deny: -2, denied: -2, lawsuit: -1, unconstitutional: -3, extreme: -2, scheme: -2, cruel: -3,
  // for
  support: 2, supports: 2, supported: 2, praised: 2, praise: 2, protect: 2, protects: 2, secure: 2, security: 1, integrity: 2,
  overwhelming: 1, passed: 1, win: 2, won: 2, success: 2, bipartisan: 2, fair: 2, trust: 2, confidence: 2, safeguard: 1,
  important: 1, reform: 1, reforms: 1, strengthen: 2, champion: 2, commonsense: 2, simple: 1, fundamental: 1, approved: 1,
  advance: 1, advanced: 1, signed: 1, victory: 2, hope: 1, benefit: 2, improve: 2, legal: 1, ensure: 1, honest: 2,
}
const NEGATORS = new Set(["not", "no", "never", "couldn't", "didn't", "don't", "won't", "can't", "cannot", "wouldn't", "without"])

export type Mood = "negative" | "neutral" | "positive"

/** A word-list score: each weighted word counts, flipped when a negator sits within three words before it. */
export function sentiment(text: string): { score: number; mood: Mood; hits: string[] } {
  const words = text.toLowerCase().replace(/[’]/g, "'").match(/[a-z']+/g) ?? []
  let score = 0
  const hits: string[] = []
  words.forEach((word, i) => {
    const weight = WORDS[word]
    if (!weight) return
    const negated = words.slice(Math.max(0, i - 3), i).some((w) => NEGATORS.has(w))
    score += negated ? -weight : weight
    hits.push(negated ? `not ${word}` : word)
  })
  return { score, mood: score <= -1 ? "negative" : score >= 1 ? "positive" : "neutral", hits }
}

/* -------------------------------------------------------------- framing */

// How a sentence frames the bill: as protecting elections, or as keeping
// people from voting. The patterns are the phrases each side's coverage uses.
export const FRAMES = [
  {
    key: "integrity",
    label: "Election integrity",
    patterns: [/election integrity/i, /legal citizens?/i, /secure elections?/i, /non-?citizens? (voting|from voting|vote)/i, /illegal (aliens|immigrants)/i, /common ?sense/i, /voter id/i, /photo id/i],
  },
  {
    key: "access",
    label: "Voting access",
    patterns: [/suppress/i, /disenfranchis/i, /voting restrictions?/i, /restrict(ive|ions)/i, /sweeping voting laws/i, /rights of millions/i, /voting rights/i, /so-called/i, /millions of (americans|voters|eligible)/i, /mail(-in)? voting/i],
  },
] as const

export function frames(text: string) {
  return FRAMES.map((f) => ({ key: f.key, terms: f.patterns.map((p) => text.match(p)?.[0]).filter((t): t is string => Boolean(t)) })).filter((f) => f.terms.length)
}

/* --------------------------------------------------------------- status */

// What the coverage says has happened to the bill.
const STALLED = /(couldn'?t|could not|failed to|fail to|unable to|refused to) (pass|persuade|sign)|\bstall(ed|s)?\b|to die\b|\bdied\b|\bdead\b|\bblocked\b|to no avail|filibuster/i
const MOVING = /\b(passed the (house|senate)|signed into law|advanced|cleared the|approved by)\b/i
const STATE_LEVEL = /\bstate'?s version\b|\bstate legislature\b|\bin (south dakota|texas|florida|ohio|missouri|kansas|utah|idaho|montana)\b/i

export function status(text: string): "stalled" | "moving" | "state" | null {
  if (STATE_LEVEL.test(text)) return "state"
  if (STALLED.test(text)) return "stalled"
  if (MOVING.test(text)) return "moving"
  return null
}

/* -------------------------------------------------------------- members */

type Member = { people_id: number; name: string; first_name: string; last_name: string; party: string; role: string; district: string | null; active: boolean }

// Last names that are also ordinary capitalised words ("Justice Department").
const COMMON = new Set(["Justice", "Banks", "Rose", "Bishop", "King", "Hill", "Frost", "Crane", "Carter", "Price", "Hunt", "Bell", "Guest", "Strong", "Sessions", "Wild", "Moore", "Scott", "Young", "Green", "Graves", "Miller", "Johnson"])

const ACTIVE = (MEMBERS as Member[]).filter((m) => m.active)
const LAST_COUNTS = ACTIVE.reduce((m, x) => m.set(x.last_name, (m.get(x.last_name) ?? 0) + 1), new Map<string, number>())

/** The sitting members of Congress a text names: the full name, or a last name only one member has. */
export function membersNamed(text: string) {
  return ACTIVE.filter((m) => {
    if (text.includes(m.name) || text.includes(`${m.first_name} ${m.last_name}`)) return true
    if (LAST_COUNTS.get(m.last_name) !== 1 || m.last_name.length < 5 || COMMON.has(m.last_name)) return false
    return new RegExp(`\\b(Rep\\.|Sen\\.|Senator|Representative|Speaker|Leader)?\\s*${m.last_name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}('s)?\\b`).test(text)
  }).map((m) => ({ id: m.people_id, name: m.name, party: m.party, role: m.role, district: m.district }))
}

/** The members a lower-case TV caption names in full ("senator mike lee"). */
export function membersInCaption(caption: string) {
  const text = caption.toLowerCase()
  return ACTIVE.filter((m) => text.includes(`${m.first_name} ${m.last_name}`.toLowerCase())).map((m) => ({ id: m.people_id, name: m.name, party: m.party, role: m.role, district: m.district }))
}
