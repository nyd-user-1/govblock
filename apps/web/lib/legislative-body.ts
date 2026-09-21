import { partyName, stateName } from "@/lib/filters"

// A member's chamber, written the way the chamber writes it. "R · Senate ·
// New York · 4" read like a US senator from New York; Monica Martinez is a
// New York State Senator, and the row has to say so (Brendan, 2026-09-08).
// The party letter went with it — the dot on the portrait already carries it.

/** Lower chambers that are not called the House of Representatives. */
const LOWER: Record<string, string> = {
  CA: "State Assembly",
  NV: "State Assembly",
  NY: "State Assembly",
  WI: "State Assembly",
  NJ: "General Assembly",
  MD: "House of Delegates",
  VA: "House of Delegates",
  WV: "House of Delegates",
}

const isUpper = (chamber: string) => /^(s|upper)/i.test(chamber.trim())

/** "New York Senate", "Maryland House of Delegates", "U.S. House of Representatives". */
export function legislativeBody(state: string | null | undefined, chamber: string | null | undefined): string {
  const code = (state ?? "").toUpperCase()
  const room = chamber ?? ""
  if (!code) return room
  if (code === "US" || code === "CONGRESS") return isUpper(room) ? "U.S. Senate" : "U.S. House of Representatives"
  // Nebraska sits one house, and it is not a senate or a house.
  if (code === "NE") return "Nebraska Legislature"
  const name = stateName(code) || code
  return isUpper(room) ? `${name} Senate` : `${name} ${LOWER[code] ?? "House of Representatives"}`
}

/** "District 4" for a state seat; a congressional district keeps its "UT-4". */
export function districtLabel(state: string | null | undefined, district: string | null | undefined): string {
  const value = (district ?? "").trim()
  if (!value) return ""
  if (/[A-Za-z]/.test(value)) return value
  return `District ${value}`
}

/** A member of Congress's own seat, short — "NY" for a senator, "NY-14" in the House — from the district Congress's rows carry ("SD-NY", "HD-NY-14"); empty for a state's member. */
export function federalSeat(district: string | null | undefined): string {
  const federal = /^[HS]D-([A-Z]{2})(?:-0*(\d+|AL))?$/.exec((district ?? "").trim().toUpperCase())
  return federal ? [federal[1], federal[2]].filter(Boolean).join("-") : ""
}

/**
 * A member in one line, for a favorite's second line (Brendan, 2026-09-19):
 * party, state, district — "Democrat, North Carolina, District 12". Congress's
 * rows file the state under "US" and carry the member's own in the district
 * ("HD-NC-12", a senator's "SD-NC"); a state's rows carry a bare seat
 * ("SD-063").
 */
export function memberLine(member: { party?: string | null; state?: string | null; district?: string | null }): string {
  const d = (member.district ?? "").trim().toUpperCase()
  const federal = /^[HS]D-([A-Z]{2})(?:-0*(\d+|AL))?$/.exec(d)
  const state = federal ? federal[1] : member.state ?? ""
  const number = federal ? federal[2] : /^[A-Z]+-0*(\d+)$/.exec(d)?.[1]
  const seat = number === "AL" ? "At large" : number ? `District ${number}` : federal ? null : d || null
  return [partyName(member.party), state && state !== "US" ? stateName(state) : null, seat].filter(Boolean).join(", ")
}
