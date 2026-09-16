import type { Metadata } from "next"
import type { ReactNode } from "react"

import { attention, comparison, framing, headlines, members, moodByFrame, moodByOutlet, moods, outlets, phrase, programs, scoreSpread, sentences, span, standing, syndicated, television, tone, tvSpan, world } from "@/lib/gdelt/sample"
import { cost, files, linkedBills, money, namesInCoverage, organisations, pressure, publishingHours, quotes as fileQuotes, reporters, spread, themes as fileThemes, toneSpread } from "@/lib/gdelt/files"
import { AttentionChart, BinChart, CompareChart, HourChart, ScoreChart, SpreadChart, StackedWeeks, ToneChart, ToneHistogram } from "@/components/gdelt/charts"
import { FlagChip } from "@/components/policy/imagery"

// /gdelt (Brendan, 2026-09-15): a sample of every way GovBlock could use
// GDELT, drawn from one snapshot for one bill, to decide what stays and what
// goes on the bill pages. The snapshot is scripts/gdelt/sample.mjs.

export const metadata: Metadata = { title: "GDELT" }

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const when = (iso: string) => (iso ? `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}, ${iso.slice(0, 4)}` : "")

function Marked({ text }: { text: string }) {
  // The bill under every name the coverage gives it: SAVE Act, SAVE America Act, the long title.
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

function Section({ n, title, aside, children }: { n?: number; title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="flex items-baseline gap-3 font-heading text-xl font-semibold tracking-tight">
        {n ? <span className="font-mono text-sm text-muted-foreground tabular-nums">{n}</span> : null}
        {title}
        {aside ? <span className="text-sm font-normal text-muted-foreground">{aside}</span> : null}
      </h2>
      {children}
    </section>
  )
}

const Panel = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`rounded-2xl border bg-card p-4 ${className}`}>{children}</div>

const Waiting = () => <Panel className="text-sm text-muted-foreground">GDELT has not answered this call yet.</Panel>

function MoodBar({ label, tally }: { label: string; tally: { negative: number; neutral: number; positive: number } }) {
  const total = tally.negative + tally.neutral + tally.positive || 1
  const parts = [
    { key: "negative", n: tally.negative, className: "bg-destructive/80" },
    { key: "neutral", n: tally.neutral, className: "bg-muted-foreground/30" },
    { key: "positive", n: tally.positive, className: "bg-[oklch(0.65_0.15_150)]" },
  ]
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex flex-col gap-1">
        <div className="flex h-3 overflow-hidden rounded-full">
          {parts.map((p) => (p.n ? <span key={p.key} className={p.className} style={{ width: `${(p.n / total) * 100}%` }} /> : null))}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{tally.negative} negative</span>
          <span>{tally.neutral} neutral</span>
          <span>{tally.positive} positive</span>
        </div>
      </div>
    </div>
  )
}

const partyTone = (party: string) => (party === "R" ? "text-red-600" : party === "D" ? "text-blue-600" : "text-muted-foreground")

