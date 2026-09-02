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

    // Slack's OAuth client now EXISTS — `govblock-slack` is READY in the token
    // vault, holding the client secret so the app never has to. What is missing
    // is one console paste of the vault's callback URL into the Slack app, and
    // until that lands consent would fail on Slack's own page. So the state is
    // still "unavailable", but the detail says which piece is missing and whose
    // it is, rather than repeating a sentence that is no longer true.
    //
    // The other half of the truth, kept here deliberately: the grant the vault
    // can hand back is a BOT token. A post lands in the reader's own workspace,
    // in a channel they pick, on their own consent — but under govblock's name,
    // not theirs. Slack nests the user token inside `authed_user` and the vault
    // has no way to reach it.
    if (connector.id === "slack")
      return {
        ...connector,
        state: "unavailable",
        detail:
          "The OAuth client is ready in the token vault; govblock's redirect URL still has to be added to the Slack app, and that one is ours. Posts will arrive under govblock's name rather than yours — Slack keeps the personal token somewhere the vault cannot reach.",
      }

    return {
      ...connector,
      state: "unavailable",
      detail: "Not wired yet.",
    }
  })
}
