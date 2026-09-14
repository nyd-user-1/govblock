import "server-only"

// Cloudflare Stream, for the Admin experience's Stream page (Brendan,
// 2026-09-06: "set this up and give me one page for the related UI"). The
// library, the live inputs, an import from a URL, a new live input, and a
// delete — all through the REST API with a server-side token, never from the
// browser. The token needs "Stream: Edit" on the account; the analytics
// token on file does not have it, so `status()` says so and the page shows
// the setup instead of an empty library.
//
// Pricing, so nobody is surprised: $5 per 1,000 minutes stored per month and
// $1 per 1,000 minutes delivered, billed to the account once Stream is
// enabled in the dashboard.

const API = "https://api.cloudflare.com/client/v4"
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN || process.env.CLOUDFLARE_API_TOKEN

export type StreamVideo = {
  uid: string
  name: string
  state: string
  readyToStream: boolean
  duration: number
  created: string
  size: number
  thumbnail: string
  preview: string
  hls: string | null
  width: number | null
  height: number | null
  requireSignedURLs: boolean
}
export type LiveInput = {
  uid: string
  name: string
  created: string
  status: string | null
  rtmpsUrl: string | null
  rtmpsKey: string | null
  srtUrl: string | null
  webRtcUrl: string | null
  recording: string | null
}

type Envelope<T> = { success: boolean; result: T; errors?: { code: number; message: string }[] }

async function cf<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!ACCOUNT) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set")
  if (!TOKEN) throw new Error("no Cloudflare token is set")
  const res = await fetch(`${API}/accounts/${ACCOUNT}${path}`, { ...init, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) }, cache: "no-store" })
  const body = (await res.json()) as Envelope<T>
  if (!body.success) {
    const first = body.errors?.[0]
    const error = new Error(first ? `${first.code}: ${first.message}` : `${res.status} ${res.statusText}`) as Error & { code?: number }
    error.code = first?.code
    throw error
  }
  return body.result
}

/** The customer code that fronts every player URL: set by hand, else read off a video's preview or a live input's WebRTC address. */
function customerCode(videos: StreamVideo[], live: LiveInput[]) {
  if (process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE) return process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
  const urls = [...videos.map((v) => v.preview), ...live.map((l) => l.webRtcUrl ?? "")]
  for (const u of urls) {
    const m = /customer-([a-z0-9]+)\.cloudflarestream\.com/.exec(u ?? "")
    if (m) return m[1]
  }
  return null
}

/** Whether the token can reach Stream at all, and what to do if not. */
export async function status() {
  if (!ACCOUNT || !TOKEN) return { ok: false, reason: !ACCOUNT ? "CLOUDFLARE_ACCOUNT_ID is not set" : "no Cloudflare token is set", needs: "env" as const }
  try {
    await cf<unknown[]>("/stream?per_page=1")
    return { ok: true, reason: "", needs: null }
  } catch (error) {
    const e = error as Error & { code?: number }
    // 10000 is Cloudflare's "authentication error": a live token without the scope.
    if (e.code === 10000 || e.code === 9109) return { ok: false, reason: e.message, needs: "token" as const }
    if (/subscri|not enabled|billing/i.test(e.message)) return { ok: false, reason: e.message, needs: "subscription" as const }
    return { ok: false, reason: e.message, needs: "unknown" as const }
  }
}

type RawVideo = { uid: string; meta?: Record<string, string>; status?: { state?: string }; readyToStream?: boolean; duration?: number; created: string; size?: number; thumbnail?: string; preview?: string; playback?: { hls?: string }; input?: { width?: number; height?: number }; requireSignedURLs?: boolean }
type RawLive = { uid: string; meta?: Record<string, string>; created: string; status?: { current?: { state?: string } } | null; rtmps?: { url?: string; streamKey?: string }; srt?: { url?: string; streamId?: string; passphrase?: string }; webRTC?: { url?: string }; recording?: { mode?: string } }

export async function listVideos(): Promise<StreamVideo[]> {
  const rows = await cf<RawVideo[]>("/stream?per_page=200")
  return rows.map((v) => ({
    uid: v.uid, name: v.meta?.name ?? v.uid, state: v.status?.state ?? "unknown", readyToStream: Boolean(v.readyToStream), duration: Number(v.duration ?? 0),
    created: v.created, size: Number(v.size ?? 0), thumbnail: v.thumbnail ?? "", preview: v.preview ?? "", hls: v.playback?.hls ?? null,
    width: v.input?.width ?? null, height: v.input?.height ?? null, requireSignedURLs: Boolean(v.requireSignedURLs),
  }))
}

export async function listLiveInputs(): Promise<LiveInput[]> {
  const rows = await cf<RawLive[]>("/stream/live_inputs")
  // The list carries no keys or status; the record does. A handful at most.
  return Promise.all(rows.map(async (row) => {
    const r = await cf<RawLive>(`/stream/live_inputs/${row.uid}`).catch(() => row)
    return {
      uid: r.uid, name: r.meta?.name ?? r.uid, created: r.created, status: r.status?.current?.state ?? null,
      rtmpsUrl: r.rtmps?.url ?? null, rtmpsKey: r.rtmps?.streamKey ?? null, srtUrl: r.srt?.url ?? null, webRtcUrl: r.webRTC?.url ?? null,
      recording: r.recording?.mode ?? null,
    }
  }))
}

