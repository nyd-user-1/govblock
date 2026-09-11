import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { isJurisdiction, stateName } from "@/lib/filters"
import { getDesk } from "@/lib/policy/desk"
import { getBriefs, getStories } from "@/lib/policy/news"
import { getStream } from "@/lib/policy/stream"
import { DeskBody, DeskEyebrow, DeskRail, deskName } from "@/components/desk"
import { DocsPage } from "@/components/docs-page"

// /desk/ny (Brendan, 2026-09-11): one jurisdiction's desk, on the site's
// layout — the site rail, the desk in the centre column, its own sections in
// the right rail. The path names the jurisdiction, so the page reads no
// search params and is cached hourly per desk; the refresh icons drop that
// cache on demand.

export const revalidate = 3600
export const dynamicParams = true

export function generateStaticParams() {
  return []
}

// The other desks on the rail: the busiest legislatures, less this one.
const DESKS = ["US", "NY", "CA", "TX", "FL", "PA", "IL"]

const codeOf = (param: string) => (/^[a-z]{2}$/i.test(param) && isJurisdiction(param) ? param.toUpperCase() : null)

export async function generateMetadata({ params }: { params: Promise<{ state: string }> }): Promise<Metadata> {
  const { state } = await params
  const code = codeOf(state)
  if (!code) return { title: "Desk" }
  const name = code === "US" ? "Congress" : stateName(code)
  return { title: `${name} Desk`, description: `What the ${name} legislature did, newest first, by stage.` }
}

export default async function DeskRoute({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  const code = codeOf(state)
  if (!code) notFound()
  const [desk, others, headlines, briefs] = await Promise.all([
    getDesk(code),
    getStream({ states: DESKS.filter((d) => d !== code).slice(0, 5), limit: 2 }).then((r) => r.groups),
    getStories(code, { limit: 5 }),
    getBriefs(code, 5),
  ])
  if (!desk) notFound()
  return (
    <DocsPage
      title={deskName(code)}
      description={`What the ${code === "US" ? "Congress" : stateName(code)} legislature did, newest first, by stage.`}
      lead={<DeskEyebrow state={code} />}
      slug={`/desk/${code.toLowerCase()}`}
      previous={{ name: "Desk", url: "/desk" }}
      next={{ name: `${code === "US" ? "Congress" : stateName(code)} bills`, url: `/bills/${code.toLowerCase()}` }}
      rail={<DeskRail desk={desk} others={others} headlines={headlines} briefs={briefs} />}
    >
      <DeskBody desk={desk} />
    </DocsPage>
  )
}
