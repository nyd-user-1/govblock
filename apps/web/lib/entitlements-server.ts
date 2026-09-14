import "server-only"

import { presentedKey, resolveApiKey, type ResolvedKey } from "@/lib/api-keys"
import { auth } from "@/lib/auth/config"
import { ANONYMOUS, entitled, reasonFor, type Ask, type Reader, type Verdict } from "@/lib/entitlements"
import { hasApiAccess } from "@/lib/plans"
import { latestSession } from "@/lib/policy/db-queries"

// The entitlement rule as the server applies it (Brendan, 2026-09-13): the
// reader from the session cookie, the jurisdiction's current session from
// the ledger, and a 403 that carries the same sentence the gate shows. The
// site's own agents call the API without a cookie; `GOVBLOCK_INTERNAL_KEY`
// in a header stands in for a plan for them, when it is set.

/** The API key on the request, resolved, or null when none was sent or it is unknown. Never throws. */
export async function apiKeyOf(request?: Request): Promise<ResolvedKey | null> {
  const presented = request ? presentedKey(request) : null
  if (!presented) return null
  try {
    return await resolveApiKey(presented)
  } catch {
    return null
  }
}

/** A keyed caller as the rule sees them (2026-09-13): the plan's license, the reader's home state. */
export const readerForKey = (key: ResolvedKey): Reader => ({ signedIn: true, home: key.home, license: !hasApiAccess(key.plan) ? "none" : key.plan === "team" ? "team" : "paid" })

export async function readerOf(request?: Request): Promise<Reader> {
  const key = process.env.GOVBLOCK_INTERNAL_KEY
  if (key && request?.headers.get("x-govblock-key") === key) return { signedIn: true, home: null, license: "paid" }
  const apiKey = await apiKeyOf(request)
  if (apiKey) return readerForKey(apiKey)
  try {
    const session = await auth()
    const user = session?.user as { id?: string; home?: string | null; admin?: boolean } | undefined
    if (user?.id) return { signedIn: true, home: user.home ?? null, license: "none", admin: user.admin === true }
  } catch {
    // No session endpoint configured: everyone is a stranger.
  }
  return ANONYMOUS
}

/** The jurisdiction's current session — the newest with bills — for the rule to compare against. */
export const currentSession = (state: string) => latestSession(state)

export type Refusal = { status: 403; body: { error: string; detail: string; verdict: Verdict } & Ask }

/** Open, or the refusal to send back. */
export async function gate(request: Request, ask: Ask): Promise<{ reader: Reader; verdict: Verdict; refusal: Refusal | null }> {
  const reader = await readerOf(request)
  const verdict = entitled(reader, ask)
  if (verdict === "open") return { reader, verdict, refusal: null }
  const reason = reasonFor(reader, ask)
  return { reader, verdict, refusal: { status: 403, body: { error: reason.title, detail: reason.body, verdict, ...ask } } }
}

/** What the free scope may cache in public: anything a stranger could open. Everything else is one reader's. */
export const cacheFor = (ask: Ask, publicHeader: string) => (entitled(ANONYMOUS, ask) === "open" ? publicHeader : "private, no-store")
