import { NextResponse } from "next/server"

import { getClipRow, viewerOf } from "@/lib/clips/server"
import { q } from "@/lib/policy/db"

// Take a clip down: an admin's alone (reader_profiles.admin). The clip leaves
// the feed, and no address to its video is signed again, but neither row nor
// video is destroyed, so a mistaken takedown can be undone and a disputed one
// answered. Every open report on it is closed as removed.

export const dynamic = "force-dynamic"

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([viewerOf(), params])
  if (!viewer?.admin) return NextResponse.json({ error: "Only an admin can take a clip down." }, { status: 403 })
  const row = await getClipRow(id)
  if (!row) return NextResponse.json({ error: "No such clip." }, { status: 404 })
  try {
    await q(`update clips set status = 'removed', removed_at = now() where id = $1`, [id])
    await q(`update clip_reports set resolved_at = now(), resolution = 'removed' where clip_id = $1 and resolved_at is null`, [id])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
