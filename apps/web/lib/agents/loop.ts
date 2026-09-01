import "server-only"

import type { Message } from "@aws-sdk/client-bedrock-runtime"

import { converseStream, type StreamEvent } from "@/lib/agents/bedrock"
import type { AgentDefinition } from "@/lib/agents/registry"
import { runTool } from "@/lib/agents/run-tools"
import { toolSpec, type ToolName } from "@/lib/agents/tools"

// One round of the agent loop, in the repo, run per HTTP request.
//
// Converse hands back `stopReason: "tool_use"` with the calls it wants; we run
// them and append the results as a user turn. That is the whole mechanism — no
// framework, no runtime to deploy, no second place for the tool definitions to
// live. AgentCore Runtime would host this same loop for us; §3 of the lane
// prompt records why four agents whose tools are HTTP GETs against a route in
// this same deployment do not want a container for it.
//
// It is one round rather than the whole loop because Amplify WEB_COMPUTE
// buffers a response body — measured, both as ndjson and as SSE — so a
// server-side loop would deliver a finished transcript after a silent minute.
// A round per request is what makes the Tracker's steps actually arrive as they
// happen: the browser gets the search, renders it, then asks for the next
// round. The conversation is stateless either way (Converse is resent in full
// every round), so this costs round trips, not tokens.

// Amplify WEB_COMPUTE cuts a response off at **30 seconds** — measured twice on
// the deploy, 30.5 s and 30.8 s, returning 500 with an empty body; `maxDuration`
// is not honoured. A round's latency here is driven by how much conversation the
// model has to read before deciding what to do next, so the conversation is
// bounded in two places rather than allowed to grow until a round runs long.
//
// One: a single tool result is capped. A whole bill record is tens of kilobytes
// and the model needs its fields, not every character of its history.
const RESULT_MAX = 8_000
// Two: older tool results are compacted. The last two rounds stay verbatim —
// that is what the model is reasoning about right now — and everything before
// them keeps a readable head and says what was cut. This is why the Researcher
// is told to write each section's notes as it gathers: its own prose survives
// compaction, and a raw record does not.
const VERBATIM_ROUNDS = 2
const COMPACTED_MAX = 700

function resultText(payload: unknown) {
  const json = JSON.stringify(payload)
  if (json.length <= RESULT_MAX) return json
  return `${json.slice(0, RESULT_MAX)}\n\n[truncated: ${json.length.toLocaleString()} characters in all. Ask for a narrower slice if you need the rest.]`
}

/** Trim what the model no longer needs to re-read, newest kept whole. */
function compact(messages: Message[]): Message[] {
  const resultTurns = messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => (message.content ?? []).some((block) => block.toolResult))
  const keepFrom = resultTurns.length - VERBATIM_ROUNDS
  const compactable = new Set(resultTurns.slice(0, Math.max(0, keepFrom)).map((t) => t.index))
  if (!compactable.size) return messages

  return messages.map((message, index) => {
    if (!compactable.has(index)) return message
    return {
      ...message,
      content: (message.content ?? []).map((block) => {
        const text = block.toolResult?.content?.[0]?.text
        if (!block.toolResult || typeof text !== "string" || text.length <= COMPACTED_MAX)
          return block
        return {
          toolResult: {
            ...block.toolResult,
            content: [
              {
                text: `${text.slice(0, COMPACTED_MAX)}\n\n[earlier read, trimmed from ${text.length.toLocaleString()} characters. Your own notes above are what carries it forward.]`,
              },
            ],
          },
        }
      }),
    }
  })
}

export type StepResult = {
  /** The whole conversation including this round, to send back next time. */
  messages: Message[]
  /** True when the model stopped wanting tools — no further round to run. */
  done: boolean
  usd: number
  ms: number
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
  toolCalls: number
}

export async function* runStep({
  definition,
  messages: incoming,
  systemSuffix,
  extraTools = [],
}: {
  definition: AgentDefinition
  messages: Message[]
  systemSuffix?: string
  /** Tools contributed by the connections that are live right now. */
  extraTools?: ToolName[]
}): AsyncGenerator<StreamEvent, StepResult, void> {
  const started = Date.now()
  const messages: Message[] = [...incoming]

  const stream = converseStream({
    tier: definition.tier,
    system: systemSuffix ? `${definition.system}\n\n${systemSuffix}` : definition.system,
    messages: compact(messages),
    tools: [...definition.tools, ...extraTools].map(toolSpec),
    // Latency on this host is dominated by tokens written, and a response that
    // takes more than thirty seconds is discarded — so the ceiling is the
    // agent's, and modest by default.
    maxTokens: definition.maxTokens ?? 4096,
  })

  let next = await stream.next()
  while (!next.done) {
    yield next.value
    next = await stream.next()
  }
  const result = next.value
  messages.push(result.message)

  const calls = (result.message.content ?? []).flatMap((block) =>
    block.toolUse ? [block.toolUse] : []
  )

  if (result.stopReason !== "tool_use" || !calls.length) {
    return {
      messages,
      done: true,
      usd: result.usd,
      ms: Date.now() - started,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      cacheReadInputTokens: result.usage.cacheReadInputTokens ?? 0,
      cacheWriteInputTokens: result.usage.cacheWriteInputTokens ?? 0,
      toolCalls: 0,
    }
  }

  // Parallel: Converse may ask for several tools at once, and every result must
  // come back in a single user message — splitting them teaches the model to
  // stop asking for more than one at a time.
  // Everything the agent has written this run, which is what deliver_report
  // sends — so the report never has to be retyped into a tool argument.
  const report = [...incoming, result.message]
    .filter((message) => message.role === "assistant")
    .flatMap((message) => (message.content ?? []).map((block) => block.text).filter(Boolean))
    .join("\n\n")

  const outcomes = await Promise.all(
    calls.map(async (call) => ({
      call,
      outcome: await runTool(
        call.name as ToolName,
        (call.input ?? {}) as Record<string, unknown>,
        { report }
      ),
    }))
  )

  for (const { call, outcome } of outcomes) {
    yield {
      t: "tool_result",
      id: call.toolUseId ?? "",
      name: call.name ?? "",
      ok: outcome.ok,
      summary: outcome.summary,
      ms: outcome.ms,
    }
  }

  messages.push({
    role: "user",
    content: outcomes.map(({ call, outcome }) => ({
      toolResult: {
        toolUseId: call.toolUseId,
        content: [{ text: resultText(outcome.payload) }],
        status: outcome.ok ? ("success" as const) : ("error" as const),
      },
    })),
  })

  return {
    messages,
    done: false,
    usd: result.usd,
    ms: Date.now() - started,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    cacheReadInputTokens: result.usage.cacheReadInputTokens ?? 0,
    cacheWriteInputTokens: result.usage.cacheWriteInputTokens ?? 0,
    toolCalls: outcomes.length,
  }
}
