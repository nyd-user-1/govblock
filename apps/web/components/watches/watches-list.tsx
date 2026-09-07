"use client"

import * as React from "react"
import Link from "next/link"
import { InboxIcon, MoreHorizontalIcon, RefreshCwIcon, SearchIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Input } from "@govblock/ui/components/nova/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { cn } from "@govblock/ui/lib/utils"

import type { Watch } from "@/lib/watches/db"
import { describeSteps, describeTrigger } from "@/lib/watches/templates"
import { Gate, ago, useAccount } from "./shared"

// Watches, as the Cloudflare dashboard lists Workers: the title and the
// Create button, a search and two selects, a card a watch with its name,
// what it waits for, when it last ran and its menu, and a footer that opens
// its runs. The rail on the right: this month's usage against the
// allowance, the model time, the period's figures, the account.

type Payload = {
  user: { id: string; email: string | null; name: string | null }
  watches: (Watch & { bill_label: string | null })[]
  usage: { period_start: string; runs: number; deliveries: number; waiting: number; agent_steps: number; tokens: number; watches: number; on: number }
}

const ALLOWANCE = 200

export function WatchesList() {
  const { account, ready } = useAccount()
  const [data, setData] = React.useState<Payload | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [show, setShow] = React.useState<"all" | "on" | "off" | "waiting">("all")
  const [sort, setSort] = React.useState<"modified" | "name" | "runs">("modified")

  const load = React.useCallback(async () => {
    setBusy(true)
    const r = await fetch("/api/watches", { credentials: "same-origin" })
    if (r.ok) setData((await r.json()) as Payload)
    setBusy(false)
  }, [])
  React.useEffect(() => {
    if (account) void load()
  }, [account, load])

  const toggle = async (w: Watch) => {
    await fetch(`/api/watches/${w.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: !w.enabled }) })
    void load()
  }
  const remove = async (w: Watch) => {
    await fetch(`/api/watches/${w.id}`, { method: "DELETE" })
    void load()
  }

  if (ready && !account) return <Gate what="Watches" />

  const rows = (data?.watches ?? [])
    .filter((w) => (show === "on" ? w.enabled : show === "off" ? !w.enabled : show === "waiting" ? (w.waiting ?? 0) > 0 : true))
    .filter((w) => !query || `${w.name} ${w.bill_label ?? ""} ${describeTrigger(w.trigger)}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "runs" ? (b.runs ?? 0) - (a.runs ?? 0) : b.updated_at.localeCompare(a.updated_at)))
  const u = data?.usage

  return (
    <div className="container-wrapper">
      <div className="grid gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6">
        <div>
          <div className="flex flex-wrap items-start gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Watches</h1>
              <p className="mt-1 text-sm text-muted-foreground">What the record does, told to you the way you asked.</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" render={<Link href="/watches/inbox" />} className="gap-1.5">
                <InboxIcon className="size-4" /> Inbox
                {u && u.waiting > 0 && <Badge className="ml-0.5 h-5 px-1.5">{u.waiting}</Badge>}
              </Button>
              <Button render={<Link href="/watches/new" />}>Create watch</Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-64">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search watches" className="h-10 pl-9" />
            </div>
            <Select value={show} onValueChange={(v) => v && setShow(v as typeof show)}>
              <SelectTrigger className="h-10 w-max min-w-32" aria-label="Show">
                <SelectValue>{() => ({ all: "Show all", on: "On", off: "Off", waiting: "Waiting on you" })[show]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="w-max min-w-44">
                <SelectItem value="all" className="whitespace-nowrap">
                  Show all
                </SelectItem>
                <SelectItem value="on" className="whitespace-nowrap">
                  On
                </SelectItem>
                <SelectItem value="off" className="whitespace-nowrap">
                  Off
                </SelectItem>
                <SelectItem value="waiting" className="whitespace-nowrap">
                  Waiting on you
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => v && setSort(v as typeof sort)}>
              <SelectTrigger className="h-10 w-max min-w-36" aria-label="Sort">
                <SelectValue>{() => ({ modified: "Last modified", name: "Name", runs: "Most runs" })[sort]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="w-max min-w-44">
                <SelectItem value="modified" className="whitespace-nowrap">
                  Last modified
                </SelectItem>
                <SelectItem value="name" className="whitespace-nowrap">
                  Name
                </SelectItem>
                <SelectItem value="runs" className="whitespace-nowrap">
                  Most runs
                </SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="size-10" aria-label="Refresh" onClick={() => void load()}>
              <RefreshCwIcon className={cn("size-4", busy && "animate-spin")} />
            </Button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {data && rows.length === 0 && (
              <div className="rounded-xl border border-dashed p-12 text-center">
                <p className="text-sm text-muted-foreground">{query || show !== "all" ? "Nothing matches." : "No watches yet."}</p>
                {!query && show === "all" && (
                  <Button render={<Link href="/watches/new" />} size="sm" className="mt-4">
                    Create your first watch
                  </Button>
                )}
              </div>
            )}
            {!data && account && <div className="h-24 animate-pulse rounded-xl border bg-muted/30" />}
            {rows.map((w) => (
              <div key={w.id} className={cn("rounded-xl border bg-card", !w.enabled && "opacity-70")}>
                <div className="flex items-start gap-4 p-4">
                  <span className={cn("mt-2 size-2 shrink-0 rounded-full", w.enabled ? "bg-green-500" : "bg-muted-foreground/40")} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/watches/${w.id}`} className="text-[15px] font-semibold hover:underline">
                      {w.name}
                    </Link>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{describeTrigger(w.trigger, w.bill_label ?? undefined)}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/80">{describeSteps(w.steps)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {(w.waiting ?? 0) > 0 && <Badge variant="secondary">Waiting on you</Badge>}
                    <span className="text-sm whitespace-nowrap text-muted-foreground">{ago(w.last_run_at ?? w.updated_at)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Menu" />}>
                        <MoreHorizontalIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-max min-w-44">
                        <DropdownMenuItem className="whitespace-nowrap" onClick={() => void toggle(w)}>
                          {w.enabled ? "Turn off" : "Turn on"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="whitespace-nowrap" render={<Link href={`/watches/${w.id}`} />}>
                          View runs
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" className="whitespace-nowrap" onClick={() => void remove(w)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t px-4 py-2.5 text-sm">
                  <Link href={`/watches/${w.id}`} className="text-muted-foreground hover:text-foreground">
                    View runs ↗
                  </Link>
                  <span className="text-muted-foreground tabular-nums">
                    {w.runs ?? 0} {w.runs === 1 ? "run" : "runs"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Usage</h2>
              <Button size="sm" variant="secondary" disabled>
                Upgrade
              </Button>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Runs this month</span>
              <span className="tabular-nums">
                {u?.runs ?? 0} / {ALLOWANCE.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, ((u?.runs ?? 0) / ALLOWANCE) * 100)}%` }} />
            </div>
          </div>
          <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <span className="text-sm font-medium">Model time</span>
              <span className="text-xs text-muted-foreground">this period</span>
            </div>
            <div className="flex items-center gap-4 p-5">
              <span className="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-muted text-sm font-semibold tabular-nums">$0.00</span>
              <p className="text-sm text-muted-foreground">
                {u?.tokens ? `${u.tokens.toLocaleString()} tokens across ${u.agent_steps} agent ${u.agent_steps === 1 ? "step" : "steps"}. ` : "No agent steps yet. "}
                Model time is on the house while Watches is new.
              </p>
            </div>
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            {u ? `${new Date(u.period_start).toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Runs", u?.runs ?? 0],
              ["Deliveries", u?.deliveries ?? 0],
              ["Waiting on you", u?.waiting ?? 0],
              ["Agent steps", u?.agent_steps ?? 0],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{k}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-semibold">Account</h3>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="truncate">{account?.email ?? "—"}</dd>
              <dt className="text-muted-foreground">Watches</dt>
              <dd>
                {u?.on ?? 0} on, {(u?.watches ?? 0) - (u?.on ?? 0)} off
              </dd>
              <dt className="text-muted-foreground">Tick</dt>
              <dd>nightly, after the record</dd>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}
