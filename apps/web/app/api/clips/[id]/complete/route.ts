import { NextResponse } from "next/server"

import { getClip, getClipRow, viewerOf } from "@/lib/clips/server"
import { removeObjects, stat } from "@/lib/clips/storage"
import { q } from "@/lib/policy/db"

// A recording's upload, finished: the browser says so, the server looks in the
// bucket, and a video that arrived whole publishes the row (to its owner alone
// while it is private). One that did not arrive, or arrived over the limit,
// is refused and the row stays `processing` for the owner to delete.

export const dynamic = "force-dynamic"

const MAX_RECORDING_BYTES = 1024 * 1024 * 1024

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([viewerOf(), params])
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const row = await getClipRow(id)
  if (!row || row.owner_id !== viewer.id || row.status === "removed" || !row.video_key) return NextResponse.json({ error: "No such clip." }, { status: 404 })
  if (row.status !== "processing") return NextResponse.json({ clip: await getClip(id, viewer.id) })
  const video = await stat(row.video_key)
  if (!video || !video.bytes) return NextResponse.json({ error: "The recording did not arrive." }, { status: 409 })
  if (video.bytes > MAX_RECORDING_BYTES) {
    await removeObjects([row.video_key, row.poster_key])
    return NextResponse.json({ error: "That recording is too large." }, { status: 413 })
  }
  const poster = row.poster_key ? await stat(row.poster_key) : null
  await q(`update clips set status = 'published', published_at = now(), poster_key = $2 where id = $1`, [id, poster ? row.poster_key : null])
  return NextResponse.json({ clip: await getClip(id, viewer.id) })
}
