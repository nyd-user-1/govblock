import { NextResponse } from "next/server"
import { isUserId } from "@/lib/auth/contract"
import { readerTrace, trace } from "@/lib/agents/trace"

import { addToCalendar, grantFor, saveSheet, saveToDrive } from "@/lib/agents/connections/google"
import { publicOrigin } from "@/lib/agents/connections/origin"

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
  sessionUri?: string
  action?: "drive" | "calendar" | "sheet"
  /** Drive */
  name?: string
  markdown?: string
  /** Sheet: the header row first, then the rows. */
  rows?: string[][]
  /** Calendar */
  summary?: string
  description?: string
  start?: string
  end?: string
  timeZone?: string
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
  // A claim check shaped like a user id is refused, per the user-id contract.
  // A claim check is safe to take on the caller's word only because it is 122
  // bits of randomness nobody can guess; a `u-` id is a Google `sub`, stable
  // for a person across every app they sign into and therefore knowable by
  // people who are not them. Accepting one here would let a caller open — and
  // later hold — a grant inside somebody else's identity namespace. No grant is
  // keyed that way on the Google side today, which is exactly why this belongs
  // in before one is.
  if (!/^[A-Za-z0-9-]{8,64}$/.test(userId) || isUserId(userId))
    return NextResponse.json({ error: "a claim check is required" }, { status: 400 })

  const action =
    body.action === "calendar" ? "calendar" : body.action === "sheet" ? "sheet" : "drive"
  const origin = publicOrigin(request)

  try {
    // A Sheet is a Drive file, so it rides on the Drive grant — one consent,
    // never a second one dressed up as a different connector.
    const grant = await grantFor(
      userId,
      action === "calendar" ? "calendar" : "drive",
      `${origin}/api/connectors/callback`,
      String(body.sessionUri ?? "").trim() || undefined
    )
    trace("save", {
      action,
      reader: readerTrace(userId),
      carried: Boolean(String(body.sessionUri ?? "").trim()),
      answer: grant.kind,
      status: grant.kind === "pending" ? grant.sessionStatus : undefined,
    })

    if (grant.kind === "pending")
      return NextResponse.json({ connected: false, sessionStatus: grant.sessionStatus })
    if (grant.kind === "authorize")
      return NextResponse.json({
        connected: false,
        authorizeUrl: grant.url,
        sessionUri: grant.sessionUri,
      })

    if (action === "sheet") {
      const rows = Array.isArray(body.rows) ? body.rows : []
      if (!rows.length) return NextResponse.json({ error: "nothing to export" }, { status: 400 })
      const file = await saveSheet({
        accessToken: grant.accessToken,
        name: String(body.name ?? "govblock export").slice(0, 200),
        rows: rows.slice(0, 5000).map((row) => (Array.isArray(row) ? row.map(String) : [String(row)])),
      })
      return NextResponse.json({ connected: true, ...file })
    }

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
      timeZone: body.timeZone ? String(body.timeZone) : undefined,
      url: body.url ? String(body.url) : undefined,
    })
    return NextResponse.json({ connected: true, ...event })
  } catch (error) {
    // The loud failure: this is where a grant that never recorded finally says
    // so, and after tonight it says so somewhere durable too.
    const message = error instanceof Error ? error.message : String(error)
    trace("save.failed", { action, reader: readerTrace(userId), message: message.slice(0, 160) })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
