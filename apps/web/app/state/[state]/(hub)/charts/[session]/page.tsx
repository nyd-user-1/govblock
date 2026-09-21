import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { stateName } from "@/lib/filters"
import { StateChartsPage } from "@/components/charts/state-charts-page"

// /state/[state]/charts/[session] (Brendan, 2026-09-20): the charts page on a
// session picked from its Session menu. An address rather than a ?session=, so
// the page is rendered on its first visit and kept the hour like the latest
// one; a query string would have it read the database on every view. Nothing
// is rendered at build: fifty-two jurisdictions' every session is output
// Amplify's cap has no room for.
export const revalidate = 3600

export function generateStaticParams() {
  return []
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; session: string }> }): Promise<Metadata> {
  const { state, session } = await params
  const s = state.toUpperCase()
  const name = s === "US" ? "Congress" : stateName(s)
  return { title: `${name} charts, ${session}`, description: `${name} by the numbers in its ${session} session: sponsors, seats, committees.` }
}

export default async function Page({ params }: { params: Promise<{ state: string; session: string }> }) {
  const { state, session } = await params
  if (!/^\d{4}$/.test(session)) notFound()
  return <StateChartsPage state={state} session={Number(session)} />
}
