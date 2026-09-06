import { NextResponse } from "next/server"

import { getTraffic, refreshIfStale } from "@/lib/policy/traffic"

// The site's traffic for the Admin experience's Traffic page: Cloudflare's
// zone analytics and Amplify's metrics, from the copies Aurora keeps, with
// the Cloudflare side re-read from the API when the copy is older than six
// hours. `?days=` widens the window; `?refresh=1` forces the re-read.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  try {
    const refresh = await refreshIfStale(sp.get("refresh") === "1" ? 0 : 6)
    const data = await getTraffic(Math.min(400, Math.max(7, Number(sp.get("days") ?? 90))))
    return NextResponse.json({ ...data, refresh }, { headers: { "cache-control": "private, max-age=300" } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("traffic failed", message)
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
