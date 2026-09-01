import { NextResponse } from "next/server"
import { databaseKind, sql } from "@/lib/policy/db"

// Proof of the data path, for a deploy check and for the source badge: which
// backend answered, whether a real query came back, and how long it took. Aurora
// scales to zero, so a first request after a long idle can be slow or fail --
// that is the number to watch here.

export const dynamic = "force-dynamic"

export async function GET() {
  const started = Date.now()
  const body: Record<string, unknown> = {
    ok: false,
    database: databaseKind(),
    region: process.env.AWS_REGION ?? null,
    commit: process.env.AWS_COMMIT_ID ?? null,
  }

  if (!sql) {
    body.detail = "no database configured; pages serve their committed snapshots"
    return NextResponse.json(body, { status: 200 })
  }

  try {
    const rows = (await sql`
      select (select count(*) from public.mv_stream_latest) as stream_rows,
             (select count(*) from public.mv_newsroom_latest) as newsroom_rows,
             (select count(*) from "Bills") as bills,
             (select max(refreshed_at) from public.mv_stream_latest) as refreshed_at`) as Record<
      string,
      unknown
    >[]
    body.ok = true
    body.counts = rows[0]
  } catch (error) {
    body.detail = error instanceof Error ? error.message : String(error)
  }

  body.ms = Date.now() - started
  return NextResponse.json(body, { status: body.ok ? 200 : 503 })
}
