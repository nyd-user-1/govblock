// livingston-v3 lib/policy/filters.ts, whole; memberHref points at /docs/directory.
// The one filter model every legislative surface speaks: the /create rail
// writes it into the URL, the preview iframe receives it, the widgets fetch
// with it, /typeset and the calendars read the same keys. Client-safe — no
// database access here.

export const FILTER_KEYS = [
  "state",
  "session",
  "chamber",
  "committee",
  "member",
  "party",
  "status",
  "subject",
  "vote",
  "bill",
] as const

export type FilterKey = (typeof FILTER_KEYS)[number]

export type Filters = Partial<Record<FilterKey, string>>

// Congress. Every committed snapshot in lib/data is Congress, so this is the
// only default under which the offline fallback tells the truth.
export const DEFAULT_STATE = "US"

export const VOTE_OPTIONS = [
  { value: "Yea", label: "Aye" },
  { value: "Nay", label: "Nay" },
  { value: "NV", label: "No Vote" },
  { value: "Absent", label: "Absent" },
] as const

export const PARTY_LABEL: Record<string, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
  L: "Libertarian",
  G: "Green",
  N: "Nonpartisan",
}

export const STATE_NAMES: Record<string, string> = {
  US: "Congress",
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  PR: "Puerto Rico",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
}

// The lower chamber's name, by jurisdiction. `Bills.body` and `People.chamber`
// carry it per row, but labels (series, calendars, toggles) are chosen before
// the rows arrive. Five states seat an Assembly; everyone else, a House.
const ASSEMBLY_STATES = new Set(["CA", "NV", "NJ", "NY", "WI"])

export function lowerChamber(state: string | undefined) {
  return ASSEMBLY_STATES.has((state ?? "").toUpperCase()) ? "Assembly" : "House"
}

// Congress first, then the states A–Z, then DC — the order the switcher
// groups by. These live here rather than in jurisdiction.tsx because that
// module is "use client": a server component (the bill timeline) cannot call
// a function exported from a client module, only render one.
export const CONGRESS = "US"
export const DISTRICT = "DC"

export const STATE_CODES = Object.keys(STATE_NAMES)
  .filter((code) => code !== CONGRESS && code !== DISTRICT)
  .sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]))

export function isJurisdiction(
  code: string | null | undefined
): code is string {
  return !!code && code.toUpperCase() in STATE_NAMES
}

/** Where a member's page lives. One place, so every link agrees. */
export function memberHref(peopleId: number | string, state?: string) {
  return `/docs/directory/${peopleId}${state ? `?state=${state}` : ""}`
}

export function flagUrl(code: string) {
  return `/flags/${code.toUpperCase()}.png`
}

export function stateName(code: string | undefined) {
  if (!code) return ""
  return STATE_NAMES[code] ?? code
}

export function partyName(code: string | null | undefined) {
  if (!code) return ""
  return PARTY_LABEL[code] ?? code
}

// Only the non-empty keys, in a stable order, so the same filters always
// produce the same URL (and the same CDN cache key).
export function filtersToQuery(filters: Filters) {
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    if (value) params.set(key, value)
  }
  return params.toString()
}

export function readFilters(source: URLSearchParams | Record<string, unknown>) {
  const filters: Filters = {}
  for (const key of FILTER_KEYS) {
    const value =
      source instanceof URLSearchParams ? source.get(key) : source[key]
    if (typeof value === "string" && value !== "") {
      filters[key] = value
    }
  }
  return filters
}

// A surface with its own params bag (typeset) still has to be scoped by the
// header. Fill what it left empty from the jurisdiction hook: the state
// always, the session only when it is an explicit choice (the default is the
// server's job, so it stays out of the URL and the CDN key).
export function scopedFilters(
  filters: Filters,
  state: string,
  session?: number | null,
  isDefaultSession = true
): Filters {
  const next: Filters = { ...filters, state: filters.state || state }
  if (!next.session && !isDefaultSession && session) {
    next.session = String(session)
  }
  return next
}

export function policyUrl(
  resource: string,
  filters: Filters = {},
  extra: Record<string, string | number | undefined> = {}
) {
  const params = new URLSearchParams(filtersToQuery(filters))
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") params.set(key, String(value))
  }
  const query = params.toString()
  return `/api/policy/${resource}${query ? `?${query}` : ""}`
}
