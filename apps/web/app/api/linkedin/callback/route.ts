import { NextResponse } from "next/server"

import { exchangeCode, member, publicOrigin } from "@/lib/linkedin/api"
import { adminId, refused } from "@/lib/linkedin/session"
import { saveAccount } from "@/lib/linkedin/store"

// GET /api/linkedin/callback: LinkedIn's answer. The code becomes a token,
// the token says who the member is, and both are kept; then back to /content-calendar,
// which reads `linkedin=` to say how it went.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const userId = await adminId()
  if (!userId) return refused()
  const url = new URL(request.url)
  const back = (outcome: string) => {
    const response = NextResponse.redirect(`${publicOrigin(request)}/content-calendar?linkedin=${encodeURIComponent(outcome)}`)
    response.cookies.delete({ name: "linkedin_state", path: "/api/linkedin" })
    return response
  }

  const expected = request.headers.get("cookie")?.match(/(?:^|;\s*)linkedin_state=([^;]+)/)?.[1]
  if (url.searchParams.get("error")) return back(url.searchParams.get("error_description") ?? url.searchParams.get("error")!)
  const code = url.searchParams.get("code")
  if (!code || !expected || url.searchParams.get("state") !== expected) return back("The sign-in expired or did not match. Try Connect again.")

  try {
    const grant = await exchangeCode(request, code)
    const who = await member(grant.token)
    await saveAccount({ userId, memberUrn: who.urn, name: who.name, picture: who.picture, token: grant.token, expiresIn: grant.expiresIn, scope: grant.scope })
    return back("connected")
  } catch (error) {
    return back(error instanceof Error ? error.message : String(error))
  }
}
