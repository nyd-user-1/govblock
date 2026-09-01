import "server-only"

import { DEFINITIONS, normalise, type ToolName } from "@/lib/agents/tools"
import { deliver } from "@/lib/agents/connections"
import { postToDiscord } from "@/lib/agents/connections/discord"
import { postToSlack } from "@/lib/agents/connections/slack"

// Executing a tool call. Everything except the connections goes out over HTTPS
// to this same deployment's /api/policy, which is what puts the agents behind
// the CloudFront cache the pages already warm.

export type ToolOutcome = {
  ok: boolean
  /** What the model is given back. JSON for a hit, a sentence for a miss. */
  payload: unknown
  /** One line for the transcript the browser renders. */
  summary: string
  ms: number
}

function origin() {
  // Amplify sets neither a site URL nor a VERCEL_URL equivalent, so the branch
  // variable is the one honest source; the localhost fallback is for a laptop.
  return (
    process.env.AGENTS_ORIGIN ||
    process.env.SITE_ORIGIN ||
    "https://policy.nysgpt.com"
  ).replace(/\/$/, "")
}

function count(payload: unknown): string {
  if (Array.isArray(payload)) return payload.length ? `${payload.length} rows` : "nothing"
  if (payload && typeof payload === "object") {
    const entries = Object.entries(payload)
    const parts: string[] = []
    for (const [key, value] of entries) {
      if (Array.isArray(value) && value.length) parts.push(`${value.length} ${key}`)
    }
    if (parts.length) return parts.slice(0, 4).join(", ")
    // A search that matched nothing answers with the same shape as one that
    // matched everything — all the arrays are simply empty. Saying "1 record"
    // there read as a hit in the transcript.
    if (entries.length && entries.every(([, value]) => Array.isArray(value) && !value.length))
      return "nothing"
    return "1 record"
  }
  return payload == null ? "nothing" : "1 value"
}

export type ToolContext = {
  /** Everything the agent has written this run — what deliver_report sends. */
  report?: string
  /**
   * The subject the reader gave the task. It wins over the title the model
   * would have invented, so the Discord thread and the inbox thread carry the
   * same words — which is the whole point of a subject line.
   */
  title?: string
}

export async function runTool(
  name: ToolName,
  rawInput: Record<string, unknown>,
  context?: ToolContext
): Promise<ToolOutcome> {
  const started = Date.now()
  const definition = DEFINITIONS[name]
  const input = normalise(name, rawInput)

  if (name === "deliver_report") {
    const title =
      (context?.title ?? "").trim() || String(rawInput.title ?? "").trim() || "govblock report"
    const body = (context?.report ?? "").trim()
    if (!body)
      return {
        ok: false,
        payload: { error: "There is nothing written to deliver yet." },
        summary: "nothing written yet",
        ms: Date.now() - started,
      }
    const result = await deliver(`**${title}**\n\n${body}`)
    return {
      ok: result.ok,
      payload: result,
      summary: result.ok
        ? `delivered to ${result.where}${result.ref ? ` · id ${result.ref}` : ""}`
        : `not delivered — ${result.error}`,
      ms: Date.now() - started,
    }
  }

  if (name === "post_to_slack" || name === "post_to_discord") {
    // The destination is the connection's, never the model's — see the note
    // above the two posting tools in tools.ts.
    const post = name === "post_to_slack" ? postToSlack : postToDiscord
    const result = await post({ text: String(rawInput.text ?? "") })
    return {
      ok: result.ok,
      payload: result,
      // The id is the proof the post exists — "posted" on its own is the agent
      // asserting success, which is the thing this whole surface avoids.
      summary: result.ok
        ? `posted to ${result.where}${result.ref ? ` · id ${result.ref}` : ""}`
        : `not posted — ${result.error}`,
      ms: Date.now() - started,
    }
  }

  if (!definition?.request) {
    return { ok: false, payload: { error: `no such tool ${name}` }, summary: "unknown tool", ms: 0 }
  }

  const path = definition.request(input)
  const url = `${origin()}/api/policy/${path}`

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "govblock-agents/1" },
      // The route's own cache-control governs; this just declines to add a
      // second layer of Next's fetch cache on top of it.
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
    const body = await response.json().catch(() => null)

    if (!response.ok) {
      // The policy route answers 503 with a sentence when a jurisdiction does
      // not hold a dataset. That sentence is the honest answer — hand it to the
      // model rather than an HTTP status it cannot interpret.
      const message =
        (body && typeof body === "object" && "error" in body && String(body.error)) ||
        `${response.status} from /api/policy/${path.split("?")[0]}`
      return {
        ok: false,
        payload: { error: message },
        summary: message.slice(0, 120),
        ms: Date.now() - started,
      }
    }

    const shaped = definition.shape ? definition.shape(body, input) : body

    // A shape may decide that a 200 was not an answer — get_bill does, when the
    // route hands back a different bill than the number asked for. That is a
    // miss, and the transcript should say so rather than print "1 record".
    const refused =
      shaped && typeof shaped === "object" && "error" in shaped
        ? String((shaped as { error: unknown }).error)
        : null

    return {
      ok: !refused,
      payload: shaped,
      summary: refused ? refused.slice(0, 120) : count(shaped),
      ms: Date.now() - started,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, payload: { error: message }, summary: message.slice(0, 120), ms: Date.now() - started }
  }
}
