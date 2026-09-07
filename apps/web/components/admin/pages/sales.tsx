"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"

import CODES from "@/lib/data/congress/committee-codes.json"
import { memberHref, stateName } from "@/lib/filters"
import { honorific } from "@/lib/format"
import { PARTY_BLUE, PARTY_OTHER, PARTY_RED, portraitFor } from "@/lib/imagery"
import { committeeKey } from "@/lib/policy/congress"
import { committeeSlug } from "@/lib/policy/committee-slug"
import { num, pct, priorSession, useActivity, useAdopted, useCommittees, useSeats, useSponsors } from "@/components/admin/data"
import { Chart3, Chart4, type Slice, type StackRow } from "@/components/admin/blocks/charts"
import { Pending, Stat2, type Stat2Props } from "@/components/admin/blocks/stats"
import { Table3, type ProductRow } from "@/components/admin/blocks/tables"
import { Analytics7, Promo1, type Source } from "@/components/admin/blocks/widgets"
import { ChamberSeal } from "@/components/policy/imagery"

// paceui's Sales Performance, as the session's performance: the four stats
// are the session against the one before it, the bars are bills with an
// action by month and chamber, the products are the top sponsors, the
// channels are the chambers, the traffic sources the busiest committees, and
// the promo is the datasets page, which is the thing here worth an upsell.
// Reshaped 2026-09-07 to the rules Data Pipeline set: no filler lines,
// figures as stats, nothing decorative, every row that names a record opens
// it, and Refresh re-reads every card.

/** "Feb ’25", not "Feb 25", which reads as a day. */
const monthLabel = (ym: string) => {
  const d = new Date(`${ym}-15T12:00:00`)
  return `${d.toLocaleDateString("en-US", { month: "short" })} ’${d.toLocaleDateString("en-US", { year: "2-digit" })}`
}
const monthName = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "long" })

const ordinal = (n: number) => {
  const r = n % 100
  return `${n}${r >= 11 && r <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`
}

/** The session by name: "the 118th" for Congress, "the 2023 session" elsewhere. */
function sessionLabel(state: string, session: number) {
  if (state === "US") return `the ${ordinal((session - 1789) / 2 + 1)}`
  return `the ${session} session`
}

