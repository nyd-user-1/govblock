"use client"

import * as React from "react"
import Link from "next/link"

import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@govblock/ui/components/animate-ui/components/base/dialog"
import { Button } from "@govblock/ui/components/nova/button"

// Everything a card's menu can do to the page — edit it, swap it, save it,
// rearrange it, resize it, delete it — belongs to an account. Rather than
// disable those items and say nothing, they open this. Downloading the card's
// own data is the exception, and the menu marks it with a check.

type Gate = { ask: (action: string) => void }
const GateContext = React.createContext<Gate | null>(null)

/** Wrap nothing: the provider owns the dialog and hands children a way to open it. */
export function CardGateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const value = React.useMemo<Gate>(() => ({ ask: () => setOpen(true) }), [])
  return (
    <GateContext.Provider value={value}>
      {children}
      {/* animate-ui's Base UI dialog — the same component and the same flip
          off the top as the Radix one Brendan pointed at, on the primitive
          library the rest of the kit is built from. It carries its own border
          and close cross, and still closes on a click past it. */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPopup from="top" showCloseButton={false} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">Make our home page your home page.</DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              Sign in to rearrange components, add new ones, change metrics, sessions, jurisdiction, or choose a theme.
            </DialogDescription>
          </DialogHeader>
          {/* Two named ways out and no close cross: the pair says what each
              choice does, where a cross only says "go away" (Brendan,
              2026-09-08). A click past the dialog still closes it. */}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button render={<Link href="/auth" />} nativeButton={false} onClick={() => setOpen(false)}>
              Continue
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </GateContext.Provider>
  )
}

/** Null where no provider is mounted, so a card outside the shell still renders. */
export function useCardGate() {
  return React.useContext(GateContext)
}
