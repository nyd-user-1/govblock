import file from "@/lib/data/jurisdictions.json"
import { stateName } from "@/lib/filters"

// Every jurisdiction's counts, from a file (Brendan, 2026-09-20): the years
// and sessions on file, the bills, the sections of law, the members, the roll
// calls. They move a little each day and not at all within one, so nothing
// asks the database for them on a page load — /state, the root's second
// section, the hubs' sub-header and the ⌘K menu's Jurisdictions all read
// lib/data/jurisdictions.json, which scripts/jurisdictions/freeze.mjs counts
// and writes. Plain data, so the server and the client import it alike.

export type Jurisdiction = {
  state: string
  name: string
  firstYear: number
  /** The last year a bill moved, not the latest session's label: a two-year session is filed under the year it opened. */
  lastYear: number
  sessions: number
  bills: number
  /** Sections of standing law, as /laws counts them. */
  laws: number
  /** Sitting this session, by the members page's rule; 0 where nobody qualifies yet. */
  members: number
  /** Everyone on file, sitting or former. */
  legislators: number
  rollCalls: number
}

export const JURISDICTIONS_FROZEN = file.frozen

const named = (file.rows as Omit<Jurisdiction, "name">[]).map((row) => ({ ...row, name: row.state === "US" ? "Congress" : stateName(row.state) }))
const byName = (a: Jurisdiction, b: Jurisdiction) => a.name.localeCompare(b.name)

/** A to Z by name, Congress among the Cs. */
export const JURISDICTIONS: Jurisdiction[] = [...named].sort(byName)

/** /state's order: Congress, the states by name, the District last. */
export const JURISDICTIONS_TABLE: Jurisdiction[] = [...named.filter((j) => j.state === "US"), ...named.filter((j) => j.state !== "US" && j.state !== "DC").sort(byName), ...named.filter((j) => j.state === "DC")]

export const jurisdiction = (state: string) => named.find((j) => j.state === state.toUpperCase()) ?? null

/** The jurisdictions either side, A to Z and round the ends: the arrows on a hub's head and on its charts'. */
export function neighbours(state: string) {
  const at = JURISDICTIONS.findIndex((j) => j.state === state.toUpperCase())
  if (at < 0) return null
  return { previous: JURISDICTIONS[(at - 1 + JURISDICTIONS.length) % JURISDICTIONS.length]!, next: JURISDICTIONS[(at + 1) % JURISDICTIONS.length]! }
}

/** "2009–2026". */
export const coverage = (j: Jurisdiction) => (j.lastYear > j.firstYear ? `${j.firstYear}–${j.lastYear}` : String(j.firstYear))

export const yearsOf = (j: Jurisdiction) => j.lastYear - j.firstYear + 1

const count = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`

/** "18 years, 9 sessions". */
export const span = (j: Jurisdiction) => `${count(yearsOf(j), "year")}, ${count(j.sessions, "session")}`

/** "18 years, 9 sessions, 7,083 bills, 177 members, 7,663 roll calls": everything on file, so the members are everyone who has sat. */
export const summary = (j: Jurisdiction) => [span(j), count(j.bills, "bill"), count(j.legislators, "member"), count(j.rollCalls, "roll call")].join(", ")
