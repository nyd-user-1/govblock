"use client"

import * as React from "react"
import { CheckIcon, LockIcon } from "lucide-react"

import { accessTo } from "@/lib/map/access"
import { overlayFor, type OverlayId } from "@/lib/map/overlays"
import { SidebarMenuSubButton } from "@govblock/ui/components/ny4/sidebar"

// A chamber in the rail: its seal, its name, and what it is doing — a tick
// while its districts are drawn, a lock and the word that would unlock it
// otherwise. Locked is drawn, never hidden, so a reader can see what the
// map holds before deciding it is worth an account.

export function ChamberRow({
  code,
  chamber,
  active,
  reader,
  onOpen,
  children,
}: {
  code: string
  chamber: string
  active: Set<OverlayId>
  reader: { signedIn: boolean; home: string }
  onOpen: () => void
  /** The chamber's seal. */
  children: React.ReactNode
}) {
  const o = overlayFor(code, chamber)
  const access = o
    ? accessTo(o.id, reader)
    : ({ open: false, reason: "Plan", why: "No boundaries on file" } as const)
  const drawn = !!o && active.has(o.id)

  return (
    <SidebarMenuSubButton asChild>
      <button
        type="button"
        disabled={!access.open}
        onClick={onOpen}
        title={access.open ? undefined : access.why}
        className="w-full cursor-pointer disabled:cursor-default"
      >
        {children}
        <span className="min-w-0 flex-1 truncate text-left">{chamber}</span>
        {drawn && o?.color ? (
          <span className="flex shrink-0 items-center gap-1">
            <span
              className="inline-block h-0.5 w-3 rounded-full"
              style={{ background: o.color }}
            />
            <CheckIcon className="size-3.5" />
          </span>
        ) : access.open ? null : (
          <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
            <LockIcon className="size-3" />
            {access.reason}
          </span>
        )}
      </button>
    </SidebarMenuSubButton>
  )
}
