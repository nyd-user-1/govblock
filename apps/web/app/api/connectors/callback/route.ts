import { NextResponse } from "next/server"

// Where the token vault sends the reader back after Google has asked them.
//
// It carries nothing we need: the grant is already in the vault, keyed to the
// claim check that started the flow, and the next call for a token will simply
// find it. So this route's whole job is to put the reader back on the page they
// left, which is the one thing the vault cannot do for us.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const back = url.searchParams.get("state") || "/connectors"
  const failed = url.searchParams.get("error")
  const to = new URL(back.startsWith("/") ? back : "/connectors", url.origin)
  to.searchParams.set(failed ? "connectFailed" : "connected", failed ?? "1")
  return NextResponse.redirect(to)
}
