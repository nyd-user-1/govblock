import { NextResponse } from "next/server"

import { toMessages, type ChatTurn, type StreamEvent } from "@/lib/agents/bedrock"
import { runAgent } from "@/lib/agents/loop"
import { MODELS } from "@/lib/agents/models"
import { agent } from "@/lib/agents/registry"

// The one route behind every agent on /agents. A specialist answering a
// question and the Tracker carrying out a watch are the same loop with
// different tools, so they are the same route and the same client reader —
// which is why a chat can show tool calls without a second protocol.
//
// Amplify WEB_COMPUTE fronts SSR with CloudFront. Streaming survives that only
// if nothing downstream buffers or transforms the body, hence no-transform,
// no-store and X-Accel-Buffering: no. The `open` event is written before
// Bedrock is called, so time-to-first-byte is measurable apart from
// time-to-first-token.

export const dynamic = "force-dynamic"
export const maxDuration = 300

const encoder = new TextEncoder()

// Two framings of the same events. Newline-delimited JSON is the default and
// what the panel reads; Server-Sent Events is offered because some proxies
// treat text/event-stream as a special case and decline to buffer it, and
// measuring that on this deployment is the only way to know whether Amplify
// does. Ask for it with `Accept: text/event-stream`.
function framer(sse: boolean) {
  return (event: StreamEvent) =>
    encoder.encode(sse ? `data: ${JSON.stringify(event)}\n\n` : JSON.stringify(event) + "\n")
}

export async function POST(request: Request) {
  const sse = (request.headers.get("accept") ?? "").includes("text/event-stream")
  const line = framer(sse)

  let body: { agent?: string; turns?: ChatTurn[]; jurisdiction?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 })
  }

  const definition = agent(String(body.agent ?? ""))
  if (!definition) return NextResponse.json({ error: "unknown agent" }, { status: 404 })

  const turns = (body.turns ?? []).filter((turn) => turn && typeof turn.text === "string")
  if (!turns.length) return NextResponse.json({ error: "no turns" }, { status: 400 })
  if (turns.at(-1)?.role !== "user")
    return NextResponse.json({ error: "the last turn must be the user's" }, { status: 400 })

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
        const run = runAgent({ definition, turns: toMessages(turns), systemSuffix })
        let next = await run.next()
        while (!next.done) {
          controller.enqueue(line(next.value))
          next = await run.next()
        }
        const result = next.value
        controller.enqueue(
          line({
            t: "done",
            stopReason: `${result.rounds} round${result.rounds === 1 ? "" : "s"}, ${result.toolCalls} tool calls`,
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
      "Content-Type": sse
        ? "text/event-stream; charset=utf-8"
        : "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
