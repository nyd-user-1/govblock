import { NextResponse } from "next/server"

import { publicOrigin } from "@/lib/agents/connections/origin"
import { trace } from "@/lib/agents/trace"

// Where the token vault sends the reader back after Google has asked them.
//
// It carries nothing we need: the grant is already in the vault, keyed to the
// claim check that started the flow, and the next call for a token will simply
// find it. So this route's whole job is to put the reader back on the page they
// left, which is the one thing the vault cannot do for us.
//
// Two things it got wrong, both live until Brendan walked the real flow:
//
// 1. The origin came from `new URL(request.url)`, which on Amplify's SSR
//    compute is `https://localhost:3000` — the request reaches the function on
//    an internal URL and only the forwarded headers carry the host the reader
//    typed. Brendan finished the Drive consent and the last hop sent him to
//    `https://localhost:3000/connectors?connected=1`, refused. The vault's own
//    leg had been fine, because AgentCore checks its return URL against the
//    registered one and fails loudly; ours built a link and failed silently,
//    which is exactly the shape the publicOrigin trap warns about.
//
// 2. `state` was trusted if it began with "/", and "//example.com/x" begins
//    with "/". `new URL("//example.com/x", origin)` is a protocol-relative
//    reference and resolves to **example.com** — a link through our own
//    callback landed the reader on any host an attacker chose. Proved against
//    the deploy before it was fixed. A path is now a path: one leading slash,
//    no second one, no backslash, and anything else goes to /connectors.

export const dynamic = "force-dynamic"

/** A same-site path, or nothing. Protocol-relative and absolute both fail. */
function safePath(value: string | null) {
  if (!value) return "/connectors"
  if (!value.startsWith("/")) return "/connectors"
  if (value.startsWith("//") || value.startsWith("/\\")) return "/connectors"
  return value
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const failed = url.searchParams.get("error")
  const to = new URL(safePath(url.searchParams.get("state")), publicOrigin(request))
  to.searchParams.set(failed ? "connectFailed" : "connected", failed ?? "1")
  // The vault reaches this route with no identity we can read — the grant it
  // just recorded is keyed to a claim check that lives in the browser, not in
  // this request. So the useful facts are that the leg ran at all, whether
  // Google refused, and which origin we resolved: the localhost bounce would
  // have been one line here instead of a night.
  trace("callback", {
    outcome: failed ? "error" : "ok",
    error: failed ?? undefined,
    params: [...url.searchParams.keys()].join(","),
    origin: publicOrigin(request),
  })
  return NextResponse.redirect(to)
}
