import "server-only"

import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager"

import type { Connection } from "@/lib/agents/connections"

// Slack, the first connection.
//
// A single-workspace bot posting to one channel needs a bot token and nothing
// else — no OAuth dance, no per-user consent, no refresh. So the credential is
// a Secrets Manager secret read by the same Amplify compute role that reads the
// database secret, and `chat.postMessage` is one signed HTTPS call. Bedrock
// AgentCore Identity's SlackOauth2 credential provider is the AWS-standard
// alternative and is the right answer the moment a *second* workspace or a
// per-user token appears; it is the wrong answer for one bot, because it wants
// a client id and secret for a three-legged flow this app never performs.
// §3 of the lane prompt carries the full comparison.
//
// Until Brendan installs the app and writes the token into the secret, every
// call returns `connected: false` with the reason. Nothing is stubbed out or
// faked: the Tracker runs its whole plan and reports honestly that the last
// step could not be taken.

const SECRET_ID = process.env.SLACK_SECRET_ID || "govblock/slack"
const REGION = process.env.AWS_REGION || "us-east-1"

type SlackSecret = { bot_token?: string; channel?: string }

let cached: { at: number; value: SlackSecret } | null = null
let secrets: SecretsManagerClient | null = null

async function read(): Promise<SlackSecret> {
  // Five minutes: long enough that a burst of tool calls costs one read, short
  // enough that writing the token into the secret takes effect without a deploy.
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.value
  if (!secrets) secrets = new SecretsManagerClient({ region: REGION })
  try {
    const result = await secrets.send(new GetSecretValueCommand({ SecretId: SECRET_ID }))
    const value = result.SecretString ? (JSON.parse(result.SecretString) as SlackSecret) : {}
    cached = { at: Date.now(), value }
    return value
  } catch {
    cached = { at: Date.now(), value: {} }
    return {}
  }
}

export type SlackPost =
  | { ok: true; channel: string; ts: string; permalink?: string }
  | { ok: false; error: string }

export async function postToSlack({
  text,
  channel,
}: {
  text: string
  channel?: string
}): Promise<SlackPost> {
  const secret = await read()
  const token = secret.bot_token?.trim()
  const target = channel || secret.channel || "#govblock"

  if (!token) {
    return {
      ok: false,
      error: `Slack is not connected yet — the secret ${SECRET_ID} holds no bot_token. Say so plainly and hand back the digest as text instead.`,
    }
  }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: target, text, unfurl_links: false }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json()) as { ok?: boolean; error?: string; ts?: string; channel?: string }
    if (!body.ok) return { ok: false, error: body.error ?? `HTTP ${response.status}` }
    return { ok: true, channel: body.channel ?? target, ts: body.ts ?? "" }
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
    const secret = await read()
    if (secret.bot_token?.trim())
      return { connected: true, detail: `Posting to ${secret.channel || "#govblock"}.` }
    return {
      connected: false,
      detail: `Waiting on the workspace install. The secret ${SECRET_ID} exists; its bot_token is empty.`,
    }
  },
}
