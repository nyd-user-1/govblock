"use client"

import * as React from "react"
import { LandmarkIcon } from "lucide-react"

import { stateName } from "@/lib/filters"
import { honorific } from "@/lib/format"
import { PARTY_BLUE, PARTY_OTHER, PARTY_RED } from "@/lib/imagery"
import { num, pct, priorSession, useActivity, useAdopted, useSeats, useSponsors } from "@/components/admin/data"
import { Chart3, Chart4, type Slice, type StackRow } from "@/components/admin/blocks/charts"
import { Pending, Stat2, type Stat2Props } from "@/components/admin/blocks/stats"
import { Table3, type ProductRow } from "@/components/admin/blocks/tables"
import { Analytics7, Promo1, type Source } from "@/components/admin/blocks/widgets"
import { PageTitle } from "@/components/admin/page-title"
import { useAdminNav } from "@/components/admin/nav"

// paceui's Sales Performance, as the session's performance: the four stats
// are the session against the one before it, the bars are bills with an
// action by month and chamber, the products are the top sponsors, the
// channels are the chambers, the traffic sources the busiest committees, and
// the promo is the datasets page, which is the thing here worth an upsell.

const monthLabel = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" })

export function SalesPage() {
  const { go } = useAdminNav()
  const activity = useActivity()
  const adopted = useAdopted()
  const sponsors = useSponsors(6)
  const seats = useSeats()
  const session = activity.scope.session
  const state = activity.scope.state

  const now = adopted.data?.find((r) => r.session_id === session)
  const before = priorSession(adopted.data, session)
  const rollCalls = activity.data?.rollCalls.reduce((s, r) => s + r.roll_calls, 0) ?? 0
  const seatTotal = seats.data?.reduce((s, r) => s + r.seats, 0) ?? 0

  const stats: Stat2Props[] = [
    {
      title: "Bills",
      value: now ? num(now.bills) : <Pending />,
      trendValue: now ? pct(now.bills, before?.bills) : 0,
      footerLabel: now && before ? (now.bills >= before.bills ? "Ahead of last session" : "Behind last session") : "This session",
      footerSubtext: before ? `vs. ${num(before.bills)} in ${before.session_id}` : "no earlier session on file",
    },
    {
      title: "Adopted",
      value: now ? num(now.adopted) : <Pending />,
      trendValue: now ? pct(now.adopted, before?.adopted) : 0,
      footerLabel: now && before ? (now.adopted >= before.adopted ? "More became law" : "Fewer so far") : "Passed both chambers",
      footerSubtext: now ? `${now.bills ? Math.round((now.adopted / now.bills) * 1000) / 10 : 0}% of the session's bills` : "",
    },
    {
      title: "Roll Calls",
      value: activity.data ? num(rollCalls) : <Pending />,
      trendValue: 0,
      footerLabel: "Recorded votes",
      footerSubtext: activity.data ? `${num(activity.data.rollCalls.reduce((s, r) => s + r.yea, 0))} yeas cast` : "",
    },
    {
      title: "Seats",
      value: seats.data ? num(seatTotal) : <Pending />,
      trendValue: 0,
      footerLabel: "Sitting members",
      footerSubtext: seats.data ? seats.data.filter((s) => s.party === "D" || s.party === "R").map((s) => `${s.party} ${s.seats} ${s.chamber}`).slice(0, 2).join(" · ") : "",
    },
  ]

  const bars: StackRow[] | undefined = activity.data?.monthly.slice(-20).map((m) => ({ date: m.ym, item1: m.senate, item2: m.assembly }))
  const lastMonth = activity.data?.monthly[activity.data.monthly.length - 1]
  const upper = state === "US" ? "Senate" : "Senate"
  const lower = state === "US" ? "House" : ["NY", "CA", "NJ", "NV", "WI"].includes(state) ? "Assembly" : "House"

  const products: ProductRow[] =
    sponsors.data?.map((s) => ({
      id: String(s.people_id),
      name: `${honorific(s.role, s.chamber)} ${s.name}`,
      sku: s.district ? `District ${s.district}` : s.chamber,
      category: s.chamber,
      image: s.photo_url,
      revenue: `${num(s.prime)} bills`,
      sales: "prime sponsor",
      status: s.party === "D" ? "Democrat" : s.party === "R" ? "Republican" : s.party || "Other",
      statusVariant: "outline",
    })) ?? []

  const chamberSlices: Slice[] | undefined = seats.data
    ? [
        { title: "Democrats", value: seats.data.filter((s) => s.party === "D").reduce((a, s) => a + s.seats, 0), fill: PARTY_BLUE },
        { title: "Republicans", value: seats.data.filter((s) => s.party === "R").reduce((a, s) => a + s.seats, 0), fill: PARTY_RED },
        { title: "Other", value: seats.data.filter((s) => s.party !== "D" && s.party !== "R").reduce((a, s) => a + s.seats, 0), fill: PARTY_OTHER },
      ]
    : undefined

  const top = activity.data?.committees[0]?.bills ?? 1
  const sources: Source[] | undefined = activity.data?.committees.slice(0, 4).map((c) => ({
    key: c.committee,
    label: c.committee,
    icon: LandmarkIcon,
    sub: "committee of referral",
    value: num(c.bills),
    percent: Math.round((c.bills / top) * 100),
  }))

  return (
    <div>
      <PageTitle title="Session Performance" />
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-4">
        {stats.map((stat) => (
          <Stat2 {...stat} key={stat.title} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-7">
        <div className="xl:col-span-4">
          <Chart3
            title="Legislative Activity"
            description={`Bills with an action, by month and chamber, ${stateName(state)}`}
            data={bars}
            labels={{ item1: upper, item2: lower }}
            tickFormatter={monthLabel}
            figures={[
              { label: "This month", value: lastMonth ? num(lastMonth.bills) : "—" },
              { label: upper, value: lastMonth ? num(lastMonth.senate) : "—" },
              { label: lower, value: lastMonth ? num(lastMonth.assembly) : "—" },
            ]}
          />
        </div>
        <div className="xl:col-span-3">
          <Table3 title="Top Sponsors" description="The members with the most bills to their name this session." rows={products} pending={sponsors.pending} columns={["Portrait", "Member", "Chamber", "Party", "Bills", "Actions"]} menu={["View Members", "Open Directory"]} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Chart4 title="Seats by Party" description="The sitting roster, both chambers together" totalLabel="Seats" data={chamberSlices} />
        <Analytics7 title="Busiest Committees" description="Where the session's bills were referred" sources={sources} />
        <Promo1 badge="Bulk Datasets" title="Take the session as a file" description="Every family of the record, a session at a time, as JSON or CSV." points={["Bills, sponsors, members, committees", "Roll calls, votes and history", "Cached a day, no key needed"]} cta="Open Datasets" href="/docs/datasets" onClick={() => go("")} />
      </div>
    </div>
  )
}
