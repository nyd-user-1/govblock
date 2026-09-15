import { NextResponse } from "next/server"

import { codeOutline } from "@/lib/xml/code-outline"

// A code's outline for the Library's and the Work page's sidebar
// (lib/xml/code-outline.ts). Open to every reader, as the library is.
//
//   GET /api/typeset/outline?prefix=/us-ny/code/agm

export const dynamic = "force-dynamic"

const PREFIX = /^\/us(?:-[a-z]{2})?\/(?:code|usc)\/[A-Za-z0-9.-]+$|^\/us(?:-[a-z]{2})?\/const$/

export async function GET(request: Request) {
  const prefix = new URL(request.url).searchParams.get("prefix") ?? ""
  if (!PREFIX.test(prefix)) return NextResponse.json({ error: "prefix is a code, a US Code title or a constitution" }, { status: 400 })
  try {
    const items = await codeOutline(prefix)
    if (!items) return NextResponse.json({ error: "no such code" }, { status: 404 })
    return NextResponse.json({ prefix, items }, { headers: { "cache-control": "private, max-age=3600" } })
  } catch (error) {
    return NextResponse.json({ error: String((error as Error)?.message ?? error).slice(0, 200) }, { status: 500 })
  }
}
