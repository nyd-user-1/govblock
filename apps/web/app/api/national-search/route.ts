import { NextResponse } from "next/server"

import { isJurisdiction } from "@/lib/filters"
import { nationalSearch, type LawSort, type Source } from "@/lib/policy/national-search"

// The national search's one endpoint (Brendan, 2026-09-18): bills, law and
// legislators across every jurisdiction, three groups of up to eight — twenty
// when one source is asked for alone. Asked only when a reader submits a
// search, never on page load (the 2026-09-15 rule).
//
//   ?q=firearm                 every jurisdiction, all three groups
//   &j=NY                      one jurisdiction: a state, DC, or US for Congress
//   &only=law                  one group
//   &sort=relevance            law ranked by relevance; honoured with a j only
//
// Open to everyone, as search is (lib/entitlements.ts): the gate stands on the
// record a result opens, not on the result.
export const dynamic = "force-dynamic"

const SOURCES: Source[] = ["bills", "law", "legislators"]

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const term = (sp.get("q") ?? "").trim().slice(0, 200)
  if (term.length < 2) return NextResponse.json({ error: "q needs two characters or more" }, { status: 400 })
  const code = (sp.get("j") ?? "").toUpperCase()
  const j = code && code !== "ALL" && isJurisdiction(code) ? code : null
  const only = SOURCES.find((s) => s === sp.get("only")) ?? null
  const sort: LawSort = sp.get("sort") === "relevance" ? "relevance" : "code"
  try {
    const result = await nationalSearch({ term, j, only, sort, limit: only ? 20 : 8 })
    return NextResponse.json(result, { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("national search failed", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
