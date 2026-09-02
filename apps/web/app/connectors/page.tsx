import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { getConnectorStatuses, type ConnectorStatus } from "@/lib/agents/connector-status"
import { KIND_LABEL, STATE_LABEL } from "@/lib/agents/connectors"
import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"

import { ConnectionMark } from "../agents/connection-mark"
import { ConnectButton } from "./connect-button"

const title = "Connectors"
const description =
  "Connect the places you already work, so what an agent finishes here can land there."

export const metadata = { title, description }
export const dynamic = "force-dynamic"

function Dot({ state }: { state: ConnectorStatus["state"] }) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        state === "connected" && "bg-emerald-500",
        state === "available" && "bg-amber-500",
        state === "unavailable" && "bg-muted-foreground/40"
      )}
    />
  )
}

function Action({ connector }: { connector: ConnectorStatus }) {
  // Whether *this browser* holds a Google grant is a question only the browser
  // can ask, so those two hand off to a client component that asks the vault.
  if (connector.id === "google-drive") return <ConnectButton service="drive" />
  if (connector.id === "google-calendar") return <ConnectButton service="calendar" />

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
  return <span className="text-xs text-muted-foreground">Not yet</span>
}

function Card({ connector }: { connector: ConnectorStatus }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <ConnectionMark
          name={connector.name}
          logo={connector.logo}
          tint={connector.tint}
          live={connector.state === "connected"}
        />
        <span className="min-w-0 truncate font-medium">{connector.name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
          <Dot state={connector.state} />
          {STATE_LABEL[connector.state]}
        </span>
      </div>
      <p className="min-h-10 text-sm text-muted-foreground">{connector.summary}</p>
      <div>
        <Action connector={connector} />
      </div>
    </div>
  )
}

export default async function ConnectorsPage() {
  const connectors = await getConnectorStatuses()
  const popular = connectors.filter((connector) => connector.popular)

  return (
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
      <div className="not-prose grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {popular.map((connector) => (
          <Card key={connector.id} connector={connector} />
        ))}
      </div>

      <h2 className="mt-10 text-lg font-semibold tracking-tight">All connectors</h2>
      <div className="not-prose overflow-hidden rounded-xl border">
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
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                    <Dot state={connector.state} />
                    {STATE_LABEL[connector.state]}
                  </span>
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
  )
}
