"use client"

import * as React from "react"
import { CalendarIcon, ClockIcon, FilterIcon, PlusIcon, Share2Icon, UserIcon, VideoIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { StatEducation } from "@/components/admin/blocks/stats"
import { CardAnchor, CardTools } from "@/components/admin/blocks/card-tools"
import { PageTitle } from "@/components/admin/page-title"
import { Avatar, AvatarFallback } from "@govblock/ui/components/nova/avatar"
import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardHeader } from "@govblock/ui/components/nova/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/nova/chart"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { Progress } from "@govblock/ui/components/progress"

// paceui's Education Management, rebuilt from its rendered page with its
// sample figures. The layout is a main column and a narrow right column
// that holds the professor's card.

const attendance = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
  day: d,
  students: 200 + Math.round(Math.random() * 200),
  campaign: 40 + Math.round(Math.random() * 80),
}))
const attendanceConfig: ChartConfig = {
  students: { label: "Attendance", color: "var(--chart-1)" },
  campaign: { label: "Social Campaign", color: "var(--chart-3)" },
}
const sessions = [
  {
    time: "09:00",
    m: "AM",
    title: "User Research and Persona Development Workshop",
  },
  {
    time: "10:30",
    m: "AM",
    title: "UI Grid Systems, Baseline Alignment, and Spacing Rules",
  },
  {
    time: "13:00",
    m: "PM",
    title: "Interactive Prototyping and Micro-animations in Figma",
  },
]
const engagement = Array.from({ length: 8 }, (_, i) => ({
  w: `W${i + 1}`,
  v: 50 + Math.round(Math.random() * 40),
}))

export function EducationPage() {
  return (
    <div>
      <PageTitle title="Education Management" />
      <div className="mt-4 grid gap-6 sm:mt-5 xl:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 2xl:grid-cols-3">
            <StatEducation title="Total Enrollments" period="This Semester" value="12,847" badge="+8.3%" note="vs last semester" />
            <StatEducation title="Active Courses" period="Current Quarter" value="342" badge="+24" note="new this quarter" />
            <StatEducation title="Completion Rate" period="All Programs" value="89.4%" badge="+5.7%" note="year over year" />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 2xl:grid-cols-5">
            <div className="2xl:col-span-3">
              <Card>
                <CardHeader className="gap-4">
                  <CardAnchor>Weekly Attendance</CardAnchor>
                  <div className="flex flex-wrap items-end gap-4">
                    <span className="text-3xl font-semibold">2,182</span>
                    <span className="mb-1 text-xs text-muted-foreground">This week (+8.3%)</span>
                    <span className="mb-1 ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="size-2 rounded-full bg-[var(--chart-3)]" />
                      Social Campaign
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={attendanceConfig} className="aspect-video w-full">
                    <BarChart data={attendance}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
                      <Bar dataKey="students" stackId="a" fill="var(--color-students)" radius={[0, 0, 6, 6]} />
                      <Bar dataKey="campaign" stackId="a" fill="var(--color-campaign)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
            <div className="2xl:col-span-2">
              <Card className="gap-4">
                <CardHeader>
                  <CardAnchor>Scalable Systems & API Design</CardAnchor>
                  <CardAction>
                    <CardTools />
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-2 text-sm">
                    {[
                      { k: "Date", v: "28 Jun 26", icon: CalendarIcon },
                      { k: "Duration", v: "60 minutes", icon: ClockIcon },
                      { k: "Speaker", v: "Alex River", icon: UserIcon },
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
                      Register
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="gap-3">
              <CardHeader>
                <CardAnchor>Product Masterclass</CardAnchor>
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sessions.map((s) => (
                    <div key={s.title} className="flex gap-3 rounded-lg border p-3">
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
            <Card>
              <CardContent className="flex flex-col gap-4">
                <div className="flex gap-2">
                  <Badge variant="secondary">UI/UX Design</Badge>
                  <Badge variant="outline">Intermediate</Badge>
                </div>
                <div>
                  <p className="text-lg font-semibold">Mastering responsive layout grids</p>
                  <p className="text-sm text-muted-foreground">Dive deep into CSS Grid, Flexbox, and Tailwind CSS. Learn to construct resilient, fluid dashboard interfaces that scale seamlessly across device sizes.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Active designers</p>
                    <div className="flex -space-x-2">
                      {["SC", "MA", "DP", "CK"].map((i) => (
                        <Avatar key={i} className="ring-2 ring-background">
                          <AvatarFallback className="text-xs">{i}</AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between text-xs">
                      <span className="text-muted-foreground">Syllabus progress</span>
                      <span className="font-medium">60%</span>
                    </div>
                    <Progress value={60} className="**:data-[slot=progress-indicator]:bg-primary *:data-[slot=progress-track]:h-1.5" />
                  </div>
                </div>
                <Button size="lg" className="gap-1.5">
                  Resume chapter
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:w-84 2xl:w-108">
          <Card className="gap-4">
            <CardHeader className="flex items-center gap-3">
              <Avatar size="lg">
                <AvatarFallback>SJ</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <CardAnchor>Dr. Sarah Jenkins</CardAnchor>
                <p className="text-sm text-muted-foreground">Physics Professor</p>
              </div>
              <CardAction>
                <CardTools />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Upcoming Session</p>
                <p className="font-medium">Quantum Mechanics Seminar</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <VideoIcon className="size-3.5" />
                  Virtual Lecture · Today, 14:00
                </p>
              </div>
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Engagement Rate</p>
                    <p className="text-2xl font-semibold">74%</p>
                    <p className="text-xs text-muted-foreground">Weekly</p>
                  </div>
                  <Badge variant="outline" className="h-5 text-green-600">
                    Target +12%
                  </Badge>
                </div>
                <ChartContainer
                  config={{
                    v: { label: "Engagement", color: "var(--chart-1)" },
                  }}
                  className="mt-2 aspect-video h-24 w-full"
                >
                  <BarChart data={engagement}>
                    <XAxis dataKey="w" hide />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Bar dataKey="v" fill="var(--color-v)" radius={4} />
                  </BarChart>
                </ChartContainer>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Deadlines</h3>
                {[
                  ["Grade Physics Lab Reports", "Today"],
                  ["Publish Syllabus Draft", "Tomorrow"],
                ].map(([t, w]) => (
                  <div key={t} className="flex items-center justify-between py-1.5 text-sm">
                    <span>{t}</span>
                    <Badge variant="secondary" className="h-5">
                      {w}
                    </Badge>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Workspace</h3>
                {["Exam and assessment", "Personal planner", "Machine learning algorithms"].map((t, i) => (
                  <label key={t} className="flex items-center gap-2 py-1.5 text-sm">
                    <Checkbox defaultChecked={i === 0} />
                    {t}
                  </label>
                ))}
                <Button variant="outline" size="sm" className="mt-2 gap-1">
                  <PlusIcon className="size-3.5" />
                  Add Class
                </Button>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Team collaboration</h3>
                <div className="flex -space-x-2">
                  {["AR", "BK", "CL", "DM", "EP"].map((i) => (
                    <Avatar key={i} size="sm" className="ring-2 ring-background">
                      <AvatarFallback className="text-[10px]">{i}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
