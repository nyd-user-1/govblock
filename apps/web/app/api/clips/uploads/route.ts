import { NextResponse } from "next/server"

import { newId, viewerOf } from "@/lib/clips/server"
import { createUpload } from "@/lib/policy/cloudflare-stream"
import { q } from "@/lib/policy/db"

// Upload: a reader's own long video, to be cut into clips the way a hearing
// is. Nothing is taken without the reader's word that they have the right to
// post it — refused here, and refused again by the table's own check. The
// video goes to Stream private; its clips come out in the reader's library.

export const dynamic = "force-dynamic"

const MAX_SECONDS = 4 * 60 * 60
const MAX_BYTES = 30 * 1024 * 1024 * 1024

export async function POST(request: Request) {
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ error: "Sign in to upload a video." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { title?: string; bytes?: number; rights?: boolean }
  if (body.rights !== true) return NextResponse.json({ error: "Confirm the right to post this video first." }, { status: 400 })
  const title = String(body.title ?? "").trim().slice(0, 150)
  const bytes = Number(body.bytes)
  if (!title) return NextResponse.json({ error: "An upload needs a title." }, { status: 400 })
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES) return NextResponse.json({ error: "That file is empty or too large." }, { status: 400 })

  try {
    const { uid, uploadUrl } = await createUpload({ bytes, name: title, creator: viewer.id, maxDurationSeconds: MAX_SECONDS, requireSignedURLs: true })
    const id = newId("cut")
    await q(`insert into clip_cuts (id, status, source_stream_uid, owner_id, rights_attested_at, title) values ($1, 'queued', $2, $3, now(), $4)`, [id, uid, viewer.id, title])
    return NextResponse.json({ upload: { id, title, status: "queued" }, uploadUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const full = /^10011:/.test(message)
    return NextResponse.json({ error: full ? "Clips cannot take new video right now." : message }, { status: full ? 503 : 502 })
  }
}
