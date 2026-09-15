import { NextResponse } from "next/server"

import { getClipRow, viewerOf } from "@/lib/clips/server"
import { removeObjects } from "@/lib/clips/storage"
import { q } from "@/lib/policy/db"

// One clip of the reader's own. PATCH publishes or hides it and changes its
// words; DELETE removes its video and poster from the clips bucket and its row
// from Aurora. A clip that is not
// the reader's answers 404, the same as one that does not exist.

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }> }

async function owned(props: Props) {
  const [viewer, { id }] = await Promise.all([viewerOf(), props.params])
  if (!viewer) return { ok: false as const, error: NextResponse.json({ error: "Sign in first." }, { status: 401 }) }
  const row = await getClipRow(id)
  if (!row || row.owner_id !== viewer.id || row.status === "removed") return { ok: false as const, error: NextResponse.json({ error: "No such clip." }, { status: 404 }) }
  return { ok: true as const, row }
}

export async function PATCH(request: Request, props: Props) {
  const held = await owned(props)
  if (!held.ok) return held.error
  const { row } = held
  const body = (await request.json().catch(() => ({}))) as { visibility?: string; title?: string; caption?: string }
  const visibility = body.visibility === "public" || body.visibility === "private" ? body.visibility : null
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 150) : null
  const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, 2200) : null
  if (title === "") return NextResponse.json({ error: "A clip needs a title." }, { status: 400 })
  try {
    await q(`update clips set visibility = coalesce($2, visibility), title = coalesce($3, title), caption = coalesce($4, caption) where id = $1`, [row.id, visibility, title, caption])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}

export async function DELETE(_request: Request, props: Props) {
  const held = await owned(props)
  if (!held.ok) return held.error
  const { row } = held
  try {
    await removeObjects([row.video_key, row.poster_key])
    await q(`delete from clips where id = $1`, [row.id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
