"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronDown } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { usePendingSession } from "@/components/policy/pending-session"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@govblock/ui/components/nova/dropdown-menu"

// The Sessions menu at the top right of every block on a member's page — the
// data table's Columns menu, repurposed (Brendan, 2026-09-05). Picking a
// session reloads the page on it; the record, the lists and the tables all
// read the session from the URL.
export type SessionOption = { value: number; label: string }

export function SessionsMenu({ sessions, current }: { sessions: SessionOption[]; current: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { start } = usePendingSession()
  function choose(value: number) {
    const next = new URLSearchParams(params.toString())
    next.set("session", String(value))
    // Inside a transition, so every Figure on the page pulses until the new
    // session's page lands.
    start(() => router.push(`${pathname}?${next.toString()}`))
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="ml-auto">
            Sessions <ChevronDown />
          </Button>
        }
      />
      {/* At least w-44, and as wide as its widest item: an item never wraps (Brendan, 2026-09-05). */}
      <DropdownMenuContent align="end" className="w-max min-w-44">
        {sessions.map((s) => (
          <DropdownMenuCheckboxItem key={s.value} className="whitespace-nowrap" checked={s.value === current} onCheckedChange={() => choose(s.value)}>
            {s.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
