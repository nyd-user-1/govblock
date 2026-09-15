"use client"

import { DEFAULT_AVATAR } from "@/lib/auth/use-account"

import { creatorOf } from "./desks"

// The clips a reader can see, who made them, and what was said under them.
// This began as the mock's store (Brendan, 2026-09-07: "have it be a mockup,
// just to show me how it would really look and feel, and we'd wire it up
// later"). Likes and comments a reader adds still sit in localStorage, and
// the stock set is free Mixkit clips (no attribution required) under the
// desks that would have shot them.
//
// Wired (2026-09-14): `saveClip` writes the row in Aurora through /api/clips,
// which hands back signed addresses in the private clips bucket on S3; the
// browser sends the take and its poster there itself, and the row is
// published once the video has arrived. `loadMine` reads the reader's own
// rows back. Recorded, cut and
// generated clips all come back through the same `loadFeed`. Nothing that
// renders changes.

export { CREATORS, creatorOf, type Creator } from "./desks"

export type Visibility = "private" | "public"

export type Clip = {
  id: string
  creatorId: string
  author: { name: string; handle: string; image?: string | null }
  title: string
  caption: string
  src: string
  /** A YouTube video id: the clip plays in YouTube's own player and `src` is empty. */
  youtube?: string
  blob?: Blob
  /** A frame of the recording as a JPEG data URL, drawn when it was saved, so a tile has something to show before the video decodes. */
  poster?: string
  duration?: number
  createdAt: string
  visibility: Visibility
  views: number
  likes: number
  mine?: boolean
  /** How a clip in Aurora came to be; absent on a stock clip. */
  origin?: "recorded" | "cut" | "generated"
  /** `processing` until its upload has arrived; only a clip's owner sees it then. */
  status?: "processing" | "review" | "published" | "removed"
  /** The record's own pages the clip is keyed to: the hearing, the bill, the roll call. */
  links?: { label: string; href: string }[]
}

export type Comment = { id: string; clipId: string; author: { name: string; handle: string; image?: string | null }; text: string; at: string; likes: number; mine?: boolean }

// 720p, not 360 (Brendan, 2026-09-11: "the video quality is just pretty
// shitty"): five times the bytes, still under 6 MB a clip; 1080 is fifty.
const MIXKIT = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`
const by = (id: string) => {
  const c = creatorOf(id)!
  return { name: c.name, handle: c.handle, image: c.image }
}

/** A Short from a committee's channel: YouTube's portrait thumbnail, and the player when it is active. */
const short = (id: string, o: { title: string; caption: string; duration: number; createdAt: string; views: number }): Clip => ({
  id: `yt-${id}`,
  creatorId: "house-ag",
  author: by("house-ag"),
  src: "",
  youtube: id,
  poster: `https://i.ytimg.com/vi/${id}/oardefault.jpg`,
  visibility: "public",
  likes: 0,
  ...o,
})

