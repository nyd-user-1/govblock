// The connectors surface's catalogue.
//
// Two kinds, and the distinction is the whole point of the page. A **platform**
// connector is one credential the site holds — Discord's webhook, Slack's bot —
// and everyone who uses govblock shares its destination. A **user** connector
// is yours: an OAuth grant to your own Google Drive or your own Slack
// workspace, which nobody else can see and which the site can only use while
// you are the one asking.
//
// Client-safe on purpose: the cards and the table render from this, and the
// live status is read separately on the server. Nothing here touches a secret.

export type ConnectorKind = "user" | "platform"

export type ConnectorState = "connected" | "available" | "unavailable"

export type Connector = {
  id: string
  name: string
  logo: string
  tint: string
  kind: ConnectorKind
  /** One line: what connecting it lets you do. */
  summary: string
  /** Popular connectors lead the page. */
  popular?: boolean
  /** Where connecting begins, when it can begin. */
  href?: string
}

export const CONNECTORS: Connector[] = [
  {
    id: "google-drive",
    name: "Google Drive",
    logo: "/logos/google-drive.svg",
    tint: "#1a73e8",
    kind: "user",
    popular: true,
    summary: "Save a delivered report straight into your own Drive, as a document you own.",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    logo: "/logos/google-calendar.svg",
    tint: "#1a73e8",
    kind: "user",
    popular: true,
    summary: "Put a hearing on your own calendar, with the committee, the time and the link back.",
  },
  {
    id: "slack",
    name: "Slack",
    logo: "/logos/slack.png",
    tint: "#611f69",
    kind: "user",
    popular: true,
    summary: "Send a digest to a channel in your own workspace, under your own account.",
  },
  {
    id: "discord",
    name: "Discord",
    logo: "/logos/discord.svg",
    tint: "#5865F2",
    kind: "platform",
    popular: true,
    summary: "Where the Tracker posts its digests and the Researcher delivers its reports.",
    href: "/agents/discord",
  },
]

export const KIND_LABEL: Record<ConnectorKind, string> = {
  user: "Yours",
  platform: "The site's",
}

export const STATE_LABEL: Record<ConnectorState, string> = {
  connected: "Connected",
  available: "Not connected",
  unavailable: "Not available yet",
}
