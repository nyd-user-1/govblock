"use client"

import * as React from "react"

import type { LinkedInAccount } from "@/lib/linkedin/types"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

// The profile's social accounts (Brendan, 2026-09-17): LinkedIn, which /posts
// publishes to, with who is connected, what it may post to and when the
// grant runs out; X and Facebook beside it, which nothing publishes to yet.

const DAY = 86_400_000

function Mark({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white", className)}>{children}</span>
}

function Row({ mark, name, detail, action }: { mark: React.ReactNode; name: string; detail: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b py-2.5 last:border-b-0">
      {mark}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {action}
    </div>
  )
}

export function SocialAccounts() {
  // undefined while loading; null when this reader may not publish (not an admin).
  const [account, setAccount] = React.useState<LinkedInAccount | null | undefined>(undefined)

  const load = React.useCallback(() => {
    fetch("/api/linkedin/account")
      .then((r) => (r.ok ? r.json() : null))
      .then(setAccount)
      .catch(() => setAccount(null))
  }, [])

  React.useEffect(load, [load])

  const disconnect = async () => {
    await fetch("/api/linkedin/account", { method: "DELETE" })
    load()
  }

  const daysLeft = account?.expiresAt ? Math.max(0, Math.floor((new Date(account.expiresAt).getTime() - Date.now()) / DAY)) : null
  const linkedin =
    account === undefined
      ? "…"
      : account === null
        ? "Publishing from /content-calendar is for admins"
        : !account.configured
          ? "The app's LinkedIn keys are not set"
          : account.connected
            ? (
                <>
                  {account.name} · {account.company ? "profile and company page" : "profile only"} ·{" "}
                  <span className={cn(daysLeft !== null && daysLeft < 7 && "text-destructive")}>expires in {daysLeft} days</span>
                </>
              )
            : "Not connected"

  return (
    <div className="flex flex-col">
      <p className="pb-1 text-sm font-medium">Social accounts</p>
      <Row
        mark={<Mark className="bg-[#0a66c2]">in</Mark>}
        name="LinkedIn"
        detail={linkedin}
        action={
          account?.connected ? (
            <Button variant="outline" size="sm" onClick={disconnect}>
              Disconnect
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled={!account?.configured} render={<a href="/api/linkedin/connect" />}>
              Connect
            </Button>
          )
        }
      />
      <Row
        mark={<Mark className="bg-black">𝕏</Mark>}
        name="X"
        detail="Not available yet"
        action={
          <Button variant="outline" size="sm" disabled>
            Connect
          </Button>
        }
      />
      <Row
        mark={<Mark className="bg-[#1877f2]">f</Mark>}
        name="Facebook"
        detail="Not available yet"
        action={
          <Button variant="outline" size="sm" disabled>
            Connect
          </Button>
        }
      />
    </div>
  )
}
