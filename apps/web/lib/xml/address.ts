// The corpus's address (docs/xml/schema.md, section 1): USLM's referencing
// model applied to every jurisdiction. `/us/bill/119/hr/6644@2025-12-11_ih`
// is H.R. 6644 as introduced; `/us-ny/code/agm/s3` is a section of New York's
// Agriculture and Markets Law. The pipeline stores by it, the library browses
// by it, and the `/` command and the `@` resolver read it through this file.

export type Kind = "bill" | "usc" | "code" | "const" | "pl" | "law"

export type Address = {
  jurisdiction: string
  kind: Kind | string
  /** The Work's path after the kind: "119/hr/6644", "t10/s130i". */
  work: string
  /** The Work's full address: "/us/bill/119/hr/6644". */
  workAddress: string
  /** The expression: "2025-12-11_ih", or null for the Work itself. */
  expression: string | null
  date: string | null
  stage: string | null
  format: string | null
}

const FORMATS = new Set(["xml", "html", "md", "txt", "pdf", "json"])
const ADDRESS = /^\/(us(?:-[a-z]{2})?)\/([a-z]+)((?:\/[A-Za-z0-9.-]+)*)(?:@(\d{4}-\d{2}-\d{2})(?:_([A-Za-z0-9.-]+))?)?(?:\.([a-z]+))?$/

/** An address read into its parts; null when it is not one. A trailing ".xml" is a format only when it names one. */
export function parseAddress(input: string): Address | null {
  const m = ADDRESS.exec(input.trim())
  if (!m) return null
  let [, jurisdiction, kind, path, date, stage, format] = m
  // "/us/usc/t10/s130i.5" has no format; a dot inside a section number stays in the path.
  if (format && !FORMATS.has(format)) {
    if (date) return null
    path = `${path}.${format}`
    format = undefined as unknown as string
  }
  const work = path.replace(/^\//, "")
  return {
    jurisdiction,
    kind,
    work,
    workAddress: `/${jurisdiction}/${kind}${path}`,
    expression: date ? (stage ? `${date}_${stage}` : date) : null,
    date: date ?? null,
    stage: stage ?? null,
    format: format ?? null,
  }
}

export function formatAddress(workAddress: string, expression?: string | null, format?: string | null): string {
  return `${workAddress}${expression ? `@${expression}` : ""}${format ? `.${format}` : ""}`
}

/** The S3 key an Expression's USLM is stored under (decision 10). */
export const s3KeyOf = (workAddress: string, expression: string) => `lake/v1/xml${workAddress}/${expression}.xml`

/** "NY" → "us-ny"; "US" → "us". */
export const jurisdictionOf = (state: string) => (state.toUpperCase() === "US" ? "us" : `us-${state.toLowerCase()}`)

/** A segment as the address writes it: anything outside [A-Za-z0-9.-] becomes "-". */
export const segment = (s: string) => s.trim().replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "")

// ----------------------------------------------------------------- bills ---

/** LegiScan's federal bill types, as GPO names them. */
const FEDERAL_TYPES: Record<string, string> = { hb: "hr", sb: "s", hjr: "hjres", sjr: "sjres", hcr: "hconres", scr: "sconres", hr: "hres", sr: "sres" }

/** "2025 1st Special Session" → "2025s1"; a regular session is its first year; Congress is its number. */
export function sessionSegment(state: string, sessionId: number | string, sessionTitle?: string | null, special?: boolean | number | null, legiscanSessionId?: number | string | null): string {
  const year = Number(sessionId)
  if (state.toUpperCase() === "US") return String(Math.floor((year - 1789) / 2) + 1)
  if (!special) return String(year)
  const ordinal = /(\d+)(?:st|nd|rd|th)\s+special/i.exec(sessionTitle ?? "")
  return ordinal ? `${year}s${ordinal[1]}` : `${year}s-${legiscanSessionId ?? "x"}`
}

/** "S07721" → { type: "s", number: "7721" }; "B26-0123" → { type: "b", number: "26-123" }. */
export function billParts(state: string, billNumber: string): { type: string; number: string } | null {
  const m = /^([A-Za-z]+)\s*(.+)$/.exec(billNumber.trim())
  if (!m) return null
  let type = m[1].toLowerCase()
  if (state.toUpperCase() === "US") type = FEDERAL_TYPES[type] ?? type
  const number = segment(m[2].replace(/\d+/g, (d) => String(Number(d))))
  return { type, number }
}

/** A bill row's Work address: "/us/bill/119/hr/6644". */
export function billWork(bill: { state: string; session_id: number | string | null; bill_number: string; session_title?: string | null; special?: number | boolean | null; legiscan_session_id?: number | string | null }): string | null {
  const parts = billParts(bill.state, bill.bill_number)
  if (!parts || bill.session_id == null) return null
  const session = sessionSegment(bill.state, bill.session_id, bill.session_title, bill.special, bill.legiscan_session_id)
  return `/${jurisdictionOf(bill.state)}/bill/${session}/${parts.type}/${parts.number}`
}

/** GPO's version code from a package id or a GovInfo URL: "BILLS-119hr6644ih" → "ih". */
export function federalStage(packageOrUrl: string): string | null {
  const m = /BILLS-\d+[a-z]+\d+([a-z]+)/.exec(packageOrUrl)
  return m ? m[1] : null
}

