import { NextResponse } from "next/server"

import { one, q } from "@/lib/policy/db"

// The Consolidated Laws of the State of New York, and the rest of what the
// Open Legislation API publishes (the Constitution, the unconsolidated laws,
// the court acts, the rules), from the "Laws" table. Brendan, 2026-09-04:
// "for decades there was a monopoly of private businesses who offered the
// full text to willing buyers… you had to pay to see the law?" Not here.
//
//   ?list=1                          every law: id, name, type, chapter, section count
//   ?law=GBS                         the law's tree, without text
//   ?law=GBS&doc=A44-B               one node, with text, and its children
//   ?q=frontier+model[&law=GBS]      full-text search, ranked, with snippets

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400"

export type LawSummary = { law_id: string; law_name: string; law_type: string; chapter: string | null; sections: number }
export type LawNode = { location_id: string; doc_type: string; doc_level_id: string | null; title: string | null; parent_location_id: string | null; sequence_no: number; depth: number; repealed: boolean; active_date: string | null }
export type LawDoc = LawNode & { law_id: string; law_name: string; text: string | null; children: LawNode[]; crumbs: { location_id: string; title: string | null; doc_type: string }[] }
export type LawHit = { law_id: string; law_name: string; location_id: string; doc_type: string; title: string | null; snippet: string; rank: number }

const NODE = `location_id, doc_type, doc_level_id, title, parent_location_id, sequence_no, depth, repealed, active_date::text`

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const state = (sp.get("state") ?? "NY").toUpperCase()
  try {
    if (sp.get("list")) {
      const laws = await q<LawSummary>(
        `select law_id, law_name, law_type, chapter, count(*) filter (where doc_type = 'SECTION')::int sections
           from "Laws" where state = $1 group by law_id, law_name, law_type, chapter
           order by case law_type when 'CONSOLIDATED' then 0 when 'MISC' then 1 when 'UNCONSOLIDATED' then 2 when 'COURT_ACTS' then 3 else 4 end, law_name`,
        [state]
      )
      return NextResponse.json({ laws }, { headers: { "cache-control": CACHE } })
    }
    const text = sp.get("q")?.trim()
    if (text) {
      const law = sp.get("law")
      const params: unknown[] = [state, text]
      const scope = law ? `and law_id = $${params.push(law)}` : ""
      const hits = await q<LawHit>(
        `select law_id, law_name, location_id, doc_type, title,
                ts_headline('english', coalesce(text, ''), query, 'MaxFragments=2, MaxWords=24, MinWords=12, StartSel=<b>, StopSel=</b>') snippet,
                ts_rank_cd(tsv, query) rank
           from "Laws", websearch_to_tsquery('english', $2) query
          where state = $1 and tsv @@ query and doc_type in ('SECTION', 'PREAMBLE', 'JOINT_RULE', 'RULE') ${scope}
          order by rank desc limit 50`,
        params
      )
      return NextResponse.json({ hits, total: hits.length }, { headers: { "cache-control": CACHE } })
    }
    const law = sp.get("law")
    if (!law) return NextResponse.json({ error: "law, q or list required" }, { status: 400 })
    const doc = sp.get("doc")
    if (doc) {
      const node = await one<LawDoc>(`select law_id, law_name, ${NODE}, text from "Laws" where state = $1 and law_id = $2 and location_id = $3`, [state, law, doc])
      if (!node) return NextResponse.json({ error: "no such document" }, { status: 404 })
      const children = await q<LawNode>(`select ${NODE} from "Laws" where state = $1 and law_id = $2 and parent_location_id = $3 order by sequence_no`, [state, law, doc])
      // The path from the chapter down, for the crumbs.
      const crumbs: LawDoc["crumbs"] = []
      let cursor: string | null = node.parent_location_id
      for (let i = 0; cursor && i < 12; i++) {
        const p: { location_id: string; title: string | null; doc_type: string; parent_location_id: string | null } | null = await one(`select location_id, title, doc_type, parent_location_id from "Laws" where state = $1 and law_id = $2 and location_id = $3`, [state, law, cursor])
        if (!p) break
        crumbs.unshift({ location_id: p.location_id, title: p.title, doc_type: p.doc_type })
        cursor = p.parent_location_id
      }
      return NextResponse.json({ ...node, children, crumbs }, { headers: { "cache-control": CACHE } })
    }
    const nodes = await q<LawNode>(`select ${NODE} from "Laws" where state = $1 and law_id = $2 order by sequence_no`, [state, law])
    const info = await one<{ law_name: string; law_type: string; chapter: string | null }>(`select law_name, law_type, chapter from "Laws" where state = $1 and law_id = $2 limit 1`, [state, law])
    return NextResponse.json({ law_id: law, ...info, nodes }, { headers: { "cache-control": CACHE } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("laws failed", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
