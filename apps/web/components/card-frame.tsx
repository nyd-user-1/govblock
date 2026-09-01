"use client"

import * as React from "react"
import { EllipsisVerticalIcon } from "lucide-react"

import { SIZE_CHOICES, SIZE_LABEL } from "@/lib/layout"
import { useJurisdiction } from "@/lib/policy/jurisdiction"
import { usePolicy } from "@/lib/policy/use-policy"
import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/button"
import { Card } from "@govblock/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@govblock/ui/components/dropdown-menu"

// Ported from livingston-v3 components/create/card-frame.tsx. The card chrome,
// once, for every card: CardFrame is the Card primitive with a component id;
// ComponentActions is the ⋮ menu. Every item is inert here — the menu shows
// the states a card in the editable, sourced position would show. Disabled
// items render disabled, never hidden.

export function CardFrame({
  id,
  className,
  children,
  ...props
}: React.ComponentProps<typeof Card> & { id: string }) {
  return (
    <Card data-component={id} className={cn("relative", className)} {...props}>
      {children}
    </Card>
  )
}

// Choose Session — the first item of every card's menu (Brendan, 2026-09-01: it
// used to be a footer picker on some cards). The jurisdiction's own sessions,
// newest first; choosing one writes the shared scope, so every card follows.
function ChooseSession() {
  const { state, session, resolved, setSession } = useJurisdiction()
  const { data } = usePolicy<{ session_id: number; bills: number; title: string }[]>(resolved ? "sessions" : null, { state })
  const sessions = data ?? []
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Choose Session</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={session ? String(session) : ""} onValueChange={(value) => setSession(String(value))}>
          {sessions.map((row) => (
            <DropdownMenuRadioItem key={row.session_id} value={String(row.session_id)}>
              {row.title || String(row.session_id)}
            </DropdownMenuRadioItem>
          ))}
          {!sessions.length && <DropdownMenuItem disabled>No sessions</DropdownMenuItem>}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

export function ComponentActions({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Component options" />}
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <ChooseSession />
          <DropdownMenuItem>Edit Component</DropdownMenuItem>
          <DropdownMenuItem>Choose Component</DropdownMenuItem>
          <DropdownMenuItem>Save Component</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Full Screen</DropdownMenuItem>
          <DropdownMenuItem>Download data (CSV)</DropdownMenuItem>
          <DropdownMenuItem>Download data (JSON)</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Rearrange</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Size</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup value="">
                {SIZE_CHOICES.map((name) => (
                  <DropdownMenuRadioItem key={name} value={name}>
                    {SIZE_LABEL[name]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem disabled>Reset Component</DropdownMenuItem>
          <DropdownMenuItem>Reset layout</DropdownMenuItem>
          <DropdownMenuItem variant="destructive">Delete Component</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
