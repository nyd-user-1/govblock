"use client"

import * as React from "react"
import { CalendarIcon, FilterIcon, MicIcon, PlusIcon, Share2Icon, TagIcon, UserIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { StatEducation } from "@/components/admin/blocks/stats"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { PageTitle } from "@/components/admin/page-title"
import { Avatar, AvatarFallback } from "@govblock/ui/components/nova/avatar"
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
const attendanceConfig: ChartConfig = {
  majority: { label: "Majority", color: "var(--chart-1)" },
  minority: { label: "Minority", color: "var(--chart-3)" },
}
const sessions = [
  { time: "9:00", m: "AM", title: "User Research and Persona Development Workshop" },
  { time: "10:30", m: "AM", title: "UI Grid Systems, Baseline Alignment, and Spacing Rules" },
  { time: "1:00", m: "PM", title: "Interactive Prototyping and Micro-animations in Figma" },
]
const subcommittees = Array.from({ length: 11 }, (_, i) => ({ ...sessions[i % 3], key: i }))
const activeBills = Array.from({ length: 16 }, (_, i) => ({ key: i, member: "Rep. Smith", bill: "HR 10234" }))

function AttendanceCard({ title, series }: { title: string; series: ("majority" | "minority")[] }) {
  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <CardAnchor>{title}</CardAnchor>
          <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {series.map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: attendanceConfig[s].color }} />
                {attendanceConfig[s].label}
              </span>
            ))}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={attendanceConfig} className="aspect-video w-full">
          <BarChart data={attendance}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            {series.map((s, i) => (
              <Bar key={s} dataKey={s} stackId="a" fill={`var(--color-${s})`} radius={series.length === 1 ? 6 : i === 0 ? [0, 0, 6, 6] : [6, 6, 0, 0]} />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function BillCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div>
          <p className="text-lg font-semibold">HR 10345</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">Insert bill description here, talk about the bill a bit. Two lines is usually enough, in most cases I&apos;ll say truncate at two lines...</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Co-Sponsors</p>
            <div className="flex -space-x-2">
              {["SC", "MA", "DP", "CK"].map((i) => (
                <Avatar key={i} className="ring-2 ring-background">
                  <AvatarFallback className="text-xs">{i}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
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
  )
}

export function CommitteePage() {
  return (
    <div>
      <PageTitle title="Labor" />
      <div className="mt-4 grid gap-6 sm:mt-5 xl:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 2xl:grid-cols-3">
            <StatEducation title="Membership" period="Current Session" value="39" badge="+6%" note="vs last session" />
            <StatEducation title="Active Bills" period="Current Session" value="342" badge="+24" note="new this quarter" />
            <StatEducation title="Passage Rate" period="All Bills" value="89.4%" badge="+5.7%" note="vs last session" />
            <StatEducation title="Passage Rate" period="All Bills" value="89.4%" badge="+5.7%" note="vs last session" />
            <StatEducation title="Passage Rate" period="All Bills" value="89.4%" badge="+5.7%" note="vs last session" />
            <StatEducation title="Passage Rate" period="All Bills" value="89.4%" badge="+5.7%" note="vs last session" />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-3">
            <AttendanceCard title="Attendance" series={["majority", "minority"]} />
            <AttendanceCard title="Majority" series={["majority"]} />
            <AttendanceCard title="Minority" series={["minority"]} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <BillCard key={i} />
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
                {activeBills.map((r) => (
                  <div key={r.key} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <UserIcon className="size-4" />
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
              {subcommittees.map((s) => (
                <div key={s.key} className="flex gap-3 rounded-lg border p-3">
                  <div className="flex flex-col items-center leading-none">
                    <span className="text-lg font-semibold">{s.time}</span>
                    <span className="text-[10px] text-muted-foreground">{s.m}</span>
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
            <CardAnchor>Upcoming Hearing</CardAnchor>
            <CardDescription>Describe the upcoming hearing and allow people to register/add it to their calendar...</CardDescription>
            <CardAction>
              <CardTools />
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2 text-sm">
              {[
                { k: "Date", v: "28 Jun 26", icon: CalendarIcon },
                { k: "Chair", v: "Rep. Smith", icon: UserIcon },
                { k: "Topic", v: "Workforce Training", icon: TagIcon },
                { k: "Speaker", v: "Alex River", icon: MicIcon },
              ].map((r) => (
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
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <BillCard key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
