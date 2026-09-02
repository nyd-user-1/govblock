import "server-only"

import { readSecret } from "@/lib/agents/connections/secret"

// The two read paths into the Discord server, kept apart because they need
// different things and fail differently.
//
// 1. **The widget** is public and needs no credential: Discord serves
//    `/api/guilds/<id>/widget.json` to anyone once the server owner switches
//    the widget on, and 403s with `50004` until then. So the card either shows
//    the server or says precisely which switch is off, and neither state is a
//    guess.
// 2. **The threads** need a bot. A webhook can write and cannot read — the URL
//    is a one-way door — so rendering PolicyBot's posts on our own pages needs
//    a read-only bot token in `govblock/discord-bot`. Until that exists this
//    renders nothing at all. Standing in local runs would put one browser's
//    history under a heading that says Discord, which is a different claim.

const GUILD_ID = process.env.DISCORD_GUILD_ID || "1537459604626219018"
const BOT_SECRET_ID = process.env.DISCORD_BOT_SECRET_ID || "govblock/discord-bot"

export type Widget =
  | {
      enabled: true
      id: string
      name: string
      invite: string | null
      online: number
      channels: { id: string; name: string }[]
    }
  | { enabled: false; reason: string }

export async function getWidget(): Promise<Widget> {
  try {
    const response = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/widget.json`, {
      headers: { "user-agent": "govblock-agents/1 (+https://policy.nysgpt.com)" },
      // The widget changes when someone joins or leaves; a minute is fresh
      // enough for a card and keeps us far inside Discord's rate limit.
      next: { revalidate: 60 },
    })
    if (response.status === 403)
      return {
        enabled: false,
        reason: "The server widget is switched off, so Discord will not serve it to anyone.",
      }
    if (!response.ok) return { enabled: false, reason: `Discord returned ${response.status}.` }
    const body = (await response.json()) as {
      id: string
      name: string
      instant_invite: string | null
      presence_count?: number
      members?: unknown[]
      channels?: { id: string; name: string }[]
    }
    return {
      enabled: true,
      id: body.id,
      name: body.name,
      invite: body.instant_invite ?? null,
      online: body.presence_count ?? body.members?.length ?? 0,
      channels: body.channels ?? [],
    }
  } catch (error) {
    return {
      enabled: false,
      reason: error instanceof Error ? error.message : "Discord could not be reached.",
    }
  }
}

export const WIDGET_URL = (theme: "dark" | "light") =>
  `https://discord.com/widget?id=${GUILD_ID}&theme=${theme}`

export type BotStatus =
  | { connected: true; guildId: string; channelId: string }
  | { connected: false; detail: string }

export async function getBotStatus(): Promise<BotStatus> {
  const secret = await readSecret(BOT_SECRET_ID)
  const token = secret.bot_token?.trim()
  if (!token)
    return {
      connected: false,
      detail: `No read-only bot yet — the secret ${BOT_SECRET_ID} holds no bot_token.`,
    }
  if (!secret.channel_id?.trim())
    return {
      connected: false,
      detail: `The bot token is present but ${BOT_SECRET_ID} names no channel_id to read.`,
    }
  return {
    connected: true,
    guildId: secret.guild_id?.trim() || GUILD_ID,
    channelId: secret.channel_id.trim(),
  }
}

export type Thread = {
  id: string
  name: string
  messageCount: number
  createdAt: string | null
  url: string
}

/**
 * PolicyBot's threads, read with the bot token.
 *
 * Returns an empty list rather than throwing when the bot is not connected —
 * the surface says why, and an empty list is the honest shape of "we cannot
 * see the channel" as well as of "the channel is empty". The two are told
 * apart by the status, never by the length.
 */
export async function getThreads(): Promise<Thread[]> {
  const status = await getBotStatus()
  if (!status.connected) return []
  const secret = await readSecret(BOT_SECRET_ID)
  const token = secret.bot_token!.trim()

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${status.channelId}/threads/active`,
      {
        headers: {
          authorization: `Bot ${token}`,
          "user-agent": "govblock-agents/1 (+https://policy.nysgpt.com)",
        },
        next: { revalidate: 60 },
      }
    )
    if (!response.ok) return []
    const body = (await response.json()) as {
      threads?: { id: string; name: string; message_count?: number; thread_metadata?: { create_timestamp?: string } }[]
    }
    return (body.threads ?? []).map((thread) => ({
      id: thread.id,
      name: thread.name,
      messageCount: thread.message_count ?? 0,
      createdAt: thread.thread_metadata?.create_timestamp ?? null,
      url: `https://discord.com/channels/${status.guildId}/${thread.id}`,
    }))
  } catch {
    return []
  }
}
