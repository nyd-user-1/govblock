import "server-only"

import { randomBytes } from "node:crypto"

import { CREATORS } from "@/components/clips/desks"
import type { Clip } from "@/components/clips/store"
import { auth } from "@/lib/auth/config"
import { enableDownload, getVideo, playbackToken, playbackUrls } from "@/lib/policy/cloudflare-stream"
import { one, q } from "@/lib/policy/db"
import { sessionSlug } from "@/lib/policy/roll-call-queries"

// The clips Aurora holds (sql/020_clips.sql), as the feed's own Clip shape.
// A row carries what the record knows — origin, desk, the ids it is keyed
// to — and Stream carries the video; this file joins the two. A private
// clip's MP4 and poster are handed out under a four-hour token, and only to
// its owner.

export const newId = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`

/** The signed-in reader, with the admin flag the session carries; null when signed out. */
export async function viewerOf() {
  try {
    const session = await auth()
    const user = session?.user as { id?: string; admin?: boolean } | undefined
    return user?.id ? { id: user.id, admin: user.admin === true } : null
  } catch {
    return null
  }
}

type Row = {
  id: string
  stream_uid: string | null
  origin: "recorded" | "cut" | "generated"
  status: "processing" | "review" | "published" | "removed"
  visibility: "private" | "public"
  desk: string | null
  owner_id: string | null
  title: string
  caption: string
  duration: number | null
  created_at: string
  owner_name: string | null
  owner_email: string | null
  owner_image: string | null
  hearing_key: string | null
  hearing_title: string | null
  roll_chamber: string | null
  roll_congress: number | null
  roll_session: string | null
  roll_number: string | null
  bill_id: number | null
  bill_label: string | null
}

// Every link a clip carries is read from the record's own tables by the ids
// on the row, so a clip can only point at something the site has.
const SELECT = `
  select c.id, c.stream_uid, c.origin, c.status, c.visibility, c.desk, c.owner_id, c.title, c.caption, c.duration,
         to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') created_at,
         p.name owner_name, r.email owner_email, p.image owner_image,
         c.hearing_key, m.title hearing_title,
         c.roll_call_chamber roll_chamber, coalesce(hv.congress, sv.congress) roll_congress,
         coalesce(hv.session_number, sv.session_number) roll_session, coalesce(hv.roll_call_number, sv.roll_call_number) roll_number,
         b.bill_id, b.bill_type || ' ' || b.number bill_label
    from clips c
    left join reader_profiles p on p.user_id = c.owner_id
    left join readers r on r.id = c.owner_id
    left join congress_committee_meetings m on m.key = c.hearing_key
    left join congress_house_votes hv on c.roll_call_chamber = 'house' and hv.key = c.roll_call_key
    left join congress_senate_votes sv on c.roll_call_chamber = 'senate' and sv.key = c.roll_call_key
    left join congress_bills b on b.key = c.bill_key`

function linksOf(r: Row): NonNullable<Clip["links"]> {
  const links: NonNullable<Clip["links"]> = []
  if (r.hearing_key) links.push({ label: r.hearing_title ? r.hearing_title.replace(/^"|"$/g, "") : "Hearing", href: `/meetings/${r.hearing_key}` })
  if (r.bill_id) links.push({ label: r.bill_label ?? "Bill", href: `/bills/${r.bill_id}` })
  if (r.roll_chamber && r.roll_congress && r.roll_session && r.roll_number)
    links.push({ label: `${r.roll_chamber === "senate" ? "Senate" : "House"} roll call ${r.roll_number}`, href: `/roll-call-votes/${sessionSlug(r.roll_chamber, r.roll_congress, r.roll_session)}/${r.roll_number}` })
  return links
}

async function toClip(r: Row, viewer: string | null): Promise<Clip> {
  const mine = !!viewer && r.owner_id === viewer
  const desk = r.desk ? CREATORS.find((c) => c.id === r.desk) : undefined
  const handle = (r.owner_email ?? "reader").split("@")[0]
  const author = desk ? { name: desk.name, handle: desk.handle, image: desk.image } : { name: r.owner_name ?? handle, handle, image: r.owner_image }
  let src = ""
  let poster: string | undefined
  if (r.stream_uid && r.status !== "processing") {
    const key = r.visibility === "private" ? await playbackToken(r.stream_uid).catch(() => null) : r.stream_uid
    if (key) ({ mp4: src, poster } = playbackUrls(key))
  }
  return {
    id: r.id,
    creatorId: r.desk ?? (mine ? "you" : "reader"),
    author,
    title: r.title,
    caption: r.caption,
    src,
    poster,
    duration: r.duration ?? undefined,
    createdAt: r.created_at,
    visibility: r.visibility,
    views: 0,
    likes: 0,
    mine,
    origin: r.origin,
    status: r.status,
    links: linksOf(r),
  }
}

/**
 * A processing clip, looked at again: once Stream has the video ready the
 * MP4 is asked for, and once the MP4 is ready the clip is published (to its
 * owner alone while it is private).
 */
async function settle(r: Row): Promise<Row> {
  if (r.status !== "processing" || !r.stream_uid) return r
  const video = await getVideo(r.stream_uid).catch(() => undefined)
  if (video === undefined || !video?.ready) return r
  const mp4 = await enableDownload(r.stream_uid).catch(() => "inprogress")
  if (mp4 !== "ready") return r
  await q(`update clips set status = 'published', duration = coalesce($2, duration), width = $3, height = $4, published_at = coalesce(published_at, now()) where id = $1`, [r.id, video.duration, video.width, video.height])
  return { ...r, status: "published", duration: video.duration ?? r.duration }
}

/** The feed: every published public clip, and the viewer's own whatever their state. */
export async function listClips(viewer: string | null): Promise<{ published: Clip[]; mine: Clip[] }> {
  const rows = await q<Row>(
    `${SELECT}
      where (c.status = 'published' and c.visibility = 'public') or (c.owner_id = $1 and c.status <> 'removed')
      order by c.created_at desc limit 300`,
    [viewer ?? ""]
  )
  const settled = await Promise.all(rows.map((r) => (viewer && r.owner_id === viewer ? settle(r) : r)))
  const clips = await Promise.all(settled.map((r) => toClip(r, viewer)))
  return { published: clips.filter((c) => c.status === "published" && c.visibility === "public" && !c.mine), mine: clips.filter((c) => c.mine) }
}

export async function getClipRow(id: string) {
  return one<{ id: string; stream_uid: string | null; owner_id: string | null; desk: string | null; visibility: string; status: string; origin: string }>(
    `select id, stream_uid, owner_id, desk, visibility, status, origin from clips where id = $1`,
    [id]
  )
}

export async function getClip(id: string, viewer: string | null) {
  const row = await one<Row>(`${SELECT} where c.id = $1`, [id])
  return row ? toClip(row, viewer) : null
}
