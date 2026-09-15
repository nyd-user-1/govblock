import { NextResponse } from "next/server"

import { S3_PREFIX, viewerOf } from "@/lib/clips/server"
import { removeObjects } from "@/lib/clips/storage"
import { one, q } from "@/lib/policy/db"

// Withdraw an upload of the reader's own before it is cut: the video leaves
// the bucket and the queue. One already cut, or not the reader's, answers 404.

export const dynamic = "force-dynamic"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([viewerOf(), params])
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const row = await one<{ id: string; source_url: string | null }>(`select id, source_url from clip_cuts where id = $1 and owner_id = $2 and status in ('queued', 'failed')`, [id, viewer.id])
  if (!row) return NextResponse.json({ error: "No such upload." }, { status: 404 })
  try {
    if (row.source_url?.startsWith(S3_PREFIX)) await removeObjects([row.source_url.slice(S3_PREFIX.length)])
    await q(`delete from clip_cuts where id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
