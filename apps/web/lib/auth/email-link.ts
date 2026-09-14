import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"
import { createHash, randomBytes, randomUUID } from "node:crypto"
import { Resend } from "resend"

import { one } from "@/lib/policy/db"
import { getProfile } from "@/lib/profile"

import { userIdForSubject } from "./contract"

// Email-only sign-in (Brendan, 2026-09-13): no passwords, ever. A reader types
// an address, receives a link, and opening it signs them in. Sign-up and
// sign-in are the same mechanism; an address becomes a reader when its first
// link is opened, and the two differ only in where the link lands.
//
// Only a hash of the token is stored, salted with AUTH_SECRET, so a read of
// `sign_in_links` hands nobody a working link.

/** Where an opened link lands. One place, so the pages' owner can move them. */
export const LANDING = { newReader: "/sign-up#welcome", returning: "/home" } as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOKEN = /^[A-Za-z0-9_-]{43}$/

export type RequestLinkResult = { ok: true } | { ok: false; reason: "invalid" | "too-soon" | "send-failed" }
export type ConsumeLinkResult = { ok: true; id: string; email: string; newReader: boolean } | { ok: false; reason: "expired" | "used" | "unknown" }

export const normalizeEmail = (email: unknown) => String(email ?? "").trim().toLowerCase()

const hashToken = (token: string) => createHash("sha256").update(token + (process.env.AUTH_SECRET ?? "")).digest("hex")

/**
 * The origin the reader typed. Behind Amplify only the forwarded headers carry
 * the public host (see `lib/agents/connections/origin.ts`); on the dev box
 * `AUTH_URL` names port 3000 while Brendan reaches it on 3001, so neither the
 * request URL nor `AUTH_URL` will do.
 */
export function originFrom(headers: Headers): string | null {
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  if (!host) return null
  return `${headers.get("x-forwarded-proto") ?? "https"}://${host}`
}

/**
 * The hosts a link may point at (Brendan, 2026-09-13). The origin comes from
 * request headers anyone can forge, so without this a request naming another
 * server would mail a reader a live token for it. One constant, so it can move
 * to an env var later.
 */
export const LINK_HOSTS = {
  production: ["gov.nysgpt.com", "policy.nysgpt.com", "govblocks.nysgpt.com", "44gov.nysgpt.com"],
  development: ["localhost:3000", "localhost:3001"],
} as const

/** `origin` if a link may point at it: an allowed host, over https except on localhost. */
export function allowedOrigin(origin: string | null): string | null {
  let url: URL
  try {
    url = new URL(origin ?? "")
  } catch {
    return null
  }
  const production: readonly string[] = LINK_HOSTS.production
  const development: readonly string[] = process.env.NODE_ENV !== "production" ? LINK_HOSTS.development : []
  if (production.includes(url.host) && url.protocol === "https:") return url.origin
  if (development.includes(url.host) && (url.protocol === "http:" || url.protocol === "https:")) return url.origin
  return null
}

/**
 * The mark, as a 96px PNG on a white tile, sent inline by content id. Mail
 * clients show neither inline SVG nor SVG images, and a remote image would
 * point at whatever origin the request came from — unreachable from a mail
 * client on the dev box, and blocked by default in Proton and others. The
 * white tile keeps the blue strokes visible when a client darkens the page.
 */
const MARK_CID = "govblock-mark"
const MARK_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAGAAAABgBAMAAAAQtmoLAAAAMFBMVEVMaXH////p6e7///////////////88WX/nucT///8KMWGzGUI/XoTRusjJWniFmLAhV8XNAAAACXRSTlMAz/8bn2FF7ai+hb+lAAAACXBIWXMAACxLAAAsSwGlPZapAAABiklEQVR42u3Yu0oDQRQG4BG1F4xCXiGIl8LCTks7xcrS0scJXmASV2G7HRasw4KFXdKkTmPATsTGTkEwTrLuTOZyzl9q8lfLcj6YXZize0YInd0DSaR2IowcS0bWqvozycp6Wb8kmdkf1y/WuaC5rcGOZGdVgzofNKEnKJ/iHAHX2Ir0mpYllCOxgIEVsYeBC3GKgStxiIHL2Et6Kn7zVr2mcP1mYeS5vBsBryZ4oEFSWBmQ4NYGLyRo26DDAR3P9ayDYU9N0meBDVXlkQESo17lDNAwgfqgQc8CXRJYK1IqI8HdqOp9ct3igBul7iUCRkUpCrK/AGJb1AVEE3AB0WZcQDQyD4i3Sg/wNuMo8GbWgT99FOgeBYEcBT89CgNdFGTQa23NwRz8C5D6ihoh4H52x/kM7Tj3w66zFdzTSXiLDrxg6ueEbjNTvz9G0gBIeCsK/MKFO6U0Bo6h5zHyL2cug0caeGiCxzJ48INHS3h4xcdjeACHR3z8EAE+poAPQvCjFvwwBzku+gavB71Sy4N0tQAAAABJRU5ErkJggg=="

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** The link email: the mark, the line, one button, the raw link, how long it lasts. Inline CSS and tables, for mail clients. */
function linkEmail(link: string) {
  const href = escapeHtml(link)
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Sign in to GovBlock</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${font};color:#1a1a1a;">
<tr><td style="padding:0 0 32px 0;"><img src="cid:${MARK_CID}" width="48" height="48" alt="GovBlock" style="display:block;width:48px;height:48px;border:0;outline:none;"></td></tr>
<tr><td style="padding:0 0 28px 0;font-family:${font};font-size:24px;line-height:32px;font-weight:600;color:#0a3161;">Sign in to GovBlock</td></tr>
<tr><td style="padding:0 0 20px 0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="#0a3161" style="background-color:#0a3161;border-radius:6px;"><a href="${href}" style="display:inline-block;padding:12px 32px;font-family:${font};font-size:16px;line-height:24px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Sign in</a></td>
</tr></table>
</td></tr>
<tr><td style="padding:0 0 28px 0;font-family:${font};font-size:12px;line-height:18px;color:#555555;word-break:break-all;"><a href="${href}" style="color:#0a3161;text-decoration:underline;">${href}</a></td></tr>
<tr><td style="padding:20px 0 0 0;border-top:2px solid #b31942;font-family:${font};font-size:14px;line-height:20px;color:#1a1a1a;">The link is good for 15 minutes and works once.</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
  const text = `Sign in to GovBlock\n\nSign in: ${link}\n\nThe link is good for 15 minutes and works once.\n`
  return { html, text }
}

