import { NextResponse } from "next/server"

import { identify } from "@/lib/auth/user-id"
import { one } from "@/lib/policy/db"
import { writeDraft } from "@/lib/typeset/fork-store"

// A fork's working document, saved as the reader types (2026-09-15): the
// XML view turns into the reader's fork on the first keystroke and saves the
// way Google Docs does. The body is the document's ProseMirror JSON, gzipped
// in the browser; only the fork's owner may save it.
//
//   PUT /api/typeset/draft?fork=<id>[&parent=<commit id>][&claim=]

export const dynamic = "force-dynamic"

/** A whole printing is about a megabyte of JSON and a sixth of that gzipped; far past this is not a document. */
const MAX_GZ = 8_000_000

export async function PUT(request: Request) {
  const sp = new URL(request.url).searchParams
  const forkId = Number(sp.get("fork"))
  if (!forkId) return NextResponse.json({ error: "fork required" }, { status: 400 })
  const who = await identify(sp.get("claim"))
  if (!who) return NextResponse.json({ error: "sign in to save" }, { status: 401 })
  const fork = await one<{ owner: string }>(`select owner from "Forks" where id = $1`, [forkId])
  if (!fork) return NextResponse.json({ error: "no such fork" }, { status: 404 })
  if (fork.owner !== who.id) return NextResponse.json({ error: "not your fork" }, { status: 403 })

  const gz = Buffer.from(await request.arrayBuffer())
  if (!gz.length || gz.length > MAX_GZ) return NextResponse.json({ error: "no document, or too large" }, { status: 413 })
  const parent = Number(sp.get("parent")) || null
  const saved = await writeDraft(forkId, gz, parent)
  if (!saved) return NextResponse.json({ error: "not a document of the USLM schema" }, { status: 400 })
  return NextResponse.json(saved, { headers: { "cache-control": "private, no-store" } })
}
