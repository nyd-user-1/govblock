import "server-only"

import { q } from "@/lib/policy/db"
import { stateOfJurisdiction } from "@/lib/typeset/expression-document"
import { isConstitution, LEAF, lawIdsOf, lawWorks, sectionNumber } from "@/lib/xml/law-address"

// A code's outline (Brendan's road test, 2026-09-14, item 5: a section
// sidebar for the Library, like the Git view's outline): its titles, chapters
// and articles, and under each the sections, with their headings and the
// address each was stored under. Read from "Laws" through the cached executor,
// without the text; a section the XML store does not hold has no address, so
// the sidebar never links to nothing. Items travel as tuples: California's
// Food and Agricultural Code is 11,268 of them.
//
//   /us-ny/code/agm   New York's Agriculture and Markets Law
//   /us/usc/t7        Title 7 of the United States Code
//   /us-ny/const      New York's Constitution

/** [depth, "Article 2" or "§ 16", its heading, a section's Work address or null]. */
export type OutlineItem = [depth: number, label: string, heading: string | null, address: string | null]

const PAGE = 2500
const MOST = 15_000

type Row = { location_id: string; doc_type: string; doc_level_id: string | null; title: string | null; parent_location_id: string | null; depth: number; law_name: string | null; law_id: string; sequence_no: number }

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s_])([a-z])/g, (_, gap: string, c: string) => `${gap === "_" ? " " : gap}${c.toUpperCase()}`)

/** The law ids a library prefix names, in the state "Laws" files it under. */
async function lawsOf(prefix: string): Promise<{ state: string; lawIds: string[] } | null> {
  const [, jurisdiction, kind, unit] = prefix.split("/")
  if (!jurisdiction) return null
  const state = stateOfJurisdiction(jurisdiction)
  if (kind === "const") {
    const rows = await q<{ law_id: string; law_name: string | null }>(`select distinct law_id, law_name from "Laws" where state = $1 and (law_id ~* '^CNS$|CONST' or law_name ilike '%constitution%') limit 5`, [state])
    const ids = rows.filter((r) => isConstitution(r.law_id, r.law_name)).map((r) => r.law_id)
    return ids.length ? { state, lawIds: ids } : null
  }
  if ((kind === "code" || kind === "usc") && unit) return { state, lawIds: lawIdsOf(jurisdiction, unit) }
  return null
}

export async function codeOutline(prefix: string): Promise<OutlineItem[] | null> {
  const laws = await lawsOf(prefix)
  if (!laws) return null
  const rows: Row[] = []
  let after = -1
  for (;;) {
    const page = await q<Row>(
      `select location_id, doc_type, doc_level_id, title, parent_location_id, depth, law_name, law_id, sequence_no
         from "Laws"
        where state = $1 and law_id = any($2::text[]) and sequence_no > $3 and (doc_type <> all($4::text[]) or text is not null)
        order by sequence_no limit ${PAGE}`,
      [laws.state, `{${laws.lawIds.map((id) => `"${id}"`).join(",")}}`, after, `{${LEAF.join(",")}}`]
    )
    rows.push(...page.map((r) => ({ ...r, depth: Number(r.depth), sequence_no: Number(r.sequence_no) })))
    if (page.length < PAGE || rows.length >= MOST) break
    after = rows[rows.length - 1].sequence_no
  }
  if (!rows.length) return []

  const byId = new Map(rows.map((r) => [r.location_id, r]))
  const leaf = (r: Row) => LEAF.includes(r.doc_type.toUpperCase())
  // A number that repeats in the law restarts in a container, and is addressed under it (statutes.mjs).
  const counts = new Map<string, number>()
  for (const r of rows) if (leaf(r)) counts.set(sectionNumber(r.doc_level_id, r.location_id), (counts.get(sectionNumber(r.doc_level_id, r.location_id)) ?? 0) + 1)
  // The law's own root row (its name over everything) is not a level of the outline.
  const root = (r: Row) => !r.parent_location_id && !leaf(r)
  const top = Math.min(...rows.filter((r) => !root(r)).map((r) => r.depth))

  const items: OutlineItem[] = rows
    .filter((r) => !root(r))
    .map((r) => {
      const depth = Math.max(0, r.depth - top)
      const heading = r.title?.replace(/\s+/g, " ").trim() || null
      if (!leaf(r)) return [depth, `${titleCase(r.doc_type)} ${r.doc_level_id ?? ""}`.trim(), heading, null]
      const parent = r.parent_location_id ? byId.get(r.parent_location_id) : undefined
      const num = sectionNumber(r.doc_level_id, r.location_id)
      const [address] = lawWorks({ state: laws.state, law_id: r.law_id, law_name: r.law_name, doc_type: r.doc_type, doc_level_id: r.doc_level_id, location_id: r.location_id, parent_type: parent?.doc_type ?? null, parent_level: parent?.doc_level_id ?? null }, (counts.get(num) ?? 0) > 1)
      return [depth, r.doc_type.toUpperCase() === "PREAMBLE" ? "Preamble" : `§ ${num}`, r.doc_type.toUpperCase() === "PREAMBLE" ? null : heading, address ?? null]
    })

  // Only what the store holds keeps its address.
  const addresses = items.flatMap((i) => (i[3] ? [i[3]] : []))
  const held = new Set<string>()
  for (let at = 0; at < addresses.length; at += 2000) {
    const chunk = addresses.slice(at, at + 2000)
    const found = await q<{ work: string }>(`select distinct work from expressions where work = any($1::text[])`, [`{${chunk.map((a) => `"${a.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`])
    for (const f of found) held.add(f.work)
  }
  return items.map((i) => (i[3] && !held.has(i[3]) ? [i[0], i[1], i[2], null] : i))
}
