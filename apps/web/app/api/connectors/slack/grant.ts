import "server-only"

import {
  BedrockAgentCoreClient,
  GetResourceOauth2TokenCommand,
  GetWorkloadAccessTokenForUserIdCommand,
} from "@aws-sdk/client-bedrock-agentcore"

// Slack as a **user** connector: an OAuth grant to the reader's own workspace,
// held in AgentCore Identity's token vault rather than by us.
//
// ── Why this is the bot token and not the reader's own ────────────────────────
//
// Slack v2 returns the bot token as the top-level `access_token` and the USER
// token nested at `authed_user.access_token`, with any incoming webhook beside
// it at `incoming_webhook.url`. The vault reads the standard top-level field and
// the control-plane API has **no response-mapping surface at all** — no JSON
// path, no claim map, no token-field override; the whole shape list was searched
// for one. So the user token and the webhook are lost in precisely the same way,
// which is lane X's Discord finding generalising: *anything riding beside the
// token does not survive the vault.*
//
// Measured, in the order that matters, because stopping early would have given
// the right answer for the wrong reason:
//   1. the native SlackOauth2 vendor emits `scope=` and never `user_scope=`, so
//      a user token is not merely awkward — it is never asked for; but
//   2. `user_scope` CAN be smuggled in through a CustomOauth2 provider whose
//      `authorizationEndpoint` carries its own query string (tested: Slack saw
//      both). The authorize leg is NOT the wall.
//   3. The token leg is, and it has no door.
//
// The consequence the surface must carry: a message posts **as govblock**, not
// as the reader. It is still their grant — nobody else can see it and it works
// only while they are asking — but their name is not on it.
//
// Untested and not implied otherwise: a real consent needs a workspace, so (3)
// is structural rather than observed end to end. If a consent ever yields an
// `xoxp-` token here, this comment is wrong and the shape changes.

const REGION = process.env.AWS_REGION || "us-east-1"
const WORKLOAD = process.env.AGENTCORE_WORKLOAD || "govblock"
const PROVIDER = process.env.SLACK_PROVIDER || "govblock-slack"

/**
 * The scope set, in one place so a ruling against it is a one-line change.
 *
 * `chat:write.public` is not padding. Without it a bot may post only to
 * channels it has been invited to, which puts an invite step between the
 * reader's consent and anything working — they would connect successfully and
 * then watch the first post fail. `channels:read` is what makes a channel
 * picker possible at all.
 */
export const SLACK_SCOPES = ["chat:write", "chat:write.public", "channels:read"] as const

/**
 * Whether Brendan's redirect URL has been registered on the Slack app.
 *
 * **This is declared, not detected, and that is a finding rather than laziness.**
 * The same probe that proved Google's redirect URI was registered — follow the
 * authorize URL and read what the provider says — does not work on Slack:
 * Google rejects an unregistered `redirect_uri` server-side with a plain
 * `redirect_uri_mismatch`, whereas Slack answers 200 with a 4.4 KB JavaScript
 * shell whether the URL is registered or not. So there is nothing to read.
 *
 * It flips to `true` when a real consent completes, and until then the surface
 * says the paste is outstanding rather than offering a button that would strand
 * the reader on a Slack error page.
 *
 * The URL to paste, from the provider's own creation response:
 * https://bedrock-agentcore.us-east-1.amazonaws.com/identities/oauth2/callback/c4f72085-8d2b-46ef-aa26-2ebf562b6551
 */
export const SLACK_REDIRECT_REGISTERED = false

let client: BedrockAgentCoreClient | null = null
function agentcore() {
  if (!client) client = new BedrockAgentCoreClient({ region: REGION })
  return client
}

export type SlackGrant =
  /** The reader has consented; here is a bot token for their workspace. */
  | { kind: "token"; accessToken: string }
  /** They have not; send the browser here, and keep the session for next time. */
  | { kind: "authorize"; url: string; sessionUri?: string; sessionStatus?: string }
  /** A session was carried back unfinished. A third state, not a fault. */
  | { kind: "pending"; sessionStatus?: string }

/**
 * Ask the vault for this reader's Slack token.
 *
 * `sessionUri` is optional in the signature and mandatory in practice: the 3LO
 * flow is session-scoped, and a call that omits it opens a NEW session instead
 * of reporting on the one the reader just walked. That cost lane X two nights on
 * the Google path — same vault, same trap, so it is honoured here from the
 * start rather than rediscovered.
 *
 * This duplicates the client and the workload-token mint from
 * `lib/agents/connections/google.ts` **by fence, not by preference** — that file
 * belongs to lane X and is under active edit. The obvious follow-up, once the
 * fence lifts, is one `connections/vault.ts` that both providers call; nothing
 * here is shaped to resist that.
 */
export async function slackGrantFor(
  userId: string,
  returnUrl: string,
  sessionUri?: string
): Promise<SlackGrant> {
  const minted = await agentcore().send(
    new GetWorkloadAccessTokenForUserIdCommand({ workloadName: WORKLOAD, userId })
  )
  if (!minted.workloadAccessToken) throw new Error("no workload access token")

  const out = await agentcore().send(
    new GetResourceOauth2TokenCommand({
      workloadIdentityToken: minted.workloadAccessToken,
      resourceCredentialProviderName: PROVIDER,
      scopes: [...SLACK_SCOPES],
      oauth2Flow: "USER_FEDERATION",
      resourceOauth2ReturnUrl: returnUrl,
      ...(sessionUri ? { sessionUri } : {}),
    })
  )
  if (out.accessToken) return { kind: "token", accessToken: out.accessToken }
  if (out.authorizationUrl)
    return {
      kind: "authorize",
      url: out.authorizationUrl,
      sessionUri: out.sessionUri,
      sessionStatus: out.sessionStatus,
    }
  if (out.sessionStatus) return { kind: "pending", sessionStatus: out.sessionStatus }
  throw new Error("the vault returned neither a token nor an authorization url")
}
