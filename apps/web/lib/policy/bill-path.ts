// The path every bill walks, in five steps (Brendan, 2026-09-20): introduced,
// committee, floor, the other chamber, the governor. Every jurisdiction's bills
// carry the same status vocabulary ("In Senate Committee", "Passed Senate",
// "Signed by Governor" — 23 values across the whole database), so one mapping
// places any bill on the path. A bill sitting in the chamber it did not start
// in — a Senate bill "In Assembly Committee" — has crossed over, which is step
// four whatever that chamber is doing with it.

export const BILL_PATH = ["Introduced", "Committee", "Floor", "Other chamber", "Governor"] as const

export type BillPath = {
  /** How many steps are behind it or under way, 0 to 5. */
  reached: number
  /** It left the path: failed, stricken, substituted, vetoed. */
  ended: boolean
  /** The path is complete: signed, passed, adopted. */
  done: boolean
}

const CHAMBER = /^(?:In )?(Senate|House|Assembly|Legislature|Council|J)\b/

export function billPath(status: string | null | undefined, origin: string | null | undefined): BillPath {
  const s = (status ?? "").trim()
  const at = CHAMBER.exec(s)?.[1] ?? null
  // Nebraska's one chamber, the District's council and a joint committee have no other side to cross to.
  const crossed = !!at && !!origin && at !== origin && ["Senate", "House", "Assembly"].includes(at)
  if (/^(Signed by Governor|Passed|Adopted)$/.test(s)) return { reached: 5, ended: false, done: true }
  if (s === "Vetoed") return { reached: 5, ended: true, done: false }
  if (/^(Enrolled|Delivered to Governor)$/.test(s)) return { reached: 5, ended: false, done: false }
  if (/^(Failed|Stricken|Substituted)$/.test(s)) return { reached: 1, ended: true, done: false }
  if (/^(Engrossed|Passed (Senate|House|Assembly))$/.test(s) || crossed) return { reached: 4, ended: false, done: false }
  if (/Floor Calendar$/.test(s)) return { reached: 3, ended: false, done: false }
  if (/Committee$/.test(s)) return { reached: 2, ended: false, done: false }
  return { reached: 1, ended: false, done: false }
}

const squeeze = (text: string) => text.toLowerCase().replace(/\bthe\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim()

/**
 * Whether a bill's latest action says anything its status does not (Brendan,
 * 2026-09-20). Most actions only restate the status in the legislature's own
 * words — "Referred to the House Committee on Education and Workforce" under
 * "In House Committee · Education and Workforce" — and printing both reads as
 * the same line twice. One that carries more is kept: a chapter number, an
 * amendment, a vote.
 */
export function actionAdds(action: string | null | undefined, status: string | null | undefined) {
  const a = squeeze(action ?? "")
  if (!a) return false
  const s = squeeze(status ?? "")
  // The status itself, or a piece of it: "Signed by Governor." under "Signed by Governor".
  if (s && (a === s || s.includes(a))) return false
  const more = /amend|substitut|vote|pass|report|chapter|veto/.test(a)
  // The routine openings: filed, read in, sent to committee, and nothing after.
  if (/^(introduced|filed|prefiled|pre filed|read first time|first reading|first read)\b/.test(a)) return more
  if (/^(re )?referred to\b/.test(a)) return more
  return true
}

/**
 * A legislature's action line, made readable (Brendan, 2026-09-20). Texas prints its actions as a form: a chamber
 * code before the words ("E" for the executive, "H", "S") and a dotted leader where a date goes — "E Effective on
 * . . . . . . .", "Effective on . . . . . December 4, 2025". The code and the leader come out, and a line the
 * leader left without its date takes the action's own date, which is the day it names.
 */
export function tidyAction(action: string | null | undefined, state: string, date: string | null | undefined, fmt: (iso: string) => string): string {
  let text = String(action ?? "").replace(/(?:\s*\.){3,}\s*/g, " ").replace(/\s+/g, " ").trim()
  if (state === "TX") text = text.replace(/^[EHS] (?=[A-Z])/, "")
  if (/^effective on$/i.test(text) && date) text = `${text} ${fmt(date)}`
  return text
}
