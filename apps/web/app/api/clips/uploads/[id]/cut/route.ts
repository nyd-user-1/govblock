import { NextResponse } from "next/server"

import { pickMoments } from "@/lib/clips/moments"
import { newId, viewerOf } from "@/lib/clips/server"
import { readTranscript, storedTranscript, TranscriptError } from "@/lib/clips/youtube"
import { one, q } from "@/lib/policy/db"

// Cut a pasted YouTube link into clips, one step a request, so no step runs
// into the host's thirty-second cut-off: first the captions (kept in
// clip_transcripts), then the moments, which become the reader's own clips,
// private until the reader makes one public. The browser calls again until the
// answer is done, failed, or waiting on the worker box.

export const dynamic = "force-dynamic"
export const maxDuration = 30

type Cut = { id: string; status: string; owner_id: string | null; video_id: string | null; title: string | null; log: string | null; clips: number | null; error: string | null }

const answer = (cut: Pick<Cut, "id" | "status" | "clips" | "error">, step: string | null) => NextResponse.json({ upload: { id: cut.id, status: cut.status, clips: cut.clips, error: cut.error }, step })

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const [viewer, { id }] = await Promise.all([viewerOf(), params])
  if (!viewer) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const cut = await one<Cut>(`select id, status, owner_id, video_id, title, log, clips, error from clip_cuts where id = $1`, [id])
  if (!cut || (cut.owner_id !== viewer.id && !viewer.admin)) return NextResponse.json({ error: "No such link." }, { status: 404 })
  if (cut.status === "done" || cut.status === "failed") return answer(cut, null)
  if (!cut.video_id) return answer({ ...cut, error: "Only YouTube links are cut here; this one waits for the worker box." }, null)

  const fail = async (message: string) => {
    await q(`update clip_cuts set status = 'failed', error = $2, log = null, finished_at = now() where id = $1`, [id, message])
    return answer({ ...cut, status: "failed", error: message }, null)
  }

  // Step one: the captions.
  const kept = await storedTranscript(cut.video_id)
  if (!kept) {
    await q(`update clip_cuts set status = 'running', started_at = coalesce(started_at, now()), error = null where id = $1`, [id])
    try {
      const job = cut.log?.startsWith("supadata:") ? cut.log.slice("supadata:".length) : undefined
      const t = await readTranscript(cut.video_id, job)
      await q(`update clip_cuts set title = coalesce($2, title), log = null where id = $1`, [id, t.title?.slice(0, 150) ?? null])
      return answer({ ...cut, status: "running" }, "transcript")
    } catch (error) {
      if (error instanceof TranscriptError) {
        if (error.kind === "pending") {
          await q(`update clip_cuts set log = $2 where id = $1`, [id, `supadata:${error.jobId}`])
          return answer({ ...cut, status: "running" }, "pending")
        }
        if (error.kind === "blocked") {
          const message = "YouTube would not send the captions to the server; the link waits for the worker box."
          await q(`update clip_cuts set status = 'queued', error = $2 where id = $1`, [id, message])
          return answer({ ...cut, status: "queued", error: message }, null)
        }
        return fail(error.message)
      }
      return fail(error instanceof Error ? error.message : String(error))
    }
  }

  // Step two: the moments, as clips. Claimed first, so two tabs cannot cut the same link twice; a claim older than ninety seconds has died with its request.
  const claimed = await one<{ id: string }>(
    `update clip_cuts set status = 'running', started_at = coalesce(started_at, now()), log = 'cutting:' || extract(epoch from now())::bigint
      where id = $1 and case when coalesce(log, '') like 'cutting:%' then split_part(log, ':', 2)::bigint < extract(epoch from now())::bigint - 90 else true end
      returning id`,
    [id]
  )
  if (!claimed) return answer({ ...cut, status: "running" }, "moments")
  try {
    const moments = await pickMoments(kept)
    if (!moments.length) return fail("Nothing in this video stood on its own as a clip.")
    for (const m of moments) {
      await q(
        `insert into clips (id, origin, status, visibility, owner_id, title, caption, duration, width, height, jurisdiction, cut_id, source_start, source_end, template, composition, published_at)
         values ($1, 'cut', 'published', 'private', $2, $3, $4, $5, 1920, 1080, 'us', $6, $7, $8, 'youtube', $9::jsonb, now())`,
        [newId("clp"), cut.owner_id ?? viewer.id, m.title, m.caption, Math.round((m.end - m.start) * 10) / 10, id, m.start, m.end, JSON.stringify({ template: "youtube", props: { videoId: kept.videoId, start: m.start, end: m.end } })]
      )
    }
    await q(`update clip_cuts set status = 'done', clips = $2, error = null, log = null, finished_at = now() where id = $1`, [id, moments.length])
    return answer({ ...cut, status: "done", clips: moments.length, error: null }, "moments")
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}
