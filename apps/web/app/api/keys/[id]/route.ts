import { NextResponse } from "next/server"

import { revokeApiKey } from "@/lib/api-keys"
import { who } from "@/lib/watches/session"

// Revoke one of the reader's keys (2026-09-13). A revoked key stays in the
// list, marked, so the reader can see what a client that starts failing was using.

export const dynamic = "force-dynamic"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await who()
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 })
  const { id } = await params
  const done = await revokeApiKey(user.id, id)
  if (!done) return NextResponse.json({ error: "That key is not yours, or is already revoked." }, { status: 404 })
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "private, no-store" } })
}
