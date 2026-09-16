import type { Metadata } from "next"
import type { ReactNode } from "react"

import { attention, comparison, framing, headlines, members, moods, outlets, phrase, programs, sentences, span, standing, syndicated, television, tone, tvSpan, world } from "@/lib/gdelt/sample"
import { AttentionChart, CompareChart, StackedWeeks, ToneChart, ToneHistogram } from "@/components/gdelt/charts"
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
            <div className="grid gap-4 lg:grid-cols-2">
              <Panel className="flex flex-col gap-5">
                <MoodBar label="Press sentences" tally={feeling.press} />
                <MoodBar label="TV captions" tally={feeling.tv} />
                {mood?.rows ? <ToneChart rows={mood.rows} /> : null}
                {mood?.bins.length ? <ToneHistogram bins={mood.bins} /> : null}
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

        <Section n={11} title="Beside other election bills">
          {beside ? (
            <Panel>
              <CompareChart weeks={beside.weeks} names={beside.names} />
            </Panel>
          ) : (
            <Waiting />
          )}
        </Section>

        <Section n={12} title="Around the world">
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
