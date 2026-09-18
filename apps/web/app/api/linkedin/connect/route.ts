import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"

import { authorizeUrl, credentials } from "@/lib/linkedin/api"
import { adminId, refused } from "@/lib/linkedin/session"

// GET /api/linkedin/connect: off to LinkedIn to grant the app its scopes. The
// state rides in a cookie so the callback knows the answer is to this request.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await adminId())) return refused()
  if (!credentials()) return NextResponse.json({ error: "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are not set." }, { status: 500 })
  const state = randomBytes(16).toString("base64url")
  const response = NextResponse.redirect(authorizeUrl(request, state))
  response.cookies.set("linkedin_state", state, { httpOnly: true, sameSite: "lax", secure: !request.url.startsWith("http://"), path: "/api/linkedin", maxAge: 600 })
  return response
}
