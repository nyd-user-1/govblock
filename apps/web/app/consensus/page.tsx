import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { conversations } from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { ConversationsRail } from "@/components/consensus/rail"
import { MessagesSquare } from "lucide-react"

// /consensus — the conversations, as a directory.
//
// Polis lists these by printing every conversation's entire description into
// a wall of monospace. A conversation is a thing with a shape — how many
// people, how many statements, how many groups it found — so it gets a card
// with that shape on it, the way committees and bills do here.
const title = "Consensus"
const description =
  "Opinion gathered at scale: people vote on each other's statements, and the groups emerge from the votes rather than from who spoke loudest."

export const metadata = { title, description }

export default function ConsensusPage() {
  const all = conversations()
  return (
    <DocsPage
      title={title}
      description={description}
      slug="/consensus"
      previous={{ name: "Briefing", url: "/briefing" }}
      next={{ name: "Report", url: "/consensus/report" }}
      rail={<ConversationsRail />}
      railFirst
    >
      <div data-not-typeset="true" className="my-8 flex flex-col gap-8">
        <ProjectGrid>
          {all.map((c) => (
            <ProjectCard
              key={c.slug}
              href={`/consensus/report?c=${c.slug}`}
              title={c.title}
              media={
                <MessagesSquare
                  className="size-7 text-muted-foreground"
                  aria-hidden
                />
              }
              meta={`${fmtNumber(c.stats.voters)} participants · ${fmtNumber(c.stats.statements)} statements · ${c.stats.groups} groups`}
            />
          ))}
        </ProjectGrid>

        <p className="text-sm text-muted-foreground">
          The conversations are the Computational Democracy Project&apos;s own
          published data, so every one of them has already clustered.
          The <Link href="/consensus/survey">survey</Link> is where a
          conversation is voted on and the{" "}
          <Link href="/consensus/admin">admin</Link> is where one is built.
        </p>
      </div>
    </DocsPage>
  )
}
