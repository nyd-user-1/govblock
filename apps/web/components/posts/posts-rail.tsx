"use client"

import * as React from "react"
import { XIcon } from "lucide-react"

import { SiteRail } from "@/components/home/home-rail"
import { MiniCalendar } from "@/components/calendar/mini-calendar"
import { Button } from "@govblock/ui/components/nova/button"
import { SidebarContent } from "@govblock/ui/components/ny4/sidebar"

import { useLinkedIn } from "./post-source"

const DAY = 86_400_000

// The calendar's rail with the LinkedIn connection under the month.
export function PostsRail() {
  return (
    <SidebarContent className="scrollbar-none overflow-x-hidden">
      <div className="flex flex-col gap-3 px-3 pt-3">
        <MiniCalendar />
        <Connection />
      </div>
      <SiteRail />
    </SidebarContent>
  )
}

function Connection() {
  const { account, disconnect, notice, setNotice } = useLinkedIn()
  if (!account) return null

  const connect = (
    <Button size="sm" className="w-full" render={<a href="/api/linkedin/connect" />}>
      {account.connected ? "Reconnect LinkedIn" : "Connect LinkedIn"}
    </Button>
  )

  const daysLeft = account.expiresAt ? Math.floor((new Date(account.expiresAt).getTime() - Date.now()) / DAY) : null

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
      {notice && (
        <div className="flex items-start gap-2 text-destructive">
          <p className="min-w-0 flex-1 break-words">{notice}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>
            <XIcon className="size-4" />
          </button>
        </div>
      )}
      {!account.configured ? (
        <p className="text-muted-foreground">LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are not set on the server.</p>
      ) : account.connected ? (
        <>
          <div className="flex items-center gap-2">
            {account.picture && <img src={account.picture} alt="" className="size-7 rounded-full" />}
            <span className="min-w-0 truncate font-medium">{account.name}</span>
          </div>
          <p className="text-muted-foreground">
            {account.company ? "Profile and company page" : "Profile only"}
            {daysLeft !== null && <span className={daysLeft < 7 ? "text-destructive" : undefined}> · expires in {Math.max(daysLeft, 0)} days</span>}
          </p>
          {daysLeft !== null && daysLeft < 7 && connect}
          <Button variant="ghost" size="sm" className="w-full" onClick={() => disconnect()}>
            Disconnect
          </Button>
        </>
      ) : (
        connect
      )}
    </div>
  )
}
