"use client"

import * as React from "react"
import { CalendarIcon, FilterIcon, MicIcon, PlusIcon, Share2Icon, TagIcon, UserIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { useRouter } from "next/navigation"

import { useCommittee, useCommittees, type Sponsor } from "@/components/admin/data"
import { usePolicy } from "@/lib/policy/use-policy"
import { portraitFor } from "@/lib/imagery"
import { CitationList } from "@govblock/ui/components/tool-ui/citation"
import { fmtBill, fmtDate, fmtNumber, truncate } from "@/lib/format"
import { useUrlParams } from "@/lib/policy/url-state"
import { useScope } from "@/lib/policy/scope"
import { ChamberSeal, MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { partyColor } from "@/lib/imagery"
import { useScoped } from "@/lib/policy/use-scoped"
import { StatEducation } from "@/components/admin/blocks/stats"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { PageTitle } from "@/components/admin/page-title"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"

// The Labor committee dashboard: the Education page, reshaped in Brendan's
// browser on 2026-09-07 (public/labor-committee-dashboard.html) and read
// back. Six stat tiles, three attendance charts (the committee, its majority,
// its minority), the bills before it as cards, the active bills as a list on
// the right, then the sub-committees' schedule and the next hearing. Every
// figure is the mock's placeholder until the page reads the record.

const attendance = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
  day: d,
  majority: 20 + Math.round(Math.random() * 10),
  minority: 8 + Math.round(Math.random() * 8),
}))
// Majority and minority are parties, and the site draws a party in its own
// colour everywhere else (Brendan, 2026-09-08: "red or blue based on majority
// minority"). Which party holds the chamber is read from the seat count, not
// assumed, so a chamber that flips repaints itself.
function attendanceColours(seats: { chamber: string; party: string; seats: number }[] | null, chamber: string | null): ChartConfig {
  const room = (chamber ?? "").toLowerCase()
  const held = (seats ?? []).filter((row) => !room || row.chamber.toLowerCase() === room)
  const ordered = [...held].sort((a, b) => b.seats - a.seats)
  return {
    majority: { label: "Majority", color: partyColor(ordered[0]?.party ?? "R") },
    minority: { label: "Minority", color: partyColor(ordered[1]?.party ?? "D") },
  }
}
const sessions = [
  { time: "9:00", m: "AM", title: "User Research and Persona Development Workshop" },
  { time: "10:30", m: "AM", title: "UI Grid Systems, Baseline Alignment, and Spacing Rules" },
  { time: "1:00", m: "PM", title: "Interactive Prototyping and Micro-animations in Figma" },
]
const subcommittees = Array.from({ length: 11 }, (_, i) => ({ ...sessions[i % 3], key: i }))
const activeBills = Array.from({ length: 16 }, (_, i) => ({ key: i, member: "Rep. Smith", party: null as string | null, bill: "HR 10234" }))

