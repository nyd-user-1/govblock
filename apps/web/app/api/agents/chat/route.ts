import { NextResponse } from "next/server"

import {
  converseStream,
  toMessages,
  type ChatTurn,
  type StreamEvent,
} from "@/lib/agents/bedrock"
import { MODELS } from "@/lib/agents/models"

// The chat surface behind /agents. One POST, one newline-delimited JSON stream
// out — the same protocol the Tracker's run route uses, so a chat and an
// agentic run render through one client reader.
//
// Amplify WEB_COMPUTE fronts SSR with CloudFront. Streaming survives it only if
// nothing downstream is allowed to buffer or transform the body, hence the
// no-transform / no-store / X-Accel-Buffering headers and the first `open`
// event, which is written before Bedrock is even called so time-to-first-byte
// is measurable separately from time-to-first-token.

export const dynamic = "force-dynamic"
export const maxDuration = 120

const encoder = new TextEncoder()

function line(event: StreamEvent) {
  return encoder.encode(JSON.stringify(event) + "\n")
}

export async function POST(request: Request) {
  let body: { system?: string; turns?: ChatTurn[]; tier?: "reasoning" | "routing" }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 })
  }

  const turns = (body.turns ?? []).filter((turn) => turn && typeof turn.text === "string")
  if (!turns.length) return NextResponse.json({ error: "no turns" }, { status: 400 })
  if (turns.at(-1)?.role !== "user")
    return NextResponse.json({ error: "the last turn must be the user's" }, { status: 400 })

  const tier = body.tier === "routing" ? "routing" : "reasoning"
  const system =
    typeof body.system === "string" && body.system.trim()
      ? body.system
      : "You are an assistant on govblock, a public record of legislation across all 52 US jurisdictions."

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(line({ t: "open", model: MODELS[tier].id, label: MODELS[tier].label }))
      try {
        const rounds = converseStream({ tier, system, messages: toMessages(turns) })
        let next = await rounds.next()
        while (!next.done) {
          controller.enqueue(line(next.value))
          next = await rounds.next()
        }
        const result = next.value
        controller.enqueue(
          line({
            t: "done",
            stopReason: result.stopReason,
            usage: result.usage,
            usd: result.usd,
            ms: result.ms,
          })
        )
      } catch (error) {
        // A failed exchange is reported in the transcript rather than as a
        // 500 — by the time Bedrock throws, the response has already begun.
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
