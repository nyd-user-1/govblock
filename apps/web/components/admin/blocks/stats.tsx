"use client"

import * as React from "react"
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon, MoreHorizontalIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Skeleton } from "@govblock/ui/components/nova/skeleton"
import { cn } from "@govblock/ui/lib/utils"

// paceui's stat cards, one per dashboard that has its own: Stat1 and Stat2
// are the free template's (Logs and Sales); the rest are rebuilt from the
// Ultimate Dashboard's rendered pages. Each takes its figures as props so a
// page can hand it the record's numbers or the template's sample ones.

export type Stat1Props = {
  title: string
  value: React.ReactNode
  changeValue: React.ReactNode
  direction?: "up" | "down" | "neutral"
}

/** Logs: title, value, and a coloured change with an arrow. */
export function Stat1({ title, value, changeValue, direction = "up" }: Stat1Props) {
  const variants = {
    up: { Icon: ArrowUpRightIcon, color: "text-green-500" },
    down: { Icon: ArrowDownRightIcon, color: "text-destructive" },
    neutral: { Icon: MinusIcon, color: "text-muted-foreground" },
  }
  const { Icon, color } = variants[direction]
  return (
    <Card className="@container/card gap-4 py-4">
      <CardHeader className="px-4">
        <CardDescription className="font-medium">{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold @[600px]/card:text-4xl @[800px]/card:text-5xl">{value}</CardTitle>
      </CardHeader>
      <CardFooter className={cn("flex-row items-center gap-1 px-4 text-sm font-medium", color)}>
        <Icon className="size-4" />
        <span>{changeValue}</span>
      </CardFooter>
    </Card>
  )
}

export type Stat2Props = {
  title: string
  value: React.ReactNode
  trendValue?: number | null
  footer?: React.ReactNode
}

/** Sales: title, value, a trend badge where there is a comparison, and one stat line beneath. */
export function Stat2({ title, value, trendValue, footer }: Stat2Props) {
  const hasTrend = typeof trendValue === "number"
  const isPositive = hasTrend && trendValue > 0
  const isNeutral = hasTrend && trendValue === 0
  const Icon = isNeutral ? MinusIcon : isPositive ? TrendingUpIcon : TrendingDownIcon
  const trendClass = isNeutral ? "text-foreground bg-muted" : isPositive ? "text-green-500 border-green-500/20 bg-green-500/10" : "text-destructive border-destructive/20 bg-destructive/10"
  const formattedTrend = isNeutral ? "0%" : `${isPositive ? "+" : ""}${trendValue}%`
  return (
    <Card className="@container/card max-sm:py-4">
      <CardHeader className="flex items-start justify-between gap-2 max-sm:px-4">
        <div>
          <CardDescription className="font-medium">{title}</CardDescription>
          <CardTitle className="text-2xl font-bold @[600px]/card:text-4xl @[800px]/card:text-5xl">{value}</CardTitle>
        </div>
        {hasTrend && (
          <Badge variant="outline" className={cn("gap-1 px-1.5 py-0.5", trendClass)}>
            <Icon className="size-3" />
            {formattedTrend}
          </Badge>
        )}
      </CardHeader>
      {footer && (
        <CardFooter className="max-sm:px-4">
          <div className="line-clamp-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            {hasTrend && !isNeutral && <Icon className={cn("size-3.5 shrink-0", isPositive ? "text-green-500" : "text-destructive")} />}
            <span>{footer}</span>
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

/** Customers: title, value, a trend badge beside it, and a note. */
export function StatCustomer({ title, value, trend, note }: { title: string; value: React.ReactNode; trend: string; note: string }) {
  const down = trend.trim().startsWith("-")
  return (
    <Card className="gap-2">
      <CardHeader className="gap-1">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold">{value}</span>
          <Badge variant="outline" className={cn("h-5 gap-1", down ? "text-destructive" : "text-green-600")}>
            {down ? <TrendingDownIcon className="size-3" /> : <TrendingUpIcon className="size-3" />}
            {trend}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}

/** Orders: a label, a big value, and a footer with the target and the change. */
export function StatOrder({ label, value, target, change }: { label: string; value: React.ReactNode; target: string; change: string }) {
  const down = change.trim().startsWith("-")
  return (
    <Card className="gap-0!">
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold">{value}</CardTitle>
      </CardHeader>
      <CardFooter className="flex items-center justify-between pt-4 text-xs">
        <span className="text-muted-foreground">{target}</span>
        <span className={cn("flex items-center gap-1 font-medium", down ? "text-destructive" : "text-green-600")}>
          {down ? <ArrowDownRightIcon className="size-3.5" /> : <ArrowUpRightIcon className="size-3.5" />}
          {change}
        </span>
      </CardFooter>
    </Card>
  )
}

/** Education: title and period, an options menu, a value with a badge, and a note only where one adds something the number does not. */
export function StatEducation({ title, period, value, badge, note, options = ["View details", "Export"] }: { title: string; period: string; value: React.ReactNode; badge: string; note?: string; options?: string[] }) {
  return (
    <Card className="gap-3">
      <CardHeader className="gap-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{period}</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Open options">
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-max min-w-44">
              {options.map((o) => (
                <DropdownMenuItem key={o} className="whitespace-nowrap">
                  {o}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-end gap-2.5">
        <span className="text-3xl font-semibold">{value}</span>
        <Badge variant="outline" className="mb-1 h-5 gap-1 text-green-600">
          <TrendingUpIcon className="size-3" />
          {badge}
        </Badge>
        {note ? <span className="mb-1 text-xs text-muted-foreground">{note}</span> : null}
      </CardContent>
    </Card>
  )
}

/** AI Tokens: title with a badge, a value with a unit, and a note. */
export function StatAi({ title, badge, prefix, value, unit, note, badgeTone = "up" }: { title: string; badge: string; prefix?: string; value: React.ReactNode; unit?: string; note: string; badgeTone?: "up" | "down" | "neutral" }) {
  const tone = badgeTone === "up" ? "text-green-600" : badgeTone === "down" ? "text-destructive" : "text-muted-foreground"
  return (
    <Card className="gap-3">
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Badge variant="outline" className={cn("h-5 gap-1", tone)}>
          {badge}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-2xl font-semibold">
          {prefix && <span className="text-lg text-muted-foreground">{prefix}</span>}
          {value}
          {unit && <span className="ms-1 text-base font-medium text-muted-foreground">{unit}</span>}
        </p>
        <p className="text-xs text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  )
}

/** Crypto: title and description, a value "of" a target, and the share reached. */
export function StatCrypto({ title, description, value, of, percent, note }: { title: string; description: string; value: React.ReactNode; of: React.ReactNode; percent: number; note: string }) {
  return (
    <Card className="gap-3!">
      <CardHeader className="gap-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-2xl font-semibold">
          {value} <span className="text-sm font-normal text-muted-foreground">of {of}</span>
        </p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{percent}%</span> {note}
        </p>
      </CardContent>
    </Card>
  )
}

export type DbStat = {
  title: string
  value: React.ReactNode
  change?: string
  direction?: "up" | "down" | "neutral"
  note?: string
}

/** Database: six tiles inside one card, a hairline between them. */
export function StatDatabaseGrid({ stats }: { stats: DbStat[] }) {
  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <div className="grid grid-cols-1 gap-px bg-border sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {stats.map((s) => {
            const d = s.direction ?? "up"
            const Icon = d === "up" ? ArrowUpRightIcon : d === "down" ? ArrowDownRightIcon : MinusIcon
            return (
              <div key={s.title} className="flex flex-col gap-1.5 bg-card p-4 first:rounded-l-xl last:rounded-r-xl">
                <p className="text-sm text-muted-foreground">{s.title}</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-semibold">{s.value}</span>
                  {s.change && (
                    <span className={cn("flex items-center gap-0.5 text-xs font-medium", d === "up" ? "text-green-600" : d === "down" ? "text-destructive" : "text-muted-foreground")}>
                      <Icon className="size-3.5" />
                      {s.change}
                    </span>
                  )}
                </div>
                {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

/** A number that is still on its way. */
export function Pending({ width = "w-16" }: { width?: string }) {
  return <Skeleton className={cn("inline-block h-6 align-middle", width)} />
}
