import { stateName } from "@/lib/filters"

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
