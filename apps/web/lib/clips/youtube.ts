import "server-only"

import { one, q } from "@/lib/policy/db"

// A YouTube video's captions (2026-09-14), read once and kept in
// clip_transcripts (sql/024), straight from YouTube's own player API. YouTube
// answers a server on AWS with "sign in to confirm you're not a bot", so from
// Amplify a new video's captions are usually refused; what is already kept
// still reads, and a refused link waits in the queue for the worker box. No
// paid caption service (Brendan, 2026-09-14).

export type Segment = { start: number; end: number; text: string }
export type Transcript = { videoId: string; source: "youtube" | "worker"; language: string | null; title: string | null; channel: string | null; duration: number; segments: Segment[] }

/** Why a transcript could not be read: the video has none, or YouTube refused the server. */
export class TranscriptError extends Error {
  constructor(
    message: string,
    public kind: "none" | "blocked"
  ) {
    super(message)
  }
}

/** The 11-character id from any of YouTube's link shapes, or null. */
export function youtubeId(text: string): string | null {
  const t = text.trim()
  if (/^[\w-]{11}$/.test(t)) return t
  let url: URL
  try {
    url = new URL(t)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "")
  if (host === "youtu.be") return /^\/([\w-]{11})/.exec(url.pathname)?.[1] ?? null
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null
  const v = url.searchParams.get("v")
  if (v && /^[\w-]{11}$/.test(v)) return v
  return /^\/(?:shorts|live|embed|v)\/([\w-]{11})/.exec(url.pathname)?.[1] ?? null
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim()

async function oembed(videoId: string) {
  const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`, { signal: AbortSignal.timeout(5000) }).catch(() => null)
  if (!res?.ok) return { title: null, channel: null }
  const body = (await res.json().catch(() => ({}))) as { title?: string; author_name?: string }
  return { title: body.title ?? null, channel: body.author_name ?? null }
}

/** YouTube's own player API as the Android app calls it, then the caption track's XML. */
async function direct(videoId: string): Promise<Omit<Transcript, "title" | "channel">> {
  const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip" },
    body: JSON.stringify({ context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", androidSdkVersion: 30, hl: "en" } }, videoId }),
    signal: AbortSignal.timeout(10000),
  })
  const player = (await res.json().catch(() => ({}))) as {
    playabilityStatus?: { status?: string; reason?: string }
    captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: { baseUrl: string; languageCode: string; kind?: string }[] } }
  }
  const status = player.playabilityStatus?.status
  if (status && status !== "OK") throw new TranscriptError(player.playabilityStatus?.reason ?? "YouTube would not play this video to the server.", status === "LOGIN_REQUIRED" ? "blocked" : "none")
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []
  if (!tracks.length) throw new TranscriptError("This video has no captions.", "none")
  const track = tracks.find((t) => t.languageCode.startsWith("en") && t.kind !== "asr") ?? tracks.find((t) => t.languageCode.startsWith("en")) ?? tracks[0]
  const xml = await fetch(track.baseUrl.replace(/&fmt=[^&]*/, ""), { signal: AbortSignal.timeout(10000) }).then((r) => r.text())
  const segments: Segment[] = []
  for (const m of xml.matchAll(/<text start="([\d.]+)"(?: dur="([\d.]+)")?[^>]*>([\s\S]*?)<\/text>/g)) {
    const start = Number(m[1])
    segments.push({ start, end: start + Number(m[2] ?? 2), text: decode(m[3]) })
  }
  if (!segments.length)
    for (const m of xml.matchAll(/<p t="(\d+)"(?: d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g)) {
      const start = Number(m[1]) / 1000
      segments.push({ start, end: start + Number(m[2] ?? 2000) / 1000, text: decode(m[3]) })
    }
  const kept = segments.filter((s) => s.text)
  if (!kept.length) throw new TranscriptError(xml ? "This video has no captions." : "YouTube would not send the captions to the server.", xml ? "none" : "blocked")
  return { videoId, source: "youtube", language: track.languageCode, duration: kept[kept.length - 1].end, segments: kept }
}

type Row = { video_id: string; source: Transcript["source"]; language: string | null; title: string | null; channel: string | null; duration: number | null; segments: string }

export async function storedTranscript(videoId: string): Promise<Transcript | null> {
  const row = await one<Row>(`select video_id, source, language, title, channel, duration, segments::text segments from clip_transcripts where video_id = $1`, [videoId])
  return row ? { videoId: row.video_id, source: row.source, language: row.language, title: row.title, channel: row.channel, duration: Number(row.duration ?? 0), segments: JSON.parse(row.segments) as Segment[] } : null
}

/** The kept transcript, or a fresh read of it, kept. */
export async function readTranscript(videoId: string): Promise<Transcript> {
  const kept = await storedTranscript(videoId)
  if (kept) return kept
  const body = await direct(videoId).catch((error: unknown) => {
    if (error instanceof TranscriptError) throw error
    throw new TranscriptError("YouTube would not send the captions to the server.", "blocked")
  })
  const meta = await oembed(videoId)
  const transcript: Transcript = { ...body, ...meta }
  await q(
    `insert into clip_transcripts (video_id, source, language, title, channel, duration, segments) values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     on conflict (video_id) do nothing`,
    [videoId, transcript.source, transcript.language, transcript.title, transcript.channel, transcript.duration, JSON.stringify(transcript.segments)]
  )
  return transcript
}
