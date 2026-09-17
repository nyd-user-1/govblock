import Link from "next/link"

import DEEP from "@/lib/data/deep-lens.json"
import { DocsPage } from "@/components/docs-page"
import { ShowMore } from "@/components/gdelt/sections"
import { ChamberSeal, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"
import { Button } from "@govblock/ui/components/ny4/button"

// Deep Lens (Brendan, 2026-09-16): the paid tier's enrichment, shown on a real
// sample. GovBlock's own nightly read of the news finds which bills the press
// is writing about; Deep Lens asks NewsAPI.ai what that coverage is worth.
// Everything below is one dated read of five bills, stored with the page — the
// page calls nothing, and the live lens runs only for paid accounts.

type Story = { title: string; url: string; source: string; host: string; date: string; image: string | null; sentiment: number | null; importanceRank: number | null; authors: string[]; duplicate: boolean; inGdelt: boolean }
type Member = { id: number; name: string; party: string; role: string; district: string | null; photo: string | null; state: string; chamber: string | null }
type Example = {
  bill: string | null
  title: string
  keyword: string
  window: { start: string; end: string }
  gdelt: { stories: number }
  total: number
  read: number
  duplicates: number
  weightiest: Story[]
  people: { uri: string; label: string; articles: number; member: Member | null }[]
  organisations: { uri: string; label: string; articles: number }[]
  stories: { articles: number; outlets: number; lead: Story }[]
  ahead: { date: string; articles: number; example: { title: string; url: string; source: string } }[]
  gdeltStories: { title: string; url: string; source: string; enriched: Story | null }[]
}

const data = DEEP as unknown as { readAt: string; gdeltDay: string; examples: Example[] }
const byKeyword = (keyword: string) => data.examples.find((e) => e.keyword === keyword)!

const title = "Deep Lens"
const description = "Which coverage of a bill actually matters: outlets weighed by reach, the people in it identified for certain, forty copies of one wire story counted once, and the dates the press says are coming."

export const metadata = { title, description }

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const when = (iso: string) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : "")

function Section({ title, bill, children, method }: { title: string; bill: Example; children: React.ReactNode; method: string }) {
  return (
    <section className="not-typeset flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          {bill.bill ? <ChamberSeal state="US" chamber={bill.bill.startsWith("S.") ? "Senate" : "House"} size={18} /> : null}
          {bill.bill ? `${bill.bill}, ` : ""}
          {bill.keyword}
        </span>
      </div>
      {children}
      <p className="text-xs text-muted-foreground">{method}</p>
    </section>
  )
}

