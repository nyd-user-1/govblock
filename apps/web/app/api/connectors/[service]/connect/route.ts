import { NextResponse } from "next/server"

import { grantFor, type GoogleService } from "@/lib/agents/connections/google"
import { publicOrigin } from "@/lib/agents/connections/origin"

// Start — or resume — a reader's Google connection.
//
// One call answers both questions the caller has: `{connected:true}` when the
// vault already holds a grant for this browser and this scope, and a URL to
// send them to when it does not. There is no local record of who has connected
// what, so there is nothing to fall out of date with the vault.

export const dynamic = "force-dynamic"

const SERVICES = new Set<GoogleService>(["drive", "calendar"])

export async function POST(request: Request, { params }: { params: Promise<{ service: string }> }) {
  const { service } = await params
  if (!SERVICES.has(service as GoogleService))
    return NextResponse.json({ error: `unknown service ${service}` }, { status: 404 })

  let body: { claimCheck?: string; sessionUri?: string; force?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 })
  }

  // The claim check is the vault's user id. It arrives from the browser that
  // minted it; we neither store it nor learn anything else about who sent it.
  const userId = String(body.claimCheck ?? "").trim()
  if (!/^[A-Za-z0-9-]{8,64}$/.test(userId))
    return NextResponse.json({ error: "a claim check is required" }, { status: 400 })

  const origin = publicOrigin(request)
  try {
    // The session the browser is holding, if it has one: without it the vault
    // opens a new authorization every time and can never report the one the
    // reader just completed.
    const session = String(body.sessionUri ?? "").trim() || undefined
    const grant = await grantFor(
      userId,
      service as GoogleService,
      `${origin}/api/connectors/callback`,
      session,
      body.force === true
    )
    if (grant.kind === "token") return NextResponse.json({ connected: true })
    if (grant.kind === "pending")
      return NextResponse.json({ connected: false, sessionStatus: grant.sessionStatus })
    return NextResponse.json({
      connected: false,
      authorizeUrl: grant.url,
      sessionUri: grant.sessionUri,
      sessionStatus: grant.sessionStatus,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    )
  }
}
