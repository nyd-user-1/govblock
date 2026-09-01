import { NextResponse } from "next/server"

import type { Message } from "@aws-sdk/client-bedrock-runtime"

import { toMessages, type ChatTurn, type StreamEvent } from "@/lib/agents/bedrock"
import { runStep } from "@/lib/agents/loop"
import { MODELS } from "@/lib/agents/models"
import { agent, maxRounds } from "@/lib/agents/registry"
import { liveTools } from "@/lib/agents/connections"

// The one route behind every agent on /agents. A specialist answering a
// question and the Tracker carrying out a watch are the same loop with
// different tools, so they are the same route and the same client reader —
// which is why a chat can show tool calls without a second protocol.
//
// **Contract.** POST JSON, get newline-delimited JSON back, one event per line:
//
//   request   { agent: slug, jurisdiction?: "NY",
//               turns:  [{ role: "user" | "assistant", text }]   // first call
//               state?: { messages: Message[] } }                // every call after
//
//   events    { t: "open",  model, label }
//             { t: "text",  v }                       // a fragment of the answer
//             { t: "tool",  id, name, input }         // a call the model made
//             { t: "tool_result", id, name, ok, summary, ms }
//             { t: "state", messages, done }          // send `messages` back if !done
//             { t: "done",  stopReason, usage, usd, ms }   // usage carries
//                     inputTokens, outputTokens, cacheReadInputTokens and
//                     cacheWriteInputTokens — the three input counts are
//                     disjoint, so add them for the total read
//             { t: "error", message }
//
// One request is one round of the loop, not the whole run. Amplify WEB_COMPUTE
// buffers a response body — measured on this deployment, as ndjson and as SSE,
// 4,712 characters over 418 events all arriving in the same instant at 23.27 s —
// so a server-side loop would deliver a finished transcript after a silent
// minute. A round per request is what makes the steps arrive as they happen.
// Converse is stateless and the history is resent every round regardless, so
// this costs HTTP round trips, not tokens.

export const dynamic = "force-dynamic"
// Amplify WEB_COMPUTE cuts a response off at 30 seconds and does not honour
// maxDuration — measured on the deploy, twice, at 30.5 s and 30.8 s, returning
// 500 with an empty body. The value below is what Next would use elsewhere; on
// this host the real ceiling is the loop's job to stay under, which is what the
// compaction in lib/agents/loop.ts is for.
export const maxDuration = 300

// The conversation comes back through the browser between rounds, so it is
// bounded on the way in. All four limits are far above any real run: the
// Tracker's canonical watch is four rounds, a dozen messages and a few hundred
// kilobytes of bill records.
const MAX_MESSAGES = 60
const MAX_STATE_CHARS = 600_000
// The client drives the rounds, so the server counts them too — at whichever
// ceiling the agent itself declares (a chat's twelve; the Researcher's
// twenty-four, because a report is a dozen reads and a long write). A runaway
// or hostile client would otherwise be an open-ended Bedrock bill rather than a
// broken page.
// Best-effort, and honestly so: this Map lives in one warm compute instance, so
// a burst spread across instances gets more than this. It is a brake on a stuck
// client and a crude spend ceiling, not an access control.
const RATE_PER_MINUTE = 20
const seen = new Map<string, number[]>()

function rateLimited(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? ""
  const ip = forwarded.split(",")[0]?.trim() || "unknown"
  const now = Date.now()
  const recent = (seen.get(ip) ?? []).filter((at) => now - at < 60_000)
  recent.push(now)
  seen.set(ip, recent)
  // Keep the map from growing without bound across a long-lived instance.
  if (seen.size > 5_000) {
    for (const [key, times] of seen) if (!times.some((at) => now - at < 60_000)) seen.delete(key)
  }
  return recent.length > RATE_PER_MINUTE
}

const encoder = new TextEncoder()

function line(event: StreamEvent | { t: "state"; messages: Message[]; done: boolean }) {
  return encoder.encode(JSON.stringify(event) + "\n")
}