function Bars({ rows }: { rows: { key: string; label: ReactNode; value: number; shown: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,14rem)_1fr_4rem] items-center gap-3 text-sm">
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
  const said2 = fileQuotes()
  const amounts = money()
  const push = pressure()
  const ripple = spread()
  const tones = toneSpread()
  const bill = cost()

  return (
    <div className="container-wrapper">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-10 md:px-6 md:py-14">
        <header className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">GDELT</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <code className="rounded-md border bg-muted px-1.5 py-0.5 font-mono text-foreground">{phrase}</code>
            {when(span.start)} – {when(span.end)}
          </p>
        </header>

        <Section n={1} title="Attention" aside={curve ? `${curve.total.toLocaleString()} US articles` : undefined}>
          {curve ? (
            <Panel className="flex flex-col gap-4">
              <AttentionChart rows={curve.rows} peaks={curve.peaks} actions={curve.actions} />
              <ul className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <li className="rounded-md border px-2 py-1 tabular-nums">
                  Last 30 days: {curve.last30.toLocaleString()} articles
                  {curve.change !== null ? `, ${curve.change > 0 ? "+" : ""}${curve.change}% on the 30 before` : ""}
                </li>
                <li className="rounded-md border px-2 py-1 tabular-nums">
                  {curve.surges} days at three times the median ({curve.median} a day)
                </li>
                {curve.peaks.map((p) => (
                  <li key={p.date} className="rounded-md border px-2 py-1 tabular-nums">
                    Peak {when(p.date)} · {p.articles} articles
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={2} title="Headlines" aside={news ? `${news.length} newest` : undefined}>
          {news ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
              {news.slice(0, 30).map((a) => (
                <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" className="flex flex-col overflow-hidden rounded-2xl border bg-card no-underline hover:border-foreground/20">
                  {a.image ? (
                    <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full bg-muted object-cover" />
                  ) : (
                    <span className="aspect-video w-full bg-muted" />
                  )}
                  <span className="flex flex-col gap-1.5 p-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {a.domain} · {when(a.date)}
                    </span>
                    <span className="line-clamp-3 text-sm font-medium text-foreground">{a.title}</span>
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={3} title="Sentiment">
          {feeling ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel className="flex flex-col gap-5">
                <MoodBar label="Press sentences" tally={feeling.press} />
                <MoodBar label="TV captions" tally={feeling.tv} />
                {mood?.rows ? <ToneChart rows={mood.rows} /> : null}
                {mood?.bins.length ? <ToneHistogram bins={mood.bins} /> : null}
              </Panel>
              <Panel className="flex flex-col gap-5">
                {scores ? <ScoreChart rows={scores} /> : null}
                {byOutlet ? (
                  <Bars rows={byOutlet.map((o) => ({ key: o.domain, label: <span className="truncate font-mono text-xs">{o.domain}</span>, value: Math.abs(o.average), shown: o.average > 0 ? `+${o.average}` : String(o.average) }))} />
                ) : null}
                {byFrame ? (
                  <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                    {byFrame.map((f) => (
                      <div key={f.key} className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{f.label}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {f.sentences} sentences, average {f.average > 0 ? `+${f.average}` : f.average}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {f.negative} negative · {f.positive} positive
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Panel>
              <Panel className="grid gap-4 text-sm sm:grid-cols-2">
                {[
                  { label: "Most negative", list: feeling.negative },
                  { label: "Most positive", list: feeling.positive },
                ].map(({ label, list }) => (
                  <div key={label} className="flex flex-col gap-3">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    {list.map((s) => (
                      <div key={s.url + s.sentence} className="flex flex-col gap-1">
                        <p className="text-foreground">
                          <Marked text={s.sentence} />
                        </p>
                        <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                          <span className="tabular-nums">{s.score > 0 ? `+${s.score}` : s.score}</span>
                          {s.hits.map((h, i) => (
                            <span key={i} className="rounded border px-1">
                              {h}
                            </span>
                          ))}
                          <span className="font-mono">{s.domain}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </Panel>
            </div>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={4} title="Outlets">
          {press ? (
            <Panel>
              <Bars
                rows={press.map((o) => ({
                  key: o.domain,
                  label: (
                    <>
                      {o.feed ? <FlagChip state={o.feed.state} width={20} className="shrink-0 rounded-[2px]" /> : <span className="w-5 shrink-0" />}
                      <span className="truncate font-mono text-xs">{o.domain}</span>
                    </>
                  ),
                  value: o.articles,
                  shown: String(o.articles),
                }))}
              />
            </Panel>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={5} title="Television" aside={`${when(tvSpan.start)} – ${when(tvSpan.end)}`}>
          {tv ? (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
                <Panel>
                  <StackedWeeks weeks={tv.weeks} keys={tv.networks.map((_, i) => `n${i}`)} names={tv.networks} />
                </Panel>
                <Panel>
                  <div className="flex flex-col gap-5">
                    <Bars rows={tv.stations.map((s) => ({ key: s.station, label: s.station, value: s.share, shown: `${s.share}%` }))} />
                    {shows ? (
                      <ul className="flex flex-col gap-1 border-t pt-4 text-sm">
                        {shows.slice(0, 8).map((p) => (
                          <li key={p.station + p.show} className="flex items-baseline justify-between gap-3">
                            <span className="truncate">{p.show}</span>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {p.station} · {p.clips}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </Panel>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                {tv.clips.map((c) => (
                  <a key={`${c.url}-${c.snippet.slice(0, 20)}`} href={c.url} target="_blank" rel="noopener noreferrer" className="flex flex-col overflow-hidden rounded-2xl border bg-card no-underline hover:border-foreground/20">
                    {c.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full bg-muted object-cover" />
                    ) : null}
                    <span className="flex flex-col gap-1.5 p-3">
                      <span className="text-xs text-muted-foreground">
                        {c.station} · {when(c.date)}
                      </span>
                      <span className="line-clamp-1 text-sm font-medium text-foreground">{c.show}</span>
                      <span className="line-clamp-4 text-sm text-muted-foreground">
                        <Marked text={c.snippet} />
                      </span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={6} title="Sentences">
          {said ? (
            <Panel className="p-0">
              <ul className="divide-y">
                {said.slice(0, 30).map((s) => (
                  <li key={s.url + s.sentence} className="flex flex-col gap-1 px-4 py-3">
                    <p className="text-sm text-foreground">
                      <Marked text={s.sentence} />
                    </p>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-muted-foreground no-underline hover:underline">
                      {s.domain} · {when(s.date)}
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={7} title="Framing">
          {frames ? (
            <div className="grid gap-4 md:grid-cols-2">
              {frames.map((f) => (
                <Panel key={f.key} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {f.count} of {said?.length ?? 0} sentences
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
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={8} title="Where it stands">
          {stands ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { key: "stalled", label: "Stalled", list: stands.groups.stalled },
                { key: "moving", label: "Moving", list: stands.groups.moving },
                { key: "state", label: "In the states", list: stands.groups.state },
              ].map((g) => (
                <Panel key={g.key} className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{g.label}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">{g.list.length}</span>
                  </div>
                  {g.list.slice(0, 3).map((s) => (
                    <p key={s.url + s.sentence} className="text-sm text-muted-foreground">
                      <Marked text={s.sentence} />
                    </p>
                  ))}
                </Panel>
              ))}
            </div>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={9} title="Members named">
          {named?.length ? (
            <Panel className="p-0">
              <ul className="divide-y">
                {named.map(({ member, press, tv: onTv }) => (
                  <li key={member.id}>
                    <a href={`/members/${member.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm no-underline hover:bg-muted/40">
                      <span className="flex items-baseline gap-2">
                        <span className="font-medium text-foreground">{member.name}</span>
                        <span className={`text-xs ${partyTone(member.party)}`}>
                          {member.party} · {member.role}
                          {member.district ? ` · ${member.district}` : ""}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {press ? `${press} in print` : ""}
                        {press && onTv ? " · " : ""}
                        {onTv ? `${onTv} on TV` : ""}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={10} title="Syndication">
          {copies?.length ? (
            <Panel className="p-0">
              <ul className="divide-y">
                {copies.map((c) => (
                  <li key={c.sentence} className="flex flex-col gap-1.5 px-4 py-3">
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
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={23} title="Beside other election bills">
          {beside ? (
            <Panel>
              <CompareChart weeks={beside.weeks} names={beside.names} />
            </Panel>
          ) : (
            <Waiting />
          )}
        </Section>

        <div className="flex flex-col gap-3 border-t pt-10">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">From the files</h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground tabular-nums">
            <span>{files.minutes} minutes of GDELT&rsquo;s own files, read {files.readAt} UTC</span>
            <span>·</span>
            <span>{files.articles.read.toLocaleString()} articles on legislation</span>
            <span>·</span>
            <span>{files.mentions.read.toLocaleString()} mentions</span>
          </p>
        </div>

        <Section n={13} title="Tied to a bill by its own link" aside={`${files.billLinkCount} stories`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {linked.map((row) => (
              <div key={row.link + row.url} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <a href={row.link} target="_blank" rel="noopener noreferrer" className="font-mono text-sm font-semibold text-foreground no-underline hover:underline">
                    {row.bill.label}
                  </a>
                  <span className="text-xs text-muted-foreground">{row.bill.where}</span>
                </div>
                <a href={row.url} target="_blank" rel="noopener noreferrer" className="line-clamp-3 text-sm text-foreground no-underline hover:underline">
                  {row.title || row.url}
                </a>
                <span className="mt-auto font-mono text-xs text-muted-foreground">{row.host}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section n={14} title="Quoted on legislation" aside={`${files.quoteCount} in ${files.minutes} minutes`}>
          <div className="grid gap-4 md:grid-cols-2">
            {said2.map((q) => (
              <div key={q.url + q.quote.slice(0, 40)} className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
                {q.pre ? <span className="text-xs text-muted-foreground">…{q.pre}</span> : null}
                <p className="text-sm text-foreground">&ldquo;{q.quote}&rdquo;</p>
                <a href={q.url} target="_blank" rel="noopener noreferrer" className="mt-auto font-mono text-xs text-muted-foreground no-underline hover:underline">
                  {q.host}
                </a>
              </div>
            ))}
          </div>
        </Section>

        <Section n={15} title="Who writes it">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <Bars
                rows={bylines.map((b) => ({
                  key: `${b.author}-${b.source}`,
                  label: (
                    <span className="flex min-w-0 items-baseline gap-2 truncate">
                      <span className="truncate">{b.author}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{b.source}</span>
                    </span>
                  ),
                  value: b.articles,
                  shown: String(b.articles),
                }))}
              />
            </Panel>
            <Panel className="flex flex-col gap-3">
              <HourChart rows={hours} />
              <span className="text-xs text-muted-foreground">Published by the hour, from each outlet&rsquo;s own timestamp</span>
            </Panel>
          </div>
        </Section>

        <Section n={16} title="Named in the coverage">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <Bars
                rows={names.map((n) => ({
                  key: n.name,
                  label: n.member ? (
                    <a href={`/members/${n.member.id}`} className="flex min-w-0 items-baseline gap-2 truncate no-underline hover:underline">
                      <span className="truncate text-foreground">{n.name}</span>
                      <span className={`shrink-0 text-xs ${partyTone(n.member.party)}`}>{n.member.party}</span>
                    </a>
                  ) : (
                    <span className="truncate">{n.name}</span>
                  ),
                  value: n.articles,
                  shown: String(n.articles),
                }))}
              />
            </Panel>
            <Panel>
              <Bars rows={orgs.map((o) => ({ key: o.name, label: <span className="truncate">{o.name}</span>, value: o.articles, shown: String(o.articles) }))} />
            </Panel>
          </div>
        </Section>

        <Section n={17} title="What the coverage is about">
          <Panel>
            <div className="flex flex-wrap gap-2">
              {subjects.map((t) => (
                <span key={t.code} className="rounded-md border px-2 py-1 text-sm">
                  {t.theme} <span className="text-muted-foreground tabular-nums">{t.articles}</span>
                </span>
              ))}
            </div>
          </Panel>
        </Section>

        <Section n={18} title="Money it names">
          <Panel className="p-0">
            <ul className="divide-y">
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
        </Section>

        <Section n={19} title="Pressure on legislatures" aside={`${push.kept} events, about ${push.perDay.toLocaleString()} a day`}>
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Panel>
              <Bars rows={push.types.map((t) => ({ key: t.label, label: <span className="truncate">{t.label}</span>, value: t.n, shown: String(t.n) }))} />
            </Panel>
            <Panel className="p-0">
              <ul className="divide-y">
                {push.rows.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1 px-4 py-2.5 text-sm">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{r.from}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="font-medium">{r.to}</span>
                      <span className="text-muted-foreground">· {r.label}</span>
                    </span>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex flex-wrap gap-2 font-mono text-xs text-muted-foreground no-underline hover:underline">
                      <span className="tabular-nums">tone {r.tone.toFixed(1)}</span>
                      <span className="tabular-nums">{r.mentions} mentions</span>
                      <span className="tabular-nums">{r.sources} outlets</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </Section>

        {ripple ? (
          <Section n={20} title="How one story spread" aside={`${ripple.total} articles, ${ripple.outlets} outlets`}>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Panel className="flex flex-col gap-3">
                <span className="text-sm">
                  <span className="font-medium">{ripple.event.from}</span> <span className="text-muted-foreground">→</span> <span className="font-medium">{ripple.event.to}</span>{" "}
                  <span className="text-muted-foreground">· {ripple.event.label}</span>
                </span>
                <SpreadChart rows={ripple.curve} />
              </Panel>
              <Panel className="flex flex-col gap-4">
                <ul className="flex flex-col gap-1.5 text-sm">
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">In the first two sentences</span>
                    <span className="tabular-nums">{ripple.lede}</span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Further down</span>
                    <span className="tabular-nums">{ripple.buried}</span>
                  </li>
                  <li className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Average tone</span>
                    <span className="tabular-nums">{ripple.tone.toFixed(1)}</span>
                  </li>
                </ul>
                <div className="flex flex-wrap gap-1.5 border-t pt-3">
                  {ripple.sources.map((s) => (
                    <span key={s} className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              </Panel>
            </div>
          </Section>
        ) : null}

        <Section n={21} title="Tone of all legislative coverage" aside={`${files.articles.read.toLocaleString()} articles`}>
          <Panel>
            <BinChart rows={tones} />
          </Panel>
        </Section>

        <Section n={22} title="What a day of it costs">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="p-0">
              <ul className="divide-y text-sm">
                {bill.read.map((r) => (
                  <li key={r.feed} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                    <span className="capitalize">{r.feed}</span>
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
                  <span className="text-muted-foreground">Downloaded, a day</span>
                  <span className="tabular-nums">{(bill.rawPerDay / 1e6).toFixed(0)} MB</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Downloaded, a year</span>
                  <span className="tabular-nums">{(bill.rawPerYear / 1e9).toFixed(0)} GB</span>
                </li>
                <li className="flex justify-between gap-3 border-t pt-2">
                  <span className="text-muted-foreground">Kept after filtering, a day</span>
                  <span className="tabular-nums">{(bill.keptPerDay / 1e6).toFixed(1)} MB</span>
                </li>
                <li className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Kept after filtering, a year</span>
                  <span className="tabular-nums">{(bill.keptPerYear / 1e9).toFixed(1)} GB</span>
                </li>
              </ul>
            </Panel>
          </div>
        </Section>

        <Section n={24} title="Around the world">
          {countries ? (
            <Panel>
              <Bars rows={countries.map((c) => ({ key: c.country, label: c.country, value: c.volume, shown: c.volume.toFixed(2) }))} />
            </Panel>
          ) : (
            <Waiting />
          )}
        </Section>
      </div>
    </div>
  )
}
