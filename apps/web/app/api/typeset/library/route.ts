import { NextResponse } from "next/server"

import { readLibraryQuery, resolveLibrary } from "@/lib/xml/library-data"

// The library as JSON (window 4, 2026-09-14): what the Library page draws for
// a path, and the next page of Works when a reader asks for more. The
// catalogue and the addresses are open to every reader, as search is; the
// gate is on the Work a row opens.
//
//   GET /api/typeset/library?path=us/ny/code/agm&sort=address&q=&j=&show=&offset=100  (us-ny/code/agm reads the same)

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const segments = (sp.get("path") ?? "").split("/").filter(Boolean)
  try {
    const resolved = await resolveLibrary(segments, readLibraryQuery(sp))
    if (!resolved) return NextResponse.json({ error: "no library at that path" }, { status: 404 })
    return NextResponse.json(resolved, { headers: { "cache-control": "private, max-age=60" } })
  } catch (error) {
    return NextResponse.json({ error: String((error as Error)?.message ?? error).slice(0, 200) }, { status: 500 })
  }
}
