import "server-only"

import { CONNECTORS, type Connector, type ConnectorState } from "@/lib/agents/connectors"
import { getWidget } from "@/lib/agents/connections/discord-community"
import { discord } from "@/lib/agents/connections/discord"
import { slack } from "@/lib/agents/connections/slack"

// What each connector's state actually is, read live rather than declared.
//
// "Not available yet" is not a euphemism for broken: it means the thing a
// reader would have to click does not exist to be clicked, and the detail says
// which piece is missing and who has to create it. A button that opens nothing
// would be worse than a sentence.

export type ConnectorStatus = Connector & {
  state: ConnectorState
  detail: string
}

export async function getConnectorStatuses(): Promise<ConnectorStatus[]> {
  const [discordStatus, slackStatus, widget] = await Promise.all([
    discord.status(),
    slack.status(),
    getWidget(),
  ])

  return CONNECTORS.map((connector): ConnectorStatus => {
    if (connector.id === "discord")
      return {
        ...connector,
        state: discordStatus.connected ? "connected" : "available",
        detail: discordStatus.connected
          ? `${discordStatus.detail}${widget.enabled ? ` ${widget.name} is up.` : ""}`
          : discordStatus.detail,
      }

    // Drive and Calendar are connectable now: the client exists in the vault
    // and the grant is per reader, so whether *this* browser has one is a
    // question only the browser can ask — the card's button asks it on mount.
    if (connector.id === "google-drive" || connector.id === "google-calendar")
      return {
        ...connector,
        state: "available",
        detail:
          connector.id === "google-drive"
            ? "Scope drive.file — it reaches files govblock creates for you and cannot read anything else in your Drive."
            : "Scope calendar.events.owned — calendars you own, your primary included, and none merely shared with you.",
      }

    // Docs and Sheets are not separate grants and the surface must not imply
    // they are: they are what drive.file already covers, so their state is the
    // Drive connection's state and connecting either one *is* connecting Drive.
    if (connector.ridesOn === "google-drive")
      return {
        ...connector,
        state: "available",
        detail: "Included in your Google Drive connection — the same drive.file grant, no second consent.",
      }

    // Slack is connectable: `govblock-slack` is READY in the token vault, it
    // holds the client secret so the app never has to, and the callback URL is
    // registered on the Slack app. Consent is walkable, so "available" is the
    // true state and a dimmed card would be understating it.
    //
    // The half that stays said, because it is the half a reader would otherwise
    // discover from a message with the wrong name on it: the grant the vault can
    // hand back is a BOT token. A post lands in the reader's own workspace, in a
    // channel they pick, on their own consent — under govblock's name, not
    // theirs. Slack nests the personal token inside `authed_user` and the vault
    // has no way to reach it.
    //
    // This detail renders on /agents and /agents/[slug], not only here, so a
    // sentence left stale here is stale in three places.
    if (connector.id === "slack")
      return {
        ...connector,
        state: "available",
        detail:
          "An OAuth grant to your own Slack workspace, held in the token vault rather than by us. Posts arrive under govblock's name rather than yours — Slack keeps the personal token somewhere the vault cannot reach.",
      }

    return {
      ...connector,
      state: "unavailable",
      detail: "Not wired yet.",
    }
  })
}
