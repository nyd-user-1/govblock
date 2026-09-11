#!/usr/bin/env node
// Find YouTube Shorts that meet a set of requirements, for the Clips page
// (Brendan, 2026-09-11: "can we devise a script to search for shorts that
// meet certain requirements?").
//
// Two ways in. A keyword search:
//
//   node scripts/clips/shorts.mjs --q "state legislature" --after 2026-06-01 --limit 10
//
// or a sweep of the committee channels the committee pages already know
// (apps/web/lib/data/congress/committee-youtube.json), which costs almost
// nothing in quota:
//
//   node scripts/clips/shorts.mjs --committees --after 2026-08-01
//   node scripts/clips/shorts.mjs --channel hsag00            # one committee, by code
//   node scripts/clips/shorts.mjs --channel UCWtWf-QUTnJ-UMP5ZNWVB5Q
//
// Requirements, all optional:
//   --max 180        longest a clip may run, in seconds (Shorts run to three minutes)
//   --min 1          shortest (a scheduled hearing lists at zero until it airs)
//   --after DATE     published on or after (ISO date)
//   --order date     search order: date | relevance | viewCount (search mode only)
//   --license cc     only Creative Commons videos (search mode only)
//   --views 1000     at least this many views
//   --landscape      keep landscape videos too (by default only portrait or square, which is what a Short is)
//   --verify         also confirm each survivor at youtube.com/shorts/<id> (no quota; a non-Short redirects)
//   --limit 20       how many to keep
//   --json           print JSON instead of a table
//
// What a "Short" is, as far as the API lets us tell: the Data API has no
// shorts flag, so a Short here is a video at most --max seconds long whose
// player is portrait or square (videos.list's `player` part reports the
// embed's width and height when asked at a fixed height). --verify checks the
// last mile against YouTube itself.
//
// Quota, from the key's 10,000 units a day: search.list is 100 a call (50
// results), playlistItems.list is 1, videos.list is 1 per 50 ids. The sweep of
// thirty-one committees is about forty units; a keyword search is about a
// hundred. The script prints what it spent.

import { readFileSync, existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, "../..")

function keyFrom(...files) {
  if (process.env.YOUTUBE_API_KEY) return process.env.YOUTUBE_API_KEY
  for (const f of files) {
    if (!existsSync(f)) continue
    const line = readFileSync(f, "utf8").split("\n").find((l) => l.startsWith("YOUTUBE_API_KEY="))
    if (line) return line.slice("YOUTUBE_API_KEY=".length).trim().replace(/^["']|["']$/g, "")
  }
  return ""
}
const KEY = keyFrom(path.join(repo, "apps/web/.env.local"), path.join(homedir(), "Code/livingston/.env.local"))
if (!KEY) {
  console.error("No YOUTUBE_API_KEY in the environment, apps/web/.env.local or ~/Code/livingston/.env.local.")
  process.exit(1)
}

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const v = args[i + 1]
  return v === undefined || v.startsWith("--") ? true : v
}
const opt = {
  q: flag("q", ""),
  channel: flag("channel", ""),
  committees: flag("committees", false) === true,
  max: Number(flag("max", 180)),
  // One second, not zero: a scheduled hearing lists as P0D until it airs.
  min: Number(flag("min", 1)),
  after: flag("after", ""),
  order: flag("order", "date"),
  license: flag("license", ""),
  views: Number(flag("views", 0)),
  landscape: flag("landscape", false) === true,
  verify: flag("verify", false) === true,
  limit: Number(flag("limit", 20)),
  json: flag("json", false) === true,
}
if (!opt.q && !opt.channel && !opt.committees) {
  console.error("Say what to look for: --q <words>, --channel <id or committee code>, or --committees.")
  process.exit(1)
}

const API = "https://www.googleapis.com/youtube/v3"
let spent = 0
async function yt(method, params, units) {
  const url = new URL(`${API}/${method}`)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v))
  url.searchParams.set("key", KEY)
  spent += units
  const res = await fetch(url)
  const body = await res.json()
  if (!res.ok) throw new Error(`${method}: ${body.error?.message ?? res.status}`)
  return body
}

const channels = JSON.parse(readFileSync(path.join(repo, "apps/web/lib/data/congress/committee-youtube.json"), "utf8")).channels

