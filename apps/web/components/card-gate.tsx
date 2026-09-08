"use client"

import * as React from "react"
import Link from "next/link"

import { Button } from "@govblock/ui/components/nova/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"

// Everything a card's menu can do to the page — edit it, swap it, save it,
// rearrange it, resize it, delete it — belongs to an account. Rather than
// disable those items and say nothing, they open this and say what an account
// is for (Brendan, 2026-09-08). Downloading the card's own data is the
// exception, and the menu marks it with a check.

type Gate = { ask: (action: string) => void }
const GateContext = React.createContext<Gate | null>(null)

/** Wrap nothing: the provider owns the dialog and hands children a way to open it. */
export function CardGateProvider({ children }: { children: React.ReactNode }) {
  const [action, setAction] = React.useState<string | null>(null)
  const value = React.useMemo<Gate>(() => ({ ask: setAction }), [])
  return (
    <GateContext.Provider value={value}>
      {children}
      <Dialog open={action !== null} onOpenChange={(open) => !open && setAction(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{action ? `${action} needs an account` : "Sign in to continue"}</DialogTitle>
            <DialogDescription>
              Reading is open to everyone and always will be. Changing a page — editing a block, swapping one, saving
              your own arrangement — is kept with your account so it is still there tomorrow, on whichever machine you
              open next. Signing up takes a Google account and no more.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button render={<Link href="/auth" />} nativeButton={false}>
              Sign in or sign up
            </Button>
            <Button variant="outline" onClick={() => setAction(null)}>
              Not now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GateContext.Provider>
  )
}

/** Null where no provider is mounted, so a card outside the shell still renders. */
export function useCardGate() {
  return React.useContext(GateContext)
}
