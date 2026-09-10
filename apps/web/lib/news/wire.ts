import "server-only"

import { converseStream, toMessages } from "@/lib/agents/bedrock"
import { MODELS } from "@/lib/agents/models"
import { stateName } from "@/lib/filters"
import { getStories, saveBrief, type NewsBrief } from "@/lib/policy/news"

// A wire brief: what the press filed on a desk, in one model call.
//
// Not the briefing. The Reporter's briefing reads the whole record through
// its tools — bills, actions, roll calls, hearings, committees, members — and
// costs about half a dollar and a minute a desk. This costs about two cents
// and a few seconds, because it reads only the stories already crawled into
// news_stories and calls the model once, with no tools at all.
//
// Its job is that a desk is never bare (Brendan, 2026-09-10): every
// jurisdiction has something to read before anyone has paid for the real one.
// It is filed under author "wire" so the page can say so, and a Reporter
// briefing filed the same day supersedes it.

const WINDOW_DAYS = 7
const MAX_STORIES = 30

const clip = (text: string | null, n: number) =>
  (text ?? "").replace(/\s+/g, " ").trim().slice(0, n)

const SYSTEM = `You write a short wire summary of the press on one jurisdiction's
government. You are not writing the full briefing — you have only the stories
below, not the legislative record — so you cover what the press covered and you
do not reach past it.

Write, in order:
1. One sentence of lede: the week on this desk in a breath. No date, no
   greeting, no preamble, no heading, no horizontal rule. The first word a
   reader sees is the first word of the lede.
2. Three to six bullets, each beginning "• ", each one story or one thread,
   each ending in its citation as [n] — the number of the story it rests on. A
   bullet may cite two; it may not cite none.
3. Nothing after the bullets.

Attribute every claim to the outlet that made it — "VTDigger reports", "per
Capitol News Illinois". Never invent a bill number, a dollar figure or a vote
count that no story carries. Where the press is thin or off the desk's
business, say so in the lede and write fewer bullets rather than fill.`

export async function generateWireBrief(
  state: string
): Promise<NewsBrief | null> {
  const code = state.toUpperCase()
  const since = Date.now() - WINDOW_DAYS * 864e5
  const stories = (await getStories(code, { limit: 120 }))
    .filter(
      (s) => !s.published_at || new Date(s.published_at).getTime() >= since
    )
    .slice(0, MAX_STORIES)
  if (stories.length < 3) return null

  const desk = stateName(code)
  const list = stories
    .map(
      (s, i) =>
        `[${i + 1}] ${s.title}\n    ${s.source_name ?? "source"}${s.published_at ? ` · ${s.published_at.slice(0, 10)}` : ""}\n    ${clip(s.description ?? s.content, 500)}`
    )
    .join("\n\n")

  const prompt = `Today is ${new Date().toISOString().slice(0, 10)}. The desk is ${desk}.

Here is the press on ${desk === "Congress" ? "Congress" : `${desk}'s legislature and governor`} this week, numbered:

${list}

Write the wire summary for this desk from these stories and nothing else.`

  const stream = converseStream({
    tier: "grounded",
    system: SYSTEM,
    messages: toMessages([{ role: "user", text: prompt }]),
    maxTokens: 900,
    temperature: 0.2,
  })
  let text = ""
  let result: { usd?: number } = {}
  for (;;) {
    const next = await stream.next()
    if (next.done) {
      result = next.value
      break
    }
    if (next.value.t === "text") text += next.value.v
  }
  const content = text.trim()
  if (content.length < 40) return null

  // [n] in the text is stories[n-1], and each opens on its page here.
  const citations = stories.map((s) => ({
    title: s.title,
    url: `/news/${code.toLowerCase()}/${s.id}`,
  }))

  return saveBrief({
    scope: code,
    author: "wire",
    title: null,
    content,
    grounding: [{ field: "content", confidence: "medium", citations }],
    results: citations,
    model: MODELS.grounded.label,
    usd: result.usd ?? null,
  })
}
