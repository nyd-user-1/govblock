import * as React from "react"
import { notFound } from "next/navigation"

import { DocsPage } from "@/components/docs-page"
import { CONNECTIONS } from "@/lib/agents/connections"
import { MODELS } from "@/lib/agents/models"
import { AGENTS, agent as findAgent } from "@/lib/agents/registry"

import { AgentChat } from "../agent-chat"

// Dynamic: whether Slack is connected is a property of a secret, and the page
// must not print a build-time answer to it.
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agent = findAgent(slug)
  return agent ? { title: agent.name, description: agent.speciality } : {}
}

export default async function AgentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agent = findAgent(slug)
  if (!agent) notFound()

  const index = AGENTS.findIndex((a) => a.slug === slug)
  const before = AGENTS[index - 1]
  const after = AGENTS[index + 1]

  const needed = CONNECTIONS.filter((c) => (agent.connections ?? []).includes(c.id))
  const statuses = await Promise.all(needed.map(async (c) => [c, await c.status()] as const))

  return (
    <DocsPage
      title={agent.name}
      description={agent.speciality}
      slug={`/agents/${agent.slug}`}
      previous={before ? { name: before.name, url: `/agents/${before.slug}` } : { name: "Agents", url: "/agents" }}
      next={after ? { name: after.name, url: `/agents/${after.slug}` } : { name: "Bills", url: "/docs/bills" }}
    >
      <dl className="not-prose mb-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="text-muted-foreground">Reads</dt>
        <dd>{agent.reads}</dd>
        <dt className="text-muted-foreground">Can do</dt>
        <dd>{agent.can}</dd>
        <dt className="text-muted-foreground">Model</dt>
        <dd className="text-muted-foreground">{MODELS[agent.tier].label}</dd>
        <dt className="text-muted-foreground">Tools</dt>
        <dd className="flex flex-wrap gap-1.5">
          {agent.tools.map((tool) => (
            <code key={tool} className="rounded bg-muted px-1.5 py-0.5 text-xs">
              {tool}
            </code>
          ))}
        </dd>
        {statuses.map(([connection, status]) => (
          <React.Fragment key={connection.id}>
            <dt className="text-muted-foreground">{connection.name}</dt>
            <dd className={status.connected ? "" : "text-muted-foreground"}>
              {status.detail}{" "}
              <span className="block text-xs">{connection.auth}</span>
            </dd>
          </React.Fragment>
        ))}
      </dl>

      <AgentChat agent={agent} />
    </DocsPage>
  )
}
