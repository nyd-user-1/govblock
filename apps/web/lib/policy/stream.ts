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

/** The customer code that fronts every player URL: read off a video, or set by hand. */
function customerCode(videos: StreamVideo[]) {
  if (process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE) return process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE
  const m = /customer-([a-z0-9]+)\.cloudflarestream\.com/.exec(videos.find((v) => v.preview)?.preview ?? "")
  return m?.[1] ?? null
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

/** Everything the page shows, in one read. */
export async function getStream() {
  const state = await status()
  if (!state.ok) return { ...state, videos: [] as StreamVideo[], live: [] as LiveInput[], customer: null as string | null, account: ACCOUNT ?? null }
  const [videos, live] = await Promise.all([listVideos(), listLiveInputs()])
  return { ...state, videos, live, customer: customerCode(videos), account: ACCOUNT ?? null }
}
