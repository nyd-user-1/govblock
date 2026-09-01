// Which Claude this account can actually reach on Bedrock.
//
// Two lists that disagree: `bedrock:ListFoundationModels` advertises the whole
// Anthropic catalogue including the Claude 5 family, and
// `bedrock:GetFoundationModelAvailability` reports opus-5 as AUTHORIZED /
// AVAILABLE. Neither is true here — a Converse call to any of them comes back
// `AccessDeniedException: ... is not available for this account`. The only
// honest probe is an invoke. Measured 2026-09-01 in us-east-1 for account
// 638175140432; the ones below answered, everything from Opus 4.7 upward did
// not. Re-probe with `scripts/agents/probe-models.sh` before changing these.
//
// Every entitled model here is INFERENCE_PROFILE-only, so the id is always the
// `us.` cross-region profile, never the bare `anthropic.` foundation model.

export type ModelTier = "reasoning" | "routing"

export type ModelSpec = {
  /** The cross-region inference profile id passed to Converse. */
  id: string
  label: string
  /** Bedrock us-east-1 on-demand list price, USD per million tokens. */
  usdPerMTokIn: number
  usdPerMTokOut: number
}

export const MODELS: Record<ModelTier, ModelSpec> = {
  // The strongest Claude this account can invoke. The specialists answer on it.
  reasoning: {
    id: "us.anthropic.claude-opus-4-6-v1",
    label: "Claude Opus 4.6",
    usdPerMTokIn: 5,
    usdPerMTokOut: 25,
  },
  // The cheapest tier that does tool use competently, which is all the
  // Tracker's plan/route/observe loop needs. 44b's two AgentCore agents run on
  // this same id for the same reason.
  routing: {
    id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5",
    usdPerMTokIn: 1,
    usdPerMTokOut: 5,
  },
}

export type Usage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens?: number
}

/** What one exchange cost, in dollars, at the list prices above. */
export function costOf(tier: ModelTier, usage: Usage) {
  const model = MODELS[tier]
  // Cache reads bill at a tenth of the input rate on Bedrock; they arrive in
  // `cacheReadInputTokens` and are *not* included in `inputTokens`.
  const cached = usage.cacheReadInputTokens ?? 0
  return (
    (usage.inputTokens * model.usdPerMTokIn +
      cached * model.usdPerMTokIn * 0.1 +
      usage.outputTokens * model.usdPerMTokOut) /
    1_000_000
  )
}

export const MODEL_ARNS = Object.values(MODELS).map((m) => m.id)
