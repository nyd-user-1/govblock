"use client"

import * as React from "react"

import { cn } from "@govblock/ui/lib/utils"
import { Button } from "@govblock/ui/components/ny4/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"

// The floating pill: dark, rounded, bottom of the stage. Two of them on
// /create — the block switch at the right (01 the cards, 02 to 07 the blocks)
// and the variant switch at the left (State, Design). Same pill the typeset
// toolbar and the preview's kind switch already wear, so the stage reads as
// one instrument.

export function Fab({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("dark z-20 flex items-center gap-1 rounded-xl bg-card/90 p-1 shadow-xl backdrop-blur-xl", className)}>{children}</div>
}

// `tip` names the button on hover, the way /typeset's toolbar names its
// numbered pages — a "04" says nothing on its own.
export function FabButton({ active, tip, className, children, ...props }: React.ComponentProps<typeof Button> & { active?: boolean; tip?: string }) {
  const button = (
    <Button
      variant="ghost"
      size="sm"
      data-active={active}
      className={cn(
        "h-7 min-w-8 cursor-pointer rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
  if (!tip) return React.cloneElement(button, undefined, children)
  return (
    <Tooltip>
      <TooltipTrigger render={button}>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={10}>
        {tip}
      </TooltipContent>
    </Tooltip>
  )
}
