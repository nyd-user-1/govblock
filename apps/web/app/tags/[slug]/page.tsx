import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { TAGS, TAG_BY_SLUG } from "@/lib/data/tags"
import { DEFAULT_STATE, stateName } from "@/lib/filters"
import { fmtBill, fmtNumber } from "@/lib/format"
import { NEWS_TAGS, NEWS_TAG_BY_SLUG, firstSeen, tagStories, tagsFile } from "@/lib/gdelt/tags"
import { latestSession } from "@/lib/policy/db-queries"
import { getTagBills } from "@/lib/policy/tag-queries"
import { CalendarCard } from "@/components/cards/calendar"
import { DocsPage } from "@/components/docs-page"
import { FollowTagButton } from "@/components/tags/follow"
import { ChamberSeal } from "@/components/policy/imagery"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { H2 } from "@/components/typeset"

// One tag (Brendan, 2026-09-16; the news joined 2026-09-18). A tag is GDELT's
// — a theme the legislative coverage carried — or GovBlock's own subject, or
// both when the words agree: the stories under it, by day, and the bills filed
// under it in the jurisdiction in scope. The neighbours in the header walk
// every tag alphabetically, as the docs pages walk each other.

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ state?: string }> }

const ordered = [...new Map([...NEWS_TAGS.map((t) => [t.slug, t.name] as const), ...TAGS.map((t) => [t.slug, t.name] as const)])].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.slug.localeCompare(b.slug))

const MONTHS = ["Jan.", "Feb.", "March", "April", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."]
const when = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`

/** GDELT keeps a page's title as the page wrote it, entities and all. */
const decode = (text: string) =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, name: string) => ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " })[name]!)

function about(slug: string) {
  const subject = TAG_BY_SLUG.get(slug)
  const news = NEWS_TAG_BY_SLUG.get(slug)
  if (!subject && !news) return null
  const name = subject?.name ?? news!.name
  const blurb = subject?.blurb ?? `The legislative news GDELT's knowledge graph files under ${news!.codes.join(", ")}.`
  return { subject, news, name, blurb }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = about((await params).slug)
  return tag ? { title: tag.name, description: tag.blurb } : { title: "Tag" }
}

function Days({ days }: { days: number[] }) {
  const max = Math.max(...days, 1)
  return (
    <div className="not-typeset mt-6 flex h-36 items-end gap-1.5">
      {days.map((n, i) => (
        <div key={tagsFile.days[i]} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${when(tagsFile.days[i]!)}: ${fmtNumber(n)} stories`}>
          <span className="text-[10px] text-muted-foreground tabular-nums opacity-0 group-hover:opacity-100">{fmtNumber(n)}</span>
          <span className="w-full rounded-t bg-primary/70 group-hover:bg-primary" style={{ height: `${Math.max(2, (n / max) * 100)}%` }} />
          <span className="text-[10px] text-muted-foreground">{Number(tagsFile.days[i]!.slice(8, 10))}</span>
        </div>
      ))}
    </div>
  )
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params
  const tag = about(slug)
  if (!tag) notFound()
  const { subject, news } = tag
  const asked = (await searchParams).state?.toUpperCase()
  const state = asked && /^[A-Z]{2}$/.test(asked) ? asked : DEFAULT_STATE
  const session = subject ? await latestSession(state) : null
  const page = subject && session ? await getTagBills({ state, session }, slug, 24, 0) : null
  const stories = news ? await tagStories(slug) : []

  const at = ordered.findIndex((t) => t.slug === slug)
  const link = (i: number) => (ordered[i] ? { name: ordered[i].name, url: `/tags/${ordered[i].slug}${subject ? `?state=${state}` : ""}` } : undefined)
  const bills = page?.bills ?? []
  const total = page?.total ?? 0

  return (
    <DocsPage
      title={tag.name}
      description={tag.blurb}
      lead={<p className="text-[1.05rem] text-muted-foreground sm:text-base">{news ? `Tag · ${fmtNumber(news.total)} ${news.total === 1 ? "story" : "stories"}` : "Tag"}</p>}
      slug={`/tags/${slug}`} previous={link(at - 1)} next={link(at + 1) ?? { name: "Tags", url: "/tags" }} rail={<CalendarCard compact />} actions={<FollowTagButton slug={slug} />}>
      {news && (
        <>
          <H2>In the news</H2>
          <p>
            <code>{fmtNumber(news.total)}</code> of the window&rsquo;s {fmtNumber(tagsFile.articles)} legislative stories carried this tag, first on {when(firstSeen(news))}.
          </p>
          {stories.length > 0 && (
            <ul className="not-typeset mt-6 flex flex-col divide-y rounded-2xl border">
              {stories.map((story) => (
                <li key={story.url}>
                  <a href={story.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 no-underline hover:bg-muted/40">
                    {story.image ? <img src={story.image} alt="" loading="lazy" className="size-14 shrink-0 rounded-lg bg-muted object-cover" /> : <span className="size-14 shrink-0 rounded-lg bg-muted" />}
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="line-clamp-2 text-sm font-medium text-foreground">{decode(story.title)}</span>
                      <span className="text-xs text-muted-foreground">
                        {story.source} · {when(story.day)}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <hr />
          <H2>Trend</H2>
          <Days days={news.days} />
        </>
      )}
      {subject && (
        <>
          {news && <hr />}
          <H2>Bills</H2>
          <p>
            {stateName(state)} files <code>{fmtNumber(total)}</code> {total === 1 ? "bill" : "bills"} under {subject.name.toLowerCase()} this session
            {bills.length < total ? <>; the {fmtNumber(bills.length)} with the newest action are below</> : null}.
          </p>
          <ProjectGrid>
            {bills.map((bill) => (
              <ProjectCard
                key={bill.bill_id}
                href={`/bills/${bill.bill_id}`}
                title={fmtBill(bill.bill_number, state)}
                media={<ChamberSeal state={state} size={28} />}
                note={bill.title}
                meta={[bill.status_desc, bill.last_action_date].filter(Boolean).join(" · ")}
              />
            ))}
          </ProjectGrid>
          {page && page.terms.length > 0 && (
            <>
              <H2>What this tag gathers</H2>
              <p>
                {subject.name} holds every bill {stateName(state)} files under{" "}
                {page.terms.slice(0, 12).map((term, i) => (
                  <span key={term}>
                    {i > 0 ? ", " : ""}
                    <code>{term}</code>
                  </span>
                ))}
                {page.terms.length > 12 ? <> and {fmtNumber(page.terms.length - 12)} more</> : null}.
              </p>
            </>
          )}
        </>
      )}
    </DocsPage>
  )
}
