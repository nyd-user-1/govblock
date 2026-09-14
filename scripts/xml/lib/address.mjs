// The address, as apps/web/docs/xml/schema.md §1 writes it, for the loaders:
// the Work, the expression, and the S3 key they make. Window 4's
// lib/xml/address.ts parses addresses for the `/` and `@` commands; this
// builds them from the columns the corpus stores, and follows that file.

export const BUCKET = "govblock-lake-638175140432"
export const PREFIX = "lake/v1/xml"

/** "NY" → "us-ny", "US" → "us". */
export const jurisdictionOf = (state) => (String(state).toUpperCase() === "US" ? "us" : `us-${String(state).toLowerCase()}`)

/** A path segment: `[A-Za-z0-9.-]` and nothing else. */
export const segment = (s) => String(s).replace(/[^A-Za-z0-9.-]+/g, "-").replace(/^-+|-+$/g, "") || "-"

/** Leading zeros off each run of digits: "07721" → "7721", "26-0123" → "26-123". */
const unpad = (s) => s.replace(/\d+/g, (d) => String(Number(d)))

// LegiScan's federal prefixes to GPO's type codes.
export const FEDERAL_TYPE = { HB: "hr", SB: "s", HJR: "hjres", SJR: "sjres", HCR: "hconres", SCR: "sconres", HR: "hres", SR: "sres" }

/** The Congress a federal session year belongs to: 2025 → 119. */
export const congressOf = (year) => Math.floor((Number(year) - 1789) / 2) + 1
export const yearOfCongress = (congress) => (Number(congress) - 1) * 2 + 1789

/** "/us/bill/119/hr/6644" from GovInfo's pieces. */
export const federalBillWork = (congress, type, number) => `/us/bill/${congress}/${type.toLowerCase()}/${unpad(String(number))}`

/**
 * A state session's segment: its first year, or `2025s1` for a special
 * session, with `2025s-<legiscan id>` when the title names no ordinal.
 */
export function sessionSegment(year, title, legiscanSessionId) {
  const t = String(title ?? "")
  if (!/special|extraordinary/i.test(t)) return String(year)
  const ordinal = /(\d+)(?:st|nd|rd|th)\s+(?:special|extraordinary)/i.exec(t)
  return ordinal ? `${year}s${Number(ordinal[1])}` : `${year}s-${legiscanSessionId ?? "x"}`
}

/** "/us-ny/bill/2025/s/7721" from a "Bills" row. Null when the number will not split. */
export function stateBillWork(state, session, billNumber) {
  const m = /^([A-Za-z]+)\s*(.+)$/.exec(String(billNumber ?? "").trim())
  if (!m) return null
  const juris = jurisdictionOf(state)
  if (juris === "us") {
    const type = FEDERAL_TYPE[m[1].toUpperCase()]
    return type ? `/us/bill/${session}/${type}/${segment(unpad(m[2]))}` : null
  }
  return `/${juris}/bill/${session}/${m[1].toLowerCase()}/${segment(unpad(m[2]))}`
}

/** A printing's name as a stage slug: "Amended" → "amended", "Introduced in House" → "introduced-in-house". */
export const stageSlug = (name) => segment(String(name ?? "").toLowerCase()).toLowerCase() || "text"

/** "USC10" → "t10", "USC05A" → "t5a"; a state's law id lower-cased. */
export function codeSegment(state, lawId) {
  const id = String(lawId)
  if (String(state).toUpperCase() === "US") {
    const m = /^USC0*(\d+)([A-Za-z]?)$/i.exec(id)
    if (m) return `t${m[1]}${m[2].toLowerCase()}`
  }
  return segment(id.toLowerCase())
}

/** "/us/usc/t10/s130i", "/us-ny/code/agm/s3". */
export function statuteWork(state, lawId, sectionNumber, kind = "code") {
  const juris = jurisdictionOf(state)
  const code = codeSegment(state, lawId)
  const num = segment(String(sectionNumber).replace(/^§+\s*/, "").replace(/\.$/, ""))
  return juris === "us" ? `/us/usc/${code}/s${num}` : `/${juris}/${kind}/${code}/s${num}`
}

/** "2025-12-11_ih"; a statute section has no stage. */
export const expressionOf = (date, stage) => (stage ? `${date}_${stage}` : String(date))

/** lake/v1/xml/us/bill/119/hr/6644/2025-12-11_ih.xml */
export const keyOf = (work, expression) => `${PREFIX}${work}/${expression}.xml`
