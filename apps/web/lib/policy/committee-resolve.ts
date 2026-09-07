import "server-only"

import CODES from "@/lib/data/congress/committee-codes.json"
import { getCommittees, latestSession } from "@/lib/policy/db-queries"
import { type CommitteeRecord, getCommitteeRecord, getStateCommittee } from "@/lib/policy/committee-queries"
import { shortName, slugify } from "@/lib/policy/committee-slug"

// What a committee id on the URL means, resolved once for the page and once
// for the rail that stands beside it. Three shapes:
//
//   hsvr00                    a federal committee, by congress.gov's system code
//   senate-aging              a New York committee, by the slug its site uses
//   tx-house-ways-and-means   any other state's, by state, chamber and name

const CODE_MAP = CODES as { byName: Record<string, string>; byCode: Record<string, { chamber: string; name: string }> }

/** LegiScan names a standing committee by its subject ("Veterans' Affairs") and a subcommittee by its full title. Only the first wants the word appended. */
export const committeeTitle = (name: string) => (/\b(sub)?committee\b/i.test(name) ? name : `${name} Committee`)

export type ResolvedCommittee = {
  kind: "federal" | "ny" | "state"
  id: string
  state: string
  chamber: string
  /** The name as LegiScan's Bills.committee spells it, for the bills before it. */
  legiscanName: string
  /** The page's h1. */
  title: string
  record: CommitteeRecord | null
  ny: Awaited<ReturnType<typeof getStateCommittee>>
}

async function quiet<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read()
  } catch (error) {
    console.error("committee: family unavailable", error instanceof Error ? error.message : error)
    return fallback
  }
}

export async function resolveCommittee(id: string): Promise<ResolvedCommittee | null> {
  const lower = id.toLowerCase()
  const state = lower.match(/^([a-z]{2})-(house|senate|assembly|joint)-(.+)$/)
  if (/^(senate|assembly)-/.test(lower)) {
    const ny = await quiet(() => getStateCommittee(lower), null)
    if (ny) return { kind: "ny", id: lower, state: "NY", chamber: ny.chamber, legiscanName: ny.name, title: committeeTitle(ny.name), record: null, ny }
  }
  if (state && state[1] !== "us") {
    const code = state[1].toUpperCase()
    const session = await latestSession(code)
    const rows = await quiet(() => getCommittees({ state: code, session }), [] as { committee_name: string; chamber: string; bills: number }[])
    const chamber = state[2].charAt(0).toUpperCase() + state[2].slice(1)
    const hit = rows.find((r) => r.chamber.toLowerCase() === state[2] && slugify(r.committee_name) === state[3]) ?? rows.find((r) => slugify(r.committee_name) === state[3])
    if (hit) return { kind: "state", id: lower, state: code, chamber: hit.chamber || chamber, legiscanName: hit.committee_name, title: committeeTitle(hit.committee_name), record: null, ny: null }
    return null
  }
  const record = await quiet(() => getCommitteeRecord(lower), null)
  const mapped = CODE_MAP.byCode[lower] ?? null
  if (!record && !mapped) return null
  const chamber = record?.chamber ?? mapped?.chamber ?? "House"
  // The bills carry LegiScan's name for the committee, which the code map
  // knows; a committee the map lacks falls back to congress.gov's own name.
  const legiscanName = mapped?.name ?? (record ? shortName(record.name) : lower)
  const title = record ? (record.parent ? record.name : committeeTitle(shortName(record.name))) : committeeTitle(mapped!.name)
  return { kind: "federal", id: lower, state: "US", chamber, legiscanName, title, record, ny: null }
}
