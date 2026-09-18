import "server-only"

import { one, q } from "@/lib/policy/db"

import { getUpload } from "@/lib/typeset/uploads"

import { administeredPages, publish, uploadImage } from "./api"
import { seal, unseal } from "./seal"
import { feedUrl, type LinkedInAccount, type Post, type PostImage, type PostStatus, type PostTarget } from "./types"

// The connection and the posts in Aurora (sql/031_linkedin.sql), and the
// publisher that sends what is due.

type AccountRow = {
  user_id: string
  member_urn: string
  name: string | null
  picture: string | null
  token_sealed: string
  scope: string
  expires_at: string
  org_urns: string[]
}

type PostRow = {
  id: string
  user_id: string
  title: string
  body: string
  target: PostTarget
  publish_at: string
  status: PostStatus
  error: string | null
  images: PostImage[]
  posted_urns: string[]
}

// The Data API hands a timestamptz back as "2026-09-17 21:04:00", UTC with no
// designator; a Postgres URL hands back a Date.
const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : new Date(`${String(value).replace(" ", "T")}Z`).toISOString())

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    target: row.target,
    publishAt: iso(row.publish_at),
    status: row.status,
    error: row.error,
    images: row.images ?? [],
    urls: (row.posted_urns ?? []).map(feedUrl),
  }
}

// ---------------------------------------------------------------------------
// The connection

export async function saveAccount(input: { userId: string; memberUrn: string; name: string | null; picture: string | null; token: string; expiresIn: number; scope: string }) {
  const orgs = input.scope.includes("w_organization_social") ? await administeredPages(input.token) : []
  await q(
    `insert into linkedin_accounts (user_id, member_urn, name, picture, token_sealed, scope, expires_at, org_urns, connected_at)
     values ($1, $2, $3, $4, $5, $6, now() + ($7::int * interval '1 second'), $8::jsonb, now())
     on conflict (user_id) do update set member_urn = excluded.member_urn, name = excluded.name, picture = excluded.picture,
       token_sealed = excluded.token_sealed, scope = excluded.scope, expires_at = excluded.expires_at, org_urns = excluded.org_urns, connected_at = now()`,
    [input.userId, input.memberUrn, input.name, input.picture, seal(input.token), input.scope, input.expiresIn, JSON.stringify(orgs)]
  )
}

export async function accountOf(userId: string): Promise<LinkedInAccount> {
  const row = await one<AccountRow>(`select * from linkedin_accounts where user_id = $1`, [userId])
  if (!row) return { connected: false, configured: true }
  return {
    connected: unseal(row.token_sealed) !== null,
    configured: true,
    name: row.name,
    picture: row.picture,
    expiresAt: iso(row.expires_at),
    company: (row.org_urns ?? []).length > 0,
  }
}

export async function disconnect(userId: string) {
  await q(`delete from linkedin_accounts where user_id = $1`, [userId])
}

// ---------------------------------------------------------------------------
// The posts

export async function listPosts(userId: string): Promise<Post[]> {
  const rows = await q<PostRow>(`select * from linkedin_posts where user_id = $1 order by publish_at`, [userId])
  return rows.map(toPost)
}

export type PostInput = { title?: string; body?: string; target?: PostTarget; publishAt?: string; status?: "draft" | "scheduled"; images?: PostImage[] }

export async function createPost(userId: string, id: string, input: PostInput): Promise<Post> {
  const row = await one<PostRow>(
    `insert into linkedin_posts (id, user_id, title, body, target, publish_at, status, images)
     values ($1::uuid, $2, $3, $4, $5, $6::timestamptz, 'draft', $7::jsonb) returning *`,
    [id, userId, input.title ?? "", input.body ?? "", input.target ?? "profile", input.publishAt ?? new Date().toISOString(), JSON.stringify(input.images ?? [])]
  )
  return toPost(row!)
}

/**
 * Changes a post that has not gone out. A post that is publishing or posted
 * is LinkedIn's now, and a change to one is refused (null). A failed post
 * goes back to draft when edited, so it is only resent once scheduled again.
 */