function AttendanceCard({ title, series, config }: { title: string; series: ("majority" | "minority")[]; config: ChartConfig }) {
  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <CardAnchor>{title}</CardAnchor>
          <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {series.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: config[s].color }} />
                {config[s].label}
              </span>
            ))}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="aspect-video w-full">
          <BarChart data={attendance}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            {/* Side by side, not stacked (Brendan, 2026-09-11): each party's day stands on the axis. */}
            {series.map((s) => (
              <Bar key={s} dataKey={s} fill={`var(--color-${s})`} radius={6} />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

type HeldBill = NonNullable<ReturnType<typeof useCommittee>["data"]>["bills"][number]

// A bill before the committee (Brendan, 2026-09-11): its number, its title
// clamped to two lines, its sponsors as tool-ui's stacked citations in the
// bottom-left corner, and the two buttons. The card fills its row so the
// bottoms line up with the Active Bills list beside it.
function BillCard({ bill, state }: { bill: HeldBill | null; state: string }) {
  const router = useRouter()
  const { session } = useScope()
  const { data: sponsors } = usePolicy<Sponsor[]>(bill ? "bill-sponsors" : null, { state, session: session ? String(session) : undefined }, { bill: bill?.bill_id })
  const citations = React.useMemo(
    () =>
      (sponsors ?? [])
        .slice()
        .sort((a, b) => b.prime - a.prime)
        .map((m) => ({
          id: String(m.people_id),
          href: `https://gov.nysgpt.com/members/${m.people_id}`,
          title: m.name,
          snippet: [m.role, m.party, m.district].filter(Boolean).join(" · "),
          domain: m.prime ? "Sponsor" : "Cosponsor",
          favicon: portraitFor(m) ?? undefined,
          type: "webpage" as const,
        })),
    [sponsors]
  )
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4">
        <div>
          <p className="text-lg font-semibold">{bill ? fmtBill(bill.bill_number, state) : "HR 10345"}</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {bill ? bill.title : "Insert bill description here, talk about the bill a bit. Two lines is usually enough, in most cases I\u2019ll say truncate at two lines..."}
          </p>
        </div>
        <div className="mt-auto flex flex-col gap-3">
          {citations.length > 0 && (
            <CitationList
              id={`sponsors-${bill?.bill_id}`}
              variant="stacked"
              citations={citations}
              onNavigate={(href) => router.push(new URL(href).pathname)}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="lg" className="gap-1.5">
              <Share2Icon className="size-4" />
              Share
            </Button>
            <Button size="lg" className="gap-1.5">
              + Add to Calendar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/** How many of a committee's bills got out of it. */
const passageRate = (statuses: { status: string; bills: number }[]) => {
  const total = statuses.reduce((a, s) => a + s.bills, 0)
  if (!total) return null
  const passed = statuses.filter((s) => /passed|engrossed|enrolled|adopted|chaptered|became law/i.test(s.status)).reduce((a, s) => a + s.bills, 0)
  return { total, passed, pct: Math.round((passed / total) * 1000) / 10 }
}

export function CommitteePage() {
  // The committee the page is about: the one the crumb's switcher wrote into
  // `of`. Its own record drives the tiles, the bills and the sittings; the
  // charts stay the mock's until an attendance record exists to draw
  // (Brendan, 2026-09-08).
  const { of } = useUrlParams(["of"])
  const { state } = useScope()
  const committees = useCommittees()
  // No `of` yet: the first committee on the list, so the page reads the record rather than the mock (Brendan, 2026-09-11: "the active bills needs to be wired up").
  const chosen = (committees.data ?? []).find((c) => (c.slug ?? c.committee_name) === of || c.committee_name === of) ?? (committees.data ?? [])[0] ?? null
  const record = useCommittee(chosen?.committee_name ?? null)
  const held = record.data
  const rate = held ? passageRate(held.statuses) : null
  // "Upcoming" means the next sitting on or after today; where a committee has
  // none scheduled the card shows its most recent one and says so, rather than
  // an invented date (Brendan, 2026-09-08). Sub-committee sittings arrive in
  // the same list, so both are covered by reading it whole.
  const sittings = React.useMemo(() => [...(held?.hearings ?? [])].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")), [held])
  const today = new Date().toISOString().slice(0, 10)
  const next = sittings.find((h) => (h.date ?? "") >= today) ?? null
  const upcoming = next ?? sittings[sittings.length - 1] ?? null
  const sittingLabel = next ? "Upcoming Hearing" : upcoming ? "Most Recent Hearing" : "Hearings"
  const { data: seats } = useScoped<{ chamber: string; party: string; seats: number }[]>("seats", null as unknown as { chamber: string; party: string; seats: number }[])
  const colours = React.useMemo(() => attendanceColours(seats ?? null, chosen?.chamber ?? null), [seats, chosen?.chamber])
  const dash = "—"

  return (
    <div>
      <PageTitle
        title={chosen?.committee_name ?? "Labor"}
        endContent={
          chosen ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <ChamberSeal state={state} chamber={chosen.chamber} size={24} />
              {[chosen.chamber, `${fmtNumber(chosen.bills)} bills`].filter(Boolean).join(" · ")}
            </span>
          ) : undefined
        }
      />
      <div className="mt-4 grid gap-6 sm:mt-5 xl:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 2xl:grid-cols-3">
            <StatEducation
              title="Bills Referred"
              period="Current Session"
              value={chosen ? fmtNumber(chosen.bills) : "342"}
              badge={chosen?.chamber ?? "+24"}
            />
            <StatEducation
              title="Passage Rate"
              period="All Bills"
              value={rate ? `${rate.pct}%` : chosen ? dash : "89.4%"}
              badge={rate ? fmtNumber(rate.passed) : "+5.7%"}
            />
            <StatEducation
              title="Statuses"
              period="Current Session"
              value={held ? fmtNumber(held.statuses.length) : chosen ? dash : "39"}
              badge={held?.statuses[0]?.status ?? "+6%"}
            />
            <StatEducation
              title="Sittings"
              period="Current Session"
              value={held ? fmtNumber(held.hearings.length) : chosen ? dash : "89.4%"}
              badge={upcoming ? fmtDate(upcoming.date, false) : "+5.7%"}
            />
            <StatEducation
              title="In Committee"
              period="Current Session"
              value={held ? fmtNumber(held.statuses.find((s) => /committee/i.test(s.status))?.bills ?? 0) : chosen ? dash : "89.4%"}
              badge={rate ? `${fmtNumber(rate.total)} in all` : "+5.7%"}
            />
            <StatEducation
              title="Newest Bill"
              period="Current Session"
              value={held?.bills[0] ? fmtBill(held.bills[0].bill_number, state) : chosen ? dash : "89.4%"}
              badge={held?.bills[0]?.last_action_date ? fmtDate(held.bills[0].last_action_date, false) : "+5.7%"}
            />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
            <AttendanceCard title="Attendance" series={["majority", "minority"]} config={colours} />
            <AttendanceCard title="Majority" series={["majority"]} config={colours} />
            <AttendanceCard title="Minority" series={["minority"]} config={colours} />
          </div>
          <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <BillCard key={held?.bills[i]?.bill_id ?? i} bill={held?.bills[i] ?? null} state={state} />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 xl:w-84 2xl:w-108">
          <Card className="gap-4">
            <CardHeader className="gap-1">
              <CardAnchor>Active Bills</CardAnchor>
              <CardAction>
                <CardTools />
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2 text-sm">
                {(held?.bills.length
                  ? held.bills.map((b, i) => ({ key: i, member: b.sponsor ?? "—", party: b.sponsor_party, bill: fmtBill(b.bill_number, state) }))
                  : activeBills
                ).map((r) => (
                  <div key={r.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {r.member && r.member !== "—" ? (
                        <span className="relative shrink-0">
                          <MemberPortrait name={r.member} photoUrl={null} state={state} chamber={chosen?.chamber ?? null} size={20} />
                          <PartyDot party={r.party ?? null} className="absolute -right-0.5 -bottom-0.5 size-2 ring-2 ring-card" />
                        </span>
                      ) : (
                        <UserIcon className="size-4" />
                      )}
                      {r.member}
                    </span>
                    <span className="font-medium">{r.bill}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card className="gap-3">
          <CardHeader>
            <CardAnchor>Sub-Committees</CardAnchor>
            <CardAction>
              <CardTools className="gap-2">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <FilterIcon className="size-3.5" />
                  Filter sessions
                </Button>
              </CardTools>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* The committee's own sittings and its sub-committees', newest
                  first, from the record. The mock rows below are what a
                  committee with nothing on file still draws. */}
              {(sittings.length
                ? [...sittings].reverse().map((h, i) => ({
                    key: i,
                    time: h.time ? h.time.slice(0, 5) : fmtDate(h.date, false),
                    m: h.time ? "" : "",
                    title: h.description || h.title || fmtBill(h.bill_number, state),
                  }))
                : subcommittees
              ).map((s) => (
                <div key={s.key} className="flex gap-3 rounded-lg border p-3">
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-lg font-semibold">{s.time}</span>
                    {s.m ? <span className="text-[10px] text-muted-foreground">{s.m}</span> : null}
                  </div>
                  <p className="line-clamp-2 text-sm">{s.title}</p>
                </div>
              ))}
              <button type="button" className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:bg-muted">
                <PlusIcon className="size-4" />
                Add Session
              </button>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-4">
          <CardHeader className="gap-1">
            <CardAnchor>{sittingLabel}</CardAnchor>
            <CardDescription>{next ? "The next sitting on the calendar." : upcoming ? "Nothing is scheduled; this is the last one held." : "No sitting is on the record for this committee."}</CardDescription>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 text-sm">
              {(upcoming
                ? [
                    { k: "Date", v: fmtDate(upcoming.date), icon: CalendarIcon },
                    { k: "Time", v: upcoming.time || "—", icon: MicIcon },
                    { k: "Bill", v: fmtBill(upcoming.bill_number, state), icon: TagIcon },
                    { k: "Sponsor", v: truncate(upcoming.description ?? "", 28) || "—", icon: UserIcon },
                  ]
                : [
                    { k: "Date", v: "28 Jun 26", icon: CalendarIcon },
                    { k: "Chair", v: "Rep. Smith", icon: UserIcon },
                    { k: "Topic", v: "Workforce Training", icon: TagIcon },
                    { k: "Speaker", v: "Alex River", icon: MicIcon },
                  ]
              ).map((r) => (
                <div key={r.k} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <r.icon className="size-4" />
                    {r.k}
                  </span>
                  <span className="font-medium">{r.v}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" className="gap-1.5">
                <Share2Icon className="size-4" />
                Share
              </Button>
              <Button size="lg" className="gap-1.5">
                + Add to Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[3, 4, 5, 6, 7, 8].map((i) => (
            <BillCard key={held?.bills[i]?.bill_id ?? i} bill={held?.bills[i] ?? null} state={state} />
          ))}
        </div>
      </div>
    </div>
  )
}
