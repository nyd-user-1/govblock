"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { fmtNumber } from "@/lib/format"
import { congressName } from "@/lib/policy/congress"
import { useScoped } from "@/lib/policy/use-scoped"
import { CardFrame, ComponentActions } from "@/components/card-frame"
import { CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@govblock/ui/components/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/chart"

// Adopted Bills — the finance demo's Stock Performance chart, made real
// (Brendan, 2026-09-05): the bills adopted in every session the jurisdiction
// has, oldest to newest, so the shape is the legislature's own output over
// the years. Adopted is LegiScan's Passed, and the other pipelines' words for
// it. The current session is the last point and is still climbing.

type Row = { session_id: number; adopted: number; bills: number }

const chartConfig = {
  adopted: { label: "Adopted", color: "var(--chart-1)" },
} satisfies ChartConfig

export function AdoptedBillsCard() {
  const { data, state, pending } = useScoped<Row[]>("adopted", [])
  const rows = React.useMemo(() => {
    const all = (data ?? []).filter((r) => r.bills > 0)
    // The last twelve sessions, and a session's name is what the pages call it.
    return all.slice(-12).map((r) => ({ session: state === "US" ? congressName(r.session_id).replace(" Congress", "") : String(r.session_id), adopted: r.adopted, bills: r.bills }))
  }, [data, state])
  const latest = rows[rows.length - 1]

  return (
    <CardFrame id="stock">
      <CardHeader>
        <CardTitle>Adopted Bills</CardTitle>
        <CardDescription>
          {pending && !rows.length ? "By session" : latest ? `By session · ${fmtNumber(latest.adopted)} so far this session` : "By session"}
        </CardDescription>
        <CardAction>
          <ComponentActions />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart accessibilityLayer data={rows} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fillAdopted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-adopted)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="var(--color-adopted)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="session" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelKey="session" />} />
            <Area type="monotone" dataKey="adopted" stroke="var(--color-adopted)" strokeWidth={2} fill="url(#fillAdopted)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </CardFrame>
  )
}
