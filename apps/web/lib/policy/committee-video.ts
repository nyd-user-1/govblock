import "server-only"

import map from "@/lib/data/congress/committee-youtube.json"

// The committee's latest hearing video.
//
// **Finding is expensive and showing is not.** `search.list` costs 100 quota
// units of the 10,000 a day; reading a channel's uploads playlist costs ONE. So
// the expensive half — which channel belongs to which committee — was done once
// at build time and committed beside this file, and a page view spends a single
// unit against `playlistItems.list`. At 10,000 units a day that is ten thousand
// committee pages before the key notices, and the hourly cache below means we
// never get close.
//
// The freshness ruling stands: LIVE is as fresh as the cache and no fresher.
// The named upgrade, priced and NOT built, is one `videos.list` confirm (1 unit)
// against a cached live id — cheap precisely because the finding stays cached.

const KEY = process.env.YOUTUBE_API_KEY
const CHANNELS = (map as { channels: Record<string, Channel> }).channels

type Channel = { channelId: string; uploads: string; title: string }

export type LatestHearing =
  /** A video, and whether the channel says it is live right now. */
  | { kind: "video"; id: string; title: string; publishedAt: string; live: boolean; channel: string }
  /** Everything else says what WE lack, never what the committee lacks. */
  | { kind: "unmapped" }
  | { kind: "unconfigured" }
  | { kind: "empty"; channel: string }
  | { kind: "failed"; channel: string; reason: string }

/**
 * Whether that video is streaming right now.
 *
 * This is a second call because it has to be: `playlistItems` does not carry
 * `liveBroadcastContent` at all — checked against the real payload, the field is
 * simply absent — while `videos.list` returns it. Without this the LIVE badge
 * could never fire, which is worse than not having one: dead code promising a
 * thing it cannot do.
 *
 * It costs ONE unit and shares the hourly cache, so a committee page view is 2
 * units rather than 1, against 10,000 a day. The badge is therefore as fresh as
 * the hour, which is the v1 ruling exactly; minute-fresh would mean skipping the
 * cache on this call alone, and that stays priced rather than built.
 */
async function isLive(id: string) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(id)}&key=${KEY}`,
      { next: { revalidate: 3600 } }
    )
    if (!response.ok) return false
    const json = (await response.json()) as {
      items?: { snippet?: { liveBroadcastContent?: string } }[]
    }
    return json.items?.[0]?.snippet?.liveBroadcastContent === "live"
  } catch {
    // A badge we could not confirm is a badge we do not show.
    return false
  }
}

export function hasChannel(code: string) {
  return Boolean(CHANNELS[code.toLowerCase()])
}

export async function latestHearing(code: string): Promise<LatestHearing> {
  const channel = CHANNELS[code.toLowerCase()]
  if (!channel) return { kind: "unmapped" }
  if (!KEY) return { kind: "unconfigured" }

  const url =
    "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=1" +
    `&playlistId=${encodeURIComponent(channel.uploads)}&key=${KEY}`

  try {
    // One hour, which is the freshness this card promises and the reason a page
    // view is not a quota event.
    const response = await fetch(url, { next: { revalidate: 3600 } })
    const json = (await response.json()) as {
      items?: {
        snippet?: { title?: string; publishedAt?: string; liveBroadcastContent?: string }
        contentDetails?: { videoId?: string; videoPublishedAt?: string }
      }[]
      error?: { message?: string }
    }
    if (!response.ok)
      return { kind: "failed", channel: channel.title, reason: json.error?.message ?? `YouTube returned ${response.status}` }

    const item = json.items?.[0]
    const id = item?.contentDetails?.videoId
    if (!item || !id) return { kind: "empty", channel: channel.title }

    return {
      kind: "video",
      id,
      title: item.snippet?.title ?? "Hearing",
      publishedAt: item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? "",
      live: await isLive(id),
      channel: channel.title,
    }
  } catch (error) {
    return {
      kind: "failed",
      channel: channel.title,
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}
