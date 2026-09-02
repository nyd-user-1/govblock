import { NextResponse } from "next/server"

import { addToCalendar, grantFor, saveToDrive } from "@/lib/agents/connections/google"

// Act on a reader's Google grant: save a report to their Drive, or put a
// hearing on their calendar.
//
// If the vault has no grant this answers with the authorize URL rather than an
// error — the caller sends them to consent and tries again, which is the same
// branch the Connect button takes. A reader who clicks "Save to Drive" without
// having connected first gets asked, not scolded.

export const dynamic = "force-dynamic"
export const maxDuration = 60

type Body = {
  claimCheck?: string
  action?: "drive" | "calendar"
  /** Drive */
  name?: string
  markdown?: string
  /** Calendar */
  summary?: string
  description?: string
  start?: string
  end?: string
  url?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 })
  }

  const userId = String(body.claimCheck ?? "").trim()
  if (!/^[A-Za-z0-9-]{8,64}$/.test(userId))
    return NextResponse.json({ error: "a claim check is required" }, { status: 400 })

  const action = body.action === "calendar" ? "calendar" : "drive"
  const origin = new URL(request.url).origin

  try {
    const grant = await grantFor(userId, action, `${origin}/api/connectors/callback`)
    if (grant.kind === "authorize")
      return NextResponse.json({ connected: false, authorizeUrl: grant.url })

    if (action === "drive") {
      const markdown = String(body.markdown ?? "")
      if (!markdown.trim()) return NextResponse.json({ error: "nothing to save" }, { status: 400 })
      const file = await saveToDrive({
        accessToken: grant.accessToken,
        name: String(body.name ?? "govblock report").slice(0, 200),
        markdown,
      })
      return NextResponse.json({ connected: true, ...file })
    }

    const start = String(body.start ?? "").trim()
    if (!start) return NextResponse.json({ error: "a start date is required" }, { status: 400 })
    const event = await addToCalendar({
      accessToken: grant.accessToken,
      summary: String(body.summary ?? "Hearing").slice(0, 200),
      description: body.description ? String(body.description) : undefined,
      start,
      end: body.end ? String(body.end) : undefined,
      url: body.url ? String(body.url) : undefined,
    })
    return NextResponse.json({ connected: true, ...event })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    )
  }
}
