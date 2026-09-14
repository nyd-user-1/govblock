import { NextResponse } from "next/server"

import { viewerOf } from "@/lib/clips/server"
import { deleteVideo } from "@/lib/policy/cloudflare-stream"
import { one, q } from "@/lib/policy/db"

// Withdraw an upload of the reader's own before it is cut: the video leaves
// Stream and the queue. One already cut, or not the reader's, answers 404.

export const dynamic = "force-dynamic"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([viewerOf(), params])
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const row = await one<{ id: string; source_stream_uid: string | null }>(`select id, source_stream_uid from clip_cuts where id = $1 and owner_id = $2 and status in ('queued', 'failed')`, [id, viewer.id])
  if (!row) return NextResponse.json({ error: "No such upload." }, { status: 404 })
  try {
    if (row.source_stream_uid)
      await deleteVideo(row.source_stream_uid).catch((e: Error & { code?: number }) => {
        if (e.code !== 10003) throw e
      })
    await q(`delete from clip_cuts where id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