/** A federal committee's page is by system code; New York's by its slug; any other state's by state, chamber and name. */
const codeFor = (chamber: string, name: string): string | undefined => (CODES as { byName: Record<string, string> }).byName[committeeKey(chamber, name)]
function committeeHref(state: string, chamber: string, name: string, slug?: string) {
  if (state === "US") {
    const code = codeFor(chamber, name)
    return code ? `/docs/committees/${code}` : `/docs/bills?state=${state}&committee=${encodeURIComponent(name)}`
  }
  return `/docs/committees/${slug ?? committeeSlug(state, chamber, name)}`
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")

export function SalesPage() {
  const [refresh, setRefresh] = React.useState(0)
  const extra = { r: refresh || undefined }
  const activity = useActivity(extra)
  const adopted = useAdopted(extra)
  const sponsors = useSponsors(6, extra)
  const seats = useSeats(extra)
  const committees = useCommittees(extra)
  const session = activity.scope.session
  const state = activity.scope.state
  const refreshAll = () => setRefresh((r) => r + 1)

  const now = adopted.data?.find((r) => r.session_id === session)
  const before = priorSession(adopted.data, session)
  const rollCalls = activity.data?.rollCalls.reduce((s, r) => s + r.roll_calls, 0) ?? 0
  const yeas = activity.data?.rollCalls.reduce((s, r) => s + r.yea, 0) ?? 0
  const seatTotal = seats.data?.reduce((s, r) => s + r.seats, 0) ?? 0
  const byParty = (party: string) => seats.data?.filter((s) => s.party === party).reduce((a, s) => a + s.seats, 0) ?? 0
  const others = seats.data?.filter((s) => s.party !== "D" && s.party !== "R").reduce((a, s) => a + s.seats, 0) ?? 0

  const stats: Stat2Props[] = [
    {
      title: "Bills",
      value: now ? num(now.bills) : <Pending />,
      trendValue: now && before ? pct(now.bills, before.bills) : undefined,
      footer: before && session ? `vs ${num(before.bills)} in ${sessionLabel(state, before.session_id)}` : now ? "no earlier session on file" : undefined,
    },
    {
      title: "Adopted",
      value: now ? num(now.adopted) : <Pending />,
      trendValue: now && before ? pct(now.adopted, before.adopted) : undefined,
      footer: now ? `${now.bills ? Math.round((now.adopted / now.bills) * 1000) / 10 : 0}% of the session's bills` : undefined,
    },
    {
      title: "Roll Calls",
      value: activity.data ? num(rollCalls) : <Pending />,
      footer: activity.data ? `${num(yeas)} yeas cast` : undefined,
    },
    {
      title: "Seats",
      value: seats.data ? num(seatTotal) : <Pending />,
      footer: seats.data ? [`R ${num(byParty("R"))}`, `D ${num(byParty("D"))}`, others ? `I ${num(others)}` : null].filter(Boolean).join(" · ") : undefined,
    },
  ]

  const bars: StackRow[] | undefined = activity.data?.monthly.slice(-20).map((m) => ({ date: m.ym, item1: m.senate, item2: m.assembly }))
  const lastMonth = activity.data?.monthly[activity.data.monthly.length - 1]
  const upper = "Senate"
  const lower = state === "US" ? "House" : ["NY", "CA", "NJ", "NV", "WI"].includes(state) ? "Assembly" : "House"

  const members: ProductRow[] =
    sponsors.data?.map((s) => ({
      id: String(s.people_id),
      name: `${honorific(s.role, s.chamber)} ${s.name}`,
      category: state === "US" ? stateName((s.district ?? "").split("-")[1]) || s.chamber : s.chamber,
      image: portraitFor(s),
      fallback: initials(s.name),
      revenue: `${num(s.prime)} bills`,
      status: s.party === "D" ? "Democrat" : s.party === "R" ? "Republican" : s.party || "Other",
      statusVariant: "outline",
      // The party is the dot on the portrait, not a column (Brendan, 2026-09-07).
      dot: s.party === "D" ? PARTY_BLUE : s.party === "R" ? PARTY_RED : PARTY_OTHER,
      href: memberHref(s.people_id, state),
    })) ?? []

  const chamberSlices: Slice[] | undefined = seats.data
    ? [
        { title: "Democrats", value: byParty("D"), fill: PARTY_BLUE },
        { title: "Republicans", value: byParty("R"), fill: PARTY_RED },
        { title: "Other", value: others, fill: PARTY_OTHER },
      ]
    : undefined

  const allBills = Math.max(1, activity.data?.total ?? now?.bills ?? 1)
  const busiest: Source[] | undefined = committees.data
    ? [...committees.data]
        .sort((a, b) => b.bills - a.bills)
        .slice(0, 4)
        .map((c) => ({
          key: `${c.chamber}/${c.committee_name}`,
          label: c.committee_name,
          media: <ChamberSeal state={state} chamber={c.chamber} size={36} />,
          sub: c.chamber,
          value: num(c.bills),
          percent: Math.round((c.bills / allBills) * 100),
          href: committeeHref(state, c.chamber, c.committee_name, c.slug),
        }))
    : undefined

  return (
    <div>
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-4">
        {stats.map((stat) => (
          <Stat2 {...stat} key={stat.title} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-7">
        <div className="xl:col-span-4">
          <Chart3
            title="Legislative Activity"
            data={bars}
            labels={{ item1: upper, item2: lower }}
            tickFormatter={monthLabel}
            onRefresh={refreshAll}
            refreshing={activity.pending && !!activity.data}
            fileName={`legislative-activity-${state.toLowerCase()}-${session ?? "session"}`}
            figures={[
              {
                label: lastMonth ? monthName(lastMonth.ym) : "This month",
                value: lastMonth ? num(lastMonth.bills) : "—",
              },
              { label: upper, value: lastMonth ? num(lastMonth.senate) : "—" },
              {
                label: lower,
                value: lastMonth ? num(lastMonth.assembly) : "—",
              },
            ]}
          />
        </div>
        <div className="xl:col-span-3">
          <Table3 title="Top Sponsors" rows={members} pending={sponsors.pending} columns={["Portrait", "Member", state === "US" ? "State" : "Chamber", null, "Bills"]} />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Chart4 title="Seats by Party" totalLabel="Seats" data={chamberSlices} />
        <Analytics7 title="Busiest Committees" note="This session" sources={busiest} />
        <Promo1
          icon={DownloadIcon}
          badge="Bulk Datasets"
          title="Take the session as a file"
          description="Every family of the record, a session at a time, as JSON or CSV."
          points={["Bills, sponsors, members, committees", "Roll calls, votes and history", "Cached a day, no key needed"]}
          cta="Open Datasets"
          href="/docs/datasets"
        />
      </div>
    </div>
  )
}
