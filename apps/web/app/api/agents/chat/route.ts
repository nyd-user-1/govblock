import { NextResponse } from "next/server"

import type { Message } from "@aws-sdk/client-bedrock-runtime"

import { toMessages, type ChatTurn, type StreamEvent } from "@/lib/agents/bedrock"
import { runStep } from "@/lib/agents/loop"
import { MODELS } from "@/lib/agents/models"
import { agent } from "@/lib/agents/registry"

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
//             { t: "done",  stopReason, usage, usd, ms }
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
export const maxDuration = 300

// The conversation comes back through the browser between rounds, so it is
// bounded on the way in. Both limits are far above any real run: the Tracker's
// longest is about a dozen messages and a few hundred kilobytes of bill records.
const MAX_MESSAGES = 60
const MAX_STATE_CHARS = 600_000

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
  const systemSuffix = /^[A-Z]{2}$/.test(jurisdiction)
    ? `The reader is currently scoped to jurisdiction ${jurisdiction}. Use it when the question does not name one.`
    : undefined

  const model = MODELS[definition.tier]

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(line({ t: "open", model: model.id, label: model.label }))
      try {
        const step = runStep({ definition, messages, systemSuffix })
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
            usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
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
