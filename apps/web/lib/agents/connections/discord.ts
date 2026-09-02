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
// Three Discord facts shape the code:
//
// 1. A message's `content` caps at 2,000 characters and an embed's
//    `description` at 4,096, so a long digest goes as embeds and splits on a
//    blank line — between bills rather than mid-sentence.
// 2. **A webhook pointed at a forum channel must carry `thread_name`**, and one
//    pointed at a text channel must not. The webhook object does not say which
//    kind it is, so rather than ask Brendan to know, the first post learns:
//    it tries the plain shape, and if Discord says the channel is a forum it
//    retries with a thread name taken from the digest's first line. The answer
//    is remembered for the life of the compute instance. (Found the honest way
//    — PolicyBot's channel is a forum and the first real run came back 400.)
// 3. `?wait=true` makes Discord return the message it created instead of a bare
//    204 — which is what lets the Tracker report an id rather than assert
//    success, and gives the thread id that keeps a split digest in one thread
//    instead of starting a new one per part.

const SECRET_ID = process.env.DISCORD_SECRET_ID || "govblock/discord"
const CONTENT_MAX = 2000
const EMBED_MAX = 4096
const THREAD_NAME_MAX = 100

type Message = { id?: string; channel_id?: string }

/** Unknown until the first post tells us. */
let forum: boolean | null = null

function chunk(text: string, size: number) {
  const parts: string[] = []
  let rest = text
  while (rest.length > size) {
    // Break on a blank line if there is one in the last fifth of the window, so
    // a digest splits between bills rather than mid-sentence.
    const window = rest.slice(0, size)
    const cut = window.lastIndexOf("\n\n")
    const at = cut > size * 0.8 ? cut : size
    parts.push(rest.slice(0, at))
    rest = rest.slice(at).replace(/^\n+/, "")
  }
  if (rest) parts.push(rest)
  return parts
}

/** A forum post needs a title; the digest's own first line is the honest one. */
function title(text: string) {
  const first = (text.split("\n").find((line) => line.trim()) ?? "govblock digest")
    .replace(/[*_`#>]/g, "")
    .trim()
  return first.slice(0, THREAD_NAME_MAX) || "govblock digest"
}

async function send(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Discord asks webhook clients to identify themselves.
      "user-agent": "govblock-agents/1 (+https://policy.nysgpt.com)",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  })
  const body = await response.text()
  if (!response.ok) {
    const error = new Error(`Discord returned ${response.status} ${body.slice(0, 200)}`)
    ;(error as Error & { body: string }).body = body
    throw error
  }
  return (body ? JSON.parse(body) : {}) as Message
}

export async function postToDiscord({ text }: { text: string }): Promise<Posted> {
  const secret = await readSecret(SECRET_ID)
  const url = secret.webhook_url?.trim()

  if (!url)
    return {
      ok: false,
      error: `Discord is not connected — the secret ${SECRET_ID} holds no webhook_url.`,
    }

  const parts = text.length <= CONTENT_MAX ? [text] : chunk(text, EMBED_MAX)
  const first = parts[0] ?? ""
  const body = (part: string) =>
    part.length <= CONTENT_MAX
      ? { content: part, allowed_mentions: { parse: [] } }
      : { embeds: [{ description: part }], allowed_mentions: { parse: [] } }

  try {
    let opened: Message
    try {
      opened = await send(
        `${url}?wait=true`,
        forum ? { ...body(first), thread_name: title(text) } : body(first)
      )
      if (forum === null) forum = false
    } catch (error) {
      const detail = (error as Error & { body?: string }).body ?? ""
      if (forum !== null || !detail.includes("thread_name")) throw error
      // The channel is a forum. Learn it and open a post instead of a message.
      forum = true
      opened = await send(`${url}?wait=true`, { ...body(first), thread_name: title(text) })
    }

    // A forum post's own id is the thread; the rest of a split digest belongs
    // inside it rather than in new posts beside it.
    const thread = opened.channel_id
    for (const part of parts.slice(1)) {
      // A webhook allows about five requests a second; a digest is a handful of
      // parts at most, so a small gap is cheaper than handling a 429.
      await new Promise((resolve) => setTimeout(resolve, 300))
      await send(`${url}?wait=true${thread ? `&thread_id=${thread}` : ""}`, body(part))
    }

    return {
      ok: true,
      where: parts.length > 1 ? `Discord, in ${parts.length} parts` : "Discord",
      ref: opened.id ?? "",
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const discord: Connection = {
  id: "discord",
  name: "Discord",
  summary: "Post a finished digest into the PolicyBot channel, so a tracking run ends somewhere people already look.",
  logo: "/logos/discord.svg",
  tint: "#5865F2",
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
