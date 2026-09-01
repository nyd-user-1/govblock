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
  toolCalls: number
}

export async function* runStep({
  definition,
  messages: incoming,
  systemSuffix,
}: {
  definition: AgentDefinition
  messages: Message[]
  systemSuffix?: string
}): AsyncGenerator<StreamEvent, StepResult, void> {
  const started = Date.now()
  const messages: Message[] = [...incoming]

  const stream = converseStream({
    tier: definition.tier,
    system: systemSuffix ? `${definition.system}\n\n${systemSuffix}` : definition.system,
    messages,
    tools: definition.tools.map(toolSpec),
    // The Tracker composes a digest over several bills in one turn; the
    // specialists answer in prose. Both fit inside this.
    maxTokens: 8192,
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
      toolCalls: 0,
    }
  }

  // Parallel: Converse may ask for several tools at once, and every result must
  // come back in a single user message — splitting them teaches the model to
  // stop asking for more than one at a time.
  const outcomes = await Promise.all(
    calls.map(async (call) => ({
      call,
      outcome: await runTool(
        call.name as ToolName,
        (call.input ?? {}) as Record<string, unknown>
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
        content: [{ text: JSON.stringify(outcome.payload) }],
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
    toolCalls: outcomes.length,
  }
}