/** A state printing's stage: its name as a slug ("Amended" → "amended"). */
export const printingStage = (name: string) => segment(name.toLowerCase()) || "text"

// ------------------------------------------------------------- the / command ---

export type SlashTarget =
  | { kind: "address"; address: Address }
  | { kind: "prefix"; prefix: string; label: string }
  | { kind: "number"; number: string; type: string | null; label: string }
  | { kind: "library"; slug: string; label: string }

/** Library slugs that are one prefix. Named libraries by family of law are window 4's and resolve to sets. */
const PREFIX_SLUGS: Record<string, { prefix: string; label: string }> = {
  "us-code": { prefix: "/us/usc", label: "United States Code" },
  "united-states-code": { prefix: "/us/usc", label: "United States Code" },
  "us-constitution": { prefix: "/us/const", label: "Constitution of the United States" },
}

/** A state's name as a slug → its two-letter code. */
export const STATE_NAMES: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca", colorado: "co", connecticut: "ct", delaware: "de",
  "district-of-columbia": "dc", florida: "fl", georgia: "ga", hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
  kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md", massachusetts: "ma", michigan: "mi", minnesota: "mn",
  mississippi: "ms", missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv", "new-hampshire": "nh", "new-jersey": "nj",
  "new-mexico": "nm", "new-york": "ny", "north-carolina": "nc", "north-dakota": "nd", ohio: "oh", oklahoma: "ok", oregon: "or",
  pennsylvania: "pa", "rhode-island": "ri", "south-carolina": "sc", "south-dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut",
  vermont: "vt", virginia: "va", washington: "wa", "west-virginia": "wv", wisconsin: "wi", wyoming: "wy",
}

const titleCase = (slug: string) => slug.split("-").map((w) => (w === "of" ? w : w[0].toUpperCase() + w.slice(1))).join(" ")

/**
 * What a `/` query names. `/119` is the 119th Congress; `/6644` every bill
 * numbered 6644; `/hr6644` that House bill in any Congress; `/new-york-code`
 * and `/new-york-constitution` a state's code and constitution; a full
 * address is itself. Anything else is a library slug for window 4 to resolve.
 */
export function resolveSlash(input: string): SlashTarget | null {
  const q = input.trim().replace(/^\/+/, "").replace(/\s+/g, "-").toLowerCase()
  if (!q) return null
  const full = parseAddress(`/${input.trim().replace(/^\/+/, "")}`)
  if (full) return { kind: "address", address: full }
  const congress = /^(\d{2,3})(?:th|st|nd|rd)?(?:-congress)?$/.exec(q)
  if (congress && Number(congress[1]) >= 93 && Number(congress[1]) <= 130) return { kind: "prefix", prefix: `/us/bill/${Number(congress[1])}`, label: `${congress[1]}th Congress` }
  const number = /^([a-z]+)?-?0*(\d{1,6})$/.exec(q)
  if (number) {
    // Typed letters are GPO's ("hr" is H.R.); LegiScan's own forms that GPO does not use ("hb", "sjr") are read as theirs.
    const typed = number[1] ?? null
    const type = typed && typed !== "hr" ? (FEDERAL_TYPES[typed] ?? typed) : typed
    return { kind: "number", number: number[2], type, label: `${type ? `${type.toUpperCase()} ` : ""}${number[2]}` }
  }
  if (PREFIX_SLUGS[q]) return { kind: "prefix", ...PREFIX_SLUGS[q] }
  const state = /^(.+?)-(code|constitution|bills)$/.exec(q)
  if (state && STATE_NAMES[state[1]]) {
    const kind = state[2] === "code" ? "code" : state[2] === "constitution" ? "const" : "bill"
    return { kind: "prefix", prefix: `/us-${STATE_NAMES[state[1]]}/${kind}`, label: `${titleCase(state[1])} ${titleCase(state[2])}` }
  }
  return { kind: "library", slug: q, label: titleCase(q) }
}

/** Where an address is published, for a link a reader can follow before the `@` resolver serves it in Typeset. */
export function officialUrl(address: string): string | null {
  const usc = /^\/us\/usc\/t([0-9]+[a-z]?)\/s([0-9A-Za-z.-]+)/.exec(address)
  if (usc) return `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${usc[1]}-section${usc[2]}&num=0&edition=prelim`
  const pl = /^\/us\/pl\/(\d+)\/(\d+)/.exec(address)
  if (pl) return `https://www.congress.gov/public-laws/${pl[1]}th-congress/public-law/${pl[2]}`
  const stat = /^\/us\/stat\/(\d+)\/(\d+)/.exec(address)
  if (stat) return `https://www.govinfo.gov/link/statute/${stat[1]}/${stat[2]}`
  const bill = /^\/us\/bill\/(\d+)\/([a-z]+)\/(\d+)/.exec(address)
  if (bill) return `https://www.congress.gov/bill/${bill[1]}th-congress/${bill[2] === "hr" ? "house-bill" : bill[2] === "s" ? "senate-bill" : `${bill[2]}`}/${bill[3]}`
  return /^https?:\/\//.test(address) ? address : null
}