export const PUBLISHED: Clip[] = [
  short("ZfZYXKoJ4Rc", { title: "Time to get the Farm Bill done", caption: "Tell your elected officials: it's time to get the Farm Bill done. From the House Committee on Agriculture.", duration: 42, createdAt: "2026-03-02T15:00:00Z", views: 217 }),
  short("RHKfwZaMdqU", { title: "A new farm bill means certainty", caption: "For everyone. The committee's case for finishing the bill this session.", duration: 29, createdAt: "2026-03-01T18:00:00Z", views: 346 }),
  short("p33RWZYDpvM", { title: "Support rural America", caption: "Support the Farm Bill. The committee on what the bill carries for rural districts.", duration: 49, createdAt: "2026-03-01T14:00:00Z", views: 108 }),
  short("0agkzFpSSIQ", { title: "We need a Prop 12 fix", caption: "We need a new Farm Bill. The committee on the California pork rule and what the bill does about it.", duration: 43, createdAt: "2026-02-28T16:00:00Z", views: 104 }),
  {
    id: "pub-40700",
    creatorId: "tx",
    author: by("tx"),
    title: "Sine die at the Texas Capitol",
    caption: "The 89th adjourned Monday. What passed, what died, and the three bills the Governor still has to sign. Full list on the session page.",
    src: MIXKIT(40700),
    duration: 15,
    createdAt: "2026-09-01T14:10:00Z",
    visibility: "public",
    views: 98800,
    likes: 219,
  },
  {
    id: "pub-49851",
    creatorId: "ny",
    author: by("ny"),
    title: "Budget week from the Corning Tower",
    caption: "Albany from 42 floors up. The one-house budgets are due Thursday. Here's what's in each.",
    src: MIXKIT(49851),
    duration: 15,
    createdAt: "2026-08-28T22:40:00Z",
    visibility: "public",
    views: 56800,
    likes: 143,
  },
  {
    id: "pub-49878",
    creatorId: "ny",
    author: by("ny"),
    title: "The Assembly went past midnight",
    caption: "Housing package, 98 to 47. The vote list is on the bill page.",
    src: MIXKIT(49878),
    duration: 14,
    createdAt: "2026-08-21T04:12:00Z",
    visibility: "public",
    views: 1801,
    likes: 41,
  },
  {
    id: "pub-34562",
    creatorId: "ny",
    author: by("ny"),
    title: "Congestion pricing, week one",
    caption: "The cameras went live Sunday. The bill that got us here is S 6812, and the fight over it is not done.",
    src: MIXKIT(34562),
    duration: 8,
    createdAt: "2026-08-15T12:00:00Z",
    visibility: "public",
    views: 659000,
    likes: 2310,
  },
  {
    id: "pub-40700-b",
    creatorId: "ca",
    author: by("ca"),
    title: "The floor filled up for the housing vote",
    caption: "AB 2312 came out of committee Tuesday and hit the floor before the week was out. The roll call is on the bill page.",
    src: MIXKIT(40700),
    duration: 15,
    createdAt: "2026-09-04T17:20:00Z",
    visibility: "public",
    views: 41200,
    likes: 168,
  },
  {
    id: "pub-49851-b",
    creatorId: "govblock",
    author: by("govblock"),
    title: "What a fiscal note actually says",
    caption: "Two pages, one number, and the assumption underneath it that nobody reads. Here is how to find that assumption.",
    src: MIXKIT(49851),
    duration: 15,
    createdAt: "2026-09-03T11:05:00Z",
    visibility: "public",
    views: 12400,
    likes: 402,
  },
  {
    id: "pub-34562-b",
    creatorId: "tx",
    author: by("tx"),
    title: "Ten days to sign or veto",
    caption: "The clock on the Governor's desk is shorter than most people think, and a bill can become law without a signature at all.",
    src: MIXKIT(34562),
    duration: 8,
    createdAt: "2026-09-02T15:45:00Z",
    visibility: "public",
    views: 88100,
    likes: 511,
  },
  {
    id: "pub-49878-b",
    creatorId: "ca",
    author: by("ca"),
    title: "Suspense file day",
    caption: "Hundreds of bills, one hearing, and a chair reading numbers. Most of what dies this session dies here, in about an hour.",
    src: MIXKIT(49878),
    duration: 14,
    createdAt: "2026-08-30T19:30:00Z",
    visibility: "public",
    views: 27600,
    likes: 96,
  },
  {
    id: "pub-40656-b",
    creatorId: "ny",
    author: by("ny"),
    title: "Where a bill actually stalls",
    caption: "Not on the floor. In a committee that never calendars it. Here is how to tell the difference from the record.",
    src: MIXKIT(40656),
    duration: 12,
    createdAt: "2026-08-26T09:15:00Z",
    visibility: "public",
    views: 5400,
    likes: 138,
  },
  {
    id: "pub-40700-c",
    creatorId: "govblock",
    author: by("govblock"),
    title: "Reading a roll call in thirty seconds",
    caption: "Who voted with their party, who broke from it, and which absence changed the outcome. The votes page does the counting.",
    src: MIXKIT(40700),
    duration: 15,
    createdAt: "2026-08-24T13:00:00Z",
    visibility: "public",
    views: 74300,
    likes: 289,
  },
  {
    id: "pub-49851-c",
    creatorId: "tx",
    author: by("tx"),
    title: "Interim charges are the real preview",
    caption: "What a committee is told to study between sessions is what it files in January. They are public, and almost nobody reads them.",
    src: MIXKIT(49851),
    duration: 15,
    createdAt: "2026-08-20T16:40:00Z",
    visibility: "public",
    views: 9800,
    likes: 64,
  },
  {
    id: "pub-34562-c",
    creatorId: "ca",
    author: by("ca"),
    title: "The amendment that changed the bill",
    caption: "Same number, same title, different bill. Comparing the versions takes about a minute on the text page.",
    src: MIXKIT(34562),
    duration: 8,
    createdAt: "2026-08-18T10:25:00Z",
    visibility: "public",
    views: 33900,
    likes: 175,
  },
  {
    id: "pub-49878-c",
    creatorId: "ny",
    author: by("ny"),
    title: "A hearing nobody covered",
    caption: "Four hours on a rule change that touches every school district in the state. The transcript is up, and the vote is next week.",
    src: MIXKIT(49878),
    duration: 14,
    createdAt: "2026-08-14T20:05:00Z",
    visibility: "public",
    views: 2100,
    likes: 58,
  },
  {
    id: "pub-40656-c",
    creatorId: "govblock",
    author: by("govblock"),
    title: "Every state, one shape",
    caption: "Fifty-two jurisdictions file bills differently and mean roughly the same thing. That translation is the whole point of this site.",
    src: MIXKIT(40656),
    duration: 12,
    createdAt: "2026-08-11T08:50:00Z",
    visibility: "public",
    views: 156000,
    likes: 947,
  },
  {
    id: "pub-40677",
    creatorId: "govblock",
    author: by("govblock"),
    title: "The grounds before the session",
    caption: "Quiet for one more week. The calendar for the first day is up, and the bills that carry over are marked on the session page.",
    src: MIXKIT(40677),
    duration: 14,
    createdAt: "2026-09-05T13:15:00Z",
    visibility: "public",
    views: 22600,
    likes: 171,
  },
  {
    id: "pub-11800",
    creatorId: "govblock",
    author: by("govblock"),
    title: "Driving in for the first day",
    caption: "Up the hill at seven. Forty-one bills prefiled overnight, three of them on the same subject. The desk sorts them by stage.",
    src: MIXKIT(11800),
    duration: 28,
    createdAt: "2026-09-06T11:40:00Z",
    visibility: "public",
    views: 48300,
    likes: 356,
  },
  {
    id: "pub-40701",
    creatorId: "ny",
    author: by("ny"),
    title: "Walking to the Assembly",
    caption: "State Street to the Capitol steps in ten minutes. Today's order of business: the housing package, second reading.",
    src: MIXKIT(40701),
    duration: 10,
    createdAt: "2026-09-08T12:30:00Z",
    visibility: "public",
    views: 8900,
    likes: 84,
  },
  {
    id: "pub-44694",
    creatorId: "tx",
    author: by("tx"),
    title: "Late session, Austin",
    caption: "Past ten and the House is still in. The calendar had sixty bills on it this morning and eighteen are left.",
    src: MIXKIT(44694),
    duration: 8,
    createdAt: "2026-09-03T03:20:00Z",
    visibility: "public",
    views: 31400,
    likes: 227,
  },
  {
    id: "pub-49849",
    creatorId: "ca",
    author: by("ca"),
    title: "The 5 at rush hour",
    caption: "The transportation bill funds this stretch for nine years. What it costs, who voted for it, and the amendment that moved the money.",
    src: MIXKIT(49849),
    duration: 17,
    createdAt: "2026-09-02T00:10:00Z",
    visibility: "public",
    views: 19700,
    likes: 133,
  },
  {
    id: "pub-49858",
    creatorId: "ny",
    author: by("ny"),
    title: "Albany from above",
    caption: "Two chambers, one budget, and a deadline on the first of the month. The desk has both one-house bills side by side.",
    src: MIXKIT(49858),
    duration: 17,
    createdAt: "2026-08-31T16:00:00Z",
    visibility: "public",
    views: 14200,
    likes: 118,
  },
  {
    id: "pub-40656",
    creatorId: "govblock",
    author: by("govblock"),
    title: "Walking in to Finance",
    caption: "Ten minutes early. Four bills on the agenda, one of them the pay-transparency amendment. Agenda in the first comment.",
    src: MIXKIT(40656),
    duration: 12,
    createdAt: "2026-08-09T13:30:00Z",
    visibility: "public",
    views: 990,
    likes: 27,
  },
]

