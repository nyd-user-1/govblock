import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { TAGS, TAG_BY_SLUG } from "@/lib/data/tags"
import { DEFAULT_STATE, stateName } from "@/lib/filters"
import { fmtBill, fmtNumber } from "@/lib/format"
import { latestSession } from "@/lib/policy/db-queries"
import { getTagBills } from "@/lib/policy/tag-queries"
import { CalendarCard } from "@/components/cards/calendar"
import { DocsPage } from "@/components/docs-page"
import { ChamberSeal } from "@/components/policy/imagery"
import { ProjectCard, ProjectGrid } from "@/components/project-card"
import { H2 } from "@/components/typeset"

// One tag (Brendan, 2026-09-16): our word for a subject, the bills under it as
// cards, and the record's own terms named underneath so a reader can see what
// the tag gathers. The neighbours in the header walk the tags alphabetically,
// as the docs pages walk each other.

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ state?: string }> }

const ordered = [...TAGS].sort((a, b) => a.name.localeCompare(b.name))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tag = TAG_BY_SLUG.get(slug)
  return tag ? { title: tag.name, description: tag.blurb } : { title: "Tag" }
}

export default async function TagPage({ params, searchParams }: Props) {
  const { slug } = await params
  const tag = TAG_BY_SLUG.get(slug)
  if (!tag) notFound()
  const asked = (await searchParams).state?.toUpperCase()
  const state = asked && /^[A-Z]{2}$/.test(asked) ? asked : DEFAULT_STATE
  const session = await latestSession(state)
  const page = session ? await getTagBills({ state, session }, slug, 24, 0) : null

  const at = ordered.findIndex((t) => t.slug === slug)
  const link = (i: number) => (ordered[i] ? { name: ordered[i].name, url: `/tags/${ordered[i].slug}?state=${state}` } : undefined)
  const bills = page?.bills ?? []
  const total = page?.total ?? 0

  return (
    <DocsPage
      title={tag.name}
      description={tag.blurb}
      slug={`/tags/${slug}`}
      previous={link(at - 1)}
      next={link(at + 1) ?? { name: "Tags", url: "/tags" }}
      rail={<CalendarCard compact />}
    >
      <H2>Bills</H2>
      <p>
        {stateName(state)} files <code>{fmtNumber(total)}</code> {total === 1 ? "bill" : "bills"} under {tag.name.toLowerCase()} this session
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
            {tag.name} holds every bill {stateName(state)} files under{" "}
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
    </DocsPage>
  )
}
