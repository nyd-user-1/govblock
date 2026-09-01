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

export type ModelTier = "reasoning" | "grounded" | "routing"

export type ModelSpec = {
  /** The cross-region inference profile id passed to Converse. */
  id: string
  label: string
  /** Bedrock us-east-1 on-demand list price, USD per million tokens. */
  usdPerMTokIn: number
  usdPerMTokOut: number
  /**
   * Output tokens a second, measured on this account in us-east-1 on
   * 2026-09-01 (1,200 tokens, single call, no tools). It is here because the
   * host is the constraint: Amplify discards a response after thirty seconds,
   * so how fast a model writes decides how much it may write in one round.
   */
  tokensPerSecond: number
}

export const MODELS: Record<ModelTier, ModelSpec> = {
  // The strongest Claude this account can invoke. Kept for the one agent that
  // reasons across several records at once rather than reading one.
  reasoning: {
    id: "us.anthropic.claude-opus-4-6-v1",
    label: "Claude Opus 4.6",
    usdPerMTokIn: 5,
    usdPerMTokOut: 25,
    tokensPerSecond: 51,
  },
  // Measured before it was chosen: on the Bill Reader's own prompt over a whole
  // bill record (1,365 input tokens), Sonnet 4.6 and Opus 4.6 produced briefs
  // that were indistinguishable — same status, same three sponsors, same three
  // history moves, same companion bill, both correctly refusing to characterise
  // the text they had not read. Sonnet cost 0.96¢ against Opus's 1.83¢ and
  // answered in 7.9 s against 10.7 s. Reading one record and explaining it does
  // not need the larger model, so it does not get it.
  grounded: {
    id: "us.anthropic.claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    usdPerMTokIn: 3,
    usdPerMTokOut: 15,
    tokensPerSecond: 46,
  },
  // The cheapest tier that does tool use competently, which is all the
  // Tracker's plan/route/observe loop needs. 44b's two AgentCore agents run on
  // this same id for the same reason.
  routing: {
    id: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    label: "Claude Haiku 4.5",
    usdPerMTokIn: 1,
    usdPerMTokOut: 5,
    tokensPerSecond: 102,
  },
}

export type Usage = {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
}

/** What one exchange cost, in dollars, at the list prices above. */
export function costOf(tier: ModelTier, usage: Usage) {
  const model = MODELS[tier]
  // Cached tokens are reported separately and are not included in
  // `inputTokens`: a read bills at a tenth of the input rate, a write at
  // 1.25× — which is why marking a prefix that is never read again costs
  // slightly more than not caching at all.
  const read = usage.cacheReadInputTokens ?? 0
  const written = usage.cacheWriteInputTokens ?? 0
  return (
    (usage.inputTokens * model.usdPerMTokIn +
      read * model.usdPerMTokIn * 0.1 +
      written * model.usdPerMTokIn * 1.25 +
      usage.outputTokens * model.usdPerMTokOut) /
    1_000_000
  )
}

export const MODEL_ARNS = Object.values(MODELS).map((m) => m.id)

/**
 * How much a model may write in one round on this host.
 *
 * Amplify WEB_COMPUTE discards a response after thirty seconds — measured, and
 * silently, with a 500 and an empty body. Writing is the slow part, so the
 * ceiling is a model's measured speed times the seconds we are willing to spend
 * writing, leaving the rest for reading the conversation and deciding what to
 * do. Hitting it is not a failure: the loop asks the model to continue in the
 * next round.
 */
const SECONDS_SPENT_WRITING = 17

export function roundTokens(tier: ModelTier) {
  return Math.floor(MODELS[tier].tokensPerSecond * SECONDS_SPENT_WRITING)
}