const person = (name: string, handle: string) => ({ name, handle, image: null })

export const SEED_COMMENTS: Comment[] = [
  { id: "c1", clipId: "pub-40700", author: person("Dana Whitfield", "dana.w"), text: "Which three? The bond bill is the one I'm watching.", at: "2026-09-01T15:02:00Z", likes: 4 },
  { id: "c2", clipId: "pub-40700", author: person("Marcus Ibáñez", "mibanez"), text: "HB 2, SB 4 and the water bill. He has until the 21st.", at: "2026-09-01T15:20:00Z", likes: 11 },
  { id: "c3", clipId: "pub-40700", author: person("Priya Raman", "praman"), text: "Sine die was 11:58 PM. They cut it close.", at: "2026-09-02T02:11:00Z", likes: 2 },
  { id: "c4", clipId: "pub-49851", author: person("Tom Okafor", "tokafor"), text: "The Senate one-house has the childcare line at $1.2B. The Assembly's is $1.9B.", at: "2026-08-29T01:12:00Z", likes: 9 },
  { id: "c5", clipId: "pub-49851", author: person("Lena Fischer", "lfischer"), text: "Is the tuition freeze in either?", at: "2026-08-29T13:45:00Z", likes: 1 },
  { id: "c6", clipId: "pub-49878", author: person("Dana Whitfield", "dana.w"), text: "98–47 with 5 excused. Two Democrats crossed.", at: "2026-08-21T05:00:00Z", likes: 6 },
  { id: "c7", clipId: "pub-34562", author: person("Marcus Ibáñez", "mibanez"), text: "S 6812 passed the Senate 36–25. Not unanimous, whatever the press release says.", at: "2026-08-15T14:30:00Z", likes: 23 },
  { id: "c8", clipId: "pub-34562", author: person("Aisha Bello", "abello"), text: "First week revenue numbers come out Friday.", at: "2026-08-16T09:10:00Z", likes: 3 },
  { id: "c9", clipId: "pub-34562", author: person("Tom Okafor", "tokafor"), text: "The lawsuit in NJ is still pending. This isn't over.", at: "2026-08-17T20:41:00Z", likes: 8 },
  { id: "c10", clipId: "pub-40656", author: person("GovBlock", "govblock"), text: "Agenda: S 1030, S 2277, A 4810 and the pay-transparency amendment to S 5598.", at: "2026-08-09T13:31:00Z", likes: 5 },
  { id: "c11", clipId: "pub-40656", author: person("Lena Fischer", "lfischer"), text: "Did the amendment get out of committee?", at: "2026-08-09T17:05:00Z", likes: 0 },
]