/** Video ids to consider, before any requirement is applied. */
async function candidates() {
  const ids = new Map() // id -> channel title, where known
  const afterIso = opt.after ? new Date(opt.after).toISOString() : undefined

  const sweep = async (code, ch) => {
    // The uploads playlist, newest first: one unit for fifty items.
    let pageToken
    for (let page = 0; page < 2; page++) {
      const r = await yt("playlistItems", { part: "contentDetails,snippet", playlistId: ch.uploads, maxResults: 50, pageToken }, 1)
      for (const it of r.items ?? []) {
        const at = it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt
        if (afterIso && at && at < afterIso) return
        ids.set(it.contentDetails.videoId, ch.title ?? code)
      }
      pageToken = r.nextPageToken
      if (!pageToken) return
    }
  }

  if (opt.committees) {
    for (const [code, ch] of Object.entries(channels)) await sweep(code, ch)
  } else if (opt.channel) {
    const ch = channels[opt.channel] ?? { channelId: opt.channel, uploads: opt.channel.startsWith("UC") ? "UU" + opt.channel.slice(2) : opt.channel, title: opt.channel }
    if (opt.q) {
      const r = await yt("search", { part: "id", type: "video", q: opt.q, channelId: ch.channelId, maxResults: 50, order: opt.order, publishedAfter: afterIso, videoEmbeddable: "true", videoDuration: opt.max <= 240 ? "short" : undefined }, 100)
      for (const it of r.items ?? []) ids.set(it.id.videoId, ch.title)
    } else await sweep(opt.channel, ch)
  } else {
    const r = await yt(
      "search",
      {
        part: "id",
        type: "video",
        q: opt.q,
        maxResults: 50,
        order: opt.order,
        publishedAfter: afterIso,
        videoEmbeddable: "true",
        videoLicense: opt.license === "cc" || opt.license === "creativeCommon" ? "creativeCommon" : undefined,
        videoDuration: opt.max <= 240 ? "short" : undefined,
        relevanceLanguage: "en",
      },
      100
    )
    for (const it of r.items ?? []) ids.set(it.id.videoId, "")
  }
  return ids
}

const seconds = (iso) => {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso ?? "")
  return m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0
}

/** Everything the requirements need, one unit per fifty ids. */
async function details(ids) {
  const out = []
  const list = [...ids.keys()]
  for (let i = 0; i < list.length; i += 50) {
    const r = await yt("videos", { part: "snippet,contentDetails,statistics,status,player", id: list.slice(i, i + 50).join(","), maxHeight: 1920 }, 1)
    for (const v of r.items ?? []) {
      const w = Number(v.player?.embedWidth ?? 0)
      const h = Number(v.player?.embedHeight ?? 0)
      out.push({
        id: v.id,
        title: v.snippet.title,
        channel: v.snippet.channelTitle || ids.get(v.id) || "",
        channelId: v.snippet.channelId,
        publishedAt: v.snippet.publishedAt,
        seconds: seconds(v.contentDetails.duration),
        width: w,
        height: h,
        portrait: w > 0 && h > 0 ? h >= w : null,
        views: Number(v.statistics?.viewCount ?? 0),
        embeddable: v.status?.embeddable !== false,
        license: v.contentDetails?.licensedContent ? "licensed" : "standard",
        url: `https://www.youtube.com/shorts/${v.id}`,
      })
    }
  }
  return out
}

async function isShort(id) {
  const res = await fetch(`https://www.youtube.com/shorts/${id}`, { method: "HEAD", redirect: "manual" })
  return res.status === 200
}

const ids = await candidates()
let rows = (await details(ids)).filter(
  (v) =>
    v.embeddable &&
    v.seconds >= opt.min &&
    v.seconds <= opt.max &&
    v.views >= opt.views &&
    (opt.landscape || v.portrait !== false) &&
    (!opt.after || v.publishedAt >= new Date(opt.after).toISOString())
)
rows.sort((a, b) => (opt.order === "viewCount" ? b.views - a.views : b.publishedAt.localeCompare(a.publishedAt)))
if (opt.verify) {
  const kept = []
  for (const v of rows) {
    if (kept.length >= opt.limit) break
    if (await isShort(v.id)) kept.push(v)
  }
  rows = kept
} else rows = rows.slice(0, opt.limit)

if (opt.json) {
  console.log(JSON.stringify(rows, null, 2))
} else {
  for (const v of rows) {
    const dim = v.width && v.height ? `${v.width}x${v.height}` : "?"
    console.log(`${v.id}  ${String(v.seconds).padStart(3)}s  ${dim.padEnd(9)}  ${String(v.views).padStart(9)} views  ${v.publishedAt.slice(0, 10)}  ${v.channel.slice(0, 32).padEnd(32)}  ${v.title}`)
  }
  console.log(`\n${rows.length} of ${ids.size} candidates kept · ${spent} quota units spent`)
}
