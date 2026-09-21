import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { revalidateTag } from "next/cache"
import { NextResponse } from "next/server"

import { adminId } from "@/lib/linkedin/session"
import { q } from "@/lib/policy/db"
import { scriptSections } from "@/lib/pipeline/script-sections"

// The Database dashboard's live board (Brendan, 2026-09-20). GET answers what
// is running, which jurisdictions' texts are landing right now, texts a day by
// loader, and — for one state — what is on file for it. POST starts and stops
// runs through scripts/pipeline/launch.mjs, which needs this machine's AWS
// credentials and launches real instances: development only, an admin only.
// The reads are an admin's too; they are marked fresh, so the site's read
// cache never answers a board that is watching a run.

const run = promisify(execFile)
const DEV = process.env.NODE_ENV === "development"
const PRIVATE = { "cache-control": "private, no-store" }

// A finished run clears the site's read cache (lib/policy/db.ts), once. The cache's contract is that a loader clears
// it when it ends; a throwaway box cannot reach this server, so the board does it on the box's behalf the first time
// it sees the run's `done`. Without this the fleet of 2026-09-20 turned all 52 jurisdictions green in Aurora and the
// dashboard went on drawing 51 of them red from a read cached before the fleet began.
let clearedThrough = ""
function clearAfter(runs: unknown) {
  const done = (Array.isArray(runs) ? runs : [])
    .flatMap((r) => ((r as { stages?: { stage: string; at: string | null }[] }).stages ?? []).filter((st) => st.stage.startsWith("done:")).map((st) => st.at ?? ""))
    .sort()
    .pop()
  if (done && done > clearedThrough) {
    clearedThrough = done
    revalidateTag("policy", "max")
    // And its work goes into the run log while its S3 log is still there to read.
    if (DEV) void launcher("ledger").catch(() => null)
  }
}

async function launcher(...args: string[]) {
  const { stdout } = await run("node", ["scripts/pipeline/launch.mjs", ...args], { cwd: /*turbopackIgnore: true*/ process.cwd(), timeout: 120_000, maxBuffer: 1 << 24 })
  return JSON.parse(stdout || "null") as unknown
}