/* ---- what the reader adds: S3 for the video, Aurora for the row, localStorage for the rest ---- */

/** Sends `blob` to a signed S3 address in one PUT, reporting the fraction sent. The type must be the one the address was signed for. */
export function putSigned(url: string, blob: Blob, contentType: string, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload was refused.")))
    xhr.onerror = () => reject(new Error("The upload stopped. Check the connection and try again."))
    xhr.send(blob)
  })
}

/** The bare type a recorder or a file names ("video/webm;codecs=vp9,opus" → "video/webm"). */
const bareType = (type: string, fallback: string) => type.split(";")[0].trim() || fallback

/** A JPEG data URL (the poster drawn from the take) as a Blob. */
function dataUrlBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(",")
  const bytes = atob(body)
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i)
  return new Blob([out], { type: /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg" })
}

/** A reader's long video, in the clips bucket and in the queue to be cut. */
export type Upload = { id: string; title: string; status: "queued" | "running" | "review" | "done" | "failed"; clips: number | null; createdAt: string }

export type Feed = { published: Clip[]; mine: Clip[]; uploads: Upload[] }

// A reader without a picture wears the site's default (Brendan, 2026-09-11: "george... the standard for any user who has not added a picture").
const withAvatar = (c: Clip): Clip => ({ ...c, author: { ...c.author, image: c.author.image || DEFAULT_AVATAR } })

/** Every published clip in Aurora, whatever its origin, and the reader's own. */
export async function loadFeed(): Promise<Feed> {
  const res = await fetch("/api/clips", { credentials: "same-origin", cache: "no-store" }).catch(() => null)
  if (!res?.ok) return { published: [], mine: [], uploads: [] }
  const body = (await res.json()) as Feed
  return { published: body.published.map(withAvatar), mine: body.mine.map(withAvatar), uploads: body.uploads ?? [] }
}

export const loadMine = async () => (await loadFeed()).mine

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })
  const out = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(out.error ?? `${res.status} ${res.statusText}`)
  return out
}

