"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeftIcon, MoreHorizontalIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"
import { Switch } from "@govblock/ui/components/ny4/switch"
import { cn } from "@govblock/ui/lib/utils"

import type { Run, Watch } from "@/lib/watches/db"
import { describeSteps, describeTrigger } from "@/lib/watches/templates"
import { Gate, ago, useAccount } from "./shared"

// One watch: what it waits for, what it does, whether it is on, and every
// run it has had, each with where it stopped and why.

const STATUS: Record<string, { label: string; tone: string }> = {
  running: { label: "Running", tone: "bg-sky-500" },
  waiting_until: { label: "Waiting", tone: "bg-amber-500" },
  waiting_approval: { label: "Waiting on you", tone: "bg-amber-500" },
  done: { label: "Done", tone: "bg-green-500" },
  failed: { label: "Failed", tone: "bg-destructive" },
}

export function WatchPage({ id }: { id: string }) {
  const router = useRouter()
  const { account, ready } = useAccount()
  const [data, setData] = React.useState<{ watch: Watch; runs: Run[] } | null>(null)
  const [missing, setMissing] = React.useState(false)

  const load = React.useCallback(async () => {
    const r = await fetch(`/api/watches/${id}`, { credentials: "same-origin" })
    if (r.status === 404) return setMissing(true)
    if (r.ok) setData((await r.json()) as { watch: Watch; runs: Run[] })
  }, [id])
  React.useEffect(() => {
    if (account) void load()
  }, [account, load])

  if (ready && !account) return <Gate what="Watches" />
  if (missing)
    return (
      <div className="container-wrapper px-6 py-20 text-center text-sm text-muted-foreground">
        No such watch.{" "}
        <Link href="/watches" className="underline">
          Back to Watches
        </Link>
      </div>
    )
  if (!data)
    return (
      <div className="container-wrapper px-6 py-8">
        <div className="h-24 animate-pulse rounded-xl border bg-muted/30" />
      </div>
    )
  const { watch, runs } = data

  const toggle = async (on: boolean) => {
    await fetch(`/api/watches/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: on }) })
    void load()
  }
  const remove = async () => {
    await fetch(`/api/watches/${id}`, { method: "DELETE" })
    router.push("/watches")
  }
  const [test, setTest] = React.useState<string | null>(null)
  const sendTest = async () => {
    setTest("Queuing…")
    const r = await fetch(`/api/watches/${id}/test`, { method: "POST" })
    const d = (await r.json().catch(() => ({}))) as { ok?: boolean; kind?: string; error?: string }
    setTest(r.ok ? "Queued. It runs on the next tick." : (d.error ?? "Could not queue a test."))
  }

  return (
    <div className="container-wrapper">
      <div className="px-4 py-8 lg:px-6">
        <Link href="/watches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" /> Watches
        </Link>
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight">{watch.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{describeTrigger(watch.trigger)}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{describeSteps(watch.steps)}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={watch.enabled} onCheckedChange={(v) => void toggle(!!v)} />
              {watch.enabled ? "On" : "Off"}
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="icon-sm" aria-label="Menu" />}>
                <MoreHorizontalIcon className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-max min-w-44">
                <DropdownMenuItem className="whitespace-nowrap" onClick={() => void sendTest()}>
                  Send a test event
                </DropdownMenuItem>
                <DropdownMenuItem className="whitespace-nowrap" render={<Link href="/watches/inbox" />}>
                  Open the inbox
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" className="whitespace-nowrap" onClick={() => void remove()}>
                  Delete watch
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {test && <p className="mt-3 text-sm text-muted-foreground">{test}</p>}
        <h2 className="mt-8 text-sm font-medium text-muted-foreground">Runs</h2>
        <div className="mt-2 overflow-hidden rounded-xl border">
          {runs.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No runs yet. The next tick after the record moves will start one.</p>}
          {runs.map((r) => {
            const st = STATUS[r.status] ?? { label: r.status, tone: "bg-muted-foreground" }
            const total = Array.isArray(r.steps) ? r.steps.length : 0
            return (
              <div key={r.id} className="flex items-center gap-4 border-b px-4 py-3 text-sm last:border-b-0">
                <span className={cn("size-2 shrink-0 rounded-full", st.tone)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.subject ?? r.id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {st.label} · step {Math.min(r.step, total)} of {total}
                    {r.last_error ? ` · ${r.last_error}` : ""}
                    {r.status === "waiting_until" && r.wake_at ? ` · wakes ${new Date(r.wake_at.replace(" ", "T")).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : ""}
                  </p>
                </div>
                {r.status === "waiting_approval" && (
                  <Button size="sm" variant="outline" render={<Link href="/watches/inbox" />}>
                    Review
                  </Button>
                )}
                {r.attempts > 0 && r.status !== "done" && <Badge variant="outline">retry {r.attempts}</Badge>}
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{ago(r.started_at)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
