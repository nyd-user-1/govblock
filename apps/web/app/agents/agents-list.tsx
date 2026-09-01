import Link from "next/link"

import { AGENTS } from "@/lib/agents/registry"
import { MODELS } from "@/lib/agents/models"
import { Badge } from "@govblock/ui/components/badge"
import { Button } from "@govblock/ui/components/nova/button"

// One card per agent: the name, what it specialises in, what it reads, what it
// can do, and the way in. The card is the explanation — this surface exists so
// a reader knows what an agent is before they talk to it.

export function AgentsList({
  connections,
}: {
  connections: Record<string, { connected: boolean; detail: string }>
}) {
  return (
    <div className="not-prose flex flex-col gap-4">
      {AGENTS.map((agent) => {
        const missing = (agent.connections ?? []).filter((id) => !connections[id]?.connected)
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
                {agent.tools.map((tool) => (
                  <code key={tool} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                    {tool}
                  </code>
                ))}
              </dd>
            </dl>

            {missing.map((id) => (
              <p key={id} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{id} is not connected.</span>{" "}
                {connections[id]?.detail} It runs the whole task and hands the result back as
                text instead.
              </p>
            ))}

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
