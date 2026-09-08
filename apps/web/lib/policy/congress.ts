// The congress.gov families, as the pages read them.
//
// Lane C serves these under /api/policy in the API's own field names; the
// committed fixtures under lib/data/congress answer the same URLs in the same
// envelopes while a family has no table yet. A page therefore reads one shape
// and never learns which of the two answered.

export const CONGRESS = 119

/* ---- how Congress is cited -------------------------------------------------
 * One home for the two numbering schemes, because they collide. LegiScan
 * numbers every jurisdiction in a universal scheme where HB is a house bill
 * and HR a house resolution; congress.gov runs the other way round, so H.R.
 * 155 is the Let America Vote Act and H.Res. 155 is a Ukraine measure. Every
 * surface that prints, parses or joins a federal bill number reads these
 * tables — db-queries re-exports them for the server, format.ts calls them for
 * the page — so there is one answer to "what is this bill called".
 * ------------------------------------------------------------------------- */

/** LegiScan's US bill numbers carry its own prefixes: `HB10160` is H.R. 10160. */
export const BILL_TYPE: Record<string, string> = {
  HB: "HR",
  SB: "S",
  HR: "HRES",
  SR: "SRES",
  HJR: "HJRES",
  SJR: "SJRES",
  HCR: "HCONRES",
  SCR: "SCONRES",
}

/** congress.gov's type -> the prefix LegiScan's `Bills` spells it with. */
export const LEGISCAN_PREFIX_BY_TYPE: Record<string, string> = { HR: "HB", HRES: "HR", S: "SB", SRES: "SR", HJRES: "HJR", SJRES: "SJR", HCONRES: "HCR", SCONRES: "SCR" }

/**
 * Every spelling a citation arrives in -> congress.gov's own type.
 *
 * Written out rather than spread from BILL_TYPE, because the two schemes
 * collide on exactly the keys that matter: LegiScan's `HR` is a house
 * resolution and congress.gov's is a house bill, and `SR`/`S` likewise.
 * Spreading BILL_TYPE over this once let LegiScan win, and "H.R. 155" answered
 * with H.Res. 155 — the original defect, reintroduced by a shorthand
 * (found 2026-09-07 against the dev server). Only LegiScan's non-colliding
 * spellings are borrowed, so a number copied out of a search result still lands.
 */
export const CITATION_TYPE: Record<string, string> = {
  HR: "HR", HRES: "HRES", HJRES: "HJRES", HCONRES: "HCONRES",
  S: "S", SRES: "SRES", SJRES: "SJRES", SCONRES: "SCONRES",
  HB: "HR", SB: "S", HJR: "HJRES", SJR: "SJRES", HCR: "HCONRES", SCR: "SCONRES",
}

/** How congress.gov prints it: H.R. 155, H.Res. 155, S.J.Res. 12. */
export const CITATION_LABEL: Record<string, string> = {
  HR: "H.R.", HRES: "H.Res.", HJRES: "H.J.Res.", HCONRES: "H.Con.Res.",
  S: "S.", SRES: "S.Res.", SJRES: "S.J.Res.", SCONRES: "S.Con.Res.",
}

/** "H.R. 155" from congress.gov's own type and number. */
export function citationOf(type: string | null | undefined, number: string | number | null | undefined) {
  const label = CITATION_LABEL[String(type ?? "").toUpperCase()]
  return label && (number ?? "") !== "" ? `${label} ${number}` : null
}

/**
 * A typed citation -> the type and number congress.gov files it under.
 * Punctuation is what disambiguates, so the parse happens before it is
 * stripped: `H.R.` and `H.Res.` differ by two characters and one bill. A bare
 * `HR155` is read as congress.gov reads it — a house bill — because that is
 * what a person typing it means.
 */
export function congressCitation(raw: string | null | undefined) {
  const match = String(raw ?? "").toUpperCase().replace(/\s+/g, "").match(/^([A-Z.]+?)\.?0*(\d+)$/)
  if (!match) return null
  const type = CITATION_TYPE[match[1].replace(/\./g, "")]
  return type ? { type, number: String(Number(match[2])) } : null
}

/** The congress a session year sits in: 2025 -> the 119th. */
export function congressOf(session: number | string | null | undefined) {
  return Math.floor((Number(session ?? 0) - 1789) / 2) + 1
}