export async function copyFromUrl(url: string, name: string) {
  const v = await cf<RawVideo>("/stream/copy", { method: "POST", body: JSON.stringify({ url, meta: { name: name || url.split("/").pop() || "video" } }) })
  return { uid: v.uid, state: v.status?.state ?? "queued" }
}

export async function createLiveInput(name: string) {
  const r = await cf<RawLive>("/stream/live_inputs", { method: "POST", body: JSON.stringify({ meta: { name: name || "live" }, recording: { mode: "automatic" } }) })
  return { uid: r.uid, rtmpsUrl: r.rtmps?.url ?? null, rtmpsKey: r.rtmps?.streamKey ?? null }
}

export async function deleteVideo(uid: string) {
  await cf<unknown>(`/stream/${uid}`, { method: "DELETE" })
}

export async function deleteLiveInput(uid: string) {
  await cf<unknown>(`/stream/live_inputs/${uid}`, { method: "DELETE" })
}

/* ---- Clips: direct creator uploads, one video's state, and playback ---- */

// A clip's bytes go from the browser (or the worker box) straight to Stream;
// the server only asks for the one-time address. tus, not the basic form
// upload, so a sixty-second take and a two-hour hearing take the same path:
// the basic upload stops at 200 MB.

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64")

/** A one-time tus address for `bytes` of video, and the uid it will become. */
export async function createUpload(o: { bytes: number; name: string; creator: string; maxDurationSeconds: number; requireSignedURLs: boolean }) {
  if (!ACCOUNT) throw new Error("CLOUDFLARE_ACCOUNT_ID is not set")
  if (!TOKEN) throw new Error("no Cloudflare token is set")
  const metadata = [`name ${b64(o.name.slice(0, 120) || "clip")}`, `maxDurationSeconds ${b64(String(Math.ceil(o.maxDurationSeconds)))}`, ...(o.requireSignedURLs ? ["requiresignedurls"] : [])].join(",")
  const res = await fetch(`${API}/accounts/${ACCOUNT}/stream?direct_user=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Tus-Resumable": "1.0.0", "Upload-Length": String(o.bytes), "Upload-Metadata": metadata, "Upload-Creator": o.creator },
    cache: "no-store",
  })
  const uploadUrl = res.headers.get("location")
  // The uid rides a header, and is also the upload address's last segment.
  const uid = res.headers.get("stream-media-id") ?? (uploadUrl ? /\/([a-f0-9]{32})(?:\?|$)/.exec(uploadUrl)?.[1] ?? null : null)
  if (!res.ok || !uploadUrl || !uid) {
    const body = (await res.json().catch(() => null)) as Envelope<unknown> | null
    const first = body?.errors?.[0]
    const error = new Error(first ? `${first.code}: ${first.message}` : `${res.status} ${res.statusText}`) as Error & { code?: number }
    error.code = first?.code
    throw error
  }
  return { uid, uploadUrl }
}

export type ClipVideo = { uid: string; state: string; ready: boolean; duration: number | null; width: number | null; height: number | null; requireSignedURLs: boolean; error: string | null }

/** One video's processing state, or null when Stream no longer has it. */
export async function getVideo(uid: string): Promise<ClipVideo | null> {
  try {
    const v = await cf<RawVideo & { status?: { state?: string; errorReasonText?: string } }>(`/stream/${uid}`)
    return { uid: v.uid, state: v.status?.state ?? "unknown", ready: Boolean(v.readyToStream), duration: v.duration && v.duration > 0 ? v.duration : null, width: v.input?.width || null, height: v.input?.height || null, requireSignedURLs: Boolean(v.requireSignedURLs), error: v.status?.errorReasonText || null }
  } catch (error) {
    if ((error as { code?: number }).code === 10003) return null // not found
    throw error
  }
}

/** Private or public at the source: a private video plays only through a token. */
export async function setSignedUrls(uid: string, requireSignedURLs: boolean) {
  await cf<unknown>(`/stream/${uid}`, { method: "POST", body: JSON.stringify({ uid, requireSignedURLs }) })
}

/** Asks Stream for the MP4 the feed's <video> plays; ready a few seconds after the video is. */
export async function enableDownload(uid: string) {
  const r = await cf<{ default?: { status?: string; url?: string } }>(`/stream/${uid}/downloads`, { method: "POST" })
  return r.default?.status ?? "inprogress"
}

/** A playback token for a private video, good for `hours`, that also opens its MP4. */
export async function playbackToken(uid: string, hours = 4) {
  const r = await cf<{ token: string }>(`/stream/${uid}/token`, { method: "POST", body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + hours * 3600, downloadable: true }) })
  return r.token
}

/** The MP4 and a poster frame, under the video's uid or, for a private one, its token. */
export function playbackUrls(idOrToken: string) {
  const code = process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
  if (!code) return { mp4: "", poster: "" }
  const base = `https://customer-${code}.cloudflarestream.com/${idOrToken}`
  return { mp4: `${base}/downloads/default.mp4`, poster: `${base}/thumbnails/thumbnail.jpg?time=1s&height=960` }
}

/** Everything the page shows, in one read. */
export async function getStream() {
  const state = await status()
  if (!state.ok) return { ...state, videos: [] as StreamVideo[], live: [] as LiveInput[], customer: null as string | null, account: ACCOUNT ?? null }
  const [videos, live] = await Promise.all([listVideos(), listLiveInputs()])
  return { ...state, videos, live, customer: customerCode(videos, live), account: ACCOUNT ?? null }
}
