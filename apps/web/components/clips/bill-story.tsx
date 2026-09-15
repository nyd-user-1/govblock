"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { PlusIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/ny4/button"
import { Dialog, DialogDescription, DialogHeader, DialogPopup, DialogTitle } from "@govblock/ui/components/animate-ui/components/base/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/tooltip"

// The plus beside a bill's copy button (Brendan, 2026-09-15): a video of the
// bill's journey, in the Studio's bill history template, playing at once in
// the browser. The bill's data is read when the plus is pressed, never on the
// page's load, and the player loads with it; nothing renders on a server.

const Story = dynamic(() => import("./bill-story-player").then((m) => m.BillStoryPlayer), {
  ssr: false,
  loading: () => <div className="aspect-9/16 h-[min(70vh,640px)] animate-pulse rounded-2xl bg-foreground/10" />,
})

export function BillStoryButton({ billId, label }: { billId: number; label: string }) {
  const [open, setOpen] = React.useState(false)
  const button = (
    <Button variant="secondary" size="sm" className="size-8 shadow-none md:size-7" aria-label="Make a video of this bill" onClick={() => setOpen(true)}>
      <PlusIcon aria-hidden />
    </Button>
  )
  return (
    <>
      <Tooltip>
        <TooltipTrigger render={button} />
        <TooltipContent side="bottom" sideOffset={6}>
          Make a video of this bill
        </TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup from="top" showCloseButton className="w-auto max-w-[calc(100vw-2rem)] sm:max-w-none">
          <DialogHeader className="sr-only">
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>The bill's journey as a video.</DialogDescription>
          </DialogHeader>
          {open && <Story billId={billId} />}
        </DialogPopup>
      </Dialog>
    </>
  )
}
