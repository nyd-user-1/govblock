import { NextResponse } from "next/server"

import { saveBrief } from "@/lib/policy/news"

// Where an Exa monitor delivers a run (2026-09-09). Point the monitor's
// webhook at /api/news/monitor and each completed run lands in news_briefs
// the moment it finishes; until then scripts/news/briefs.mjs pulls the same
// rows. The payload is the monitor, the run, and the run's output.
//
// EXA_WEBHOOK_SECRET, when set, must match the `x-webhook-secret` header —
// a shared secret rather than a signature, which is what the monitor's
// dashboard hands out. Unset, the route accepts what it is sent and logs it.

export const dynamic = "force-dynamic"

type Payload = {
  monitor?: {
    id?: string
    name?: string
    metadata?: Record<string, unknown> | null
  }
  run?: {
    id?: string
    status?: string
    completedAt?: string
    output?: { results?: unknown[]; content?: string; grounding?: unknown[] }
  }
  output?: { results?: unknown[]; content?: string; grounding?: unknown[] }
}

export async function POST(request: Request) {
  const secret = process.env.EXA_WEBHOOK_SECRET
  if (secret && request.headers.get("x-webhook-secret") !== secret)
    return NextResponse.json({ error: "bad secret" }, { status: 401 })

  const payload = (await request.json().catch(() => null)) as Payload | null
  const run = payload?.run
  const output = run?.output ?? payload?.output
  if (!run?.id || !output?.content)
    return NextResponse.json(
      { ok: false, reason: "no completed run in the payload" },
      { status: 202 }
    )

  const scope =
    String(payload?.monitor?.metadata?.scope ?? "states").toUpperCase() ===
    "STATES"
      ? "states"
      : String(payload?.monitor?.metadata?.scope).toUpperCase()
  const brief = await saveBrief({
    scope,
    author: "exa",
    run_id: run.id,
    monitor_id: payload?.monitor?.id ?? null,
    title: payload?.monitor?.name ?? null,
    content: output.content,
    grounding: (output.grounding as never) ?? [],
    results: (output.results ?? []).map((r) => {
      const x = r as Record<string, unknown>
      return {
        title: x.title,
        url: x.url,
        publishedDate: x.publishedDate,
        author: x.author ?? null,
        image: x.image ?? null,
      }
    }),
  })
  return NextResponse.json({ ok: true, id: brief?.id ?? null })
}
