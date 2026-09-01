import "server-only"

import type { ToolName } from "@/lib/agents/tools"
import { slack } from "@/lib/agents/connections/slack"

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

export const CONNECTIONS: Connection[] = [slack]

export function connection(id: string) {
  return CONNECTIONS.find((c) => c.id === id)
}
