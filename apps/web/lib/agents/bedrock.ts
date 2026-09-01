import "server-only"

import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type Tool,
} from "@aws-sdk/client-bedrock-runtime"

import { MODELS, costOf, type ModelTier, type Usage } from "@/lib/agents/models"

// Bedrock through the Amplify SSR compute role. Same shape as the Data API
// reader in lib/policy/db.ts: an HTTPS call signed with the hosting role, so
// there are no keys anywhere and no VPC to attach. The role is
// `govblock-amplify-compute`; the grant is the `BedrockInvoke` statement of its
// `govblock-data-access` inline policy.
//
// Converse (not InvokeModel) because it is the one API that speaks tool use,
// system prompts and usage accounting in the same vocabulary for every model —
// swapping Opus 4.6 for Haiku 4.5 is a string change, not a rewrite.

const REGION = process.env.AWS_REGION || process.env.BEDROCK_REGION || "us-east-1"

let client: BedrockRuntimeClient | null = null

function bedrock() {
  // One client per warm Lambda. Amplify's Fluid-style compute reuses the
  // instance across requests, so the signer and connection pool are reused too.
  if (!client) client = new BedrockRuntimeClient({ region: REGION })
  return client
}

export type ChatTurn = { role: "user" | "assistant"; text: string }

/** A step the browser can watch happen. The chat route serialises these as
 *  newline-delimited JSON — one line, one event, flushed as it is produced. */
export type StreamEvent =
  | { t: "open"; model: string; label: string }
  | { t: "text"; v: string }
  | { t: "reasoning"; v: string }
  | { t: "tool"; id: string; name: string; input: unknown }
  | { t: "tool_result"; id: string; name: string; ok: boolean; summary: string; ms: number }
  | { t: "step"; n: number; of: number; label: string }
  | { t: "done"; stopReason: string; usage: Usage; usd: number; ms: number }
  | { t: "error"; message: string }

export type ConverseArgs = {
  tier: ModelTier
  system: string
  messages: Message[]
  tools?: Tool[]
  maxTokens?: number
  temperature?: number
}

export type ConverseResult = {
  /** The assistant turn, ready to append to `messages` for the next round. */
  message: Message
  stopReason: string
  usage: Usage
  usd: number
  ms: number
}

/**
 * One ConverseStream round, yielding events as they arrive and returning the
 * assembled assistant message so a tool loop can continue from it.
 *
 * The generator's *return* value carries the result; callers that only want to
 * relay events can ignore it. Tool-use input arrives as partial JSON fragments
 * across many deltas, so it is buffered per content-block index and parsed once
 * at `contentBlockStop`.
 */
export async function* converseStream(
  args: ConverseArgs
): AsyncGenerator<StreamEvent, ConverseResult, void> {
  const model = MODELS[args.tier]
  const started = Date.now()

  const response = await bedrock().send(
    new ConverseStreamCommand({
      modelId: model.id,
      system: [{ text: args.system }],
      messages: args.messages,
      inferenceConfig: {
        maxTokens: args.maxTokens ?? 4096,
        temperature: args.temperature ?? 0.2,
      },
      ...(args.tools?.length ? { toolConfig: { tools: args.tools } } : {}),
    })
  )

  const texts = new Map<number, string>()
  const toolStarts = new Map<number, { toolUseId: string; name: string }>()
  const toolInputs = new Map<number, string>()
  const blocks: ContentBlock[] = []

  let stopReason = "end_turn"
  let usage: Usage = { inputTokens: 0, outputTokens: 0 }

  if (!response.stream) throw new Error("Bedrock returned no stream")

  for await (const event of response.stream) {
    if (event.contentBlockStart?.start?.toolUse) {
      const { toolUseId, name } = event.contentBlockStart.start.toolUse
      const index = event.contentBlockStart.contentBlockIndex ?? 0
      if (toolUseId && name) {
        toolStarts.set(index, { toolUseId, name })
        toolInputs.set(index, "")
      }
      continue
    }

    if (event.contentBlockDelta?.delta) {
      const index = event.contentBlockDelta.contentBlockIndex ?? 0
      const delta = event.contentBlockDelta.delta
      if (delta.text) {
        texts.set(index, (texts.get(index) ?? "") + delta.text)
        yield { t: "text", v: delta.text }
      } else if (delta.toolUse?.input !== undefined) {
        toolInputs.set(index, (toolInputs.get(index) ?? "") + delta.toolUse.input)
      } else if (delta.reasoningContent?.text) {
        yield { t: "reasoning", v: delta.reasoningContent.text }
      }
      continue
    }

    if (event.contentBlockStop) {
      const index = event.contentBlockStop.contentBlockIndex ?? 0
      const start = toolStarts.get(index)
      if (start) {
        const raw = toolInputs.get(index) ?? ""
        // Bedrock sends `""` for a no-argument tool call; `{}` is the value.
        let input: unknown = {}
        try {
          if (raw.trim()) input = JSON.parse(raw)
        } catch {
          input = { _unparsed: raw }
        }
        blocks.push({ toolUse: { toolUseId: start.toolUseId, name: start.name, input } })
        yield { t: "tool", id: start.toolUseId, name: start.name, input }
      } else {
        const text = texts.get(index)
        if (text) blocks.push({ text })
      }
      continue
    }

    if (event.messageStop?.stopReason) {
      stopReason = event.messageStop.stopReason
      continue
    }

    if (event.metadata?.usage) {
      usage = {
        inputTokens: event.metadata.usage.inputTokens ?? 0,
        outputTokens: event.metadata.usage.outputTokens ?? 0,
        cacheReadInputTokens: event.metadata.usage.cacheReadInputTokens ?? 0,
      }
      continue
    }

    const failure =
      event.internalServerException ??
      event.modelStreamErrorException ??
      event.validationException ??
      event.throttlingException ??
      event.serviceUnavailableException
    if (failure) throw new Error(failure.message ?? "Bedrock stream error")
  }

  return {
    message: { role: "assistant", content: blocks },
    stopReason,
    usage,
    usd: costOf(args.tier, usage),
    ms: Date.now() - started,
  }
}

/** The turns a browser sent, as Converse messages. */
export function toMessages(turns: ChatTurn[]): Message[] {
  return turns
    .filter((turn) => turn.text.trim())
    .map((turn) => ({ role: turn.role, content: [{ text: turn.text }] }))
}
