import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { getConnectorStatuses, type ConnectorStatus } from "@/lib/agents/connector-status"
import { Button } from "@govblock/ui/components/nova/button"

import { ConnectionMark } from "../agents/connection-mark"
import { ConnectRow } from "./connect-button"
import { GoogleConnections, type GoogleService } from "./google-state"
import { StatusChip } from "./status-chip"

const title = "Connectors"
const description =
  "Connect the places you already work, so what an agent finishes here can land there."

export const metadata = { title, description }
export const dynamic = "force-dynamic"

// The connectors the server cannot answer for: the grant lives in the vault
// under this browser's claim check, so only the browser can ask. Slack rides
// the same machinery as a third service.
function googleService(id: string): GoogleService | null {
  if (id === "google-drive" || id === "google-docs" || id === "google-sheets") return "drive"
  if (id === "google-calendar") return "calendar"
  if (id === "slack") return "slack"
  return null
}

// The non-Google connectors: Discord has somewhere to go, Slack does not yet.
// The Google four never reach here — their card is a ConnectRow.
function Action({ connector, quiet }: { connector: ConnectorStatus; quiet?: boolean }) {
  if (connector.state === "connected")
    return connector.href ? (
      <Button
        variant="outline"
        size="sm"
        render={<Link href={connector.href} />}
        nativeButton={false}
      >
        Manage
      </Button>
    ) : null

  if (connector.state === "available" && connector.href)
    return (
      <Button size="sm" render={<Link href={connector.href} />} nativeButton={false}>
        Connect
      </Button>
    )

  // Nothing to click yet, and a button that opens nothing is worse than none.
  // In a card the status chip is right beside this, and saying "not yet" twice
  // on one row helps nobody.
  return quiet ? null : <span className="text-xs text-muted-foreground">Not yet</span>
}

// The card: logo, name, status, button. Brendan's spec, and nothing else on it.
//
// The description sentences are gone from all six. What they were carrying that
// nobody else was — that Docs and Sheets are not their own grant — moves into
// the status chip rather than out of the surface, because the chip is one of
// the four things a card is allowed to have. A ride-along that is not connected
// reads "Included in Drive" instead of "Not connected", which is the truer
// sentence anyway: there is nothing separate to connect.
function Card({ connector }: { connector: ConnectorStatus }) {
  const google = googleService(connector.id)
  return (
    <div data-not-typeset="" className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40">
      <div className="flex min-w-0 items-center gap-2">
        <ConnectionMark
          name={connector.name}
          logo={connector.logo}
          tint={connector.tint}
          live={connector.state === "connected"}
        />
        <span className="min-w-0 truncate font-medium">{connector.name}</span>
      </div>
      {google ? (
        <ConnectRow service={google} />
      ) : (
        <div className="flex items-center justify-between gap-2">
          <StatusChip state={connector.state} />
          <Action connector={connector} quiet />
        </div>
      )}
    </div>
  )
}

export default async function ConnectorsPage() {
  const connectors = await getConnectorStatuses()
  const popular = connectors.filter((connector) => connector.popular)

  return (
    <GoogleConnections>
      <DocsPage
        title={title}
        description={description}
        slug="/connectors"
        previous={{ name: "Agents", url: "/agents" }}
        next={{ name: "Discord", url: "/agents/discord" }}
      >
        <p>
          There are two kinds here and the difference matters. A connector marked{" "}
          <strong>the site&apos;s</strong> is one credential govblock holds — every reader shares
          its destination, and an agent posting through it posts to the same place for everyone. A
          connector marked <strong>yours</strong> is an OAuth grant to your own account: nobody
          else can see it, and this site can only use it while you are the one asking.
        </p>

        <h2 className="mt-8 text-lg font-semibold tracking-tight">Popular</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {popular.map((connector) => (
            <Card key={connector.id} connector={connector} />
          ))}
        </div>

      </DocsPage>
    </GoogleConnections>
  )
}
