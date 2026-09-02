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

    if (connector.id === "slack")
      return {
        ...connector,
        state: "unavailable",
        detail:
          "A user connector needs a Slack app with an OAuth client, which does not exist yet. The site's own Slack bot is a separate thing and is parked.",
      }

    return {
      ...connector,
      state: "unavailable",
      detail: "Not wired yet.",
    }
  })
}