export async function updatePost(userId: string, id: string, input: PostInput): Promise<Post | null> {
  const row = await one<PostRow>(
    `update linkedin_posts set
       title = coalesce($3::text, title),
       body = coalesce($4::text, body),
       target = coalesce($5::text, target),
       publish_at = coalesce($6::timestamptz, publish_at),
       status = coalesce($7::text, case when status = 'failed' then 'draft' else status end),
       error = case when $7::text is not null or status = 'failed' then null else error end,
       images = coalesce($8::jsonb, images),
       updated_at = now()
     where id = $1::uuid and user_id = $2 and status in ('draft', 'scheduled', 'failed')
     returning *`,
    [id, userId, input.title ?? null, input.body ?? null, input.target ?? null, input.publishAt ?? null, input.status ?? null, input.images ? JSON.stringify(input.images) : null]
  )
  return row ? toPost(row) : null
}

export async function deletePost(userId: string, id: string) {
  await q(`delete from linkedin_posts where id = $1::uuid and user_id = $2 and status <> 'publishing'`, [id, userId])
}

// ---------------------------------------------------------------------------
// The publisher

/**
 * Sends every scheduled post that is due, or the one post named (Post now).
 * A post is claimed before it is sent, so two runs never send it twice; one
 * left publishing by a run that died is marked failed rather than retried,
 * since LinkedIn may already have it.
 */
export async function publishDue(only?: { userId: string; id: string }): Promise<{ sent: number; failed: number }> {
  await q(
    `update linkedin_posts set status = 'failed', error = 'Interrupted while publishing. Check LinkedIn before sending it again.', updated_at = now()
      where status = 'publishing' and claimed_at < now() - interval '15 minutes'`
  )

  const claimed = only
    ? await q<PostRow>(
        `update linkedin_posts set status = 'publishing', claimed_at = now(), error = null, updated_at = now()
          where id = $1::uuid and user_id = $2 and status in ('draft', 'scheduled', 'failed') returning *`,
        [only.id, only.userId]
      )
    : await q<PostRow>(
        `update linkedin_posts set status = 'publishing', claimed_at = now(), updated_at = now()
          where id in (select id from linkedin_posts where status = 'scheduled' and publish_at <= now()
                        order by publish_at limit 20 for update skip locked)
          returning *`
      )

  let sent = 0
  let failed = 0
  for (const post of claimed) {
    const outcome = await send(post)
    if (outcome.error) failed++
    else sent++
    await q(
      `update linkedin_posts set status = $2::text, error = $3::text, posted_urns = $4::jsonb, posted_at = case when $2::text = 'posted' then now() else posted_at end, updated_at = now()
        where id = $1::uuid`,
      [post.id, outcome.error ? "failed" : "posted", outcome.error, JSON.stringify(outcome.urns)]
    )
  }
  return { sent, failed }
}

async function send(post: PostRow): Promise<{ urns: string[]; error: string | null }> {
  const images = post.images ?? []
  if (!post.body.trim() && !images.length) return { urns: [], error: "The post has no text or images." }
  const account = await one<AccountRow>(`select * from linkedin_accounts where user_id = $1`, [post.user_id])
  if (!account) return { urns: [], error: "LinkedIn is not connected." }
  if (new Date(iso(account.expires_at)) <= new Date()) return { urns: [], error: "The LinkedIn connection expired. Reconnect and schedule it again." }
  const token = unseal(account.token_sealed)
  if (!token) return { urns: [], error: "The LinkedIn connection can no longer be read. Reconnect and schedule it again." }

  const authors: string[] = []
  if (post.target !== "company") authors.push(account.member_urn)
  if (post.target !== "profile") {
    const org = (account.org_urns ?? [])[0]
    if (!org) return { urns: [], error: "No company page is connected: LinkedIn has not granted this app the Community Management API yet." }
    authors.push(org)
  }

  // Read once; uploaded again for each author, since an image belongs to its owner.
  let files: { bytes: Uint8Array; type: string }[] = []
  try {
    files = await Promise.all(
      images.map(async (image) => {
        const object = await getUpload(image.key)
        return { bytes: new Uint8Array(await object.Body!.transformToByteArray()), type: image.type }
      })
    )
  } catch {
    return { urns: [], error: "An image could not be read back from storage." }
  }

  const urns: string[] = []
  for (const author of authors) {
    try {
      const ids: string[] = []
      for (const file of files) ids.push(await uploadImage(token, author, file.bytes, file.type))
      urns.push(await publish(token, author, post.body, ids))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const where = author.startsWith("urn:li:organization") ? "the company page" : "the profile"
      return { urns, error: urns.length ? `Posted to the profile, but not to ${where}: ${message}` : message }
    }
  }
  return { urns, error: null }
}
