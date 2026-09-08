import { NextResponse } from "next/server"

import { copyFromUrl, createLiveInput, deleteLiveInput, deleteVideo, getStream } from "@/lib/policy/cloudflare-stream"

// Cloudflare Stream for the Admin experience's Stream page. GET is the
// library, the live inputs and whether the token can reach Stream. POST
// takes an action: copy (import from a URL), live (a new live input),
// delete-video, delete-live. The token never leaves the server.

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await getStream(), { headers: { "cache-control": "private, no-store" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, reason: message, needs: "unknown", videos: [], live: [] }, { status: 200 })
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { action?: string; url?: string; name?: string; uid?: string }
  try {
    switch (body.action) {
      case "copy":
        if (!body.url || !/^https?:\/\//.test(body.url)) return NextResponse.json({ error: "a public http(s) URL is required" }, { status: 400 })
        return NextResponse.json(await copyFromUrl(body.url, body.name ?? ""))
      case "live":
        return NextResponse.json(await createLiveInput(body.name ?? ""))
      case "delete-video":
        if (!body.uid) return NextResponse.json({ error: "uid is required" }, { status: 400 })
        await deleteVideo(body.uid)
        return NextResponse.json({ ok: true })
      case "delete-live":
        if (!body.uid) return NextResponse.json({ error: "uid is required" }, { status: 400 })
        await deleteLiveInput(body.uid)
        return NextResponse.json({ ok: true })
      default:
        return NextResponse.json({ error: `unknown action ${body.action ?? ""}` }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