/**
 * A take, to the clips bucket. The row is written first and hands back the
 * signed addresses; the video and its poster go from the browser to S3
 * directly; then the server checks the video arrived and publishes the row.
 */
export async function saveClip(clip: Clip, onProgress?: (fraction: number) => void): Promise<Clip> {
  if (!clip.blob) throw new Error("Nothing was recorded.")
  const contentType = bareType(clip.blob.type, "video/webm")
  const made = await send<{ clip: Clip; uploadUrl: string; posterUrl: string | null }>("/api/clips", "POST", { title: clip.title, caption: clip.caption, visibility: clip.visibility, bytes: clip.blob.size, contentType, duration: clip.duration, poster: Boolean(clip.poster) })
  try {
    await putSigned(made.uploadUrl, clip.blob, contentType, onProgress)
    if (made.posterUrl && clip.poster) await putSigned(made.posterUrl, dataUrlBlob(clip.poster), "image/jpeg").catch(() => {})
    const done = await send<{ clip: Clip }>("/api/clips/" + encodeURIComponent(made.clip.id) + "/complete", "POST")
    return { ...done.clip, author: clip.author, mine: true }
  } catch (error) {
    await send("/api/clips/" + encodeURIComponent(made.clip.id), "DELETE").catch(() => {})
    throw error
  }
}

export async function updateClip(id: string, patch: { visibility?: Visibility; title?: string; caption?: string }) {
  await send("/api/clips/" + encodeURIComponent(id), "PATCH", patch)
}

export async function deleteClip(id: string) {
  await send("/api/clips/" + encodeURIComponent(id), "DELETE")
}

/** A reader's own video, to the clips bucket and into the queue to be cut. `rights` is the ticked box; the server refuses without it. */
export async function uploadVideo(file: File, title: string, rights: boolean, onProgress?: (fraction: number) => void): Promise<Upload> {
  const contentType = bareType(file.type, "video/mp4")
  const made = await send<{ upload: Upload; uploadUrl: string }>("/api/clips/uploads", "POST", { title, bytes: file.size, rights, contentType })
  try {
    await putSigned(made.uploadUrl, file, contentType, onProgress)
  } catch (error) {
    await send("/api/clips/uploads/" + encodeURIComponent(made.upload.id), "DELETE").catch(() => {})
    throw error
  }
  return made.upload
}

export async function withdrawUpload(id: string) {
  await send("/api/clips/uploads/" + encodeURIComponent(id), "DELETE")
}

export type ReportReason = "copyright" | "privacy" | "harmful" | "other"

export async function reportClip(report: { clipId: string; reason: ReportReason; details: string; contact: string }) {
  await send("/api/clips/reports", "POST", report)
}

export async function takeDown(id: string) {
  await send("/api/clips/" + encodeURIComponent(id) + "/takedown", "POST")
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const LIKES = "govblock:clips:likes"
const SAVES = "govblock:clips:saves"
const FOLLOWS = "govblock:clips:follows"
const COMMENTS = "govblock:clips:comments"

export const loadLikes = () => new Set(readJson<string[]>(LIKES, []))
export const storeLikes = (s: Set<string>) => writeJson(LIKES, [...s])
export const loadSaves = () => new Set(readJson<string[]>(SAVES, []))
export const storeSaves = (s: Set<string>) => writeJson(SAVES, [...s])
export const loadFollows = () => new Set(readJson<string[]>(FOLLOWS, []))
export const storeFollows = (s: Set<string>) => writeJson(FOLLOWS, [...s])
export const loadMyComments = () => readJson<Comment[]>(COMMENTS, [])
export const storeMyComments = (rows: Comment[]) => writeJson(COMMENTS, rows)

/* ---- formatting ---- */

export const fmtDuration = (s?: number) => {
  if (!s || !Number.isFinite(s)) return ""
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`
}

/** 98,800 → 98.8K, as the play count on a tile. */
export const fmtCount = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n))

export const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" })

/** "3w", "4d", "2h", as a comment's age. */
export function fmtAge(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 7))}w`
  return `${Math.floor(s / (86400 * 365))}y`
}