export async function POST(request: Request) {
  let body: {
    agent?: string
    turns?: ChatTurn[]
    jurisdiction?: string
    state?: { messages?: Message[] }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 })
  }

  const definition = agent(String(body.agent ?? ""))
  if (!definition) return NextResponse.json({ error: "unknown agent" }, { status: 404 })

  if (rateLimited(request))
    return NextResponse.json({ error: "too many rounds a minute" }, { status: 429 })

  let messages: Message[]
  if (body.state?.messages) {
    messages = body.state.messages
    if (!Array.isArray(messages) || !messages.length)
      return NextResponse.json({ error: "state.messages must be a non-empty array" }, { status: 400 })
    if (messages.length > MAX_MESSAGES)
      return NextResponse.json({ error: `at most ${MAX_MESSAGES} messages` }, { status: 413 })
    if (JSON.stringify(messages).length > MAX_STATE_CHARS)
      return NextResponse.json({ error: "conversation too large to continue" }, { status: 413 })
    if (messages.some((m) => m.role !== "user" && m.role !== "assistant"))
      return NextResponse.json({ error: "messages may only be user or assistant" }, { status: 400 })
    // One assistant turn is one round already run. The client is told the
    // agent's ceiling; this is the same one, enforced where it cannot be
    // edited.
    const ceiling = maxRounds(definition)
    if (messages.filter((m) => m.role === "assistant").length >= ceiling)
      return NextResponse.json(
        { error: `this conversation has already run ${ceiling} rounds` },
        { status: 409 }
      )
  } else {
    const turns = (body.turns ?? []).filter((turn) => turn && typeof turn.text === "string")
    if (!turns.length) return NextResponse.json({ error: "no turns" }, { status: 400 })
    if (turns.at(-1)?.role !== "user")
      return NextResponse.json({ error: "the last turn must be the user's" }, { status: 400 })
    messages = toMessages(turns)
  }

  // The reader's scope, if the surface knows it. The agents are told rather
  // than left to guess, which is what stops a Texas reader being answered with
  // Congress's rows.
  const jurisdiction = (body.jurisdiction ?? "").toUpperCase().slice(0, 2)
  const notes: string[] = []
  if (/^[A-Z]{2}$/.test(jurisdiction))
    notes.push(
      `The reader is currently scoped to jurisdiction ${jurisdiction}. Use it when the question does not name one.`
    )

  // Connections are resolved per request, not baked into the registry: a tool
  // that would fail because a credential is missing is simply not offered, and
  // the agent is told which services it does and does not have so it can say so
  // rather than discover it by calling.
  const live = await liveTools(definition.connections)
  if (definition.connections?.length) {
    if (live.connected.length) notes.push(`Connected right now: ${live.connected.join(", ")}.`)
    if (live.missing.length)
      notes.push(
        `Not connected: ${live.missing.join(", ")} — you have no tool for ${live.missing.length === 1 ? "it" : "them"}, so do not claim to have posted there.`
      )
  }
  const systemSuffix = notes.length ? notes.join(" ") : undefined

  const model = MODELS[definition.tier]

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(line({ t: "open", model: model.id, label: model.label }))
      try {
        const step = runStep({ definition, messages, systemSuffix, extraTools: live.tools })
        let next = await step.next()
        while (!next.done) {
          controller.enqueue(line(next.value))
          next = await step.next()
        }
        const result = next.value
        controller.enqueue(line({ t: "state", messages: result.messages, done: result.done }))
        controller.enqueue(
          line({
            t: "done",
            stopReason: result.done ? "answered" : `${result.toolCalls} tool calls`,
            usage: {
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              cacheReadInputTokens: result.cacheReadInputTokens,
              cacheWriteInputTokens: result.cacheWriteInputTokens,
            },
            usd: result.usd,
            ms: result.ms,
          })
        )
      } catch (error) {
        // By the time Bedrock throws, the response has already begun — so a
        // failure is reported in the transcript, not as a status code.
        controller.enqueue(
          line({ t: "error", message: error instanceof Error ? error.message : String(error) })
        )
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
