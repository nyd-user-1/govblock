import { NextResponse } from "next/server"

import { newId, viewerOf } from "@/lib/clips/server"
import { q } from "@/lib/policy/db"

// Clip a video (Brendan, 2026-09-14): a reader pastes a link to a long video
// and it is queued to be cut into clips the way a hearing is. Links only; no
// file uploads.

export const dynamic = "force-dynamic"

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
    const id = newId("cut")
    const title = `${url.hostname.replace(/^www\./, "")}${url.pathname === "/" ? "" : url.pathname}`.slice(0, 150)
    await q(`insert into clip_cuts (id, status, source_url, owner_id, title) values ($1, 'queued', $2, $3, $4)`, [id, url.toString(), viewer.id, title])
    return NextResponse.json({ upload: { id, title, status: "queued", clips: null, createdAt: new Date().toISOString() } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
