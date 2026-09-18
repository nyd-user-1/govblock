import "server-only"

// LinkedIn over HTTP: the sign-in handshake, who the member is, which pages
// they administer, and a post. Nothing here touches the database.
//
// Scopes. "Share on LinkedIn" and "Sign In with LinkedIn using OpenID Connect"
// give openid, profile and w_member_social: a post to the member's own
// profile. A company page needs the Community Management API's organization
// scopes, which LinkedIn grants on review; they are asked for only once
// LINKEDIN_ORGANIZATION=1, since asking for a scope the app lacks fails the
// whole sign-in.

const AUTHORIZE = "https://www.linkedin.com/oauth/v2/authorization"
const TOKEN = "https://www.linkedin.com/oauth/v2/accessToken"
const API = "https://api.linkedin.com"

const MEMBER_SCOPES = ["openid", "profile", "w_member_social"]

export function scopes(): string[] {
  if (process.env.LINKEDIN_ORGANIZATION !== "1") return MEMBER_SCOPES
  const org = (process.env.LINKEDIN_ORGANIZATION_SCOPES ?? "w_organization_social rw_organization_admin").split(/\s+/).filter(Boolean)
  return [...MEMBER_SCOPES, ...org]
}

export function credentials() {
  const id = process.env.LINKEDIN_CLIENT_ID
  const secret = process.env.LINKEDIN_CLIENT_SECRET
  return id && secret ? { id, secret } : null
}

/**
 * The origin the reader typed, for the redirect URL LinkedIn matches exactly.
 * Amplify's compute sees an internal URL, so the forwarded host wins; a local
 * host is plain http.
 */
export function publicOrigin(request: Request) {
  const headers = request.headers
  const host = headers.get("x-forwarded-host") ?? headers.get("host")
  if (!host) return new URL(request.url).origin
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  const proto = headers.get("x-forwarded-proto") ?? (local ? "http" : "https")
  return `${proto}://${host}`
}

export const redirectUri = (request: Request) => `${publicOrigin(request)}/api/linkedin/callback`

export function authorizeUrl(request: Request, state: string) {
  const creds = credentials()
  if (!creds) throw new Error("LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are not set")
  const url = new URL(AUTHORIZE)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", creds.id)
  url.searchParams.set("redirect_uri", redirectUri(request))
  url.searchParams.set("state", state)
  url.searchParams.set("scope", scopes().join(" "))
  return url.toString()
}

export async function exchangeCode(request: Request, code: string) {
  const creds = credentials()
  if (!creds) throw new Error("LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are not set")
  const response = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(request),
      client_id: creds.id,
      client_secret: creds.secret,
    }),
  })
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; scope?: string; error_description?: string }
  if (!response.ok || !body.access_token) throw new Error(body.error_description ?? `LinkedIn refused the code (${response.status})`)
  return { token: body.access_token, expiresIn: body.expires_in ?? 60 * 86_400, scope: body.scope ?? "" }
}

export async function member(token: string) {
  const response = await fetch(`${API}/v2/userinfo`, { headers: { authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error(`LinkedIn did not say who signed in (${response.status})`)
  const body = (await response.json()) as { sub: string; name?: string; picture?: string }
  return { urn: `urn:li:person:${body.sub}`, name: body.name ?? null, picture: body.picture ?? null }
}

// The versioned REST API names a month, YYYYMM, and retires each after about
// a year. LINKEDIN_API_VERSION pins one; otherwise the newest of the last few
// months that LinkedIn still answers is used.
function versions(): string[] {
  const pinned = process.env.LINKEDIN_API_VERSION
  const now = new Date()
  const months = [1, 2, 3, 4].map((back) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1))
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`
  })
  return pinned ? [pinned, ...months.filter((m) => m !== pinned)] : months
}

async function rest(token: string, path: string, init: RequestInit = {}) {
  let last: Response | null = null
  for (const version of versions()) {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "linkedin-version": version,
        "x-restli-protocol-version": "2.0.0",
        "content-type": "application/json",
        ...init.headers,
      },
    })
    // 426: that month's version is not active. Try the one before it.
    if (response.status !== 426) return response
    last = response
  }
  return last!
}

async function failure(response: Response, what: string) {
  const text = await response.text().catch(() => "")
  let message = text
  try {
    message = (JSON.parse(text) as { message?: string }).message ?? text
  } catch {}
  return new Error(`${what} (${response.status})${message ? `: ${message.slice(0, 300)}` : ""}`)
}

/** The pages the member administers, as organization URNs. */
export async function administeredPages(token: string): Promise<string[]> {
  const pinned = process.env.LINKEDIN_ORGANIZATION_ID
  if (pinned) return [`urn:li:organization:${pinned}`]
  const response = await rest(token, "/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED")
  if (!response.ok) return []
  const body = (await response.json()) as { elements?: { organization?: string }[] }
  return (body.elements ?? []).map((e) => e.organization).filter((urn): urn is string => !!urn)
}

/**
 * Uploads an image for `owner`, who must be the post's author, and returns
 * its URN once LinkedIn has processed it.
 */
export async function uploadImage(token: string, owner: string, bytes: Uint8Array, type: string): Promise<string> {
  const init = await rest(token, "/rest/images?action=initializeUpload", { method: "POST", body: JSON.stringify({ initializeUploadRequest: { owner } }) })
  if (!init.ok) throw await failure(init, "LinkedIn refused the image upload")
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } }
  const put = await fetch(value.uploadUrl, { method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": type }, body: Buffer.from(bytes) })
  if (!put.ok) throw await failure(put, "LinkedIn did not take the image")
  // Processing is quick but not instant; a post naming an image still
  // processing is refused.
  for (let i = 0; i < 6; i++) {
    const status = await rest(token, `/rest/images/${encodeURIComponent(value.image)}`)
    if (status.ok) {
      const body = (await status.json()) as { status?: string }
      if (body.status === "AVAILABLE") break
      if (body.status === "PROCESSING_FAILED") throw new Error("LinkedIn could not process an image")
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  return value.image
}

/** Publishes `text`, with the images already uploaded for `author`, and returns the post's URN. */
export async function publish(token: string, author: string, text: string, images: string[] = []): Promise<string> {
  const content = images.length === 1 ? { media: { id: images[0] } } : images.length > 1 ? { multiImage: { images: images.map((id) => ({ id })) } } : undefined
  const response = await rest(token, "/rest/posts", {
    method: "POST",
    body: JSON.stringify({
      author,
      commentary: escapeCommentary(text),
      ...(content ? { content } : {}),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  })
  if (!response.ok) throw await failure(response, "LinkedIn refused the post")
  const urn = response.headers.get("x-restli-id") ?? response.headers.get("x-linkedin-id")
  if (!urn) throw new Error("LinkedIn accepted the post but did not return its id")
  return urn
}

// The Posts API reads commentary as "little text", where these characters are
// markup; left bare, a post with parentheses or an @ is cut short or refused.
function escapeCommentary(text: string) {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => `\\${c}`)
}
