import { NextResponse } from "next/server"

import { publicOrigin } from "@/lib/agents/connections/origin"
import { identify } from "@/lib/auth/user-id"

import { SLACK_REDIRECT_REGISTERED, SLACK_SCOPES, slackGrantFor } from "../grant"

// Start — or resume — a reader's Slack connection.
//
// The same call answers both questions: `{connected:true}` when the vault
// already holds a grant, and a URL to send them to when it does not. There is no
// local record of who has connected what, so nothing can fall out of date with
// the vault.
//
// **This route keys on `identify()`, not on a bare regex.** Lane X's Google
// connect route validates the claim check against `^[A-Za-z0-9-]{8,64}$` and
// forwards it, which was right when a claim check was the only kind of key
// there was. It is necessary but no longer sufficient: a signed-in reader's id
// is a Google `sub`, which is stable for a person across every app they sign
// into and therefore knowable by people who are not them. Taking one on the
// caller's word would hand the sender that person's grants. `identify()`
// prefers a real session, falls back to the claim check unchanged, and refuses
// a claim check shaped like a user id. Slack gets that from its first day
// rather than by retrofit.

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: { claimCheck?: string; sessionUri?: string; force?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 })
  }

  const identity = await identify(body.claimCheck)
  if (!identity)
    return NextResponse.json({ error: "a session or a claim check is required" }, { status: 400 })

  // The honest state, and the reason it is 200 rather than an error: nothing has
  // gone wrong. The provider is READY and the code is finished; one console
  // paste on Brendan's side is outstanding, and a caller that asked a fair
  // question deserves a plain answer rather than a fault it might retry.
  if (!SLACK_REDIRECT_REGISTERED)
    return NextResponse.json({
      connected: false,
      unavailable: true,
      reason:
        "Slack's OAuth client exists and the token vault is ready, but govblock's redirect URL has not been added to the Slack app yet. That is ours to finish, not yours — until it is, consent would fail on Slack's own page.",
    })

  try {
    const grant = await slackGrantFor(
      identity.id,
      `${publicOrigin(request)}/api/connectors/callback`,
      body.sessionUri,
      body.force === true
    )
    if (grant.kind === "token") return NextResponse.json({ connected: true })
    if (grant.kind === "authorize")
      return NextResponse.json({
        connected: false,
        authorizeUrl: grant.url,
        // The browser MUST hand this back on the next call. Without it the vault
        // opens a fresh session and every check asks a question nobody answered.
        sessionUri: grant.sessionUri,
        scopes: SLACK_SCOPES,
      })
    return NextResponse.json({ connected: false, pending: true, sessionStatus: grant.sessionStatus })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    )
  }
}
