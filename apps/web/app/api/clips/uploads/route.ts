import { NextResponse } from "next/server"

import { newId, viewerOf } from "@/lib/clips/server"
import { youtubeId } from "@/lib/clips/youtube"
import { one, q } from "@/lib/policy/db"

// Clip a video (Brendan, 2026-09-14): a reader pastes a link to a long video
// and it is queued to be cut into clips. Links only; no file uploads. A
// YouTube link is cut by the site itself (POST ./[id]/cut, which the browser
// drives step by step); any other link waits for the worker box.

export const dynamic = "force-dynamic"

/** Links a reader may queue in a day; an admin has no cap. */
const DAILY = 10

export async function POST(request: Request) {
  const viewer = await viewerOf()
  if (!viewer) return NextResponse.json({ error: "Sign in to clip a video." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { url?: string }
  let url: URL
  try {
    url = new URL(String(body.url ?? "").trim())
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error()
  } catch {
    return NextResponse.json({ error: "Paste a link that starts with https://." }, { status: 400 })
  }
  try {
    if (!viewer.admin) {
      const today = await one<{ count: number }>(`select count(*)::int count from clip_cuts where owner_id = $1 and created_at > now() - interval '1 day'`, [viewer.id])
      if ((today?.count ?? 0) >= DAILY) return NextResponse.json({ error: `${DAILY} links a day; try again tomorrow.` }, { status: 429 })
    }
    const videoId = youtubeId(url.toString())
    const id = newId("cut")
    const title = videoId ? `youtube.com/watch?v=${videoId}` : `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`.slice(0, 150)
    await q(`insert into clip_cuts (id, status, source_url, owner_id, title, video_id) values ($1, 'queued', $2, $3, $4, $5)`, [id, videoId ? `https://www.youtube.com/watch?v=${videoId}` : url.toString(), viewer.id, title, videoId])
    return NextResponse.json({ upload: { id, title, status: "queued", clips: null, error: null, videoId, createdAt: new Date().toISOString() } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
