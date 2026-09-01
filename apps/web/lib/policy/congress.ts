// The congress.gov families, as the pages read them.
//
// Lane C serves these under /api/policy in the API's own field names; the
// committed fixtures under lib/data/congress answer the same URLs in the same
// envelopes while a family has no table yet. A page therefore reads one shape
// and never learns which of the two answered.

export const CONGRESS = 119

/** LegiScan's US bill numbers carry its own prefixes: `HB10160` is H.R. 10160. */
const BILL_TYPE: Record<string, string> = {
  HB: "HR",
  SB: "S",
  HR: "HRES",
  SR: "SRES",
  HJR: "HJRES",
  SJR: "SJRES",
  HCR: "HCONRES",
  SCR: "SCONRES",
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
