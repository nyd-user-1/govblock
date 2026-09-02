import Link from "next/link"

import { AGENTS } from "@/lib/agents/registry"
import { MODELS } from "@/lib/agents/models"
import { Badge } from "@govblock/ui/components/badge"

import { ConnectionMark } from "./connection-mark"
import { Button } from "@govblock/ui/components/nova/button"

// One card per agent: the name, what it specialises in, what it reads, what it
// can do, and the way in. The card is the explanation — this surface exists so
// a reader knows what an agent is before they talk to it.

export type ConnectionCard = {
  id: string
  name: string
  logo: string
  tint: string
  tools: string[]
  connected: boolean
  detail: string
}

export function AgentsList({ connections }: { connections: ConnectionCard[] }) {
  const byId = Object.fromEntries(connections.map((c) => [c.id, c]))
  return (
    <div className="flex flex-col gap-4">
      {AGENTS.map((agent) => {
        const held = (agent.connections ?? []).map((id) => byId[id]).filter(Boolean)
        const live = held.filter((c) => c.connected)
        return (
          <div
            key={agent.slug}
            className="flex flex-col gap-3 rounded-xl border p-5 transition-colors hover:bg-muted/30"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-lg font-semibold tracking-tight">{agent.name}</h2>
              {agent.agentic && <Badge variant="secondary">Agentic</Badge>}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {MODELS[agent.tier].label}
              </span>
            </div>

            <p className="text-sm text-foreground">{agent.speciality}</p>

            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Reads</dt>
              <dd className="text-muted-foreground">{agent.reads}</dd>
              <dt className="text-muted-foreground">Can do</dt>
              <dd className="text-muted-foreground">{agent.can}</dd>
              <dt className="text-muted-foreground">Tools</dt>
              <dd className="flex flex-wrap gap-1.5">
                {[...agent.tools, ...held.flatMap((c) => c.tools)].map((tool) => (
                  <code key={tool} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {tool}
                  </code>
                ))}
              </dd>
            </dl>

            {held.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {held.map((connection) => (
                    <span
                      key={connection.id}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground"
                    >
                      <ConnectionMark
                        name={connection.name}
                        logo={connection.logo}
                        tint={connection.tint}
                        live={connection.connected}
                      />
                      <span className={connection.connected ? "text-foreground" : undefined}>
                        {connection.name}
                      </span>
                      {!connection.connected && <span className="text-xs">not connected</span>}
                    </span>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {live.length ? `Posts to ${live.map((c) => c.name).join(", ")}. ` : "Nothing to post to yet. "}
                  A connection that is not live contributes no tool, so it runs the whole task and
                  hands the digest back as text rather than claiming to have sent it.
                </p>
              </div>
            )}

            <div>
              <Button size="sm" render={<Link href={`/agents/${agent.slug}`} />} nativeButton={false}>
                Open {agent.name}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
