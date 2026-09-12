"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

import { PARTY_BLUE, PARTY_RED } from "@/lib/imagery"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { CardContent } from "@govblock/ui/components/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/chart"

// Bills by party — how many bills each party's members introduced, month by
// month, in the flag's red and blue.
export type MonthRow = { month: string; republican: number; democrat: number; other?: number }

const chartConfig = {
  republican: { label: "Republican", color: PARTY_RED },
  democrat: { label: "Democrat", color: PARTY_BLUE },
} satisfies ChartConfig

const monthName = (ym: string) => new Date(`${ym}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })

export function TrafficCardBody({ rows: months, pending = false, state = "US", title = "Bills by party", action, href, chamber, onChamber }: CardBodyProps & { rows: MonthRow[]; pending?: boolean; chamber?: string; onChamber?: (chamber: string) => void }) {
  const rows = React.useMemo(() => months.map((r) => ({ ...r, label: monthName(r.month) })), [months])
  const republican = rows.reduce((sum, r) => sum + r.republican, 0)
  const democrat = rows.reduce((sum, r) => sum + r.democrat, 0)
  const total = republican + democrat
  const share = total ? Math.round((republican / total) * 100) : 0
  return (
    <>
      <CardHead title={title} action={action} />
      <CardContent className="flex flex-col gap-4 pt-0">
        <ChartContainer config={chartConfig} className="max-h-[180px] w-full">
          <BarChart accessibilityLayer data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} tickMargin={8} axisLine={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="republican" fill="var(--color-republican)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="democrat" fill="var(--color-democrat)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="grid w-full grid-cols-3 divide-x divide-border/60">
          {[
            ["Republican", republican.toLocaleString("en-US")],
            ["Democrat", democrat.toLocaleString("en-US")],
            ["Share", total ? `${share}%` : "—"],
          ].map(([label, value]) => (
            <div key={label} className="px-2 text-center">
              <div className="text-[0.65rem] text-muted-foreground uppercase">{label}</div>
              <div className={pending && label !== "Share" ? "animate-pulse text-sm font-medium tabular-nums" : "text-sm font-medium tabular-nums"}>{value}</div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFoot chamber={chamber} onChamber={onChamber} state={state} href={href ?? `${SITE}/bills?state=${state}${chamber ? `&chamber=${encodeURIComponent(chamber)}` : ""}`} label="All bills" />
    </>
  )
}

export function TrafficCard(props: Omit<React.ComponentProps<typeof TrafficCardBody>, "chamber" | "onChamber">) {
  return (
    <CardShell>
      <TrafficCardBody {...props} />
    </CardShell>
  )
}