export async function GET(request: Request) {
  if (!(await adminId())) return NextResponse.json({ error: "Only an admin can read the pipeline." }, { status: 403, headers: PRIVATE })
  const sp = new URL(request.url).searchParams
  const state = (sp.get("state") ?? "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2)
  const days = Math.min(Math.max(Number(sp.get("days") ?? 30) || 30, 7), 90)
  const live = sp.get("live") === "1"
  const fresh = live ? "/* fresh */ " : ""

  const [runs, room, recent, minutes, daily, byState, detail, updates, ledger] = await Promise.all([
    // Every run with the steps its box has reported, the last hour's finished ones too.
    DEV ? launcher("status").catch(() => []) : [],
    DEV && sp.get("room") === "1" ? launcher("quota").catch(() => null) : null,
    // Landing now: texts written in the last quarter hour, by jurisdiction. Asked only while something runs.
    live ? q<{ state: string; n: number; at: string }>(`${fresh}select state, count(*)::int n, max(fetched_at)::text at from "BillTexts" where fetched_at > now() - interval '15 minutes' group by state`).catch(() => []) : [],
    // Texts written a minute, for the last half hour: the Volume card's live view, asked only while something runs.
    live
      ? q<{ minute: string; n: number }>(
          `${fresh}select to_char(date_trunc('minute', fetched_at), 'YYYY-MM-DD"T"HH24:MI:00"Z"') as minute, count(*)::int n from "BillTexts" where fetched_at > now() - interval '30 minutes' ${state ? "and state = $1" : ""} group by 1 order by 1`,
          state ? [state] : []
        ).catch(() => [])
      : [],
    q<{ day: string; source: string; n: number }>(
      `${fresh}select to_char(fetched_at::date, 'YYYY-MM-DD') as day, coalesce(source, 'unknown') as source, count(*)::int n from "BillTexts"
        where fetched_at > now() - ($1 || ' days')::interval ${state ? "and state = $2" : ""} group by 1, 2 order by 1`,
      state ? [String(days), state] : [String(days)]
    ).catch(() => []),
    // Which jurisdictions the span's texts belong to, and which loader fetched them (Brendan: "not bundle them together in one source").
    q<{ state: string; source: string; n: number; last: string | null }>(
      `${fresh}select state, coalesce(source, 'unknown') as source, count(*)::int n, max(fetched_at)::text as last from "BillTexts" where fetched_at > now() - ($1 || ' days')::interval group by 1, 2 order by 3 desc`,
      [String(days)]
    ).catch(() => []),
    state && sp.get("detail") === "1"
      ? Promise.all([
          q<{ source: string; n: number; with_text: number; last: string | null }>(`${fresh}select coalesce(source, 'unknown') as source, count(*)::int n, count(text)::int with_text, max(fetched_at)::text as last from "BillTexts" where state = $1 group by 1 order by 2 desc`, [state]).catch(() => []),
          q<{ host: string; n: number }>(`select substring(state_link from '://([^/]+)') as host, count(*)::int n from "Bills" where state = $1 and coalesce(state_link, '') <> '' group by 1 order by 2 desc limit 4`, [state]).catch(() => []),
          q<{ bills: number; with_text: number; newest_action: string | null; newest_text: string | null }>(`${fresh}select count(*)::int bills, count(*) filter (where text_chars > 0)::int with_text, max(last_action_date) as newest_action, max(text_fetched_at)::text as newest_text from "Bills" where state = $1`, [state]).catch(() => []),
          // The loader's own code for this jurisdiction, read off the livingston checkout beside this one; development only.
          DEV ? scriptSections(state).catch(() => null) : null,
        ]).then(([sources, hosts, totals, script]) => ({ sources, hosts, totals: totals[0] ?? null, script }))
      : null,
    // What each jurisdiction holds now beside what it held before the span's first run (sql/036): the Updates chart.
    // A count of rows stamped in a day cannot say this; two counts of the same thing, a run apart, can.
    q<{ state: string; bills: number; with_text: number; base_bills: number; base_text: number; base_at: string }>(
      `${fresh}with base as (select distinct on (state) state, bills, with_text, at from "CorpusSnapshotStates" where at > now() - ($1 || ' days')::interval order by state, at)
       select b.state, count(*)::int as bills, count(*) filter (where b.text_chars > 0)::int as with_text, base.bills as base_bills, base.with_text as base_text,
              to_char(base.at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as base_at
         from "Bills" b join base on base.state = b.state group by b.state, base.bills, base.with_text, base.at order by 1`,
      [String(days)]
    ).catch(() => []),
    // The run log: what each run did for each jurisdiction it owned (sql/037), written from the boxes' own logs.
    q<{ run: string; state: string; mode: string | null; started: string; finished: string | null; exit: number | null; discover_source: string | null; discover_result: string | null; discover_exit: number | null; fetch_source: string | null; considered: number; stored: number; skipped: number; note: string | null }>(
      `${fresh}select run, state, mode, to_char(started at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as started, to_char(finished at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as finished,
              exit, discover_source, discover_result, discover_exit, fetch_source, considered, stored, skipped, note
         from "PipelineRunStates" where started > now() - ($1 || ' days')::interval order by started desc, state`,
      [String(days)]
    ).catch(() => []),
  ])
  clearAfter(runs)
  return NextResponse.json({ canRun: DEV, runs, room, recent, minutes, daily, byState, detail, updates, ledger }, { headers: PRIVATE })
}

export async function POST(request: Request) {
  if (!DEV) return NextResponse.json({ error: "Runs are started from a development machine." }, { status: 404, headers: PRIVATE })
  if (!(await adminId())) return NextResponse.json({ error: "Only an admin can start a run." }, { status: 403, headers: PRIVATE })
  const body = (await request.json().catch(() => null)) as { action?: string; state?: string; boxes?: number; target?: string } | null
  try {
    if (body?.action === "single" && /^[A-Za-z]{2}$/.test(body.state ?? "")) return NextResponse.json({ started: await launcher("single", body.state!.toUpperCase()) }, { headers: PRIVATE })
    if (body?.action === "fleet") return NextResponse.json({ started: await launcher("fleet", ...(body.boxes ? ["--boxes", String(Math.floor(body.boxes))] : [])) }, { headers: PRIVATE })
    if (body?.action === "stop" && /^(all|single|fleet|i-[0-9a-f]+)$/.test(body.target ?? "")) return NextResponse.json({ stopped: await launcher("stop", body.target!) }, { headers: PRIVATE })
  } catch (error) {
    // The launcher's refusals are sentences for the reader: "a fleet is running; stop it before…".
    const message = String((error as { stderr?: string; message?: string }).stderr || (error as Error).message)
    const said = /Error: ([^\n]+)/.exec(message)?.[1] ?? "The run did not start."
    return NextResponse.json({ error: said }, { status: 409, headers: PRIVATE })
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400, headers: PRIVATE })
}
