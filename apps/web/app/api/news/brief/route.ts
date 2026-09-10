import { NextResponse } from "next/server"

import { isJurisdiction } from "@/lib/filters"
import {
  getBriefs,
  getPhraseBriefs,
  getTodaysBrief,
  phraseScope,
  saveBrief,
} from "@/lib/policy/news"

// The Reporter's briefings, read and filed.
//
//   GET  /api/news/brief?state=NY                  the desk's last seven,
//                                                  and the phrases already written
//   GET  /api/news/brief?state=NY&phrase=redistricting   that phrase's last seven
//   POST /api/news/brief  {state, phrase?, content, sources}   file what it wrote
//
// The briefing itself is not written here. It is written by the Reporter,
// running the same loop every agent on /agents runs, driven from the browser
// so its reading arrives as it happens — Amplify buffers a response body, so a
// server-side run would show nothing for a minute and then everything at once
// (lib/agents/run-client.ts). This route is what the record is filed against
// when the run finishes, and what the page reads on the way in.
//
// One a day per scope: a brief already filed today is returned rather than
// replaced, so a second reader on the same desk pays nothing.

export const dynamic = "force-dynamic"

const codeOf = (value: unknown) => String(value ?? "").toUpperCase()
const phraseOf = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120)

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const state = codeOf(params.get("state"))
  const phrase = phraseOf(params.get("phrase"))
  if (!isJurisdiction(state))
    return NextResponse.json({ error: "state required" }, { status: 400 })
  const scope = phrase ? phraseScope(state, phrase) : state
  if (!scope)
    return NextResponse.json({ error: "phrase required" }, { status: 400 })
  // Without a phrase this is the desk opening: its own week, and the phrases
  // the Reporter has already been asked about, so they need not be retyped.
  const [briefs, phrases] = await Promise.all([
    getBriefs(scope, 7),
    phrase ? Promise.resolve([]) : getPhraseBriefs(state),
  ])
  return NextResponse.json(
    { state, phrase: phrase || null, briefs, phrases },
    {
      headers: {
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  )
}

type Source = { id?: string; title?: string; url?: string; domain?: string }

/**
 * The briefing, without whatever the agent said before starting it. The
 * Reporter's prompt forbids a preamble and the clients trim one, but the
 * guarantee belongs here: whatever wrote it, what gets filed is the briefing.
 * A rule near the top is the model separating its thinking from its writing;
 * a leading first-person line is it talking to itself.
 */
function briefingOnly(text: string) {
  let out = text.trim()
  const rule = out.slice(0, 600).search(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/m)
  if (rule >= 0) {
    const nl = out.indexOf("\n", rule)
    out = (nl >= 0 ? out.slice(nl + 1) : out.slice(rule + 3)).trim()
  }
  return out
    .split(/\n/)
    .filter(
      (line, i) =>
        !(
          i < 2 &&
          /^(good[.,]|okay[.,]|right[.,]|now |let me |i (now )?have|i'?ll |here is|here'?s )/i.test(
            line.trim()
          )
        )
    )
    .join("\n")
    .trim()
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    state?: string
    phrase?: string
    content?: string
    sources?: Source[]
    model?: string
    usd?: number
  }
  const state = codeOf(body.state)
  const phrase = phraseOf(body.phrase)
  if (!isJurisdiction(state))
    return NextResponse.json({ error: "state required" }, { status: 400 })
  const scope = phrase ? phraseScope(state, phrase) : state
  if (!scope)
    return NextResponse.json({ error: "phrase required" }, { status: 400 })

  const content = briefingOnly(String(body.content ?? ""))
  if (content.length < 40)
    return NextResponse.json({ error: "nothing to file" }, { status: 400 })

  // The briefing already filed today wins, so a second reader's deployment
  // costs nothing — except when what is on file is the cheap wire summary,
  // which the Reporter's real briefing is meant to supersede.
  const existing = await getTodaysBrief(scope)
  if (existing && existing.author !== "wire")
    return NextResponse.json({ state, phrase: phrase || null, brief: existing, fresh: false })

  const citations = (Array.isArray(body.sources) ? body.sources : [])
    .filter((s): s is Source & { url: string } => typeof s?.url === "string")
    .slice(0, 60)
    .map((s) => ({ title: String(s.title ?? s.url).slice(0, 300), url: s.url }))

  try {
    const brief = await saveBrief({
      scope,
      author: "reporter",
      title: phrase || null,
      content: content.slice(0, 20000),
      // The sources are what the run actually opened, in the order it opened
      // them — the reader can check every line against them.
      grounding: [
        { field: "content", confidence: "high", citations },
      ],
      results: citations,
      model: body.model ?? null,
      usd: typeof body.usd === "number" ? body.usd : null,
    })
    return NextResponse.json({ state, phrase: phrase || null, brief, fresh: true })
  } catch (error) {
    console.error("reporter: brief not filed", error)
    return NextResponse.json({ error: "The briefing could not be filed." }, { status: 502 })
  }
}
