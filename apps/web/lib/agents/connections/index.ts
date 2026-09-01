import "server-only"

import type { ToolName } from "@/lib/agents/tools"
import { discord, postToDiscord } from "@/lib/agents/connections/discord"
import { slack, postToSlack } from "@/lib/agents/connections/slack"
import type { Posted } from "@/lib/agents/connections/slack"

// A connection is an outside service an agent may act on. Vercel calls these
// Connections; the AWS-standard equivalent evaluated for this lane is Bedrock
// AgentCore Identity, whose OAuth2 credential providers cover Slack, Google
// (Drive and Gmail) and Microsoft as first-class vendors. The evaluation and
// the ruling live in prompts/2026-09-01-bedrock-agents.md §3.
//
// The adoption trigger, ruled 2026-09-01: Slack ships now as a bot token in
// Secrets Manager, because one workspace bot posting to one channel needs no
// OAuth flow and AgentCore Identity would want a Cognito pool and a
// workload-identity token to hand back a string we can already read. Move to
// AgentCore Identity at whichever comes first — a SECOND workspace, or the
// FIRST per-user token (a connection acting as the reader rather than as the
// app, which is what Drive and Gmail will be). At that point the OAuth dance is
// real work we would otherwise write ourselves, and its SlackOauth2 /
// GoogleOauth2 / MicrosoftOauth2 vendors already cover the list.
//
// Whatever the vault turns out to be, the shape below is what an agent sees:
// a name, where the credential comes from, whether it is live right now, and
// the tools it contributes. Adding Drive, Gmail or Discord is a new file in
// this directory and a line in CONNECTIONS — not a change to the agents, the
// tool loop, or the surface.

export type ConnectionStatus = {
  /** True only when a real credential is present and usable. */
  connected: boolean
  /** What is missing, in a sentence a person can act on. */
  detail: string
}

export type Connection = {
  /** Stable id used in the registry and the URL. */
  id: string
  name: string
  /** One line: what an agent can do once this is connected. */
  summary: string
  /** Where the credential lives, named precisely enough to go and look. */
  auth: string
  /** The tools this connection contributes to any agent that holds it. */
  tools: ToolName[]
  status: () => Promise<ConnectionStatus>
}

// Discord first because it is the one that is live. Adding it was one file and
// this line — which is what the contract above was for.
export const CONNECTIONS: Connection[] = [discord, slack]

/** The tools of the connections an agent holds that are actually connected. */
export async function liveTools(ids: string[] = []) {
  const held = CONNECTIONS.filter((c) => ids.includes(c.id))
  const statuses = await Promise.all(held.map(async (c) => [c, await c.status()] as const))
  return {
    tools: statuses.filter(([, s]) => s.connected).flatMap(([c]) => c.tools),
    connected: statuses.filter(([, s]) => s.connected).map(([c]) => c.name),
    missing: statuses.filter(([, s]) => !s.connected).map(([c]) => c.name),
  }
}

export function connection(id: string) {
  return CONNECTIONS.find((c) => c.id === id)
}

const POSTERS: Record<string, (args: { text: string }) => Promise<Posted>> = {
  discord: postToDiscord,
  slack: postToSlack,
}

/**
 * Send a finished report to the first connection that is live.
 *
 * Used by `deliver_report`, which exists because the alternative — a tool whose
 * argument is the whole report — makes the model retype thousands of tokens it
 * has already written. On a host that discards a response after thirty seconds
 * that is not a cost problem, it is a correctness one.
 */
export async function deliver(text: string): Promise<Posted> {
  for (const connection of CONNECTIONS) {
    const status = await connection.status()
    if (!status.connected) continue
    const post = POSTERS[connection.id]
    if (post) return post({ text })
  }
  return { ok: false, error: "No connection is live, so there is nowhere to deliver it." }
}
