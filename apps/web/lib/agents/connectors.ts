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
  /**
   * A connector that is not its own grant: it rides on another's. Google's
   * `drive.file` scope covers every file this app creates in Google's editors,
   * so Docs and Sheets are already inside the Drive connection — the same one
   * consent, and the surface says so rather than implying a second.
   */
  ridesOn?: string
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
    id: "google-docs",
    name: "Google Docs",
    logo: "/logos/google-docs.svg",
    tint: "#1a73e8",
    kind: "user",
    popular: true,
    ridesOn: "google-drive",
    summary: "A delivered report lands as a Google Doc you can edit, not a file you download.",
  },
  {
    id: "google-sheets",
    name: "Google Sheets",
    logo: "/logos/google-sheets.svg",
    tint: "#0f9d58",
    kind: "user",
    popular: true,
    ridesOn: "google-drive",
    summary: "Export the hearings you are looking at to a spreadsheet in your own Drive.",
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
    summary: "Where the Whip posts its digests and the Librarian delivers its reports.",
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
