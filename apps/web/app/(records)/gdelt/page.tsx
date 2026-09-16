import type { ReactNode } from "react"

import { DocsPage } from "@/components/docs-page"
import { attention, comparison, framing, headlines, members, moodByFrame, moodByOutlet, moods, outlets, phrase, programs, scoreSpread, sentences, span, standing, syndicated, television, tone, tvSpan, world } from "@/lib/gdelt/sample"
import { cost, files, linkedBills, money, namesInCoverage, organisations, pressure, publishingHours, quotes as fileQuotes, reporters, spread, themes as fileThemes, toneSpread } from "@/lib/gdelt/files"
import { countryFlag } from "@/lib/gdelt/derive"
import { AttentionChart, BinChart, CompareChart, HourChart, ScoreChart, SpreadChart, StackedWeeks, ToneChart, ToneHistogram } from "@/components/gdelt/charts"
import { Question, ShowMore } from "@/components/gdelt/sections"
import { CardBlock, type CardSpec } from "@/components/policy/card-block"
import { ChamberSeal, FlagChip, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { RecordItem, RecordList } from "@/components/policy/record-item"

// /gdelt (Brendan, 2026-09-15, 2026-09-16): what GDELT can tell a bill page,
// every use case laid out as a question a reader might ask, so the page can be
// cut down to the ones worth keeping. Two halves: what the APIs answer for one
// bill, and what the 15-minute files hold for legislation as a whole. Both are
// snapshots on disk (scripts/gdelt/sample.mjs, scripts/gdelt/files.mjs) —
// nothing here calls GDELT or reads the database when the page loads.

const title = "GDELT"
const description = "What the world's news says about a bill, and how it travelled: one bill's coverage read through GDELT's APIs, and every legislative story in GDELT's own files, measured rather than assumed."

export const metadata = { title, description }

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const when = (iso: string) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : "")
const host = (url: string) => {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return url
  }
}

const Panel = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`flex flex-col gap-4 rounded-2xl border bg-card p-4 ${className}`}>{children}</div>

function Marked({ text }: { text: string }) {
  const parts = text.split(/(Safeguard American Voter Eligibility(?: \(SAVE(?: America)?\))? Act|SAVE(?: America)? Act)/i)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded bg-primary/15 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  )
}

