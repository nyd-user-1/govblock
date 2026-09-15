import { NextResponse } from "next/server"

import { viewerOf } from "@/lib/clips/server"
import { one, q } from "@/lib/policy/db"

// The Clips dashboard's figures (2026-09-14), for an admin: what is on the
// feed and how it got there, the queue of pasted links and where each stands,
// the transcripts kept, and the reports open.

export const dynamic = "force-dynamic"

export async function GET() {
  const viewer = await viewerOf()
  if (!viewer?.admin) return NextResponse.json({ error: "Admins only." }, { status: 403 })
  try {
    const [totals, days, queue, reports, transcripts] = await Promise.all([
      one<Record<string, number>>(
        `select count(*) filter (where status <> 'removed')::int clips,
                count(*) filter (where status = 'published' and visibility = 'public')::int public,
                count(*) filter (where origin = 'recorded' and status <> 'removed')::int recorded,
                count(*) filter (where origin = 'cut' and status <> 'removed')::int cut,
                count(*) filter (where origin = 'generated' and status <> 'removed')::int generated,
                count(*) filter (where status = 'removed')::int removed,
                count(*) filter (where created_at > now() - interval '7 days')::int week,
                (select count(*)::int from clip_cuts) links,
                (select count(*)::int from clip_cuts where status = 'queued') queued,
                (select count(*)::int from clip_cuts where status = 'running') running,
                (select count(*)::int from clip_cuts where status = 'done') done,
                (select count(*)::int from clip_cuts where status = 'failed') failed,
                (select count(*)::int from clip_templates) templates
           from clips`
      ),
      q<{ day: string; recorded: number; cut: number; generated: number }>(
        `select to_char(d, 'YYYY-MM-DD') as day,
                count(c.id) filter (where c.origin = 'recorded')::int as recorded,
                count(c.id) filter (where c.origin = 'cut')::int as cut,
                count(c.id) filter (where c.origin = 'generated')::int as generated
           from generate_series(current_date - 13, current_date, interval '1 day') d
           left join clips c on c.created_at >= d and c.created_at < d + interval '1 day'
          group by d order by d`
      ),
      q<{ id: string; title: string | null; source_url: string | null; video_id: string | null; status: string; clips: number | null; error: string | null; reader: string | null; created_at: string; started_at: string | null; finished_at: string | null; transcript: string | null }>(
        `select k.id, k.title, k.source_url, k.video_id, k.status, k.clips, k.error, coalesce(p.name, split_part(r.email, '@', 1)) reader,
                to_char(k.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') created_at, to_char(k.started_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') started_at, to_char(k.finished_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') finished_at,
                t.source transcript
           from clip_cuts k
           left join readers r on r.id = k.owner_id
           left join reader_profiles p on p.user_id = k.owner_id
           left join clip_transcripts t on t.video_id = k.video_id
          order by k.created_at desc limit 50`
      ),
      q<{ id: string; clip_id: string; title: string | null; reason: string; details: string; created_at: string }>(
        `select x.id, x.clip_id, c.title, x.reason, x.details, to_char(x.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') created_at
           from clip_reports x left join clips c on c.id = x.clip_id
          where x.resolved_at is null order by x.created_at desc limit 20`
      ),
      one<{ count: number; youtube: number; worker: number; hours: number }>(
        `select count(*)::int count, count(*) filter (where source = 'youtube')::int youtube,
                count(*) filter (where source = 'worker')::int worker, coalesce(round((sum(duration) / 3600.0)::numeric, 1), 0)::float hours
           from clip_transcripts`
      ),
    ])
    return NextResponse.json(
      { totals, days, queue, reports, transcripts },
      { headers: { "cache-control": "private, no-store" } }
    )
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 502 })
  }
}
