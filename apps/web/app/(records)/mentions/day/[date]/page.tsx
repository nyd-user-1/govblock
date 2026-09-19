import { notFound } from "next/navigation"
import Link from "next/link"

import { DocsPage } from "@/components/docs-page"
import { dayHours, dayList, dayNames, dayQuotes, daySpread, dayThemes, getDay } from "@/lib/gdelt/days"
import { BinChart, HourChart, SpreadChart } from "@/components/gdelt/charts"
import { ShowMore } from "@/components/gdelt/sections"
import { ChamberSeal, FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { stateName } from "@/lib/filters"

// A day of legislative news (Brendan, 2026-09-16: "build daily round up"),
// read out of GDELT's own 15-minute files the morning after. What moved, which
// bills the press wrote about, who was quoted, what travelled and how far.
// The day file is on disk; this page calls nothing.

// Rendered on first request, not at build (2026-09-19): the build wrote every
// day and state page with its data, 37 MB of the 234.9 MB Amplify refused
// against its 230.7 MB cap (job 287). A day the nightly job adds renders the
// same way.

export function generateStaticParams() {
  return []
}

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const longDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}`

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  return { title: `Legislative news, ${longDate(date)}`, description: "What the American press published about legislation that day, and which bills it wrote about." }
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

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params
  const day = getDay(date)
  if (!day) notFound()

  const days = dayList()
  const at = days.indexOf(date)
  const quotes = dayQuotes(day)
  const names = dayNames(day)
  const themes = dayThemes(day)
  const spread = daySpread(day)
  const hours = dayHours(day)

  return (
    <DocsPage
      title={`Legislative news, ${longDate(date)}`}
      description={`${day.articles.toLocaleString()} articles on legislation, ${day.billCount} bills the coverage linked to or named, ${day.quoteCount} quotations and ${day.events.kept} public appeals to a legislature.`}
      slug={`/mentions/day/${date}`}
      previous={days[at + 1] ? { name: longDate(days[at + 1]!), url: `/mentions/day/${days[at + 1]}` } : { name: "Every day", url: "/mentions/day" }}
      next={days[at - 1] ? { name: longDate(days[at - 1]!), url: `/mentions/day/${days[at - 1]}` } : { name: "By state", url: "/mentions/state" }}
      rail={
        <nav className="flex flex-col gap-2 px-1 text-sm">
          <span className="font-medium text-foreground">Other days</span>
          {days.slice(0, 10).map((other) => (
            <Link key={other} href={`/mentions/day/${other}`} className={other === date ? "text-foreground no-underline" : "text-muted-foreground no-underline hover:text-foreground"}>
              {longDate(other)}
            </Link>
          ))}
          <Link href="/mentions/state" className="mt-2 text-muted-foreground no-underline hover:text-foreground">
            By state
          </Link>
        </nav>
      }
    >
      <div className="not-typeset flex flex-col gap-12">
        <Section title="Bills the press wrote about" aside={`${day.billCount} bills`}>
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={8} noun="bills" className="flex flex-col divide-y divide-border">
              {day.bills.map((bill) => (
                <RecordItem
                  key={`${bill.state}-${bill.label}`}
                  href={bill.link}
                  external
                  avatar={/^(H\.|S\.)/.test(bill.label) && bill.state === "US" ? <ChamberSeal state="US" chamber={bill.label.startsWith("H") ? "House" : "Senate"} size={32} /> : <FlagChip state={bill.state} width={28} />}
                  title={bill.label}
                  lead={bill.stories[0]?.title ?? null}
                  meta={[
                    bill.state === "US" ? "Congress" : stateName(bill.state),
                    bill.byLink ? `${bill.byLink} linked to it` : null,
                    bill.byName ? `${bill.byName} named it` : null,
                    bill.byLink === undefined ? `${bill.stories.length} ${bill.stories.length === 1 ? "story" : "stories"}` : null,
                  ]}
                />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        <Section title="Quoted that day" aside={`${day.quoteCount} quotations`}>
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={6} noun="quotes" className="flex flex-col divide-y divide-border">
              {quotes.map((q) => (
                <RecordItem key={`${q.url}-${q.quote.slice(0, 24)}`} href={q.url} external title={q.speaker} meta={[q.host]} description={`“${q.quote}”`} stacked />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        <Section title="Named in the coverage">
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={8} noun="names" className="flex flex-col divide-y divide-border">
              {names.map((n) => (
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
                  meta={[`${n.articles} articles`, n.member ? (n.member.role === "Sen" ? "Senator" : "Representative") : null, n.member?.district]}
                />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        {spread ? (
          <Section title="What travelled furthest" aside={`${spread.total} articles, ${spread.outlets} outlets`}>
            <Panel>
              <span className="text-sm">
                <span className="font-medium">{spread.event.from}</span> <span className="text-muted-foreground">→</span> <span className="font-medium">{spread.event.to}</span>{" "}
                <span className="text-muted-foreground">· {spread.event.label}</span>
              </span>
              <SpreadChart rows={spread.curve} />
              <span className="text-xs text-muted-foreground tabular-nums">{spread.lede} of them led with it</span>
            </Panel>
          </Section>
        ) : null}

        <Section title="Pressure on legislatures" aside={`${day.events.kept} events`}>
          <Panel className="p-0">
            <ShowMore initial={6} noun="events" className="flex flex-col divide-y">
              {day.events.rows.map((r) => (
                <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-1 px-4 py-2.5 text-sm no-underline hover:bg-muted/40">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{r.from}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-foreground">{r.to}</span>
                  </span>
                  <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>{r.label}</span>
                    <span className="tabular-nums">tone {r.tone.toFixed(1)}</span>
                    <span className="tabular-nums">{r.mentions} mentions</span>
                  </span>
                </a>
              ))}
            </ShowMore>
          </Panel>
        </Section>

        <Section title="The day's shape">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <BinChart rows={day.toneBins.map(([bin, articles]) => ({ bin, articles }))} />
              <span className="text-xs text-muted-foreground tabular-nums">Tone of every legislative article, averaging {day.tone}</span>
            </Panel>
            <Panel>
              <HourChart rows={hours} />
              <span className="text-xs text-muted-foreground">Filed by the hour, Eastern</span>
            </Panel>
          </div>
          <Panel>
            <div className="flex flex-wrap gap-2">
              {themes.map((t) => (
                <span key={t.code} className="rounded-md border px-2 py-1 text-sm">
                  {t.theme} <span className="text-muted-foreground tabular-nums">{t.articles}</span>
                </span>
              ))}
            </div>
          </Panel>
        </Section>

        <Section title="By state" aside={`${day.states.length} states`}>
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={8} noun="states" className="flex flex-col divide-y divide-border">
              {day.states.map((s) => (
                <RecordItem
                  key={s.code}
                  href={`/mentions/state/${s.code.toLowerCase()}`}
                  avatar={<FlagChip state={s.code} width={28} />}
                  title={s.code === "US" ? "Congress" : stateName(s.code)}
                  lead={s.stories[0]?.title ?? null}
                  meta={[`${s.articles} articles`, s.outlets.length ? `${s.outlets.length} outlets` : null, s.bills.length ? `${s.bills.length} bills` : null]}
                />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        <p className="text-xs text-muted-foreground">
          Method: GDELT&rsquo;s knowledge graph, event table, mentions table and quotation graph for {longDate(date)}, one slice every {day.every * 15} minutes ({day.slices} of the day&rsquo;s 96), filtered to legislation and written to
          disk on {day.readAt} UTC. {(Object.values(day.bytes).reduce((n, v) => n + v, 0) / 1e6).toFixed(0)} MB read, {(JSON.stringify(day).length / 1024).toFixed(0)} KB kept; the raw files were deleted.
        </p>
      </div>
    </DocsPage>
  )
}
