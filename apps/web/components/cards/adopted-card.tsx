"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { congressName } from "@/lib/policy/congress"
import { CardFoot } from "@/components/card-foot"
import { CardHead, CardShell, SITE, type CardBodyProps } from "@/components/cards/card-shell"
import { CardContent } from "@govblock/ui/components/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@govblock/ui/components/chart"

// Adopted Bills — the bills adopted in every session the jurisdiction has,
// oldest to newest, so the shape is the legislature's own output over the
// years. The current session is the last point and is still climbing.
export type AdoptedRow = { session_id: number; adopted: number; bills: number }

const chartConfig = {
  adopted: { label: "Adopted", color: "var(--chart-1)" },
} satisfies ChartConfig

export function AdoptedCardBody({ rows: all, state = "US", title = "Adopted Bills", action, href }: CardBodyProps & { rows: AdoptedRow[] }) {
  const nameOf = React.useCallback((id: number) => (state === "US" ? congressName(id).replace(" Congress", "") : String(id)), [state])
  // The last twelve sessions, and a session's name is what the pages call it.
  const rows = React.useMemo(() => all.filter((r) => r.bills > 0).slice(-12).map((r) => ({ session: nameOf(r.session_id), adopted: r.adopted, bills: r.bills, id: r.session_id })), [all, nameOf])
  return (
    <>
      <CardHead title={title} action={action} />
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
      <CardFoot href={href ?? `${SITE}/laws?state=${state}`} label="The laws" />
    </>
  )
}

export function AdoptedCard(props: React.ComponentProps<typeof AdoptedCardBody>) {
  return (
    <CardShell>
      <AdoptedCardBody {...props} />
    </CardShell>
  )
}