function Bars({ rows }: { rows: { key: string; label: ReactNode; value: number; shown: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="flex min-w-0 items-center gap-2 truncate">{r.label}</span>
          <span className="h-2 rounded-full bg-muted">
            <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(r.value / max) * 100}%` }} />
          </span>
          <span className="text-right text-muted-foreground tabular-nums">{r.shown}</span>
        </li>
      ))}
    </ul>
  )
}

function MoodBar({ label, tally }: { label: string; tally: { negative: number; neutral: number; positive: number } }) {
  const total = tally.negative + tally.neutral + tally.positive || 1
  const parts = [
    { key: "negative", n: tally.negative, className: "bg-destructive/80" },
    { key: "neutral", n: tally.neutral, className: "bg-muted-foreground/30" },
    { key: "positive", n: tally.positive, className: "bg-[oklch(0.65_0.15_150)]" },
  ]
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex h-3 overflow-hidden rounded-full">
        {parts.map((p) => (p.n ? <span key={p.key} className={p.className} style={{ width: `${(p.n / total) * 100}%` }} /> : null))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{tally.negative} negative</span>
        <span>{tally.neutral} neutral</span>
        <span>{tally.positive} positive</span>
      </div>
    </div>
  )
}

/** A card's picture, or GovBlock's mark where the outlet published none. */
function Media({ src }: { src: string | null }) {
  if (!src) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-muted">
        <img src="/logo.svg" alt="" className="m-0 size-8 opacity-40" />
      </span>
    )
  }
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className="m-0 size-full object-cover" />
}

export default function GdeltPage() {
  const curve = attention()
  const news = headlines()
  const mood = tone()
  const press = outlets()
  const tv = television()
  const said = sentences()
  const beside = comparison()
  const countries = world()
  const feeling = moods()
  const frames = framing()
  const stands = standing()
  const named = members()
  const copies = syndicated()
  const shows = programs()
  const scores = scoreSpread()
  const byOutlet = moodByOutlet()
  const byFrame = moodByFrame()
  const linked = linkedBills()
  const bylines = reporters()
  const hours = publishingHours()
  const names = namesInCoverage()
  const orgs = organisations()
  const subjects = fileThemes()
  const quoted = fileQuotes()
  const amounts = money()
  const push = pressure()
  const ripple = spread()
  const tones = toneSpread()
  const bill = cost()

  const headlineCards: CardSpec[] = (news ?? []).map((a) => ({
    key: a.url,
    href: a.url,
    title: a.title,
    media: <Media src={a.image} />,
    meta: `${a.domain} · ${when(a.date)}`,
  }))

  const clipCards: CardSpec[] = (tv?.clips ?? []).map((c) => ({
    key: `${c.url}-${c.snippet.slice(0, 24)}`,
    href: c.url,
    title: c.show,
    media: <Media src={c.thumb} />,
    meta: `${c.station} · ${when(c.date)}`,
  }))

  const billCards: CardSpec[] = linked.map((row) => ({
    key: `${row.link}-${row.url}`,
    href: row.url,
    title: row.title || host(row.url),
    media: (
      <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/50">
        {/^(H\.|S\.)/.test(row.bill.label) ? <ChamberSeal state="US" chamber={row.bill.label.startsWith("H") ? "House" : "Senate"} size={44} /> : <FlagChip state={row.bill.where.length === 2 ? row.bill.where : "US"} width={44} />}
        <span className="font-mono text-sm font-semibold text-foreground">{row.bill.label}</span>
      </span>
    ),
    meta: `${row.bill.where} · ${row.host}`,
  }))

  const quoteCards: CardSpec[] = quoted.map((q) => ({
    key: `${q.url}-${q.quote.slice(0, 24)}`,
    href: q.url,
    title: `“${q.quote.slice(0, 120)}${q.quote.length > 120 ? "…" : ""}”`,
    media: <Media src={null} />,
    meta: q.pre ? `…${q.pre.slice(-60)}` : q.host,
  }))

  return (
    <DocsPage
      title={title}
      description={description}
      slug="/gdelt"
      previous={{ name: "Sources", url: "/sources" }}
      next={{ name: "Changelog", url: "/changelog" }}
      rail={
        <nav className="flex flex-col gap-2 px-1 text-sm">
          <span className="font-medium text-foreground">On this page</span>
          <a href="#q1" className="text-muted-foreground no-underline hover:text-foreground">
            One bill&rsquo;s coverage
          </a>
          <a href="#q13" className="text-muted-foreground no-underline hover:text-foreground">
            All legislative coverage
          </a>
          <a href="#read" className="text-muted-foreground no-underline hover:text-foreground">
            How to read this page
          </a>
        </nav>
      }
    >
      <div className="not-typeset flex flex-col gap-12">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <code className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-foreground">{phrase}</code>
          <span>
            {when(span.start)} – {when(span.end)}
          </span>
        </div>

        <Question
          n={1}
          question="How much attention has this bill had?"
          aside={curve ? `${curve.total.toLocaleString()} articles` : undefined}
          answer={
            <p>
              GDELT counts every article it monitors, so a bill&rsquo;s coverage can be read as a <strong>share of all US news</strong> rather than a raw number that rises and falls with the news cycle. This bill drew{" "}
              {curve?.total.toLocaleString()} articles over the year, with {curve?.surges} days at three times its own median. The dotted line is the day the bill was introduced — the peaks sit nowhere near it, which is the finding: this
              coverage is driven by events outside Congress.
            </p>
          }
          method={<>Method: daily article counts divided by all US articles GDELT monitored that day. Source: GDELT DOC 2.0 API, <code>timelinevolraw</code>, September 15, 2025 to September 15, 2026; bill actions from congress_bill_actions.</>}
        >
          {curve ? (
            <Panel>
              <AttentionChart rows={curve.rows} peaks={curve.peaks} actions={curve.actions} />
              <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <li className="rounded-md border px-2 py-1 tabular-nums">
                  Last 30 days: {curve.last30.toLocaleString()}
                  {curve.change !== null ? `, ${curve.change > 0 ? "+" : ""}${curve.change}% on the 30 before` : ""}
                </li>
                <li className="rounded-md border px-2 py-1 tabular-nums">{curve.surges} surge days, median {curve.median} a day</li>
                {curve.peaks.map((p) => (
                  <li key={p.date} className="rounded-md border px-2 py-1 tabular-nums">
                    {when(p.date)} · {p.articles}
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </Question>

        <Question
          n={2}
          question="What is the press actually publishing about it?"
          aside={news ? `${news.length} articles` : undefined}
          answer={
            <p>
              The newest articles naming the bill, each linked to its outlet, with the picture the outlet chose for social sharing. Cards with a picture come first; the ones without carry GovBlock&rsquo;s mark instead. This is the raw
              material behind every other panel on the page.
            </p>
          }
          method={<>Method: the article list, newest first, one card per address. Source: GDELT Context API (sentence-level), read September 15, 2026; the DOC API&rsquo;s own article list was rate-limited at the time of the snapshot.</>}
        >
          <CardBlock cards={headlineCards} initial={4} framed={false} empty="No articles in the snapshot." />
        </Question>

        <Question
          n={3}
          question="Does the coverage read for it or against it?"
          answer={
            <p>
              Two different things are measured here. GDELT&rsquo;s own <strong>tone</strong> is a score it puts on every article it reads. Beside it is a <strong>word-list score</strong> GovBlock runs over the sentences that name the bill,
              which is cheap and transparent but blunt: a supporter saying &ldquo;we couldn&rsquo;t pass the act&rdquo; scores negative. The framing split at the bottom is the more honest political signal — which side&rsquo;s vocabulary
              a sentence uses.
            </p>
          }
          method={<>Method: GDELT tone per article; GovBlock&rsquo;s score sums weighted words and flips them after a negator. Sources: GDELT DOC 2.0 <code>timelinetone</code>; the 29 sentences from the Context API.</>}
        >
          {feeling ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <MoodBar label="Press sentences" tally={feeling.press} />
                  <MoodBar label="TV captions" tally={feeling.tv} />
                  {scores ? <ScoreChart rows={scores} /> : null}
                </Panel>
                <Panel>
                  <div className="flex flex-col gap-4 text-sm">
                    {[
                      { label: "Hardest on the bill", list: feeling.negative, tone: "text-destructive", mark: "▼" },
                      { label: "Warmest on the bill", list: feeling.positive, tone: "text-[oklch(0.55_0.15_150)]", mark: "▲" },
                    ].map(({ label, list, tone: toneClass, mark }) => (
                      <div key={label} className="flex flex-col gap-2">
                        <span className={`flex items-center gap-1.5 text-xs font-semibold ${toneClass}`}>
                          <span aria-hidden="true">{mark}</span>
                          {label}
                        </span>
                        {list.slice(0, 2).map((s) => (
                          <p key={s.url + s.sentence} className="text-sm text-foreground">
                            <Marked text={s.sentence} />
                            <span className={`ml-1.5 font-mono text-xs ${toneClass} tabular-nums`}>{s.score > 0 ? `+${s.score}` : s.score}</span>
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>
              {mood?.rows ? (
                <Panel>
                  <ToneChart rows={mood.rows} />
                  <span className="text-xs text-muted-foreground">GDELT&rsquo;s own tone, averaged daily, across the year</span>
                </Panel>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  {byOutlet ? (
                    <Bars rows={byOutlet.map((o) => ({ key: o.domain, label: <span className="truncate font-mono text-xs">{o.domain}</span>, value: Math.abs(o.average), shown: o.average > 0 ? `+${o.average}` : String(o.average) }))} />
                  ) : null}
                </Panel>
                <Panel>
                  {byFrame ? (
                    <div className="flex flex-col gap-3 text-sm">
                      {byFrame.map((f) => (
                        <div key={f.key} className="flex flex-col gap-1">
                          <span className="font-medium">{f.label}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {f.sentences} sentences · average {f.average > 0 ? `+${f.average}` : f.average} · {f.negative} negative, {f.positive} positive
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {mood?.bins.length ? <ToneHistogram bins={mood.bins} /> : null}
                </Panel>
              </div>
            </div>
          ) : null}
        </Question>

        <Question
          n={4}
          question="Which outlets are carrying it?"
          answer={
            <p>
              The outlets that ran the bill most often. A flag marks the ones GovBlock already follows by feed, which is how you tell borrowed national coverage from a state&rsquo;s own press paying attention.
            </p>
          }
          method={<>Method: articles grouped by web address. Source: the snapshot&rsquo;s article list, matched against the 144 feeds in lib/data/news-feeds.json.</>}
        >
          {press ? (
            <Panel>
              <ShowMore initial={10} noun="outlets" className="flex flex-col gap-1.5">
                {press.map((o) => (
                  <div key={o.domain} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      {o.feed ? <FlagChip state={o.feed.state} width={20} className="shrink-0" /> : <span className="w-5 shrink-0" />}
                      <span className="truncate font-mono text-xs">{o.domain}</span>
                    </span>
                    <span className="h-2 rounded-full bg-muted">
                      <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(o.articles / (press[0]?.articles || 1)) * 100}%` }} />
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">{o.articles}</span>
                  </div>
                ))}
              </ShowMore>
            </Panel>
          ) : null}
        </Question>

        <Question
          n={5}
          question="Did it reach television?"
          aside={`${when(tvSpan.start)} – ${when(tvSpan.end)}`}
          answer={
            <p>
              Which networks said the bill&rsquo;s name, how often, and the clips themselves with their captions — each opening at the Internet Archive at the moment it was said. Read the dates: <strong>GDELT&rsquo;s television archive
              stops on October 11, 2024</strong>, so this is the 2024 House fight, not this year&rsquo;s. Nothing newer exists in any GDELT television feed, the ngram files included.
            </p>
          }
          method={<>Method: mentions per network summed by week; each network&rsquo;s share of all its coverage; one clip per station, show and caption. Source: GDELT TV 2.0 API (<code>timelinevol</code>, <code>stationchart</code>, <code>clipgallery</code>), national market.</>}
        >
          {tv ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                  <StackedWeeks weeks={tv.weeks} keys={tv.networks.map((_, i) => `n${i}`)} names={tv.networks} />
                </Panel>
                <Panel>
                  <Bars rows={tv.stations.map((s) => ({ key: s.station, label: s.station, value: s.share, shown: `${s.share}%` }))} />
                  {shows ? (
                    <ShowMore initial={4} noun="programmes" className="flex flex-col gap-1 border-t pt-3 text-sm">
                      {shows.map((p) => (
                        <div key={p.station + p.show} className="flex items-baseline justify-between gap-3">
                          <span className="truncate">{p.show}</span>
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {p.station} · {p.clips}
                          </span>
                        </div>
                      ))}
                    </ShowMore>
                  ) : null}
                </Panel>
              </div>
              <CardBlock cards={clipCards} initial={4} framed={false} empty="No clips." />
            </div>
          ) : null}
        </Question>

        <Question
          n={6}
          question="What exactly are they saying about it?"
          aside={said ? `${said.length} sentences` : undefined}
          answer={
            <p>
              Every sentence in the press that names the bill, with the bill&rsquo;s name marked. This is the one thing the volume charts cannot give: the actual claim being made, in the outlet&rsquo;s own words, which is what a reader
              needs to judge whether &ldquo;coverage&rdquo; means scrutiny or a passing mention.
            </p>
          }
          method={<>Method: sentence-level matches, one per distinct sentence, so a wire story repeated by twenty sites appears once. Source: GDELT Context API, read September 15, 2026.</>}
        >
          <RecordList className="mt-0 mb-0">
            <ShowMore initial={6} noun="sentences" className="flex flex-col divide-y divide-border">
              {(said ?? []).map((s) => (
                <RecordItem
                  key={s.url + s.sentence}
                  href={s.url}
                  external
                  title={s.domain}
                  meta={[when(s.date), s.quote ? "a direct quote" : null]}
                  description={<Marked text={s.sentence} />}
                  stacked
                />
              ))}
            </ShowMore>
          </RecordList>
        </Question>

        <Question
          n={7}
          question="Whose language is the coverage using?"
          answer={
            <p>
              The same bill is &ldquo;election integrity&rdquo; in one story and &ldquo;voting restrictions&rdquo; in another. Counting which vocabulary a sentence reaches for is a better measure of a story&rsquo;s politics than any
              sentiment score, because the words are the position.
            </p>
          }
          method={<>Method: each sentence matched against two phrase lists drawn from the coverage itself; a sentence can match both. Source: the snapshot&rsquo;s sentences; lists in lib/gdelt/derive.ts.</>}
        >
          {frames ? (
            <div className="grid gap-4 md:grid-cols-2">
              {frames.map((f) => (
                <Panel key={f.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {f.count} of {said?.length ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {f.terms.map(([term, n]) => (
                      <span key={term} className="rounded-md border px-1.5 py-0.5 text-xs">
                        {term} <span className="text-muted-foreground tabular-nums">{n}</span>
                      </span>
                    ))}
                  </div>
                  {f.example ? (
                    <p className="text-sm text-muted-foreground">
                      <Marked text={f.example} />
                    </p>
                  ) : null}
                </Panel>
              ))}
            </div>
          ) : null}
        </Question>

        <Question
          n={8}
          question="Where does the coverage say the bill stands?"
          answer={
            <p>
              The press describes a bill&rsquo;s fate in a handful of phrases — stalled, died, passed the House, a state&rsquo;s own version. Sorting sentences by those phrases gives a read on the bill&rsquo;s standing that is independent
              of the official action list, and worth having precisely when the two disagree.
            </p>
          }
          method={<>Method: phrase patterns for stalled, moving and state-level action, applied to each sentence. Source: the snapshot&rsquo;s sentences; patterns in lib/gdelt/derive.ts.</>}
        >
          {stands ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { key: "stalled", label: "Stalled", list: stands.groups.stalled },
                { key: "moving", label: "Moving", list: stands.groups.moving },
                { key: "state", label: "In the states", list: stands.groups.state },
              ].map((g) => (
                <Panel key={g.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{g.label}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">{g.list.length}</span>
                  </div>
                  {g.list.slice(0, 2).map((s) => (
                    <p key={s.url + s.sentence} className="text-sm text-muted-foreground">
                      <Marked text={s.sentence} />
                    </p>
                  ))}
                </Panel>
              ))}
            </div>
          ) : null}
        </Question>

        <Question
          n={9}
          question="Which members of Congress are in the story?"
          aside={named?.length ? `${named.length} members` : undefined}
          answer={
            <p>
              The sitting members the coverage names, each linked to their page here. A member can be in a bill&rsquo;s news without being a sponsor or casting a vote — as its loudest opponent, or as the one asked about it on camera — and
              that is a relationship the official record never holds.
            </p>
          }
          method={<>Method: full names, plus last names only one sitting member has, matched against the member list; television captions matched by full name only. Source: the snapshot&rsquo;s sentences and clip captions; members from lib/data/members-us.json.</>}
        >
          {named?.length ? (
            <RecordList className="mt-0 mb-0">
              {named.map(({ member, press: inPrint, tv: onTv }) => (
                <RecordItem
                  key={member.id}
                  href={`/members/${member.id}`}
                  avatar={<MemberPortrait name={member.name} photoUrl={member.photo} state={member.state} chamber={member.chamber} size={36} />}
                  title={
                    <span className="flex items-center gap-2">
                      <PartyDot party={member.party} />
                      {member.name}
                    </span>
                  }
                  meta={[member.role === "Sen" ? "Senator" : "Representative", member.district, inPrint ? `${inPrint} in print` : null, onTv ? `${onTv} on television` : null]}
                />
              ))}
            </RecordList>
          ) : null}
        </Question>

        <Question
          n={10}
          question="How much of it is the same story twice?"
          aside={copies?.length ? `${copies.length} repeated` : undefined}
          answer={
            <p>
              One sentence, word for word, at sixteen public radio stations is one newsroom&rsquo;s work reaching sixteen markets. Without this check, a wire story looks like a wave of independent coverage — and any &ldquo;how much
              attention&rdquo; number is inflated by it.
            </p>
          }
          method={<>Method: identical sentences appearing at more than one outlet. Source: the snapshot&rsquo;s sentence list, grouped by sentence.</>}
        >
          {copies?.length ? (
            <Panel className="p-0">
              <ShowMore initial={3} noun="more" className="flex flex-col divide-y">
                {copies.map((c) => (
                  <div key={c.sentence} className="flex flex-col gap-1.5 px-4 py-3">
                    <p className="text-sm text-foreground">
                      <Marked text={c.sentence} />
                    </p>
                    <span className="flex flex-wrap gap-1.5">
                      {c.domains.map((d) => (
                        <span key={d} className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                          {d}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </ShowMore>
            </Panel>
          ) : null}
        </Question>

        <Question
          n={11}
          question="How does it compare with other bills on the same subject?"
          answer={
            <p>
              Attention only means something next to something else. Three election bills on one axis show which fight the press is actually having, and a bill that looks busy alone can turn out to be the quiet one.
            </p>
          }
          method={<>Method: weekly article counts for each phrase, US outlets only. Source: GDELT DOC 2.0 <code>timelinevolraw</code>, one call per phrase.</>}
        >
          {beside ? (
            <Panel>
              <CompareChart weeks={beside.weeks} names={beside.names} />
            </Panel>
          ) : null}
        </Question>

        <Question
          n={12}
          question="Who outside the United States is covering it?"
          answer={
            <p>
              GDELT reads 65 languages, so a domestic bill&rsquo;s foreign coverage is measurable. It matters for anything touching trade, immigration or elections: when a bill is being discussed in another country&rsquo;s press, that is a
              fact about the bill.
            </p>
          }
          method={<>Method: coverage volume by the outlet&rsquo;s own country, summed across the year. Source: GDELT DOC 2.0 <code>timelinesourcecountry</code>, no country filter.</>}
        >
          {countries ? (
            <Panel>
              <ShowMore initial={8} noun="countries" className="flex flex-col gap-1.5">
                {countries.map((c) => (
                  <div key={c.country} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <span aria-hidden="true" className="w-5 shrink-0 text-base leading-none">
                        {countryFlag(c.country) ?? ""}
                      </span>
                      <span className="truncate">{c.country}</span>
                    </span>
                    <span className="h-2 rounded-full bg-muted">
                      <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(c.volume / (countries[0]?.volume || 1)) * 100}%` }} />
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">{c.volume.toFixed(2)}</span>
                  </div>
                ))}
              </ShowMore>
            </Panel>
          ) : null}
        </Question>

        <div className="flex flex-col gap-2 border-t pt-10">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Every legislative story, not one bill</h2>
          <p className="text-sm text-muted-foreground">
            The panels above come from GDELT&rsquo;s APIs, which answer questions about one phrase at a time and refuse roughly one call every five minutes. The panels below come from GDELT&rsquo;s own files, which have no limit at all:{" "}
            {files.minutes} minutes of them, read {files.readAt} UTC — {files.articles.read.toLocaleString()} articles on legislation and {files.mentions.read.toLocaleString()} mentions.
          </p>
        </div>

        <Question
          n={13}
          question="Which stories can be tied to a bill with certainty?"
          aside={`${files.billLinkCount} stories`}
          answer={
            <p>
              GDELT records every outbound link in an article. When a story links to a bill&rsquo;s own page on congress.gov or a legislature&rsquo;s site, the story is tied to <strong>that</strong> bill — no phrase matching, no deciding
              whether &ldquo;the SAVE Act&rdquo; means this year&rsquo;s bill or last year&rsquo;s. This is the single most useful thing in any GDELT feed for a bill page.
            </p>
          }
          method={<>Method: the page-links field of every legislative article, matched against bill-page address patterns for Congress, LegiScan and the state legislatures. Source: GDELT Global Knowledge Graph 2.1, {files.minutes} minutes of 15-minute files.</>}
        >
          <CardBlock cards={billCards} initial={4} framed={false} empty="No linked bills in the snapshot." />
        </Question>

        <Question
          n={14}
          question="Who is being quoted on legislation right now?"
          aside={`${files.quoteCount} in ${files.minutes} minutes`}
          answer={
            <p>
              A separate GDELT feed pulls out every quoted sentence in the news, with the hundred characters either side. The words before a quote are nearly always who said it, so a bill page can carry what people actually said about a
              bill, attributed and dated, without a model summarising anything.
            </p>
          }
          method={<>Method: quotes kept when the quote or its introduction names a bill, chamber or lawmaker. Source: GDELT Global Quotation Graph, per-minute files, four minutes read.</>}
        >
          <CardBlock cards={quoteCards} initial={4} framed={false} empty="No quotes in the snapshot." />
        </Question>

        <Question
          n={15}
          question="Who writes the legislative coverage, and when do they file?"
          answer={
            <p>
              GDELT keeps each article&rsquo;s byline and the outlet&rsquo;s own publication timestamp — neither of which any GDELT API returns. Bylines make it possible to see which reporters own a beat; the timestamps show the filing
              day, which is what you would watch to know when a story is about to break.
            </p>
          }
          method={<>Method: bylines and precise publication timestamps from the page-metadata field; bylines counted per outlet. Source: GDELT Global Knowledge Graph 2.1 (authors on 41% of articles, timestamps on 60%).</>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <ShowMore initial={8} noun="reporters" className="flex flex-col gap-1.5">
                {bylines.map((b) => (
                  <div key={`${b.author}-${b.source}`} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="flex min-w-0 flex-col truncate">
                      <span className="truncate">{b.author}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">{b.source}</span>
                    </span>
                    <span className="h-2 rounded-full bg-muted">
                      <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(b.articles / (bylines[0]?.articles || 1)) * 100}%` }} />
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">{b.articles}</span>
                  </div>
                ))}
              </ShowMore>
            </Panel>
            <Panel>
              <HourChart rows={hours} />
              <span className="text-xs text-muted-foreground">Published by the hour, UTC, from each outlet&rsquo;s own timestamp</span>
            </Panel>
          </div>
        </Question>

        <Question
          n={16}
          question="Who is being named in it?"
          answer={
            <p>
              Every proper name and organisation GDELT pulls out of the article text. Sitting members of Congress are linked to their pages here. At scale this is how you would find the people who keep appearing beside a bill without ever
              appearing in its official record — staff, governors, industry groups.
            </p>
          }
          method={<>Method: extracted names and organisations, merged across title variants, places and institutions removed from the people column. Source: GDELT Global Knowledge Graph 2.1, {files.articles.read.toLocaleString()} legislative articles.</>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <ShowMore initial={10} noun="names" className="flex flex-col gap-1.5">
                {names.map((n) => (
                  <div key={n.name} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      {n.member ? (
                        <>
                          <PartyDot party={n.member.party} />
                          <a href={`/members/${n.member.id}`} className="truncate text-foreground no-underline hover:underline">
                            {n.name}
                          </a>
                        </>
                      ) : (
                        <span className="truncate">{n.name}</span>
                      )}
                    </span>
                    <span className="h-2 rounded-full bg-muted">
                      <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(n.articles / (names[0]?.articles || 1)) * 100}%` }} />
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">{n.articles}</span>
                  </div>
                ))}
              </ShowMore>
            </Panel>
            <Panel>
              <ShowMore initial={10} noun="bodies" className="flex flex-col gap-1.5">
                {orgs.map((o) => (
                  <div key={o.name} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="truncate">{o.name}</span>
                    <span className="h-2 rounded-full bg-muted">
                      <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(o.articles / (orgs[0]?.articles || 1)) * 100}%` }} />
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">{o.articles}</span>
                  </div>
                ))}
              </ShowMore>
            </Panel>
          </div>
        </Question>

        <Question
          n={17}
          question="What subjects does legislative news sit under?"
          answer={
            <p>
              GDELT tags every article with subject codes from its own taxonomy of several thousand themes. For a bill page, these are a way to say what a bill&rsquo;s coverage is <em>about</em> without reading it — and a way to find
              related bills whose coverage shares the same themes.
            </p>
          }
          method={<>Method: theme codes counted across the legislative articles, GDELT&rsquo;s internal buckets removed. Source: GDELT Global Knowledge Graph 2.1.</>}
        >
          <Panel>
            <div className="flex flex-wrap gap-2">
              {subjects.map((t) => (
                <span key={t.code} className="rounded-md border px-2 py-1 text-sm">
                  {t.theme} <span className="text-muted-foreground tabular-nums">{t.articles}</span>
                </span>
              ))}
            </div>
          </Panel>
        </Question>

        <Question
          n={18}
          question="What money does the coverage name?"
          answer={
            <p>
              GDELT extracts the numbers an article states, with the words around them. On a bill page this is the figure the press attached to a bill — which is often the only dollar figure a reader ever sees, and rarely the one in the
              bill&rsquo;s own text.
            </p>
          }
          method={<>Method: extracted amounts of 1,000 or more, once per figure, since one wire story runs at dozens of sites. Source: GDELT Global Knowledge Graph 2.1, amounts field.</>}
        >
          <Panel className="p-0">
            <ul className="flex flex-col divide-y">
              {amounts.map((a) => (
                <li key={a.url + a.what} className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
                  <span className="tabular-nums">{a.value.toLocaleString()}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.what}</span>
                  <a href={a.url} target="_blank" rel="noopener noreferrer" className="shrink-0 font-mono text-xs text-muted-foreground no-underline hover:underline">
                    {a.source}
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </Question>

        <Question
          n={19}
          question="Who is pressing legislatures in public?"
          aside={`${push.kept} events, about ${push.perDay.toLocaleString()} a day`}
          answer={
            <p>
              GDELT&rsquo;s event table codes news into who did what to whom. Filtered to a legislature, it becomes a record of public pressure: who appealed to Congress today, who praised it, who accused it — each with a tone score and
              the article it came from. It never names the bill, so it answers &ldquo;how much heat is on this chamber&rdquo;, never &ldquo;about what&rdquo;.
            </p>
          }
          method={<>Method: US-located events whose actors include a legislature; action codes named from GDELT&rsquo;s CAMEO lookup. Source: GDELT 2.0 Event Database, {files.minutes} minutes of 15-minute files.</>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <ShowMore initial={8} noun="kinds" className="flex flex-col gap-1.5">
                {push.types.map((t) => (
                  <div key={t.label} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
                    <span className="truncate">{t.label}</span>
                    <span className="h-2 rounded-full bg-muted">
                      <span className="block h-2 rounded-full bg-primary/70" style={{ width: `${(t.n / (push.types[0]?.n || 1)) * 100}%` }} />
                    </span>
                    <span className="text-right text-muted-foreground tabular-nums">{t.n}</span>
                  </div>
                ))}
              </ShowMore>
            </Panel>
            <Panel className="p-0">
              <ShowMore initial={6} noun="events" className="flex flex-col divide-y">
                {push.rows.map((r) => (
                  <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="flex flex-col gap-1 px-4 py-2.5 text-sm no-underline hover:bg-muted/40">
                    <span className="flex flex-wrap items-center gap-2">
                      {/^(SENATE|SENATOR)/i.test(r.to) ? <ChamberSeal state="US" chamber="Senate" size={20} /> : /^(HOUSE|CONGRESS|SPEAKER|REPRESENTATIVE)/i.test(r.to) ? <ChamberSeal state="US" chamber="House" size={20} /> : null}
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
          </div>
        </Question>

        {ripple ? (
          <Question
            n={20}
            question="How far does one story travel, and who buries it?"
            aside={`${ripple.total} articles, ${ripple.outlets} outlets`}
            answer={
              <p>
                GDELT records every article that repeats an event, not just the first, with the sentence number the mention appears in. That gives two things no volume chart can: the <strong>spread over time</strong>, and{" "}
                <strong>prominence</strong> — whether an outlet led with the story or buried it twenty sentences down. This is the closest thing available to a front-page measurement.
              </p>
            }
            method={<>Method: every mention of the most-repeated legislative event, counted by minute with a running total, split at sentence two. Source: GDELT 2.0 Mentions table.</>}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel>
                <span className="text-sm">
                  <span className="font-medium">{ripple.event.from}</span> <span className="text-muted-foreground">→</span> <span className="font-medium">{ripple.event.to}</span>{" "}
                  <span className="text-muted-foreground">· {ripple.event.label}</span>
                </span>
                <SpreadChart rows={ripple.curve} />
              </Panel>
              <Panel>
                <ul className="flex flex-col gap-1.5 text-sm">
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Led with it</span>
                    <span className="tabular-nums">{ripple.lede}</span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Buried it</span>
                    <span className="tabular-nums">{ripple.buried}</span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Average tone</span>
                    <span className="tabular-nums">{ripple.tone.toFixed(1)}</span>
                  </li>
                </ul>
                <ShowMore initial={12} noun="outlets" className="flex flex-wrap gap-1.5 border-t pt-3">
                  {ripple.sources.map((s) => (
                    <span key={s} className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {s}
                    </span>
                  ))}
                </ShowMore>
              </Panel>
            </div>
          </Question>
        ) : null}

        <Question
          n={21}
          question="Is legislative coverage generally positive or negative?"
          aside={`${files.articles.read.toLocaleString()} articles`}
          answer={
            <p>
              The tone of every legislative article in the window, binned. It is the baseline a single bill&rsquo;s tone should be read against: news about legislation is negative on average, so a bill scoring slightly negative is
              unremarkable and one scoring positive is the outlier.
            </p>
          }
          method={<>Method: GDELT&rsquo;s own tone for each article, rounded to whole numbers and counted. Source: GDELT Global Knowledge Graph 2.1, tone field.</>}
        >
          <Panel>
            <BinChart rows={tones} />
          </Panel>
        </Question>

        <Question
          n={22}
          question="What would it cost to run this every day?"
          answer={
            <p>
              The files are free to download and there is no rate limit, so the only real cost is storage and a few minutes of a box we already run. Keeping the raw files would be {(bill.rawPerYear / 1e9).toFixed(0)} GB a year. Keeping
              only the filtered rows — the legislative articles, the bill links, the quotes, the events — is about {(bill.keptPerYear / 1e9).toFixed(1)} GB a year, which is the same information for our purposes at roughly{" "}
              {Math.round(bill.rawPerYear / bill.keptPerYear)} times less.
            </p>
          }
          method={<>Method: bytes actually downloaded across {bill.minutes} minutes, projected to a day and a year; the kept figure is the size of the filtered snapshot on the same basis. Source: measured September 16, 2026.</>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-0">
              <ul className="flex flex-col divide-y text-sm">
                {bill.read.map((r) => (
                  <li key={r.feed} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                    <span className="capitalize">{r.feed === "gkg" ? "Knowledge graph" : r.feed}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {(r.size / 1e6).toFixed(1)} MB read · {(r.perDay / 1e6).toFixed(0)} MB a day
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <ul className="flex flex-col gap-2 text-sm">
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Downloaded a day</span>
                  <span className="tabular-nums">{(bill.rawPerDay / 1e6).toFixed(0)} MB</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Downloaded a year</span>
                  <span className="tabular-nums">{(bill.rawPerYear / 1e9).toFixed(0)} GB</span>
                </li>
                <li className="flex justify-between gap-3 border-t pt-2">
                  <span className="text-muted-foreground">Kept a day</span>
                  <span className="tabular-nums">{(bill.keptPerDay / 1e6).toFixed(1)} MB</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Kept a year</span>
                  <span className="tabular-nums">{(bill.keptPerYear / 1e9).toFixed(1)} GB</span>
                </li>
              </ul>
            </Panel>
          </div>
        </Question>
      </div>

      <section id="read" className="mt-16 flex scroll-mt-24 flex-col gap-4 border-t pt-10">
        <h2 className="font-heading text-2xl font-semibold tracking-tight">How to read this page</h2>
        <p>
          This is a bench test, not a product. It exists to answer one question — which of GDELT&rsquo;s many feeds is worth wiring into GovBlock permanently — by showing each possible feature built against real data, at the size it
          would actually appear.
        </p>
        <h3 className="font-heading text-lg font-semibold">How it was built</h3>
        <p>
          Two scripts wrote two files. <code>scripts/gdelt/sample.mjs</code> asks GDELT&rsquo;s APIs eleven questions about one bill, the SAVE Act, and saves the answers. <code>scripts/gdelt/files.mjs</code> downloads {files.minutes}{" "}
          minutes of GDELT&rsquo;s own 15-minute files, keeps the rows about legislation, and throws the rest away. The page reads those two files and nothing else: no request here touches GDELT, and none touches the database.
        </p>
        <p>
          That separation is the point. GDELT&rsquo;s APIs turn away a plain script and then allow roughly one article query every five minutes, so nothing built on them can serve a page on demand. Its files have no limit and arrive every
          fifteen minutes, so anything built on them can. Four feeds proved dead on inspection: the Full Text Search API returns no results for any query, the Entity Graph stops in June, the television ngrams stop in October 2024, and the
          Frontpage Graph ships empty files. What is here runs on the four that are alive.
        </p>
        <h3 className="font-heading text-lg font-semibold">How to read it</h3>
        <p>
          Every panel is a question. The heading asks it, the answer is folded away until you want it, and the footnote underneath says how the figure was measured and which feed it came from. Read the questions alone and you have the
          menu; open an answer when a panel looks useful and you get the caveat with it.
        </p>
        <p>
          The first twelve questions are <strong>one bill, deeply</strong>: how much coverage it drew, what was said, by whom, in whose language, where it stands, and how that compares with its rivals. The last ten are{" "}
          <strong>all legislative coverage, broadly</strong>: what the feeds hold for every bill at once, and what running them would cost.
        </p>
        <h3 className="font-heading text-lg font-semibold">How to use it</h3>
        <p>
          Judge each panel against one test: would a reader on a bill page be better off with it than without it? Three earn that on the evidence here. <strong>Question 13</strong> ties a story to a bill by the link the story carries,
          which is certainty no phrase matching can buy. <strong>Question 14</strong> gives attributed quotes about legislation. <strong>Question 1</strong> gives an attention curve that is honest, because it is a share of all coverage
          rather than a raw count, and because question 10 shows how much of any total is a single wire story repeated.
        </p>
        <p>
          The rest are worth looking at once and then arguing about. Some are diagnostics rather than reader features — question 21&rsquo;s baseline tells you how to read any single bill&rsquo;s tone; question 22 tells you what the whole
          thing costs. Some are honest about their limits: question 3&rsquo;s word-list score is blunt, question 19&rsquo;s events never name a bill, and question 5&rsquo;s television data is two years old and will not get newer.
        </p>
        <p>
          Nothing on this page runs on a schedule, and no feature here has been adopted. When a panel is chosen, it moves to a nightly job on the pipeline box — the same shape as the XML pipeline, filtering each fifteen-minute file and
          keeping only the rows a page will read.
        </p>
      </section>
    </DocsPage>
  )
}
