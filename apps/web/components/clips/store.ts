"use client"

// The clips a reader can see: the ones GovBlock published, and the ones they
// recorded themselves. This is the mock's store (Brendan, 2026-09-07: "have it
// be a mockup, just to show me how it would really look and feel, and we'd
// wire it up later"). A recording never leaves the browser — it sits in
// IndexedDB as a blob — and the published set is five free stock clips
// (Mixkit licence, no attribution required) streamed from Mixkit's CDN.
//
// When this is wired up, `saveClip` becomes a Cloudflare Stream direct
// creator upload (one-time URL from our /api/stream, PUT the blob to it) with
// the reader's id and the visibility in the video's `meta`, and `loadMine`
// becomes a `listVideos` filtered on that id. Nothing else here changes.

export type Visibility = "private" | "public"

export type Clip = {
  id: string
  title: string
  caption: string
  author: { name: string; image?: string | null }
  src: string
  blob?: Blob
  duration?: number
  createdAt: string
  visibility: Visibility
  mine?: boolean
}

const MIXKIT = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-360.mp4`

export const PUBLISHED: Clip[] = [
  {
    id: "pub-40700",
    title: "Sine die at the Texas Capitol",
    caption: "The 89th adjourned Monday. What passed, what died, and the three bills the Governor still has to sign.",
    author: { name: "GovBlock" },
    src: MIXKIT(40700),
    duration: 15,
    createdAt: "2026-09-01T14:10:00Z",
    visibility: "public",
  },
  {
    id: "pub-49851",
    title: "Budget week from the Corning Tower",
    caption: "Albany from 42 floors up. The one-house budgets are due Thursday. Here's what's in each.",
    author: { name: "GovBlock" },
    src: MIXKIT(49851),
    duration: 15,
    createdAt: "2026-08-28T22:40:00Z",
    visibility: "public",
  },
  {
    id: "pub-49878",
    title: "The Assembly went past midnight",
    caption: "Housing package, 98 to 47. The vote list is on the bill page.",
    author: { name: "GovBlock" },
    src: MIXKIT(49878),
    duration: 14,
    createdAt: "2026-08-21T04:12:00Z",
    visibility: "public",
  },
  {
    id: "pub-34562",
    title: "Congestion pricing, week one",
    caption: "The cameras went live Sunday. The bill that got us here is S 6812, and the fight over it is not done.",
    author: { name: "GovBlock" },
    src: MIXKIT(34562),
    duration: 8,
    createdAt: "2026-08-15T12:00:00Z",
    visibility: "public",
  },
  {
    id: "pub-40656",
    title: "Walking in to Finance",
    caption: "Ten minutes early. Four bills on the agenda, one of them the pay-transparency amendment.",
    author: { name: "GovBlock" },
    src: MIXKIT(40656),
    duration: 12,
    createdAt: "2026-08-09T13:30:00Z",
    visibility: "public",
  },
]

const DB = "govblock-clips"
const STORE = "clips"

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

type Stored = Omit<Clip, "src" | "mine">

export async function loadMine(): Promise<Clip[]> {
  if (typeof indexedDB === "undefined") return []
  const db = await open()
  const rows = await new Promise<Stored[]>((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as Stored[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return rows.map((r) => ({ ...r, src: r.blob ? URL.createObjectURL(r.blob) : "", mine: true })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function saveClip(clip: Clip) {
  const db = await open()
  const { src: _src, mine: _mine, ...row } = clip
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(row)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function deleteClip(id: string) {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export const fmtDuration = (s?: number) => {
  if (!s || !Number.isFinite(s)) return ""
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`
}

export const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
