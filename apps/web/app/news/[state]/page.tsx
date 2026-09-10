import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isJurisdiction, stateName } from "@/lib/filters"
import { getStories } from "@/lib/policy/news"
import { CalendarCard } from "@/components/cards/calendar"
import { DocsPage } from "@/components/docs-page"
import { StoriesDirectory } from "@/components/news/stories-directory"

// One jurisdiction's desk (Brendan, 2026-09-09): what the press is reporting
// on its legislature and governor, on the committees doc's page. The path
// names the jurisdiction — /news/ny — so the page reads no search params and
// is cached hourly, as the term pages are.

export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

const codeOf = (state: string) => state.toUpperCase()
const describe = (code: string) =>
  code === "US"
    ? "What the press is reporting from Congress, newest first."
    : `What the press is reporting on ${stateName(code)}'s legislature and governor, newest first.`

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>
}): Promise<Metadata> {
  const code = codeOf((await params).state)
  if (!isJurisdiction(code)) return { title: "News" }
  return { title: `${stateName(code)} news`, description: describe(code) }
}

export default async function DeskPage({
  params,
}: {
  params: Promise<{ state: string }>
}) {
  const { state } = await params
  const code = codeOf(state)
  if (!isJurisdiction(code) || code === "PR") notFound()
  const stories = await getStories(code, { limit: 200 })
  return (
    <DocsPage
      title={stateName(code)}
      description={describe(code)}
      slug={`/news/${state.toLowerCase()}`}
      previous={{ name: "News", url: "/news" }}
      next={{ name: "Newsroom", url: `/newsroom?state=${code}` }}
      rail={<CalendarCard compact />}
    >
      <StoriesDirectory state={code} stories={stories} />
    </DocsPage>
  )
}
