import { notFound } from "next/navigation"
import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { dayList, stateRollup, stateTotals } from "@/lib/gdelt/days"
import { ShowMore } from "@/components/gdelt/sections"
import { FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { stateName } from "@/lib/filters"

// One jurisdiction's legislative news, across every day on file: its own
// press, the bills its coverage links to, the people it names, and the stories
// themselves. The state is the outlet's, or the bill's own legislature.

// Rendered on first request, not at build (2026-09-19): the build wrote every
// day and state page with its data, 37 MB of the 234.9 MB Amplify refused
// against its 230.7 MB cap (job 287). A jurisdiction the nightly job adds
// renders the same way.

export function generateStaticParams() {
  return []
}

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const longDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`
const nameOf = (code: string) => (code === "US" ? "Congress" : stateName(code))

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return { title: `Legislative news, ${nameOf(code.toUpperCase())}`, description: `What the press published about ${nameOf(code.toUpperCase())} and its bills.` }
}

const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => <div className={`flex flex-col gap-4 rounded-2xl border bg-card p-4 ${className}`}>{children}</div>

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="not-typeset flex flex-col gap-4">
      <h2 className="font-heading flex items-baseline gap-3 text-lg font-semibold tracking-tight sm:text-xl">
        {title}
        {aside ? <span className="ml-auto shrink-0 text-sm font-normal text-muted-foreground tabular-nums">{aside}</span> : null}
      </h2>
      {children}
    </section>
  )
}

export default async function StatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const state = code.toUpperCase()
  const rollup = stateRollup(state)
  if (!rollup) notFound()

  const others = stateTotals()
  const at = others.findIndex((row) => row.code === state)

  return (
    <DocsPage
      title={`Legislative news, ${nameOf(state)}`}
      description={`${rollup.articles.toLocaleString()} articles from ${nameOf(state)}'s own press across ${rollup.days.length} ${rollup.days.length === 1 ? "day" : "days"}, and the bills their stories name.`}
      slug={`/mentions/state/${code}`}
      previous={others[at - 1] ? { name: nameOf(others[at - 1]!.code), url: `/mentions/state/${others[at - 1]!.code.toLowerCase()}` } : { name: "By state", url: "/mentions/state" }}
      next={others[at + 1] ? { name: nameOf(others[at + 1]!.code), url: `/mentions/state/${others[at + 1]!.code.toLowerCase()}` } : { name: "By day", url: "/mentions/day" }}
      rail={
        <nav className="flex flex-col gap-2 px-1 text-sm">
          <span className="font-medium text-foreground">Other jurisdictions</span>
          {others.slice(0, 12).map((row) => (
            <Link
              key={row.code}
              href={`/mentions/state/${row.code.toLowerCase()}`}
              className={row.code === state ? "flex items-center gap-2 text-foreground no-underline" : "flex items-center gap-2 text-muted-foreground no-underline hover:text-foreground"}
            >
              <FlagChip state={row.code} width={18} />
              {nameOf(row.code)}
            </Link>
          ))}
        </nav>
      }
    >
      <div className="not-typeset flex flex-col gap-12">
        <Section title="Bills its coverage names" aside={`${rollup.bills.length} bills`}>
          {rollup.bills.length ? (
            <Panel>
              <ul className="flex flex-col gap-1.5">
                {rollup.bills.map(([label, stories]) => (
                  <li key={label} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-mono">{label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {stories} {stories === 1 ? "story" : "stories"}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <p className="text-sm text-muted-foreground">No story from this state linked to a bill&rsquo;s own page on the days read.</p>
          )}
        </Section>

        <Section title="Its press" aside={`${rollup.outlets.length} outlets`}>
          <Panel>
            <ul className="flex flex-col gap-1.5">
              {rollup.outlets.map((o) => (
                <li key={o.host} className="grid grid-cols-[minmax(0,12rem)_1fr_3.5rem] items-center gap-3 text-sm">
                  <span className="truncate">{o.name}</span>
                  <span className="h-2 rounded-full bg-muted">
                    <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(o.articles / (rollup.outlets[0]?.articles || 1)) * 100}%` }} />
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">{o.articles}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>

        <Section title="Named in it">
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={6} noun="names" className="flex flex-col divide-y divide-border">
              {rollup.names.map((n) => (
                <RecordItem
                  key={n.name}
                  href={n.member ? `/members/${n.member.id}` : `/search?q=${encodeURIComponent(n.name)}`}
                  avatar={n.member ? <MemberPortrait name={n.member.name} photoUrl={n.member.photo} state={n.member.state} chamber={n.member.chamber} size={32} /> : undefined}
                  title={
                    n.member ? (
                      <span className="flex items-center gap-2">
                        <PartyDot party={n.member.party} />
                        {n.name}
                      </span>
                    ) : (
                      n.name
                    )
                  }
                  meta={[`${n.articles} articles`]}
                />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        <Section title="What it published">
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={6} noun="stories" className="flex flex-col divide-y divide-border">
              {rollup.stories.map((story) => (
                <RecordItem key={story.url} href={story.url} external title={story.source} meta={[longDate(story.day), `tone ${story.tone.toFixed(1)}`]} description={story.title} stacked />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        <Section title="Day by day">
          <Panel>
            <ul className="flex flex-col gap-1.5">
              {rollup.days.map((d) => (
                <li key={d.day} className="flex items-baseline justify-between gap-3 text-sm">
                  <Link href={`/mentions/day/${d.day}`} className="no-underline hover:underline">
                    {longDate(d.day)}
                  </Link>
                  <span className="text-muted-foreground tabular-nums">{d.articles} articles</span>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>

        <p className="text-xs text-muted-foreground">
          Method: a story counts for this jurisdiction when the outlet is one of the {nameOf(state)} feeds GovBlock follows, or when the story links to a bill on its legislature&rsquo;s own site. Source: GDELT&rsquo;s knowledge graph,
          across {dayList().length} {dayList().length === 1 ? "day" : "days"} on file.
        </p>
      </div>
    </DocsPage>
  )
}
