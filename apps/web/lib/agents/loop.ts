import "server-only"

import type { Message } from "@aws-sdk/client-bedrock-runtime"

import { converseStream, type StreamEvent } from "@/lib/agents/bedrock"
import type { AgentDefinition } from "@/lib/agents/registry"
import { runTool } from "@/lib/agents/run-tools"
import { toolSpec, type ToolName } from "@/lib/agents/tools"

// The agent loop, in one function, in the repo.
//
// Converse hands back `stopReason: "tool_use"` with the calls it wants; we run
// them, append the results as a user turn, and go round again. That is the whole
// mechanism — no framework, no runtime to deploy, no second place for the tool
// definitions to live. AgentCore Runtime would host this same loop for us; §3 of
// the lane prompt records why it is not worth a container for four agents whose
// tools are HTTP GETs against a route in this same deployment.
//
// Every round yields its events as they happen, so the browser watches the model
// decide, call, and read — the multi-step is observable, not asserted.

const MAX_ROUNDS = 10

export type LoopResult = {
  rounds: number
  usd: number
  ms: number
  inputTokens: number
  outputTokens: number
  toolCalls: number
}

export async function* runAgent({
  definition,
  turns,
  systemSuffix,
}: {
  definition: AgentDefinition
  turns: Message[]
  systemSuffix?: string
}): AsyncGenerator<StreamEvent, LoopResult, void> {
  const tools = definition.tools.map(toolSpec)
  const messages: Message[] = [...turns]
  const started = Date.now()

  let usd = 0
  let inputTokens = 0
  let outputTokens = 0
  let toolCalls = 0
  let round = 0

  while (round < MAX_ROUNDS) {
    round += 1
    const stream = converseStream({
      tier: definition.tier,
      system: systemSuffix ? `${definition.system}\n\n${systemSuffix}` : definition.system,
      messages,
      tools,
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

    usd += result.usd
    inputTokens += result.usage.inputTokens
    outputTokens += result.usage.outputTokens
    messages.push(result.message)

    const calls = (result.message.content ?? []).flatMap((block) =>
      block.toolUse ? [block.toolUse] : []
    )

    if (result.stopReason !== "tool_use" || !calls.length) break

    // Parallel: Converse may ask for several tools in one turn, and every
    // result must come back in a single user message or the model learns to
    // stop asking for more than one at a time.
    const outcomes = await Promise.all(
      calls.map(async (call) => {
        const outcome = await runTool(
          call.name as ToolName,
          (call.input ?? {}) as Record<string, unknown>
        )
        return { call, outcome }
      })
    )

    for (const { call, outcome } of outcomes) {
      toolCalls += 1
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
  }

  if (round >= MAX_ROUNDS) {
    yield {
      t: "error",
      message: `Stopped after ${MAX_ROUNDS} rounds — the run did not reach an answer.`,
    }
  }

  return { rounds: round, usd, ms: Date.now() - started, inputTokens, outputTokens, toolCalls }
}
