import "server-only"

import type { Connection } from "@/lib/agents/connections"
import { readSecret } from "@/lib/agents/connections/secret"

// Slack, the first connection written and the second one live.
//
// A single-workspace bot posting to one channel needs a bot token and nothing
// else — no OAuth dance, no per-user consent, no refresh — so the credential is
// a Secrets Manager secret read by the same Amplify compute role that reads the
// database secret, and `chat.postMessage` is one signed HTTPS call. Bedrock
// AgentCore Identity's SlackOauth2 credential provider is the AWS-standard
// alternative and is the right answer the moment a *second* workspace or a
// per-user token appears; it is the wrong answer for one bot, because it wants
// a client id and secret for a three-legged flow this app never performs. The
// adoption trigger is written in this directory's index.
//
// Parked, not abandoned: Brendan chose Discord first. Until a token is written
// into the secret this returns `connected: false` and contributes no tools, so
// the Tracker is never offered a way to post that does not work.

const SECRET_ID = process.env.SLACK_SECRET_ID || "govblock/slack"

export type Posted = { ok: true; where: string; ref: string } | { ok: false; error: string }

export async function postToSlack({ text }: { text: string }): Promise<Posted> {
  const secret = await readSecret(SECRET_ID)
  const token = secret.bot_token?.trim()
  const channel = secret.channel || "#govblock"

  if (!token)
    return {
      ok: false,
      error: `Slack is not connected — the secret ${SECRET_ID} holds no bot_token.`,
    }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
        "user-agent": "govblock-agents/1 (+https://policy.nysgpt.com)",
      },
      body: JSON.stringify({ channel, text, unfurl_links: false }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json()) as { ok?: boolean; error?: string; ts?: string; channel?: string }
    if (!body.ok) return { ok: false, error: body.error ?? `HTTP ${response.status}` }
    return { ok: true, where: body.channel ?? channel, ref: body.ts ?? "" }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const slack: Connection = {
  id: "slack",
  name: "Slack",
  summary: "Post a finished digest into a channel, so a tracking run ends somewhere people already look.",
  auth: `Bot token in Secrets Manager, ${SECRET_ID}, read by the govblock-amplify-compute role.`,
  tools: ["post_to_slack"],
  async status() {
    const secret = await readSecret(SECRET_ID)
    if (secret.bot_token?.trim())
      return { connected: true, detail: `Posting to ${secret.channel || "#govblock"}.` }
    return {
      connected: false,
      detail: `Parked behind Discord. The secret ${SECRET_ID} exists; its bot_token is empty, so this contributes no tools.`,
    }
  },
}
