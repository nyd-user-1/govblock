import { DocsPage } from "@/components/docs-page"
import { CONNECTIONS } from "@/lib/agents/connections"

import { AgentsList } from "./agents-list"

const title = "Agents"
const description =
  "Four specialists over the same record. Each one holds a different set of the read routes this site already serves, and says which rows it read."

export const metadata = { title, description }
export const dynamic = "force-dynamic"

export default async function AgentsPage() {
  // Read live rather than at build time: whether Slack is connected is a
  // property of a secret, and the card must not claim yesterday's answer.
  const entries = await Promise.all(
    CONNECTIONS.map(async (c) => [c.id, await c.status()] as const)
  )

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/agents"
      previous={{ name: "Directory", url: "/docs/directory" }}
      next={{ name: "Bills", url: "/docs/bills" }}
    >
      <p>
        Every agent here reads through <code>/api/policy</code> — the same routes the pages
        read, with the same jurisdiction scoping and the same cache. None of them answer from
        the model&apos;s own memory: where what a model remembers disagrees with a row, the row
        wins, and the agent says which row it read.
      </p>
      <AgentsList connections={Object.fromEntries(entries)} />
    </DocsPage>
  )
}