/** congress_bills' primary key, and the key lobbying is re-keyed onto. */
export const congressKey = (congress: number, type: string, number: string | number) => `${congress}-${String(type).toUpperCase()}-${number}`

/**
 * A bill number as its own legislature writes it. Under Congress that is
 * congress.gov's citation — `HB1` reads `H.R. 1` — and everywhere else it is
 * the record's own spelling with the zero padding taken off.
 */
export function billCitation(billNumber: string | null | undefined, state?: string | null) {
  const bare = String(billNumber ?? "")
  if (String(state ?? "").toUpperCase() !== "US") return bare.replace(/^([A-Z]+)0*(\d+)/, "$1 $2")
  const match = /^([A-Z]+)0*(\d+)$/.exec(bare.toUpperCase())
  return (match && citationOf(BILL_TYPE[match[1]] ?? match[1], match[2])) ?? bare.replace(/^([A-Z]+)0*(\d+)/, "$1 $2")
}

/**
 * The congress_bills key a LegiScan bill number and session sit under:
 * ("HB1", 2025) -> "119-HR-1". Federal lobbying is re-keyed on the same
 * expression, in sql/002_lobbying_congress_key.sql, so the two always join.
 */
export function billCongressKey(billNumber: string | null | undefined, session: number | string | null | undefined) {
  const match = /^([A-Z]+)0*(\d+)$/.exec(String(billNumber ?? "").toUpperCase())
  const type = match && BILL_TYPE[match[1]]
  return type ? congressKey(congressOf(session), type, match[2]) : null
}

export type BillRef = { type: string; number: string }

export function billRef(billNumber: string | null | undefined): BillRef | null {
  const match = /^([A-Z]+)(\d+)$/.exec(String(billNumber ?? "").toUpperCase())
  const type = match && BILL_TYPE[match[1]]
  return type ? { type, number: match[2] } : null
}

const PATH: Record<string, string> = {
  HR: "house-bill",
  S: "senate-bill",
  HRES: "house-resolution",
  SRES: "senate-resolution",
  HJRES: "house-joint-resolution",
  SJRES: "senate-joint-resolution",
  HCONRES: "house-concurrent-resolution",
  SCONRES: "senate-concurrent-resolution",
}

/** Where a bill, an amendment or a report reads on congress.gov. */
export function congressGovHref(
  kind: "bill" | "amendment",
  type: string,
  number: string | number,
  congress = CONGRESS
) {
  const t = String(type).toUpperCase()
  if (kind === "amendment") {
    const chamber = t.startsWith("H") ? "house-amendment" : "senate-amendment"
    return `https://www.congress.gov/amendment/${congress}th-congress/${chamber}/${number}`
  }
  return `https://www.congress.gov/bill/${congress}th-congress/${PATH[t] ?? "house-bill"}/${number}`
}

/**
 * The rows of a scoped answer, and only those that are provably in scope.
 *
 * A resource that is served for the whole congress accepts `?bill=` and ignores
 * it, so a per-bill section asking for one bill's amendments can be handed all
 * 7,035 of them with a 200. The rule, permanently: a bare array came from a
 * route that could not have answered without the scope; an object is trusted
 * when it echoes the scope it was asked for; anything else is filtered row by
 * row, and a row that cannot name its own bill is not shown at all. An honest
 * empty section beats another bill's rows under this bill's heading.
 */
export function scopedRows<T>(
  data: unknown,
  key: string,
  scope: { param: string; value: string | number },
  names?: (row: T) => boolean
): T[] {
  if (Array.isArray(data)) return data as T[]
  if (!data || typeof data !== "object") return []
  const body = data as Record<string, unknown>
  const rows = body[key]
  if (!Array.isArray(rows)) return []
  if (String(body[scope.param] ?? "") === String(scope.value))
    return rows as T[]
  return names ? (rows as T[]).filter(names) : []
}

/** The whole family's size, which the API and the routes both call `count`. */
export function familyCount(data: unknown, rows: unknown[]) {
  const count =
    data && typeof data === "object"
      ? (data as { count?: unknown }).count
      : undefined
  return typeof count === "number" ? count : rows.length
}

const TAG = /<[^>]*>/g
const ENTITY: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
}

/**
 * A CRS summary arrives as HTML. It is rendered as the paragraphs it is —
 * never as markup: the text is a stored payload, and prose is all a summary
 * needs to be.
 */
