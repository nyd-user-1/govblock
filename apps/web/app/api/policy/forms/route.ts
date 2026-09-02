import { NextResponse } from "next/server"

import { DEFAULT_STATE, stateName } from "@/lib/filters"
import { getForms } from "@/lib/policy/forms-queries"

// The Forms list. Its own route rather than a case in `[resource]` — that file
// is the legislative record's and lane D is in it — and a static segment beats
// the dynamic one, so `/api/policy/forms` lands here and `/api/policy/bills`
// still lands there.
//
// `?gov=` is not a parameter: scope comes from `?state=`, the same switch every
// other surface obeys, and `formsScope` maps it onto the `gov` column. The
// `facets.gov` in the answer is a fact about the rows, not a control.

export const dynamic = "force-dynamic"

// The same half hour the rest of the policy API caches for. 52 jurisdictions
// times a handful of pages is a small number of Aurora reads.
const CACHE = "public, s-maxage=1800, stale-while-revalidate=86400"

function int(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const state = (sp.get("state") || DEFAULT_STATE).toUpperCase()
  try {
    const result = await getForms({
      state,
      agency: sp.get("agency"),
      q: sp.get("q"),
      fillable: sp.get("fillable") === "1",
      all: sp.get("all") === "1",
      page: int(sp.get("page"), 1),
      limit: int(sp.get("limit"), 50),
    })
    // Not an error and not an empty list dressed up as one: we have harvested
    // no forms for this jurisdiction, and the surface says which.
    if (!result) {
      return NextResponse.json(
        {
          count: 0,
          rows: [],
          facets: { gov: [], agency: [] },
          forms: 0,
          documents: 0,
          empty: `No forms harvested for ${stateName(state)} yet. The library covers the federal government, New York State and New York City.`,
        },
        { headers: { "cache-control": CACHE } }
      )
    }
    return NextResponse.json(result, { headers: { "cache-control": CACHE } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("policy/forms failed", message)
    return NextResponse.json({ error: message, resource: "forms" }, { status: 503 })
  }
}
