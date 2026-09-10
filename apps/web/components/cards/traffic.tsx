"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { PARTY_BLUE, PARTY_RED } from "@/lib/imagery"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFoot } from "@/components/card-foot"
import { Card, CardContent, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/chart"

// Bills by party — the bar card the finance demo used for desktop and mobile
// traffic, on a real measure in red and blue (Brendan, 2026-09-07): how many
// bills each party's members introduced, month by month, for the last six
// months of the session in scope. The bills-by-party resource counts them.

type Month = { month: string; republican: number; democrat: number; other: number }

const chartConfig = {
  republican: { label: "Republican", color: PARTY_RED },
  democrat: { label: "Democrat", color: PARTY_BLUE },
} satisfies ChartConfig

const monthName = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })

export function BarChartCard() {
  const [chamber, setChamber] = React.useState("")
  const { data, state, pending } = useScoped<{ rows: Month[] }>("bills-by-party", { rows: [] }, { months: 6, chamber: chamber || undefined })
  const rows = React.useMemo(() => (data?.rows ?? []).map((r) => ({ ...r, label: monthName(r.month) })), [data])
  const republican = rows.reduce((sum, r) => sum + r.republican, 0)
  const democrat = rows.reduce((sum, r) => sum + r.democrat, 0)
  const total = republican + democrat
  const share = total ? Math.round((republican / total) * 100) : 0
  // Upstream reads the designer's style to square the bars for lyra/sera; ours is rounded.
  const isRounded = true

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bills by party</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <ChartContainer config={chartConfig} className="max-h-[180px] w-full">
          <BarChart accessibilityLayer data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} tickMargin={8} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="republican" fill="var(--color-republican)" radius={isRounded ? [6, 6, 0, 0] : 0} />
            <Bar dataKey="democrat" fill="var(--color-democrat)" radius={isRounded ? [6, 6, 0, 0] : 0} />
          </BarChart>
        </ChartContainer>
        <div className="grid w-full grid-cols-3 divide-x divide-border/60">
          <div className="px-2 text-center">
            <div className="text-[0.65rem] text-muted-foreground uppercase">Republican</div>
            <div className={pending ? "animate-pulse text-sm font-medium tabular-nums" : "text-sm font-medium tabular-nums"}>{republican.toLocaleString("en-US")}</div>
          </div>
          <div className="px-2 text-center">
            <div className="text-[0.65rem] text-muted-foreground uppercase">Democrat</div>
            <div className={pending ? "animate-pulse text-sm font-medium tabular-nums" : "text-sm font-medium tabular-nums"}>{democrat.toLocaleString("en-US")}</div>
          </div>
          <div className="px-2 text-center">
            <div className="text-[0.65rem] text-muted-foreground uppercase">Share</div>
            <div className="text-sm font-medium tabular-nums">{total ? `${share}%` : "—"}</div>
          </div>
        </div>
      </CardContent>
      <CardFoot chamber={chamber} onChamber={setChamber} href={`/bills?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} label="All bills" />
    </Card>
  )
}
