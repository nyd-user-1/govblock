"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

import { Badge } from "@govblock/ui/components/nova/badge"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import type { Delivery } from "@/lib/watches/db"
import { Gate, ago, useAccount } from "./shared"

// The inbox: everything a watch handed the reader, newest first. An
// approval carries the draft and two buttons; the answer wakes the run on
// the next tick. Emails, Slack posts and webhooks show as sent or failed.

export function WatchInbox() {
  const { account, ready } = useAccount()
  const [items, setItems] = React.useState<Delivery[] | null>(null)
  const [open, setOpen] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    const r = await fetch("/api/watches/inbox", { credentials: "same-origin" })
    if (r.ok) setItems(((await r.json()) as { items: Delivery[] }).items)
  }, [])
  React.useEffect(() => {
    if (account) void load()
  }, [account, load])

  const act = async (d: Delivery, action: "approve" | "decline" | "read") => {
    await fetch(`/api/watches/inbox/${d.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) })
    void load()
  }

  if (ready && !account) return <Gate what="Watches" />
  const waiting = (items ?? []).filter((d) => d.via === "approval" && d.status === "waiting")
  const rest = (items ?? []).filter((d) => !(d.via === "approval" && d.status === "waiting"))

  const Item = ({ d }: { d: Delivery }) => {
    const isOpen = open === d.id
    const approval = d.via === "approval"
    return (
      <div className={cn("border-b last:border-b-0", !d.read_at && !approval && "bg-accent/20")}>
        <button
          type="button"
          onClick={() => {
            setOpen(isOpen ? null : d.id)
            if (!d.read_at && !approval) void act(d, "read")
          }}
          className="flex w-full items-center gap-4 px-4 py-3 text-left text-sm"
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              approval ? (d.status === "waiting" ? "bg-amber-500" : d.status === "approved" ? "bg-green-500" : "bg-muted-foreground/50") : d.status === "failed" ? "bg-destructive" : d.read_at ? "bg-muted-foreground/30" : "bg-sky-500"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate", !d.read_at && "font-semibold")}>{d.subject ?? "(no subject)"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {d.watch_name ?? "watch"} · {approval ? ({ waiting: "waiting on you", approved: "approved", declined: "declined", expired: "expired" }[d.status] ?? d.status) : `${d.via}${d.to_addr ? ` · ${d.to_addr}` : ""} · ${d.status}`}
              {d.error ? ` · ${d.error}` : ""}
            </p>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{ago(d.at)}</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 pl-10">
            <div className="rounded-lg border bg-card p-4 text-sm whitespace-pre-wrap">{d.body}</div>
            {approval && d.status === "waiting" && (
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => void act(d, "approve")}>
                  Approve and send
                </Button>
                <Button size="sm" variant="outline" onClick={() => void act(d, "decline")}>
                  Decline
                </Button>
                <span className="text-xs text-muted-foreground">Sent on the next tick after you approve.</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="container-wrapper">
      <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
        <Link href="/watches" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeftIcon className="size-4" /> Watches
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          {waiting.length > 0 && <Badge>{waiting.length} waiting on you</Badge>}
        </div>
        {waiting.length > 0 && (
          <>
            <h2 className="mt-6 text-sm font-medium text-muted-foreground">Waiting on you</h2>
            <div className="mt-2 overflow-hidden rounded-xl border">
              {waiting.map((d) => (
                <Item key={d.id} d={d} />
              ))}
            </div>
          </>
        )}
        <h2 className="mt-6 text-sm font-medium text-muted-foreground">Everything</h2>
        <div className="mt-2 overflow-hidden rounded-xl border">
          {items && rest.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Nothing yet.</p>}
          {!items && <div className="h-16 animate-pulse bg-muted/30" />}
          {rest.map((d) => (
            <Item key={d.id} d={d} />
          ))}
        </div>
      </div>
    </div>
  )
}
