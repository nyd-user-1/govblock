import { NextResponse } from "next/server"

import { signIn } from "@/lib/auth/config"
import { LANDING, allowedOrigin, linkOutcome, originFrom, type ConsumeLinkResult } from "@/lib/auth/email-link"

// The link in the email. A live token signs the reader in and lands them: a new
// reader on the welcome step, a returning one at home. Anything else — spent,
// expired, unknown, or a sign-in that failed after the token was accepted —
// goes back to /auth with LinkExpired.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? ""
  const store: { result?: ConsumeLinkResult } = {}
  let signedIn = false
  try {
    const url: unknown = await linkOutcome.run(store, () => signIn("email-link", { token, redirect: false }))
    signedIn = !(typeof url === "string" && url.includes("error="))
  } catch (error) {
    if (store.result?.ok !== false) console.error("email-link: sign-in failed", error)
  }

  const result = store.result
  const to = signedIn && result?.ok ? (result.newReader ? LANDING.newReader : LANDING.returning) : "/sign-in?error=LinkExpired"
  // A forged host must not steer the landing either; the request URL is the fallback.
  return NextResponse.redirect(new URL(to, allowedOrigin(originFrom(request.headers)) ?? request.url), 303)
}
