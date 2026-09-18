import { NextResponse } from "next/server"

import { getFillableForms, type FillableSort } from "@/lib/policy/forms-queries"

// GET /api/research/fillable-forms?q=&agency=GOV:AGENCY&sort=&dir=&page=
// The fillable PDFs table on /research/government-forms (2026-09-18).

export const dynamic = "force-dynamic"

const SORTS: FillableSort[] = ["number", "title", "agency", "pages", "fields"]

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const sort = SORTS.includes(sp.get("sort") as FillableSort) ? (sp.get("sort") as FillableSort) : "fields"
  try {
    const result = await getFillableForms({
      q: sp.get("q"),
      agency: sp.get("agency"),
      sort,
      dir: sp.get("dir") === "asc" ? "asc" : "desc",
      page: Number(sp.get("page")) || 1,
      limit: 50,
    })
    return NextResponse.json(result, { headers: { "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 })
  }
}
