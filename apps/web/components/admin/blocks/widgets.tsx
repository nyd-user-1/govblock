"use client"

import * as React from "react"
import { ActivityIcon, AlertCircleIcon, ArrowRightIcon, CalendarDays, CheckCircle2Icon, CheckIcon, CpuIcon, DatabaseIcon, GlobeIcon, HardDriveIcon, LockIcon, NetworkIcon, PauseIcon, PlayIcon, SparklesIcon, TerminalIcon, Trash2Icon, ZapIcon, type LucideIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@govblock/ui/components/nova/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Progress } from "@govblock/ui/components/progress"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { cn } from "@govblock/ui/lib/utils"

// paceui's widget blocks: the live console, the quota list, the traffic
// sources and the promo card. The console takes a feed of lines and plays
// them in; the record's stream stands in for the template's random requests.

export type LogEntry = { id: string; timestamp: string; method: string; path: string; status: number | string; latency: string; bad?: boolean }

const METHODS = ["GET", "POST", "PUT", "DELETE"]
const PATHS = ["/api/v1/users", "/api/auth/login", "/api/products", "/api/settings", "/health"]
const STATUSES = [200, 200, 200, 201, 400, 401, 404, 500]

function sampleLog(): LogEntry {
  const status = STATUSES[Math.floor(Math.random() * STATUSES.length)]
  return {
    id: Math.random().toString(36).slice(2, 9),
    timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    method: METHODS[Math.floor(Math.random() * METHODS.length)],
    path: PATHS[Math.floor(Math.random() * PATHS.length)],
    status,
    latency: `${Math.floor(Math.random() * 200) + 20}ms`,
    bad: status > 400,
  }
}

