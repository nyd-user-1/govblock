import { NextResponse } from "next/server"

import { newId, S3_PREFIX, viewerOf } from "@/lib/clips/server"
import { extensionOf, uploadUrl } from "@/lib/clips/storage"
import { q } from "@/lib/policy/db"

// Upload: a reader's own video, to be cut into clips the way a hearing is.
// Nothing is taken without the reader's word that they have the right to
// post it — refused here, and refused again by the table's own check
// (sql/021). The video goes to the private clips bucket on a signed address;
// its clips come out in the reader's library.

export const dynamic = "force-dynamic"

// One signed PUT carries up to 5 GB; a longer upload waits on multipart.
const MAX_BYTES = 5 * 1024 * 1024 * 1024
const VIDEO_TYPES = /^video\/(webm|mp4|quicktime)$/

export async function POST(request: Request) {
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ error: "Sign in to upload a video." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { title?: string; bytes?: number; rights?: boolean; contentType?: string }
  if (body.rights !== true) return NextResponse.json({ error: "Confirm the right to post this video first." }, { status: 400 })
  const title = String(body.title ?? "").trim().slice(0, 150)
  const bytes = Number(body.bytes)
  const contentType = String(body.contentType ?? "").split(";")[0].trim()
  if (!title) return NextResponse.json({ error: "An upload needs a title." }, { status: 400 })
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES) return NextResponse.json({ error: bytes > MAX_BYTES ? "Uploads are 5 GB at most for now." : "That file is empty." }, { status: 400 })
  if (!VIDEO_TYPES.test(contentType)) return NextResponse.json({ error: "Upload an MP4, MOV or WebM video." }, { status: 400 })

  try {
    const id = newId("cut")
    const key = `uploads/${id}/source.${extensionOf(contentType)}`
    const url = await uploadUrl(key, contentType)
    await q(`insert into clip_cuts (id, status, source_url, owner_id, rights_attested_at, title) values ($1, 'queued', $2, $3, now(), $4)`, [id, `${S3_PREFIX}${key}`, viewer.id, title])
    return NextResponse.json({ upload: { id, title, status: "queued", clips: null, createdAt: new Date().toISOString() }, uploadUrl: url })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