export function summaryParagraphs(html: string | null | undefined): string[] {
  return String(html ?? "")
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(TAG, "")
    .replace(
      /&[a-z#0-9]+;/gi,
      (entity) => ENTITY[entity.toLowerCase()] ?? entity
    )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * A CRS summary as the blocks it is written in — a bold line, a paragraph, a
 * list item — so the page can set it the way congress.gov does, bullets and
 * all, without rendering the stored markup itself.
 */
export type SummaryBlock = { kind: "strong" | "p" | "li"; text: string }
export function summaryBlocks(html: string | null | undefined): SummaryBlock[] {
  const decode = (text: string) => text.replace(TAG, "").replace(/&[a-z#0-9]+;/gi, (entity) => ENTITY[entity.toLowerCase()] ?? entity).replace(/\s+/g, " ").trim()
  const out: SummaryBlock[] = []
  for (const raw of String(html ?? "").replace(/<br\s*\/?>/gi, "\n").split(/<\/(?:p|div|li|h\d)>|\n/i)) {
    const li = /<li[\s>]/i.test(raw)
    const inner = raw.replace(/<(?:ul|ol|p|div|li|h\d)[^>]*>/gi, "").trim()
    const strong = /^<strong>[\s\S]*<\/strong>$/i.test(inner)
    const text = decode(inner)
    if (text) out.push({ kind: li ? "li" : strong ? "strong" : "p", text })
  }
  return out
}

/** `2025-05-20T04:00:00Z` and `2025-05-20` are the same day. */
export const day = (value: unknown) => (value ? String(value).slice(0, 10) : "")

/**
 * The order a bill moves in. The API names a version by its stage, so the
 * timeline is the stages it has reached, in the order it reached them —
 * falling back to the date, then to the order the rows arrived.
 */
const STAGES = [
  "Introduced",
  "Referred",
  "Reported",
  "Placed on Calendar",
  "Considered",
  "Engrossed",
  "Passed",
  "Agreed",
  "Received",
  "Amendment",
  "Enrolled",
  "Public Law",
]

export function stageRank(version: string | null | undefined) {
  const name = String(version ?? "")
  for (let i = STAGES.length - 1; i >= 0; i--)
    if (name.includes(STAGES[i])) return i
  return STAGES.length
}

/** The rows of an unscoped family answer, whatever envelope it arrived in. */
export function rowsOf<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[]
  if (!data || typeof data !== "object") return []
  const rows = (data as Record<string, unknown>)[key]
  return Array.isArray(rows) ? (rows as T[]) : []
}

/**
 * One spelling for a committee. LegiScan writes `Subcommittee on Health` and
 * `Permanent Select Intelligence`; congress.gov writes `Health Subcommittee`
 * and `Intelligence (Permanent Select) Committee`. Both reduce to `health` and
 * `intelligence`, which is what `committee-codes.json` is keyed on.
 */
export function committeeKey(chamber: string | null | undefined, name: string | null | undefined) {
  let value = String(name ?? "").trim().toLowerCase()
  value = value.replace(/\([^)]*\)/g, " ")
  value = value.replace(/^(sub)?committee\s+on\s+/, "")
  value = value.replace(/^(house|senate|joint)\s+/, "")
  value = value.replace(/^(sub)?committee\s+on\s+/, "")
  value = value.replace(/\s+(sub)?committee$/, "")
  value = value.replace(/^(permanent\s+)?select\s+/, "")
  return `${chamber ?? ""}|${value.replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).join(" ")}`
}

/**
 * A system code is chamber + committee + subcommittee: `hsvr00` is the House
 * Veterans' Affairs Committee and `hsvr02` one of its subcommittees. The first
 * four characters are therefore the committee a meeting or a transcript
 * belongs to, whichever of its rooms it was held in.
 */
export const parentCode = (code: string | null | undefined) => String(code ?? "").toLowerCase().slice(0, 4)

/**
 * The Congress a session year belongs to, by name: 2025 is the 119th. LegiScan
 * titles Congress's sessions "2025-2026 Regular Session", which is not what
 * anyone calls it. The first Congress sat in 1789 and each sits for two years.
 */
export function congressName(year: number) {
  const n = congressOf(year)
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th"
  return `${n}${suffix} Congress`
}