/** Logs: a console that fills a line at a time. `feed` supplies the lines; without one it invents requests. */
export function Widget1({ title = "Live Console", feed, empty = "Waiting for incoming requests..." }: { title?: string; feed?: LogEntry[]; empty?: string }) {
  const [logs, setLogs] = React.useState<LogEntry[]>([])
  const [paused, setPaused] = React.useState(false)
  const cursor = React.useRef(0)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (paused) return
    const tick = () => {
      setLogs((prev) => {
        const next = feed ? feed[cursor.current++ % Math.max(1, feed.length)] : sampleLog()
        if (!next) return prev
        const out = [...prev, feed ? { ...next, id: `${next.id}-${cursor.current}` } : next]
        return out.length > 20 ? out.slice(out.length - 20) : out
      })
    }
    const interval = setInterval(tick, 2000)
    return () => clearInterval(interval)
  }, [paused, feed])

  React.useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>("[data-slot=scroll-area-viewport]") ?? scrollRef.current
    if (viewport && !paused && viewport.scrollHeight - (viewport.scrollTop + viewport.clientHeight) < 80) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
  }, [logs, paused])

  return (
    <Card className="flex h-full flex-col gap-0 pt-3 pb-0">
      <CardHeader className="flex items-center justify-between space-y-0 border-b px-4 pb-3!">
        <div className="flex items-center gap-2">
          <TerminalIcon className="size-4" />
          <CardTitle className="flex items-center gap-3 whitespace-nowrap">
            <p>{title}</p>
            <div className="size-1.25 rounded-full bg-foreground/15 max-sm:hidden" />
            <span className="text-xs text-muted-foreground max-sm:hidden">Last {logs.length} events</span>
          </CardTitle>
        </div>
        <div className="flex items-center gap-0">
          <Button variant="ghost" size="icon-sm" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume" : "Pause"}>
            {paused ? <PlayIcon className="size-4" /> : <PauseIcon className="size-4" />}
          </Button>
          <Button aria-label="Clear" variant="destructive" className="bg-transparent" size="icon-sm" onClick={() => setLogs([])}>
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-64 min-h-0 grow px-1.5 pt-0">
        {logs.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-4 text-muted-foreground">
            <ActivityIcon className="size-6" />
            <span>{empty}</span>
          </div>
        )}
        <ScrollArea ref={scrollRef} className="flex h-full flex-col gap-px">
          <div className="my-1.5">
            {logs.map((log) => (
              <div key={log.id} className="group flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 text-sm hover:bg-accent animate-in fade-in slide-in-from-left-2 duration-200">
                <span className="w-20 shrink-0 text-muted-foreground">{log.timestamp}</span>
                <span className={cn("w-12 shrink-0 text-xs font-medium", ["GET", "POST"].includes(log.method) && "text-primary", log.method === "DELETE" && "text-destructive")}>{log.method}</span>
                <span className={cn("w-10 shrink-0 font-medium", log.bad && "text-destructive")}>{log.status}</span>
                <span className="grow truncate text-muted-foreground">{log.path}</span>
                <span className="min-w-12 shrink-0 text-end text-xs text-muted-foreground">{log.latency}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export type Quota = { id: string; name: string; icon: LucideIcon; used: number; limit: number; unit: string; resetIn?: string | null }

export const SAMPLE_QUOTAS: Quota[] = [
  { id: "daily-req", name: "Daily Requests", icon: ZapIcon, used: 81512, limit: 100000, unit: "reqs", resetIn: "4h 12m" },
  { id: "bandwidth", name: "Egress Bandwidth", icon: NetworkIcon, used: 45.2, limit: 100, unit: "GB", resetIn: "4h 12m" },
  { id: "db-conn", name: "Active DB Connections", icon: DatabaseIcon, used: 89, limit: 100, unit: "conns", resetIn: null },
  { id: "storage", name: "Log Storage (Retention)", icon: HardDriveIcon, used: 3.2, limit: 5.0, unit: "TB", resetIn: null },
]

/** Logs: quotas as a list with a thin bar each; a badge in the corner names the load. */
export function Widget5({ title = "System Limits", description = "Resource usage against plan quotas.", quotas = SAMPLE_QUOTAS, badge, footer = "Manage Plan & Limits", onFooter, critical = 85 }: { title?: string; description?: string; quotas?: Quota[]; badge?: React.ReactNode; footer?: string; onFooter?: () => void; critical?: number }) {
  const anyCritical = quotas.some((q) => (q.used / q.limit) * 100 >= critical)
  return (
    <Card className="flex flex-col gap-5 py-4">
      <CardHeader className="px-4">
        <CardTitle className="flex items-center gap-2">
          <CpuIcon className="size-4.5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          {badge ?? (
            <Badge variant={anyCritical ? "destructive" : "secondary"}>
              {anyCritical && <AlertCircleIcon className="size-4" />}
              <span>{anyCritical ? "Critical Load" : "Healthy"}</span>
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        {quotas.map((item) => {
          const percentage = Math.min(100, Math.round((item.used / item.limit) * 100))
          const isCritical = percentage >= critical
          return (
            <div key={item.id} className="group flex flex-col">
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div className={cn("flex size-8 items-center justify-center rounded-md border bg-muted", isCritical && "border-destructive/20 bg-destructive/10 text-destructive")}>
                    <item.icon className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="leading-none font-medium max-sm:text-xs">{item.name}</span>
                    {item.resetIn && <span className="text-xs text-muted-foreground">Resets in {item.resetIn}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-end">
                  <p className="font-mono text-[10px] tracking-tight sm:text-xs">
                    {item.used.toLocaleString()} <span className="text-muted-foreground">/ {item.limit.toLocaleString()} {item.unit}</span>
                  </p>
                  <Progress aria-label={`Usage for ${item.name}`} value={percentage} className={cn("w-28 bg-muted **:data-[slot=progress-indicator]:bg-green-600 *:data-[slot=progress-track]:h-1", isCritical && "**:data-[slot=progress-indicator]:bg-destructive")} />
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
      <CardFooter className="flex items-center justify-center">
        <Button variant="outline" size="sm" onClick={onFooter}>
          {footer}
        </Button>
      </CardFooter>
    </Card>
  )
}

type RangeKey = "7d" | "30d" | "90d" | "year"
const RANGES: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "This Week" },
  { value: "30d", label: "This Month" },
  { value: "90d", label: "Last 3 Months" },
  { value: "year", label: "Year to Date" },
]

export type Source = { key: string; label: string; icon?: LucideIcon; sub: string; value: React.ReactNode; percent: number; tone?: string; toneBg?: string }

const TONES = [
  ["text-blue-500", "bg-blue-50 dark:bg-blue-800/20"],
  ["text-rose-500", "bg-rose-50 dark:bg-rose-800/20"],
  ["text-pink-500", "bg-pink-50 dark:bg-pink-800/20"],
  ["text-sky-500", "bg-sky-50 dark:bg-sky-800/20"],
  ["text-emerald-500", "bg-emerald-50 dark:bg-emerald-800/20"],
]

export const SAMPLE_SOURCES: Source[] = [
  { key: "facebook", label: "Facebook", sub: "12,450 visitors", value: "$45,200", percent: 78 },
  { key: "instagram", label: "Instagram", sub: "8,300 visitors", value: "$28,500", percent: 62 },
  { key: "dribbble", label: "Dribbble", sub: "4,100 visitors", value: "$12,100", percent: 45 },
  { key: "google", label: "Google Ads", sub: "2,400 visitors", value: "$8,400", percent: 25 },
]

/** Sales: a list of sources, each with an icon tile, two lines, a figure and a bar. */
export function Analytics7({ title = "Traffic Sources", description = "Revenue contribution from each traffic source", sources = SAMPLE_SOURCES }: { title?: string; description?: string; sources?: Source[] }) {
  const [range, setRange] = React.useState<RangeKey>("30d")
  const selected = RANGES.find((r) => r.value === range)?.label
  return (
    <Card className="gap-3 max-md:py-4!">
      <CardHeader className="max-md:px-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="gap-2 max-md:size-8">
                  <CalendarDays className="size-4 text-muted-foreground" />
                  <span className="max-md:hidden">{selected}</span>
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-max min-w-44">
              {RANGES.map((item) => (
                <DropdownMenuItem key={item.value} onClick={() => setRange(item.value)} className="whitespace-nowrap justify-between">
                  {item.label}
                  {range === item.value && <CheckIcon className="size-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5 max-md:px-4">
        {sources.map((item, i) => {
          const Icon = item.icon ?? GlobeIcon
          const [fg, bg] = TONES[i % TONES.length]
          return (
            <div key={item.key} className="group flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", item.toneBg ?? bg)}>
                    <Icon className={cn("size-5", item.tone ?? fg)} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-base font-medium">
                    {item.value}
                    <span className="ms-1 text-xs text-muted-foreground">({item.percent}%)</span>
                  </p>
                  <div className="mt-1 flex items-center justify-end gap-2.5">
                    <Progress aria-label={`Progress for ${item.label}`} value={item.percent} className="h-1 w-30 bg-muted **:data-[slot=progress-indicator]:bg-primary/70 *:data-[slot=progress-track]:h-1" />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

/** Sales: the locked-feature promo. */
export function Promo1({
  badge = "Pro Feature",
  title = "Unlock Advanced Analytics",
  description = "Gain deeper insights into customer behavior and retention trends.",
  points = ["Unlimited historical data", "Export reports to CSV/PDF", "AI-powered forecasting"],
  cta = "Upgrade to Pro",
  href,
  onClick,
}: {
  badge?: string
  title?: string
  description?: string
  points?: string[]
  cta?: string
  href?: string
  onClick?: () => void
}) {
  return (
    <Card className="relative">
      <div className="absolute top-3 left-3 flex size-10 items-center justify-center rounded-full bg-primary/10 ring-6 ring-primary/5 md:top-6 md:left-6">
        <LockIcon className="size-5 text-primary" />
      </div>
      <CardHeader className="relative flex flex-col items-center text-center">
        <Badge variant="secondary">{badge}</Badge>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription className="mx-auto max-w-70">{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
        {points.map((p) => (
          <div key={p} className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-green-500" />
            <span>{p}</span>
          </div>
        ))}
      </CardContent>
      <CardFooter className="justify-center">
        <Button className="gap-2 px-4" render={href ? <a href={href} /> : undefined} onClick={onClick}>
          <SparklesIcon className="size-4" />
          {cta}
          <ArrowRightIcon className="size-4 opacity-75" />
        </Button>
      </CardFooter>
    </Card>
  )
}
