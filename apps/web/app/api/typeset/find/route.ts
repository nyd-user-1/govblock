import { NextResponse } from "next/server"

import { findLaw, type FindResponse } from "@/lib/typeset/find"

// Search across the XML store (lib/typeset/find.ts): citations, a code named
// with a section number, and words in section headings, each answer a Work
// that opens in Typeset. Open to every reader, as the library is; the gate is
// on the Work a row opens. Asked on a keystroke or Enter, never on load.
//
//   GET /api/typeset/find?q=milk pricing[&jurisdiction=us-ny][&within=/us-ny/code/agm]

export const dynamic = "force-dynamic"

const JURISDICTION = /^us(?:-[a-z]{2})?$/
const WITHIN = /^\/us(?:-[a-z]{2})?(?:\/[A-Za-z0-9.-]+)*$/

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const text = (sp.get("q") ?? "").trim()
  const jurisdiction = sp.get("jurisdiction")
  const within = sp.get("within")
  try {
    const items = await findLaw(text, {
      jurisdiction: jurisdiction && JURISDICTION.test(jurisdiction) ? jurisdiction : null,
      within: within && WITHIN.test(within) ? within : null,
    })
    return NextResponse.json({ q: text, items } satisfies FindResponse, { headers: { "cache-control": "private, max-age=60" } })
  } catch (error) {
    return NextResponse.json({ q: text, items: [], error: String((error as Error)?.message ?? error).slice(0, 200) }, { status: 500 })
  }
}
