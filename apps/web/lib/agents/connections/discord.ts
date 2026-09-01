import "server-only"

import type { Connection } from "@/lib/agents/connections"
import { readSecret } from "@/lib/agents/connections/secret"
import type { Posted } from "@/lib/agents/connections/slack"

// Discord, the second connection — and the test of whether the contract in this
// directory was real. It is one file and one line in CONNECTIONS; nothing in the
// agents, the tool loop or the surface changed to admit it.
//
// An incoming webhook is the whole credential: the URL names the channel it
// posts to, so unlike a bot token there is no way for a caller to redirect a
// post somewhere else. That answers, by construction, the question of what
// happens when a public route holds an actuator — the destination is not a
// parameter anywhere in this system.
//
// Two limits shape the code. `content` caps at 2,000 characters and an embed's
// `description` at 4,096, so a digest goes as an embed and only falls back to
// splitting when even that is too long. `?wait=true` makes Discord return the
// message it created instead of a bare 204, which is what lets the Tracker
// report an id rather than assert success.

const SECRET_ID = process.env.DISCORD_SECRET_ID || "govblock/discord"
const CONTENT_MAX = 2000
const EMBED_MAX = 4096

type Webhook = { id?: string; channel_id?: string }

function chunk(text: string, size: number) {
  const parts: string[] = []
  let rest = text
  while (rest.length > size) {
    // Break on a blank line if there is one in the last fifth of the window,
    // so a digest splits between bills rather than mid-sentence.
    const window = rest.slice(0, size)
    const cut = window.lastIndexOf("\n\n")
    const at = cut > size * 0.8 ? cut : size
    parts.push(rest.slice(0, at))
    rest = rest.slice(at).replace(/^\n+/, "")
  }
  if (rest) parts.push(rest)
  return parts
}

async function send(url: string, payload: unknown): Promise<Webhook> {
  const response = await fetch(`${url}?wait=true`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Discord asks webhook clients to identify themselves.
      "user-agent": "govblock-agents/1 (+https://policy.nysgpt.com)",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Discord returned ${response.status} ${detail.slice(0, 200)}`)
  }
  return (await response.json().catch(() => ({}))) as Webhook
}

export async function postToDiscord({ text }: { text: string }): Promise<Posted> {
  const secret = await readSecret(SECRET_ID)
  const url = secret.webhook_url?.trim()

  if (!url)
    return {
      ok: false,
      error: `Discord is not connected — the secret ${SECRET_ID} holds no webhook_url.`,
    }

  try {
    if (text.length <= CONTENT_MAX) {
      const message = await send(url, { content: text, allowed_mentions: { parse: [] } })
      return { ok: true, where: "the PolicyBot channel", ref: message.id ?? "" }
    }

    const parts = chunk(text, EMBED_MAX)
    let first = ""
    for (const [index, part] of parts.entries()) {
      // Discord allows ~5 requests a second per webhook; a digest is a handful
      // of parts at most, so a small gap is cheaper than handling a 429.
      if (index) await new Promise((resolve) => setTimeout(resolve, 300))
      const message = await send(url, {
        embeds: [{ description: part }],
        allowed_mentions: { parse: [] },
      })
      if (!index) first = message.id ?? ""
    }
    return {
      ok: true,
      where: parts.length > 1 ? `the PolicyBot channel, in ${parts.length} parts` : "the PolicyBot channel",
      ref: first,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const discord: Connection = {
  id: "discord",
  name: "Discord",
  summary: "Post a finished digest into the PolicyBot channel, so a tracking run ends somewhere people already look.",
  auth: `Incoming-webhook URL in Secrets Manager, ${SECRET_ID}, read by the govblock-amplify-compute role. The URL names its own channel, so the destination is not a parameter anywhere in this system.`,
  tools: ["post_to_discord"],
  async status() {
    const secret = await readSecret(SECRET_ID)
    if (secret.webhook_url?.trim())
      return { connected: true, detail: "Posting to the PolicyBot channel." }
    return {
      connected: false,
      detail: `Waiting on the webhook. The secret ${SECRET_ID} exists; its webhook_url is empty, so this contributes no tools.`,
    }
  },
}
