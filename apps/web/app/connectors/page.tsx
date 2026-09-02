import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { getConnectorStatuses, type ConnectorStatus } from "@/lib/agents/connector-status"
import { KIND_LABEL } from "@/lib/agents/connectors"
import { Button } from "@govblock/ui/components/nova/button"

import { ConnectionMark } from "../agents/connection-mark"
import { ConnectButton, ConnectRow, ConnectStatus } from "./connect-button"
import { GoogleConnections, type GoogleService } from "./google-state"
import { StatusChip } from "./status-chip"

const title = "Connectors"
const description =
  "Connect the places you already work, so what an agent finishes here can land there."

export const metadata = { title, description }
export const dynamic = "force-dynamic"

// The two connectors the server cannot answer for: the grant lives in the vault
// under this browser's claim check, so only the browser can ask.
function googleService(id: string): GoogleService | null {
  if (id === "google-drive" || id === "google-docs" || id === "google-sheets") return "drive"
  if (id === "google-calendar") return "calendar"
  return null
}

function Action({ connector, quiet }: { connector: ConnectorStatus; quiet?: boolean }) {
  const google = googleService(connector.id)
  // A ride-along says which connection it is asking for, because it is not
  // asking for its own.
  if (google) return <ConnectButton service={google} label={connector.ridesOn ? "Connect Drive" : undefined} />

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

// The card: the name owns the top row, the status and the thing to click share
// the bottom one.
//
// The status used to sit beside the name, and at this width they cannot both
// have the row: the card is 202.7px, the mark and its gap take 32, "Not
// available yet" takes 105.7, and what was left rendered "Google Calendar" —
// which needs 117px — as "Go…". Measured on the deploy after Brendan reported
// it. Below, the status has the row to itself and nothing truncates.
//
// data-not-typeset because a card is not an article: DocsPage puts its children
// inside `.typeset`, which gives every <p> a 12.5px flow margin on top of the
// flex gap. (The `not-prose` this page used to carry was Tailwind typography's
// opt-out and matched nothing here; it is gone, along with nine others.)
function Card({ connector }: { connector: ConnectorStatus }) {
  const google = googleService(connector.id)
  return (
    <div data-not-typeset="" className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">
      <div className="flex min-w-0 items-center gap-2">
        <ConnectionMark
          name={connector.name}
          logo={connector.logo}
          tint={connector.tint}
          live={connector.state === "connected"}
        />
        <span className="min-w-0 truncate font-medium">{connector.name}</span>
      </div>
      <p className="min-h-10 text-sm text-muted-foreground">{connector.summary}</p>
      {connector.ridesOn && (
        // Said on the card, not left to be discovered: one grant, one consent.
        <p className="text-xs text-muted-foreground">
          Included in your Google Drive connection.
        </p>
      )}
      {google ? (
        <ConnectRow service={google} label={connector.ridesOn ? "Connect Drive" : undefined} />
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

        <h2 className="mt-10 text-lg font-semibold tracking-tight">All connectors</h2>
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Connector</th>
                <th className="hidden px-4 py-2 font-medium sm:table-cell">Type</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((connector) => (
                <tr key={connector.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <ConnectionMark
                        name={connector.name}
                        logo={connector.logo}
                        tint={connector.tint}
                        live={connector.state === "connected"}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="font-medium">{connector.name}</span>
                        <span className="text-xs text-muted-foreground">{connector.detail}</span>
                      </span>
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {KIND_LABEL[connector.kind]}
                  </td>
                  <td className="px-4 py-3">
                    {googleService(connector.id) ? (
                      <ConnectStatus service={googleService(connector.id)!} />
                    ) : (
                      <StatusChip state={connector.state} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Action connector={connector} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-lg font-semibold tracking-tight">What &ldquo;yours&rdquo; will mean</h2>
        <p>
          govblock is public and has no accounts, so a connection you make will be keyed to a
          token minted in this browser — the same place the{" "}
          <Link href="/blocks/intelligence">Agentic Inbox</Link> keeps your threads. That token is
          a claim check, not a password: it says <em>this browser made that connection</em> and
          nothing more, it does not prove who you are, and anyone with your browser has it. Clear
          the site&apos;s storage and the connection is gone with it — which is also how you
          revoke one from this side.
        </p>
        <p>
          When accounts exist, connections move onto them and stop depending on a browser. Until
          then this page will not pretend otherwise.
        </p>
      </DocsPage>
    </GoogleConnections>
  )
}
