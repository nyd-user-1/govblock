"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { honorific } from "@/lib/format"
import { num, useActivity, useMemberRecord, useMembers, useSeats } from "@/components/admin/data"
import { useUrlParams } from "@/lib/policy/url-state"
import { MemberPortrait, PartyDot } from "@/components/policy/imagery"
import { StatCustomer } from "@/components/admin/blocks/stats"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { PageTitle } from "@/components/admin/page-title"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Input } from "@govblock/ui/components/nova/input"
import { Progress } from "@govblock/ui/components/progress"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@govblock/ui/components/nova/table"
import { cn } from "@govblock/ui/lib/utils"

// One member's dashboard (Brendan, 2026-09-07): the Member Analytics page
// duplicated and titled by the member, a fictional senator until the page
// reads a real one. What follows is paceui's Customer Analytics, as the members: the four stats are the
// roster, the acquisition funnel is where the session's bills stand, the
// growth chart is votes cast by month, the directory is the members with a
// search, and the campaign goals are the busiest committees.

const monthLabel = (ym: string) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "short" })

/** What the crumb says before a member is picked. */
export const MEMBER = "Senator Peter Parker"

export function MemberPage() {
  const members = useMembers()
  const seats = useSeats()
  const activity = useActivity()
  // The member the page is about: the one the crumb's switcher wrote into `of`.
  // Nothing picked reads as the roster, which is what the page was before it
  // could be pointed at anyone (Brendan, 2026-09-08).
  const { of } = useUrlParams(["of"])
  const peopleId = Number(of) || null
  const subject = (members.data ?? []).find((m) => m.people_id === peopleId) ?? null
  const record = useMemberRecord(subject ? peopleId : null)
  const counts = record.data?.counts
  const [query, setQuery] = React.useState("")

  const all = members.data ?? []
  const sitting = all.filter((m) => m.active)
  const total = activity.data?.total ?? 0
  const perMember = sitting.length ? Math.round((total / sitting.length) * 10) / 10 : 0
  const leaders = sitting.filter((m) => m.leadership_title).length
  const senate = seats.data?.filter((s) => s.chamber === "Senate").reduce((a, s) => a + s.seats, 0) ?? 0

  // Picked, the four tiles are that member's own record: what they wrote, what
  // they signed, and how they voted. Unpicked, they are the roster the page
  // showed before it could be pointed at anyone.
  const mine = [
    {
      title: "Bills Sponsored",
      value: counts ? num(counts.sponsor) : <Skeleton className="h-7 w-16" />,
      trend: counts ? `${num(counts.cosponsor)} cosponsored` : "",
      note: "Introduced by this member this session",
    },
    {
      title: "Cosponsored",
      value: counts ? num(counts.cosponsor) : <Skeleton className="h-7 w-16" />,
      trend: subject?.district ?? "",
      note: "Signed onto another member's bill",
    },
    {
      title: "Voted Yes",
      value: counts ? num(counts.aye) : <Skeleton className="h-7 w-16" />,
      trend: counts && counts.aye + counts.nay ? `${Math.round((counts.aye / (counts.aye + counts.nay)) * 100)}% of votes cast` : "",
      note: "Recorded ayes this session",
    },
    {
      title: "Voted No",
      value: counts ? num(counts.nay) : <Skeleton className="h-7 w-16" />,
      trend: subject?.party ?? "",
      note: "Recorded nays this session",
    },
  ]

  const roster = [
    {
      title: "Members on Record",
      value: members.data ? num(all.length) : <Skeleton className="h-7 w-16" />,
      trend: `${num(sitting.length)} sitting`,
      note: "Everyone the record has ever known",
    },
    {
      title: "Sitting Members",
      value: members.data ? num(sitting.length) : <Skeleton className="h-7 w-16" />,
      trend: `${num(senate)} Senate`,
      note: "On this session's roster",
    },
    {
      title: "Bills per Member",
      value: activity.data && members.data ? String(perMember) : <Skeleton className="h-7 w-16" />,
      trend: `${num(total)} bills`,
      note: "The session's bills over its roster",
    },
    {
      title: "Leadership",
      value: members.data ? num(leaders) : <Skeleton className="h-7 w-16" />,
      trend: sitting.length ? `${Math.round((leaders / sitting.length) * 100)}%` : "0%",
      note: "Members with a leadership title",
    },
  ]
  const stats = subject ? mine : roster

  const count = (name: RegExp) => activity.data?.statuses.filter((s) => name.test(s.status)).reduce((a, s) => a + s.bills, 0) ?? 0
  const funnel = [
    { label: "Introduced", value: total, share: 100 },
    {
      label: "Engrossed",
      value: count(/engrossed|passed (house|senate|assembly)/i),
      share: total ? Math.round((count(/engrossed|passed (house|senate|assembly)/i) / total) * 100) : 0,
    },
    {
      label: "Enrolled",
      value: count(/enrolled/i),
      share: total ? Math.round((count(/enrolled/i) / total) * 100) : 0,
    },
    {
      label: "Adopted",
      value: count(/passed$|signed|chaptered|adopted|enacted|became law/i),
      share: total ? Math.round((count(/passed$|signed|chaptered|adopted|enacted|became law/i) / total) * 100) : 0,
    },
  ]

  const growth =
    activity.data?.rollCalls.map((r) => ({
      month: r.ym,
      yea: r.yea,
      nay: r.nay,
    })) ?? []
  const growthConfig: ChartConfig = {
    yea: { label: "Yea", color: "var(--chart-1)" },
    nay: { label: "Nay", color: "var(--chart-5)" },
  }

  const filtered = sitting.filter((m) => !query || m.name.toLowerCase().includes(query.toLowerCase()) || (m.district ?? "").toLowerCase().includes(query.toLowerCase())).slice(0, 5)

  const top = activity.data?.committees[0]?.bills ?? 1
  const goals =
    activity.data?.committees.slice(0, 5).map((c) => ({
      name: c.committee,
      sub: `${num(c.bills)} bills`,
      percent: Math.round((c.bills / top) * 100),
    })) ?? []

  return (
    <div>
      <PageTitle
        title={subject ? `${honorific(subject.role, subject.chamber)} ${subject.name}` : MEMBER}
        endContent={
          subject ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex shrink-0">
                <MemberPortrait name={subject.name} photoUrl={subject.photo_url} state="US" chamber={subject.chamber} size={24} />
                <PartyDot party={subject.party} serving={subject.active} className="absolute -right-0.5 -bottom-0.5 ring-2 ring-background" />
              </span>
              {[subject.chamber, subject.district, subject.party].filter(Boolean).join(" · ")}
            </span>
          ) : undefined
        }
      />
      <div className="mt-4 grid gap-4 sm:mt-5 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCustomer key={s.title} {...s} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-7">
        <div className="xl:col-span-4">
          <Card>
            <CardHeader>
              <CardAnchor>Passage</CardAnchor>
              <CardAction>
                <CardTools />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-4">
                {funnel.slice(0, 3).map((f, i) => (
                  <div key={f.label}>
                    <p className="text-2xl font-semibold">{activity.data ? (i === 0 ? num(f.value) : `${f.share}%`) : "—"}</p>
                    <p className="text-xs text-muted-foreground">{i === 0 ? "Bills introduced" : f.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {funnel.map((f) => (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-sm text-muted-foreground">{f.label}</span>
                    <div className="h-8 grow overflow-hidden rounded-md bg-muted">
                      <div className="flex h-full items-center justify-end rounded-md bg-primary/80 pr-2 text-xs font-medium text-primary-foreground transition-[width] duration-500" style={{ width: `${Math.max(f.share, 4)}%` }}>
                        {num(f.value)}
                      </div>
                    </div>
                    <Badge variant="outline" className="h-5 w-14 justify-center gap-1">
                      {f.share}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-3">
          <Card>
            <CardHeader>
              <CardAnchor>Votes Cast</CardAnchor>
              <CardAction>
                <CardTools className="gap-2">
                  <Badge variant="outline">This Session</Badge>
                </CardTools>
              </CardAction>
            </CardHeader>
            <CardContent>
              <ChartContainer config={growthConfig} className="aspect-video h-68 w-full">
                <AreaChart data={growth} margin={{ left: 0, right: 0 }}>
                  <defs>
                    <linearGradient id="fillYea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-yea)" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="var(--color-yea)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(v) => monthLabel(String(v))} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                  <Area dataKey="yea" type="monotone" stroke="var(--color-yea)" fill="url(#fillYea)" stackId="a" />
                  <Area dataKey="nay" type="monotone" stroke="var(--color-nay)" fill="var(--color-nay)" fillOpacity={0.3} stackId="a" />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card className="gap-3 max-md:py-4!">
            <CardHeader className="flex-col gap-4 max-md:px-4 sm:flex-row sm:items-center">
              <CardAnchor>Member Directory</CardAnchor>
              <CardAction>
                <CardTools className="gap-2">
                  <div className="relative">
                    <SearchIcon className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members" className="h-9 w-56 pl-8" />
                  </div>
                </CardTools>
              </CardAction>
            </CardHeader>
            <CardContent className="max-md:px-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-8">
                      <Checkbox aria-label="Select all" />
                    </TableHead>
                    <TableHead>Member ID</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Chamber</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.pending && !members.data
                    ? Array.from({ length: 5 }, (_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : filtered.map((m) => (
                        <TableRow key={m.people_id}>
                          <TableCell>
                            <Checkbox aria-label={`Select ${m.name}`} />
                          </TableCell>
                          <TableCell className="font-mono text-xs">{m.people_id}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {honorific(m.role, m.chamber)} {m.name}
                              </span>
                              <span className="text-xs text-muted-foreground">{m.district ? `District ${m.district}` : (m.leadership_title ?? "")}</span>
                            </div>
                          </TableCell>
                          <TableCell>{m.party === "D" ? "Democrat" : m.party === "R" ? "Republican" : m.party || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("h-5 gap-1", m.active ? "text-green-600" : "text-muted-foreground")}>
                              {m.active ? "Active" : "Former"}
                            </Badge>
                          </TableCell>
                          <TableCell>{m.chamber}</TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div className="xl:col-span-1">
          <Card>
            <CardHeader>
              <CardAnchor>Committee Load</CardAnchor>
              <CardAction>
                <CardTools />
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">
              {goals.map((g) => (
                <div key={g.name} className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.sub}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Progress value={g.percent} className="h-1.5 w-28 max-w-28 **:data-[slot=progress-indicator]:bg-primary *:data-[slot=progress-track]:h-1.5" />
                    <span className="w-9 text-right text-xs font-medium">{g.percent}%</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
