import { NextResponse } from "next/server"

import { getClip, listClips, newId, viewerOf } from "@/lib/clips/server"
import { extensionOf, uploadUrl } from "@/lib/clips/storage"
import { q } from "@/lib/policy/db"

// Clips in Aurora, for /clips. GET is the feed: every published public clip,
// whatever made it, and the signed-in reader's own. POST starts a recording's
// upload: the row is written in `processing`, the server hands back signed
// addresses for the video and its poster in the clips bucket, the browser
// sends both there itself, and /api/clips/[id]/complete publishes the row
// once the video has arrived. Recording needs an account; the feed does not.

export const dynamic = "force-dynamic"

const MAX_RECORDING_BYTES = 1024 * 1024 * 1024
const VIDEO_TYPES = /^video\/(webm|mp4|quicktime)(;.*)?$/

export async function GET() {
  const viewer = await viewerOf()
  try {
    return NextResponse.json(await listClips(viewer?.id ?? null), { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    return NextResponse.json({ published: [], mine: [], uploads: [], error: error instanceof Error ? error.message : String(error) }, { status: 200 })
  }
}

export async function POST(request: Request) {
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ error: "Sign in to record a clip." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { title?: string; caption?: string; visibility?: string; bytes?: number; contentType?: string; duration?: number; poster?: boolean }
  const title = String(body.title ?? "").trim().slice(0, 150)
  const caption = String(body.caption ?? "").trim().slice(0, 2200)
  const visibility = body.visibility === "public" ? "public" : "private"
  const bytes = Number(body.bytes)
  // The codecs a recorder names ("video/webm;codecs=vp9,opus") are left off: the signed address holds the bare type, and the browser sends the same.
  const contentType = String(body.contentType ?? "").split(";")[0].trim()
  const duration = Number(body.duration)
  if (!title) return NextResponse.json({ error: "A clip needs a title." }, { status: 400 })
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_RECORDING_BYTES) return NextResponse.json({ error: "That recording is empty or too large." }, { status: 400 })
  if (!VIDEO_TYPES.test(contentType)) return NextResponse.json({ error: "That recording is not a video this page can keep." }, { status: 400 })

  try {
    const id = newId("clp")
    const videoKey = `clips/${id}/video.${extensionOf(contentType)}`
    const posterKey = body.poster ? `clips/${id}/poster.jpg` : null
    const [video, poster] = await Promise.all([uploadUrl(videoKey, contentType), posterKey ? uploadUrl(posterKey, "image/jpeg") : null])
    await q(`insert into clips (id, video_key, poster_key, origin, status, visibility, owner_id, title, caption, duration) values ($1, $2, $3, 'recorded', 'processing', $4, $5, $6, $7, $8)`, [
      id,
      videoKey,
      posterKey,
      visibility,
      viewer.id,
      title,
      caption,
      Number.isFinite(duration) && duration > 0 ? duration : null,
    ])
    return NextResponse.json({ clip: await getClip(id, viewer.id), uploadUrl: video, posterUrl: poster })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