export async function requestLink(email: string, origin: string): Promise<RequestLinkResult> {
  const allowed = allowedOrigin(origin)
  if (!allowed) {
    console.warn(`email-link: refused origin ${JSON.stringify(origin)}`)
    return { ok: false, reason: "invalid" }
  }
  origin = allowed
  const address = normalizeEmail(email)
  if (!EMAIL.test(address) || address.length > 254) return { ok: false, reason: "invalid" }

  const token = randomBytes(32).toString("base64url")
  // The limit and the insert are one statement: no more than one link per
  // address per 60 seconds, no more than five an hour.
  let row: { token_hash: string } | null
  try {
    row = await one<{ token_hash: string }>(
      `insert into sign_in_links (token_hash, email, expires_at)
       select $1, $2, now() + interval '15 minutes'
       where not exists (select 1 from sign_in_links where email = $2 and created_at > now() - interval '60 seconds')
         and (select count(*) from sign_in_links where email = $2 and created_at > now() - interval '1 hour') < 5
       returning token_hash`,
      [hashToken(token), address]
    )
  } catch (error) {
    console.error("email-link: sign_in_links unavailable", error)
    return { ok: false, reason: "send-failed" }
  }
  if (!row) return { ok: false, reason: "too-soon" }

  const link = `${origin}/api/auth/link?token=${token}`
  if (process.env.NODE_ENV === "development") console.log(`email-link: ${address} ${link}`)

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("email-link: RESEND_API_KEY is not set")
    return { ok: false, reason: "send-failed" }
  }
  try {
    const { html, text } = linkEmail(link)
    const { error } = await new Resend(apiKey).emails.send({
      from: process.env.RESEND_FROM_EMAIL || "GovBlock <onboarding@resend.dev>",
      to: [address],
      subject: "Sign in to GovBlock",
      html,
      text,
      attachments: [{ filename: "govblock.png", content: MARK_PNG, contentId: MARK_CID }],
    })
    if (error) {
      console.error("email-link: send refused", error)
      return { ok: false, reason: "send-failed" }
    }
  } catch (error) {
    console.error("email-link: send failed", error)
    return { ok: false, reason: "send-failed" }
  }
  return { ok: true }
}

/**
 * The reader with this address, created with `id` if there is none. `created`
 * says which. One person, one id, however they arrive.
 */
export async function claimReader(email: string, id: string): Promise<{ id: string; created: boolean }> {
  const row = await one<{ id: string; created: boolean }>(
    `insert into readers (id, email, last_sign_in) values ($1, $2, now())
     on conflict (email) do update set last_sign_in = now()
     returning id, (xmax = 0) as created`,
    [id, normalizeEmail(email)]
  )
  if (!row) throw new Error("readers: upsert returned nothing")
  return { id: row.id, created: !!row.created }
}

export async function consumeLink(token: string): Promise<ConsumeLinkResult> {
  if (!TOKEN.test(token)) return { ok: false, reason: "unknown" }
  const hash = hashToken(token)
  // Both CTEs read the same snapshot, so `link` is the row as it was and
  // `spent` is the one-use claim; a second, concurrent open waits on the row
  // lock and finds `used_at` already set.
  const row = await one<{ email: string; live: boolean; used: boolean; claimed: string | null }>(
    `with link as (select email, expires_at > now() as live, used_at is not null as used from sign_in_links where token_hash = $1),
     spent as (update sign_in_links set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning email)
     select link.email, link.live, link.used, (select email from spent) as claimed from link`,
    [hash]
  )
  if (!row) return { ok: false, reason: "unknown" }
  if (!row.claimed) return { ok: false, reason: row.used ? "used" : "expired" }

  const minted = userIdForSubject(randomUUID())
  if (!minted) throw new Error("email-link: minted id breaks the contract")
  const reader = await claimReader(row.claimed, minted)
  // New means the welcome step is unfinished (Brendan, 2026-09-13), not that
  // the reader row is: one who skipped it is sent back there by the next link.
  const profile = await getProfile(reader.id)
  return { ok: true, id: reader.id, email: row.claimed, newReader: !profile?.completed_at }
}

/**
 * Carries `consumeLink`'s result from the provider's `authorize` back to the
 * route that called `signIn`, which Auth.js otherwise reduces to a bare
 * success or failure. Scoped to the one request.
 */
export const linkOutcome = new AsyncLocalStorage<{ result?: ConsumeLinkResult }>()
