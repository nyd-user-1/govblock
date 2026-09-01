import "server-only"

import { DEFINITIONS, normalise, type ToolName } from "@/lib/agents/tools"
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
  if (Array.isArray(payload)) return `${payload.length} rows`
  if (payload && typeof payload === "object") {
    const parts: string[] = []
    for (const [key, value] of Object.entries(payload)) {
      if (Array.isArray(value) && value.length) parts.push(`${value.length} ${key}`)
    }
    if (parts.length) return parts.slice(0, 4).join(", ")
    return "1 record"
  }
  return payload == null ? "nothing" : "1 value"
}

export async function runTool(
  name: ToolName,
  rawInput: Record<string, unknown>
): Promise<ToolOutcome> {
  const started = Date.now()
  const definition = DEFINITIONS[name]
  const input = normalise(name, rawInput)

  if (name === "post_to_slack") {
    const result = await postToSlack({
      text: String(rawInput.text ?? ""),
      channel: rawInput.channel ? String(rawInput.channel) : undefined,
    })
    return {
      ok: result.ok,
      payload: result,
      summary: result.ok
        ? `posted to ${result.channel}`
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
    return {
      ok: true,
      payload: shaped,
      summary: count(shaped),
      ms: Date.now() - started,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, payload: { error: message }, summary: message.slice(0, 120), ms: Date.now() - started }
  }
}
