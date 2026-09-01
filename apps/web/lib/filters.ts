// Ported from livingston-v3 lib/policy/filters.ts — jurisdictions and parties.
export const DEFAULT_STATE = "NY"

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
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
}

export const CONGRESS = "US"
export const DISTRICT = "DC"

export const STATE_CODES = Object.keys(STATE_NAMES)
  .filter((code) => code !== CONGRESS && code !== DISTRICT)
  .sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]))

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

export function memberHref(peopleId: number | string, state: string) {
  return `/docs/directory/${peopleId}?state=${state}`
}
