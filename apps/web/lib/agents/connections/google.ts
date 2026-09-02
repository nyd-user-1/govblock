import "server-only"

import {
  BedrockAgentCoreClient,
  GetResourceOauth2TokenCommand,
  GetWorkloadAccessTokenForUserIdCommand,
} from "@aws-sdk/client-bedrock-agentcore"

// Google, as a **user** connector: an OAuth grant to the reader's own account,
// held in AgentCore Identity's token vault rather than by us.
//
// This is the FLAG-B trigger arriving. The objection that killed AgentCore
// Identity for a single Slack bot was that redeeming a token needs a
// workload-identity token an SSR route cannot mint — true for a machine
// credential. For a *user* grant it is the opposite: the mint takes a workload
// name and an arbitrary user id, authorised by the ordinary signed AWS call
// this compute role already makes. That user id is the per-browser claim check,
// so the parameter that made Identity a bad fit before is what makes it the
// right one now. Probed before any of this was written: a 1,778-character token
// from `get-workload-access-token-for-user-id`, then an `authorizationUrl` and
// `sessionUri` from the first `get-resource-oauth2-token`.
//
// **One provider, scopes per request.** `govblock-google` holds the client id
// and secret; `GetResourceOauth2Token` takes `scopes` per call. The provider is
// the client, not the grant — two providers sharing one Google client would
// duplicate the secret and double what has to be rotated. It also gives
// incremental consent for free: a reader who only adds hearings is never asked
// for Drive.

const REGION = process.env.AWS_REGION || "us-east-1"
const WORKLOAD = process.env.AGENTCORE_WORKLOAD || "govblock"
const PROVIDER = process.env.GOOGLE_PROVIDER || "govblock-google"

export const SCOPES = {
  // The narrowest scope that can save a file: it reaches files this app
  // creates and cannot read anything else in the Drive.
  drive: "https://www.googleapis.com/auth/drive.file",
  // Narrower than calendar.events: calendars the reader owns, their primary
  // included, with no reach into calendars merely shared with them.
  calendar: "https://www.googleapis.com/auth/calendar.events.owned",
} as const

export type GoogleService = keyof typeof SCOPES

let client: BedrockAgentCoreClient | null = null
function agentcore() {
  if (!client) client = new BedrockAgentCoreClient({ region: REGION })
  return client
}

async function workloadToken(userId: string) {
  const out = await agentcore().send(
    new GetWorkloadAccessTokenForUserIdCommand({ workloadName: WORKLOAD, userId })
  )
  if (!out.workloadAccessToken) throw new Error("no workload access token")
  return out.workloadAccessToken
}

export type Grant =
  /** The reader has already consented; here is a token to act with. */
  | { kind: "token"; accessToken: string }
  /** They have not; send the browser here and Google will ask them. */
  | { kind: "authorize"; url: string }

/**
 * Ask the vault for this reader's Google token, for one service.
 *
 * The same call does both jobs, which is the shape AgentCore chose: with a
 * grant on file it returns a token, and without one it returns the URL to go
 * and get consent. Callers branch on `kind` rather than tracking state, so
 * there is no local record of who has connected what to fall out of date.
 */
export async function grantFor(
  userId: string,
  service: GoogleService,
  returnUrl: string
): Promise<Grant> {
  const out = await agentcore().send(
    new GetResourceOauth2TokenCommand({
      workloadIdentityToken: await workloadToken(userId),
      resourceCredentialProviderName: PROVIDER,
      scopes: [SCOPES[service]],
      oauth2Flow: "USER_FEDERATION",
      resourceOauth2ReturnUrl: returnUrl,
    })
  )
  if (out.accessToken) return { kind: "token", accessToken: out.accessToken }
  if (out.authorizationUrl) return { kind: "authorize", url: out.authorizationUrl }
  throw new Error("the vault returned neither a token nor an authorization url")
}

/** Save a report into the reader's Drive as a Google Doc they own. */
export async function saveToDrive({
  accessToken,
  name,
  markdown,
}: {
  accessToken: string
  name: string
  markdown: string
}) {
  // multipart/related is Drive's own upload shape: metadata part, then bytes.
  // Uploading text/markdown with a Google Docs mimeType asks Drive to convert,
  // so what lands is a document the reader can open and edit rather than a
  // file they have to download.
  const boundary = `govblock-${Math.random().toString(36).slice(2)}`
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify({ name, mimeType: "application/vnd.google-apps.document" }),
    `--${boundary}`,
    "Content-Type: text/markdown; charset=UTF-8",
    "",
    markdown,
    `--${boundary}--`,
    "",
  ].join("\r\n")

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(30_000),
    }
  )
  const json = (await response.json().catch(() => ({}))) as {
    id?: string
    name?: string
    webViewLink?: string
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(json.error?.message ?? `Drive returned ${response.status}`)
  return { id: json.id ?? "", name: json.name ?? name, url: json.webViewLink ?? "" }
}

/**
 * Save rows into the reader's Drive as a Google Sheet.
 *
 * Drive converts on upload, so this needs no Sheets API and no second scope —
 * `drive.file` covers every file this app creates in Google's editors, which is
 * the whole basis of the ride-along cards. The Docs path above is the same
 * mechanism with a different target mimeType.
 */
export async function saveSheet({
  accessToken,
  name,
  rows,
}: {
  accessToken: string
  name: string
  rows: string[][]
}) {
  const cell = (value: string) => {
    const text = String(value ?? "")
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const csv = rows.map((row) => row.map(cell).join(",")).join("\r\n")
  const boundary = `govblock-${Math.random().toString(36).slice(2)}`
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify({ name, mimeType: "application/vnd.google-apps.spreadsheet" }),
    `--${boundary}`,
    "Content-Type: text/csv; charset=UTF-8",
    "",
    csv,
    `--${boundary}--`,
    "",
  ].join("\r\n")

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(30_000),
    }
  )
  const json = (await response.json().catch(() => ({}))) as {
    id?: string
    name?: string
    webViewLink?: string
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(json.error?.message ?? `Drive returned ${response.status}`)
  return { id: json.id ?? "", name: json.name ?? name, url: json.webViewLink ?? "" }
}

/** Put a hearing on the reader's primary calendar. */
export async function addToCalendar({
  accessToken,
  summary,
  description,
  start,
  end,
  timeZone,
  url,
}: {
  accessToken: string
  summary: string
  description?: string
  /** RFC3339, or a bare date for an all-day entry. */
  start: string
  end?: string
  /**
   * IANA zone for a timed entry whose start carries no offset. Legislative
   * calendars publish a wall-clock time and no zone, and the reader's own zone
   * is the wrong one — a Texas hearing is at 8:30 in Austin whoever is looking.
   */
  timeZone?: string
  url?: string
}) {
  const allDay = !start.includes("T")
  const when = (value: string) =>
    allDay ? { date: value } : { dateTime: value, ...(timeZone ? { timeZone } : {}) }
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        summary,
        description: [description, url].filter(Boolean).join("\n\n"),
        source: url ? { title: "govblock", url } : undefined,
        start: when(start),
        end: when(end ?? start),
      }),
      signal: AbortSignal.timeout(30_000),
    }
  )
  const json = (await response.json().catch(() => ({}))) as {
    id?: string
    htmlLink?: string
    error?: { message?: string }
  }
  if (!response.ok) throw new Error(json.error?.message ?? `Calendar returned ${response.status}`)
  return { id: json.id ?? "", url: json.htmlLink ?? "" }
}
