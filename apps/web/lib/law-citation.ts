// A law's row and its citation, in a plain module so the server page that
// titles a law and the client list that draws the rows share one rule.

export type LawRow = {
  law_id: string
  law_name: string
  law_type: string
  chapter: string | null
  sections: number
  /** The level above the law, from the XML library (sql/033_library_titles.sql): "Title 1", "Part I", "Chapter 5". */
  title?: string | null
  title_name?: string | null
  title_order?: number | null
}

const bare = (s: string) => s.replace(/^0+(?=\d)/, "")
const ILCS = /^(\d+ ILCS \d+(?:\.\d+)?)\/\s*/

/**
 * The bold slot, as the jurisdiction cites the law (2026-09-19): Alaska's
 * C28.11 is Chapter 28.11; a chapter filed under its title (Alabama T10AC1,
 * Idaho T10C1, New Hampshire TIC1) is Chapter 1, the title standing over it;
 * a title filed alone (Arizona T1, Louisiana RS1, the U.S. Code's USC07) is
 * Title 1; an Illinois act is its ILCS citation, 5 ILCS 280. Anything else
 * keeps its own id: New York's ABP, California's BPC.
 */
export function lawCitation(state: string, law: Pick<LawRow, "law_id" | "chapter"> & { law_name?: string | null }) {
  const id = law.law_id
  const chapter = law.chapter?.trim() || null
  if (state === "US" && chapter) return `Title ${bare(chapter)}`
  if (state === "IL") {
    const m = ILCS.exec(law.law_name ?? "")
    if (m) return m[1]
  }
  if (chapter && id === `C${chapter}`) return `Chapter ${chapter}`
  if (chapter && /^T[\dA-Z.\-]+?(?:APPENDIX)?C/i.test(id)) return `Chapter ${bare(chapter)}`
  const title = /^(?:T|RS)(\d+[A-Z]?(?:\.\d+)?)$/i.exec(id)
  if (title) return `Title ${bare(title[1])}`
  return id
}

/** The law's name as a reader says it: an Illinois act without the citation printed in front of it. */
export function lawName(state: string, law: Pick<LawRow, "law_name">) {
  return state === "IL" ? law.law_name.replace(ILCS, "").replace(/\.$/, "") : law.law_name
}

const numeric = new Intl.Collator("en", { numeric: true })

/** The number a citation sorts by — "28.11" of "Chapter 28.11", "5 ILCS 280" — or null for one cited by name (ABP). */
const sortKey = (state: string, law: LawRow) => {
  const c = lawCitation(state, law)
  return /^(Chapter|Title) /.test(c) ? c.replace(/^(Chapter|Title) /, "") : /ILCS/.test(c) ? c : null
}

/**
 * The laws in reading order (Brendan, 2026-09-19: "sort the chapters"): kind
 * by kind as given, then title by title in the jurisdiction's own order, and
 * within a title by chapter or title number — Alaska's 08.04 before 28.11, the
 * U.S. Code's Title 7 before Title 11 — the numbered before any cited by name
 * (Mississippi's TAAB after its titles), which keep name order.
 */
export function orderLaws<T extends LawRow>(state: string, rows: T[]): T[] {
  const kinds = [...new Set(rows.map((r) => r.law_type))]
  const within = (a: T, b: T) => {
    const ka = sortKey(state, a)
    const kb = sortKey(state, b)
    if (ka !== null && kb !== null) return numeric.compare(ka, kb)
    return ka !== null ? -1 : kb !== null ? 1 : 0
  }
  return kinds.flatMap((kind) =>
    rows
      .filter((r) => r.law_type === kind)
      .map((r, i) => ({ r, i }))
      .sort((a, b) => (a.r.title_order ?? 1e9) - (b.r.title_order ?? 1e9) || within(a.r, b.r) || a.i - b.i)
      .map(({ r }) => r)
  )
}

/**
 * A title for the laws the library could not place (2026-09-19): the XML
 * pipeline files a law whose name says "constitution" as the constitution, so
 * Alaska's chapter 15.50, Constitutional Amendments and Conventions, has no
 * code row and no title. Where the laws either side of it by number share a
 * title, it is that title's; a chapter whose id names its title (Utah's
 * T20AC15, New Hampshire's TLXIIIC667) takes that title; an Illinois act takes
 * the ILCS chapter its citation names. Anything still without one is left as
 * it is.
 */
export function fillTitles<T extends LawRow>(state: string, rows: T[]): T[] {
  if (!rows.some((r) => r.title)) return rows
  const numbered = rows.filter((r) => sortKey(state, r) !== null).sort((a, b) => numeric.compare(sortKey(state, a)!, sortKey(state, b)!))
  const place = new Map<string, Pick<LawRow, "title" | "title_name" | "title_order">>()
  numbered.forEach((r, i) => {
    if (r.title) return
    const before = numbered.slice(0, i).reverse().find((x) => x.title)
    const after = numbered.slice(i + 1).find((x) => x.title)
    const ilcs = state === "IL" ? /^(\d+) ILCS/.exec(lawCitation(state, r))?.[1] : undefined
    const idTitle = /^T([\dA-Z.\-]+)C[\dA-Z.\-]*$/i.exec(r.law_id)?.[1]?.replace(/^0+(?=\d)/, "")
    const same = ilcs
      ? rows.find((x) => x.title === `Chapter ${ilcs}`)
      : (idTitle && rows.find((x) => x.title === `Title ${idTitle}`)) || (before && after && before.title === after.title ? before : undefined)
    if (same) place.set(r.law_id, { title: same.title, title_name: same.title_name, title_order: same.title_order })
  })
  return rows.map((r) => (place.has(r.law_id) ? { ...r, ...place.get(r.law_id) } : r))
}

/** What a jurisdiction's laws are called in a heading: Alaska's chapters, the U.S. Code's titles, everyone else's laws. */
export function lawsNoun(state: string, rows: LawRow[]) {
  const cited = rows.map((r) => lawCitation(state, r))
  if (cited.length && cited.every((c) => c.startsWith("Chapter "))) return "Chapters"
  if (cited.length && cited.every((c) => c.startsWith("Title "))) return "Titles"
  if (state === "IL") return "Acts"
  return "Laws"
}

/** The title a law stands under, as a heading: "Title 1 · General Provisions"; null where the code has no such level. */
export function titleHeading(law: Pick<LawRow, "title" | "title_name">) {
  if (!law.title) return null
  return law.title_name ? `${law.title} · ${law.title_name}` : law.title
}
