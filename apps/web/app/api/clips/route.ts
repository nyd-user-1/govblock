import { NextResponse } from "next/server"

import { getClip, listClips, newId, viewerOf } from "@/lib/clips/server"
import { createUpload } from "@/lib/policy/cloudflare-stream"
import { q } from "@/lib/policy/db"

// Clips in Aurora, for /clips. GET is the feed: every published public clip,
// whatever made it, and the signed-in reader's own. POST starts a recording's
// upload: the row is written, Stream hands back a one-time tus address, and
// the browser sends the take there itself. Recording needs an account; the
// feed does not.

export const dynamic = "force-dynamic"

const RECORDING_SECONDS = 60
const MAX_BYTES = 1024 * 1024 * 1024

export async function GET() {
  const viewer = await viewerOf()
  try {
    return NextResponse.json(await listClips(viewer?.id ?? null), { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    return NextResponse.json({ published: [], mine: [], error: error instanceof Error ? error.message : String(error) }, { status: 200 })
  }
}

export async function POST(request: Request) {
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ error: "Sign in to record a clip." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { title?: string; caption?: string; visibility?: string; bytes?: number }
  const title = String(body.title ?? "").trim().slice(0, 150)
  const caption = String(body.caption ?? "").trim().slice(0, 2200)
  const visibility = body.visibility === "public" ? "public" : "private"
  const bytes = Number(body.bytes)
  if (!title) return NextResponse.json({ error: "A clip needs a title." }, { status: 400 })
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES) return NextResponse.json({ error: "That recording is empty or too large." }, { status: 400 })

  try {
    // A little over the minute, so a take stopped at 60.0 s is not refused.
    const { uid, uploadUrl } = await createUpload({ bytes, name: title, creator: viewer.id, maxDurationSeconds: RECORDING_SECONDS + 5, requireSignedURLs: visibility === "private" })
    const id = newId("clp")
    await q(`insert into clips (id, stream_uid, origin, status, visibility, owner_id, title, caption) values ($1, $2, 'recorded', 'processing', $3, $4, $5, $6)`, [id, uid, visibility, viewer.id, title, caption])
    return NextResponse.json({ clip: await getClip(id, viewer.id), uploadUrl })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // 10011: the account has no Stream minutes left to store into.
    const full = /^10011:/.test(message)
    return NextResponse.json({ error: full ? "Clips cannot take new video right now." : message }, { status: full ? 503 : 502 })
  }
}