export default function DeepLensPage() {
  const clarity = byKeyword("CLARITY Act")
  const killSwitch = byKeyword("AI Kill Switch Act")
  const save = byKeyword("SAVE America Act")
  const farm = byKeyword("farm bill")
  const disclose = byKeyword("DISCLOSE Act")

  return (
    <DocsPage title={title} description={description} slug="/deep-lens" previous={{ name: "Mentions", url: "/mentions" }} next={{ name: "Sources", url: "/sources" }}>
      <div className="not-typeset flex flex-col gap-12">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/plan">Deep Lens is on the paid plan</Link>
          </Button>
          <Button size="sm" variant="secondary" className="shadow-none" asChild>
            <Link href="/mentions/day/2026-09-15">The day these bills were found</Link>
          </Button>
        </div>

        <Section
          title="Weighed by who published it"
          bill={clarity}
          method={`Ordered by the outlet's importance rank, lowest first. ${clarity.total.toLocaleString()} articles named the bill between ${when(clarity.window.start)} and ${when(clarity.window.end)}.`}
        >
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={6} noun="articles" className="flex flex-col divide-y divide-border">
              {clarity.weightiest.map((a) => (
                <RecordItem key={a.url} href={a.url} external title={a.source} lead={a.importanceRank ? `rank ${a.importanceRank.toLocaleString()}` : null} meta={[when(a.date), a.authors[0]]} description={a.title} stacked />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        <Section
          title="The right person, every time"
          bill={save}
          method="Each person is resolved to one Wikipedia entry, so a common surname never lands on the wrong member; sitting members link to their page here."
        >
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={8} noun="people" className="flex flex-col divide-y divide-border">
              {save.people.map((p) => (
                <RecordItem
                  key={p.uri}
                  href={p.member ? `/members/${p.member.id}` : p.uri}
                  external={!p.member}
                  avatar={p.member ? <MemberPortrait name={p.member.name} photoUrl={p.member.photo} state={p.member.state} chamber={p.member.chamber} size={32} /> : undefined}
                  title={
                    p.member ? (
                      <span className="flex items-center gap-2">
                        <PartyDot party={p.member.party} />
                        {p.label}
                      </span>
                    ) : (
                      p.label
                    )
                  }
                  meta={[`${p.articles} articles`, p.member ? (p.member.role === "Sen" ? "Senator" : "Representative") : null, p.member?.district, p.uri.replace("http://en.wikipedia.org/wiki/", "wikipedia/")]}
                />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        <Section
          title="One story, not forty copies"
          bill={killSwitch}
          method={`${killSwitch.duplicates} of the ${killSwitch.read} articles read were copies of another article. Stories are articles filed under the same event, however many outlets ran them.`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
              <span className="text-3xl font-semibold tabular-nums">{Math.round((killSwitch.duplicates / killSwitch.read) * 100)}%</span>
              <span className="text-sm text-muted-foreground">of the coverage was copies</span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
              <span className="text-3xl font-semibold tabular-nums">{clarity.stories.length ? clarity.stories.reduce((n, s) => n + s.articles, 0) : 0}</span>
              <span className="text-sm text-muted-foreground">
                {clarity.keyword} articles in {clarity.stories.length} stories
              </span>
            </div>
          </div>
          <RecordList className="mt-0 mb-0">
            {[...killSwitch.stories, ...clarity.stories].slice(0, 6).map((s) => (
              <RecordItem key={s.lead.url} href={s.lead.url} external title={s.lead.source} lead={`${s.articles} articles, ${s.outlets} outlets`} description={s.lead.title} stacked />
            ))}
          </RecordList>
        </Section>

        <Section title="What the press says is coming" bill={farm} method="Dates written in the articles themselves, from today on, with the article that named each one first.">
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={6} noun="dates" className="flex flex-col divide-y divide-border">
              {[...farm.ahead, ...save.ahead.filter((d) => d.articles > 1)].map((d) => (
                <RecordItem key={`${d.date}-${d.example.url}`} href={d.example.url} external title={when(d.date)} lead={`${d.articles} ${d.articles === 1 ? "article" : "articles"}`} meta={[d.example.source]} description={d.example.title} stacked />
              ))}
            </ShowMore>
          </RecordList>
        </Section>

        <Section
          title="GovBlock's finds, enriched"
          bill={disclose}
          method={`GovBlock's nightly read found these stories by their link to the bill on congress.gov, on ${when(data.gdeltDay)}. Deep Lens matched them by address or headline and added what the read alone cannot see.`}
        >
          <RecordList className="mt-0 mb-0">
            {[...disclose.gdeltStories, ...killSwitch.gdeltStories].filter((s) => s.enriched).map((s) => (
              <RecordItem
                key={s.url}
                href={s.url}
                external
                title={s.enriched!.source}
                lead={s.enriched!.importanceRank ? `rank ${s.enriched!.importanceRank.toLocaleString()}` : null}
                meta={[s.enriched!.authors[0], s.enriched!.sentiment !== null ? `sentiment ${s.enriched!.sentiment > 0 ? "+" : ""}${s.enriched!.sentiment}` : null, s.enriched!.duplicate ? "a copy" : "original"]}
                description={s.title}
                stacked
              />
            ))}
          </RecordList>
        </Section>

        <p className="text-xs text-muted-foreground">
          A sample: five bills, read once on {when(data.readAt.slice(0, 10))} from NewsAPI.ai and stored with this page. The live lens reads any bill on request for paid accounts.
        </p>
      </div>
    </DocsPage>
  )
}
